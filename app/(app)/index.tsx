import { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { QuantityControls } from '@/components/QuantityControls';
import { ScanRow } from '@/components/ScanRow';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { Toast } from '@/components/Toast';
import { UndoToast } from '@/components/UndoToast';
import { CalculatorModal } from '@/features/calculator/CalculatorModal';
import { EndSessionSheet } from '@/features/export/EndSessionSheet';
import {
  BarcodeScanner,
  BARCODE_TYPES,
  QR_TYPES,
} from '@/features/scanner/BarcodeScanner';
import { CameraPermissionGate } from '@/features/scanner/CameraPermissionGate';
import { useSessionSync } from '@/features/session/useSessionSync';
import { useAccess } from '@/features/subscription/useAccess';
import { maybeRequestReviewAfterExport } from '@/lib/review';
import {
  useSessionStore,
  useTotalCount,
  type ScanItem,
} from '@/stores/useSessionStore';
import { colors, radii, spacing, textStyles } from '@/theme';

// Auto-1 cooldown between reads (ms) — long enough that a code lingering in
// frame isn't double-counted, short enough for brisk item-to-item scanning.
const AUTO1_COOLDOWN_MS = 800;

/**
 * Scanner (Home) — brief Section 7. Live Zustand store + expo-camera barcode
 * scanning, backed by the Section 7–8 sync layer. A successful read pauses the
 * camera and parks the barcode until the user taps Confirm.
 */
export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAccess();

  const scans = useSessionStore((s) => s.scans);
  const total = useTotalCount();

  // All session writes go through the sync layer (brief Sections 7–8): the store
  // updates instantly and the queue mirrors to Supabase in the background.
  const {
    status: syncStatus,
    sessionReady,
    addScan,
    editScan,
    deleteScan,
    restoreScan,
  } = useSessionSync();
  const sessionId = useSessionStore((s) => s.sessionId);

  // Scan-in-progress state (brief Section 7): a successful read pauses the
  // scanner and parks the barcode until the user taps Confirm. The pending count
  // also tracks its expression (a plain number, or a calculator expression).
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pendingExpression, setPendingExpression] = useState('1');

  const [undo, setUndo] = useState<{ item: ScanItem; index: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Client scanning modes (feedback round 3):
  //  - Auto-1: each read commits qty 1 and stays live for rapid-fire counting.
  //  - Scan mode: toggle the camera between retail barcodes and QR codes.
  const [auto1, setAuto1] = useState(false);
  const [scanMode, setScanMode] = useState<'barcode' | 'qr'>('barcode');

  // Live values for the scan callback, held in refs so the camera handler never
  // goes stale (and we don't re-subscribe the scanner on every render).
  const auto1Ref = useRef(auto1);
  const sessionReadyRef = useRef(sessionReady);
  const addScanRef = useRef(addScan);
  useEffect(() => {
    auto1Ref.current = auto1;
  }, [auto1]);
  useEffect(() => {
    sessionReadyRef.current = sessionReady;
  }, [sessionReady]);
  useEffect(() => {
    addScanRef.current = addScan;
  }, [addScan]);

  // Calculator dialog: 'new' builds the pending count, 'edit' edits a line.
  const [calc, setCalc] = useState<
    { mode: 'new' } | { mode: 'edit'; scan: ScanItem } | null
  >(null);

  // Seed a little demo data in development so the list/total are visible on a
  // simulator. Writes straight to the store (not the sync queue) so it never
  // hits Supabase. Never seeds in production builds.
  useEffect(() => {
    if (__DEV__ && useSessionStore.getState().scans.length === 0) {
      const store = useSessionStore.getState();
      store.addScan({ barcode: '5012345678900', quantity: 3, expression: '3' });
      store.addScan({ barcode: '4006381333931', quantity: 1, expression: '1' });
    }
  }, []);

  const handleScanned = useCallback((barcode: string) => {
    if (auto1Ref.current) {
      // Auto-1 rapid-fire: commit qty 1 immediately and stay live for the next
      // item. BarcodeScanner's cooldown stops the same code counting twice.
      if (sessionReadyRef.current) {
        addScanRef.current({ barcode, quantity: 1, expression: '1' });
      }
      return;
    }
    // Normal mode: park the barcode; the camera pauses until the user confirms.
    // Guard against an in-flight read landing after pause.
    setPendingBarcode((current) => current ?? barcode);
  }, []);

  // Pop the calculator open as soon as a barcode is parked (client request:
  // scan → count). Cancelling it falls back to the +/- stepper.
  useEffect(() => {
    if (pendingBarcode != null) setCalc({ mode: 'new' });
  }, [pendingBarcode]);

  // Dev-only fallback so the flow is testable without a physical camera
  // (simulator / web). Never rendered in production builds.
  const devSimulateScan = () => {
    if (pendingBarcode != null) return;
    handleScanned(
      String(Math.floor(1_000_000_000_000 + Math.random() * 8_999_999_999_999)),
    );
  };

  // Manual +/- keeps the expression in step (a plain number is its own expression).
  const setQuantityManual = (value: number) => {
    setQuantity(value);
    setPendingExpression(String(value));
  };

  const resetPending = () => {
    setPendingBarcode(null);
    setQuantity(1);
    setPendingExpression('1');
  };

  const confirmScan = () => {
    if (pendingBarcode == null || !sessionReady) return;
    addScan({ barcode: pendingBarcode, quantity, expression: pendingExpression });
    resetPending(); // reactivate the scanner for the next item
  };

  // Discard a parked scan (e.g. scanned by mistake) without committing.
  const cancelScan = () => resetPending();

  // Toggle Auto-1. Turning it on clears any parked scan and closes the
  // calculator so continuous scanning starts cleanly.
  const toggleAuto1 = () => {
    const next = !auto1;
    setAuto1(next);
    if (next) {
      resetPending();
      setCalc(null);
    }
  };

  const toggleScanMode = () =>
    setScanMode((m) => (m === 'barcode' ? 'qr' : 'barcode'));

  const handleCalcSave = (expression: string, total: number) => {
    if (calc?.mode === 'edit') {
      editScan(calc.scan.id, total, expression);
      setCalc(null);
      return;
    }

    // 'new' mode: Save commits the scan and re-arms the camera for the next one
    // (client workflow: scan → count → save → next).
    if (pendingBarcode != null && sessionReady) {
      addScan({ barcode: pendingBarcode, quantity: total, expression });
      resetPending();
    } else {
      // Session not ready yet — park the count so the user can confirm shortly.
      setQuantity(total);
      setPendingExpression(expression);
    }
    setCalc(null);
  };

  const handleDelete = useCallback(
    (id: string) => {
      const removed = deleteScan(id);
      if (removed) setUndo(removed);
    },
    [deleteScan],
  );

  const handleUndo = () => {
    if (undo) restoreScan(undo.item, undo.index);
    setUndo(null);
  };

  const handleReportSent = () => {
    // Client request: keep the active count intact after exporting — just close
    // the sheet and confirm. (Use Settings → Start new count to reset.)
    setExportOpen(false);
    setExportSuccess(true);
    // Ask for an app-store review once, after the first successful export.
    void maybeRequestReviewAfterExport();
  };

  const openRowEditor = useCallback((scan: ScanItem) => {
    setCalc({ mode: 'edit', scan });
  }, []);

  // Access gate (brief Section 10). Settings stays reachable; only the Scanner
  // redirects to the paywall when blocked.
  if (status === 'blocked') {
    return <Redirect href="/(app)/paywall" />;
  }
  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  // Pause the camera while a scan is parked, the calculator is up, or the export
  // sheet is open (so nothing is counted behind a modal). Auto-1 keeps it live.
  const scannerActive = pendingBarcode == null && !exportOpen && calc == null;
  const barcodeTypes = scanMode === 'qr' ? QR_TYPES : BARCODE_TYPES;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar (brief Section 7.1). */}
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>
          <Text style={{ color: colors.blue }}>PRO</Text>
          <Text style={{ color: colors.grey700 }}>COUNT</Text>
        </Text>
        <View style={styles.topBarRight}>
          <SyncStatusBadge status={syncStatus} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/(app)/settings')}
            hitSlop={12}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>
      </View>

      {/* Live count — compact line just above the scanner. */}
      <Text style={styles.countLine}>
        {total} item{total === 1 ? '' : 's'} counted
      </Text>

      {/* Live camera viewfinder (brief Section 7.3). */}
      <View style={styles.viewfinder}>
        <CameraPermissionGate>
          <BarcodeScanner
            active={scannerActive}
            onScan={handleScanned}
            barcodeTypes={barcodeTypes}
            autoRearmMs={auto1 ? AUTO1_COOLDOWN_MS : undefined}
            style={StyleSheet.absoluteFill}
          />
        </CameraPermissionGate>

        {/* Scan-mode toggle (client request). The label shows the mode you'll
            switch TO: "QR" while scanning barcodes, "Barcode" while in QR. */}
        <Pressable
          onPress={toggleScanMode}
          style={styles.scanModeToggle}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${
            scanMode === 'barcode' ? 'QR code' : 'barcode'
          } scanning`}
        >
          <Text style={styles.scanModeText}>
            ⇄ {scanMode === 'barcode' ? 'QR' : 'Barcode'}
          </Text>
        </Pressable>

        {pendingBarcode != null && (
          <View style={styles.pendingBadge} pointerEvents="none">
            <Text style={styles.pendingBarcode}>{pendingBarcode}</Text>
          </View>
        )}

        {__DEV__ && (
          <Pressable
            style={styles.devButton}
            onPress={devSimulateScan}
            accessibilityRole="button"
            accessibilityLabel="Developer: simulate scan"
          >
            <Text style={styles.devButtonText}>DEV: simulate scan</Text>
          </Pressable>
        )}
      </View>

      {/* Quantity + Confirm (brief Section 7.4–7.5). Calculator button opens the
          +/× count calculator for complex stacks (client request). Auto-1
          (client request) skips all of this and counts 1 per scan. */}
      <View style={styles.controls}>
        {/* Auto-1 rapid-fire toggle (left). */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={toggleAuto1}
            style={[styles.auto1, auto1 && styles.auto1On]}
            accessibilityRole="switch"
            accessibilityState={{ checked: auto1 }}
            accessibilityLabel="Auto-1 rapid scanning"
          >
            <Text style={[styles.auto1Label, auto1 && styles.auto1LabelOn]}>
              ⚡ Auto-1 {auto1 ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
          {auto1 && (
            <Text style={styles.auto1Hint} numberOfLines={2}>
              Each scan adds 1 — just keep scanning.
            </Text>
          )}
        </View>

        {/* Manual counting controls — hidden in Auto-1 mode. */}
        {!auto1 && (
          <>
            <View style={styles.quantityRow}>
              <View style={styles.quantityControls}>
                <QuantityControls value={quantity} onChange={setQuantityManual} />
              </View>
              <Pressable
                style={styles.calcButton}
                onPress={() => setCalc({ mode: 'new' })}
                accessibilityRole="button"
                accessibilityLabel="Open calculator"
              >
                <Text style={styles.calcButtonIcon}>🧮</Text>
              </Pressable>
            </View>
            {/* Show the working when the count came from the calculator. */}
            {/\d[+×]/.test(pendingExpression) && (
              <Text style={styles.expressionHint} numberOfLines={1}>
                {pendingExpression} = {quantity}
              </Text>
            )}
            {pendingBarcode == null ? (
              <Button label="Scan an item to count" large disabled onPress={confirmScan} />
            ) : (
              <View style={styles.confirmRow}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  large
                  onPress={cancelScan}
                  style={styles.cancelButton}
                />
                <Button
                  label={sessionReady ? 'Confirm' : 'Connecting…'}
                  large
                  onPress={confirmScan}
                  disabled={!sessionReady}
                  style={styles.confirmButton}
                />
              </View>
            )}
          </>
        )}
      </View>

      {/* Recent scans (brief Section 7.6). The labelled header makes it clear
          this is a scrollable list and shows how many items are in it. */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderLabel}>RECENT SCANS</Text>
        {scans.length > 0 && (
          <Text style={styles.listHeaderCount}>{scans.length}</Text>
        )}
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={scans.length === 0 && styles.listEmptyContent}
        data={scans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ScanRow
            scan={item}
            onEditQuantity={openRowEditor}
            onDelete={handleDelete}
          />
        )}
        indicatorStyle="black"
        ListEmptyComponent={
          <Text style={styles.empty}>No scans yet. Point the camera at a barcode to start.</Text>
        }
      />

      {/* Export the count (Section 8: hold while writes drain so the server
          reads a fully-synced count). The session is kept after exporting. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label={
            syncStatus === 'syncing'
              ? 'Saving — just a moment…'
              : 'Export Count'
          }
          variant="secondary"
          disabled={syncStatus === 'syncing' || scans.length === 0}
          onPress={() => setExportOpen(true)}
        />
      </View>

      <UndoToast
        visible={undo != null}
        message="Removed"
        onUndo={handleUndo}
        onDismiss={() => setUndo(null)}
      />

      <Toast
        visible={exportSuccess}
        message="Report sent"
        onDismiss={() => setExportSuccess(false)}
      />

      <EndSessionSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        sessionId={sessionId}
        totalItems={total}
        lineItems={scans.length}
        onSent={handleReportSent}
      />

      {/* Count calculator — for the in-progress scan ('new') and row edits. */}
      <CalculatorModal
        visible={calc != null}
        title={calc?.mode === 'edit' ? calc.scan.barcode : 'Count'}
        initialExpression={calc?.mode === 'edit' ? calc.scan.expression : ''}
        onCancel={() => setCalc(null)}
        onSave={handleCalcSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  wordmark: {
    ...textStyles.heading,
    fontSize: 22,
    letterSpacing: 0.5,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsIcon: {
    fontSize: 24,
    color: colors.grey700,
  },
  countLine: {
    ...textStyles.bodyMedium,
    color: colors.grey700,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  viewfinder: {
    // Enlarged to fill the space the big count number used to take.
    flex: 2,
    marginHorizontal: spacing.xl,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.grey900,
  },
  pendingBadge: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scanModeToggle: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanModeText: {
    ...textStyles.bodyMedium,
    color: colors.white,
    fontSize: 14,
  },
  pendingBarcode: {
    ...textStyles.caption,
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  devButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(46,46,190,0.85)',
  },
  devButtonText: {
    ...textStyles.caption,
    color: colors.white,
  },
  controls: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  auto1: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.grey300,
    backgroundColor: colors.white,
  },
  auto1On: {
    borderColor: colors.blue,
    backgroundColor: colors.blueTint,
  },
  auto1Label: {
    ...textStyles.bodyMedium,
    color: colors.grey700,
  },
  auto1LabelOn: {
    color: colors.blue,
  },
  auto1Hint: {
    ...textStyles.caption,
    color: colors.grey500,
    flex: 1,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityControls: {
    flex: 1,
  },
  calcButton: {
    width: 56,
    height: 56,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.grey300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcButtonIcon: {
    fontSize: 24,
  },
  expressionHint: {
    ...textStyles.caption,
    color: colors.grey500,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 2,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.grey100,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.grey300,
  },
  listHeaderLabel: {
    ...textStyles.sectionLabel,
    color: colors.grey700,
  },
  listHeaderCount: {
    ...textStyles.sectionLabel,
    color: colors.grey500,
  },
  list: {
    flex: 1,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    ...textStyles.body,
    color: colors.grey500,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.grey300,
  },
});
