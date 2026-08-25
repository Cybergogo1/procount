import { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
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
import { ManualAddSheet } from '@/features/scanner/ManualAddSheet';
import { useSessionSync } from '@/features/session/useSessionSync';
import { useAccess } from '@/features/subscription/useAccess';
import { maybeRequestReviewAfterExport } from '@/lib/review';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  useSessionStore,
  useTotalCount,
  type ScanItem,
} from '@/stores/useSessionStore';
import { colors, radii, spacing, textStyles } from '@/theme';

// Auto-1 cooldown between reads (ms) — long enough that a code lingering in
// frame isn't double-counted, short enough for brisk item-to-item scanning.
const AUTO1_COOLDOWN_MS = 800;

// How many recent scans the main screen previews before "View all" (client
// request: main = short preview, the full searchable list lives on its own screen).
const RECENT_PREVIEW_COUNT = 20;

/**
 * Scanner (Home) — brief Section 7. Live Zustand store + expo-camera barcode
 * scanning, backed by the Section 7–8 sync layer. A successful read pauses the
 * camera and parks the barcode until the user taps Confirm.
 */
export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAccess();

  // Track focus so the camera pauses when another screen (Settings / View all)
  // is on top — otherwise it could keep counting behind them.
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

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

  // Auto-1: each read commits qty 1 and stays live for rapid-fire counting.
  const [auto1, setAuto1] = useState(false);
  // Torch (client request) — rear-camera light for scanning in poor conditions.
  const [torch, setTorch] = useState(false);
  // Manual add (client request) — enter an item that can't be scanned.
  const [manualAdd, setManualAdd] = useState(false);
  // Scan mode (barcode vs QR) now lives in Settings and persists across launches.
  const scanMode = useSettingsStore((s) => s.scanMode);

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
  // scan → count). Cancelling it discards the parked scan.
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

  // Pause the camera while a scan is parked, the calculator/export sheet is up,
  // or the screen isn't focused (e.g. Settings or View all is open) — so nothing
  // is counted behind another screen. Auto-1 keeps it live otherwise.
  const scannerActive =
    isFocused && pendingBarcode == null && !exportOpen && calc == null;
  const barcodeTypes = scanMode === 'qr' ? QR_TYPES : BARCODE_TYPES;
  const recentPreview = scans.slice(0, RECENT_PREVIEW_COUNT);

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
            enableTorch={torch}
            style={StyleSheet.absoluteFill}
          />
        </CameraPermissionGate>

        {/* QR mode is set in Settings now (client request) — a small badge keeps
            it visible while scanning so it's clear which mode is active. */}
        {scanMode === 'qr' && (
          <View style={styles.modeBadge} pointerEvents="none">
            <Text style={styles.modeBadgeText}>QR mode</Text>
          </View>
        )}

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

      {/* Quick action row (client request): Auto-1, Flashlight, Manual add,
          Calculator — left to right. Auto-1 & Flashlight are toggles (lit when
          active); Manual add and Calculator open their respective flows. */}
      <View style={styles.controls}>
        <View style={styles.actionRow}>
          <QuickAction
            icon="⚡"
            label="Auto-1"
            active={auto1}
            onPress={toggleAuto1}
            accessibilityLabel={`Auto-1 rapid scanning ${auto1 ? 'on' : 'off'}`}
          />
          <QuickAction
            icon="🔦"
            label="Light"
            active={torch}
            onPress={() => setTorch((t) => !t)}
            accessibilityLabel={`Torch ${torch ? 'on' : 'off'}`}
          />
          <QuickAction
            icon="＋"
            label="Add"
            onPress={() => setManualAdd(true)}
            accessibilityLabel="Add an item manually"
          />
          <QuickAction
            icon="🧮"
            label="Calc"
            onPress={() => setCalc({ mode: 'new' })}
            accessibilityLabel="Open calculator"
          />
        </View>

        {/* Auto-1 status, or confirm/cancel a parked scan (manual mode). */}
        {auto1 ? (
          <Text style={styles.auto1Hint} numberOfLines={1}>
            ⚡ Auto-1 on — each scan adds 1.
          </Text>
        ) : (
          <>
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

      {/* Recent scans (brief Section 7.6) — a short preview. "View all" opens the
          full searchable list (client request). */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderLabel}>
          RECENT SCANS{scans.length > 0 ? ` (${scans.length})` : ''}
        </Text>
        {scans.length > 0 && (
          <Pressable
            onPress={() => router.push('/(app)/scans')}
            accessibilityRole="button"
            accessibilityLabel="View all scans"
            hitSlop={8}
          >
            <Text style={styles.viewAll}>View all ›</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={scans.length === 0 && styles.listEmptyContent}
        data={recentPreview}
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
        ListFooterComponent={
          scans.length > recentPreview.length ? (
            <Pressable
              style={styles.viewAllFooter}
              onPress={() => router.push('/(app)/scans')}
              accessibilityRole="button"
            >
              <Text style={styles.viewAllFooterText}>
                View all {scans.length} scans ›
              </Text>
            </Pressable>
          ) : null
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

      {/* Manual add — type a barcode/SKU that won't scan (client request). */}
      <ManualAddSheet
        visible={manualAdd}
        onClose={() => setManualAdd(false)}
        onAdd={addScan}
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

/** One cell of the quick action row: an icon + label, lit when `active`. */
function QuickAction({
  icon,
  label,
  active = false,
  onPress,
  accessibilityLabel,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.action,
        active && styles.actionOn,
        pressed && styles.actionPressed,
      ]}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={[styles.actionLabel, active && styles.actionLabelOn]}>
        {label}
      </Text>
    </Pressable>
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
  modeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(46,46,190,0.85)',
  },
  modeBadgeText: {
    ...textStyles.caption,
    color: colors.white,
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    height: 60,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.grey300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionOn: {
    borderColor: colors.blue,
    backgroundColor: colors.blueTint,
  },
  actionPressed: {
    backgroundColor: colors.grey100,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionLabel: {
    ...textStyles.caption,
    color: colors.grey700,
  },
  actionLabelOn: {
    color: colors.blue,
  },
  auto1Hint: {
    ...textStyles.caption,
    color: colors.grey500,
    textAlign: 'center',
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
  viewAll: {
    ...textStyles.sectionLabel,
    color: colors.blue,
  },
  viewAllFooter: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  viewAllFooterText: {
    ...textStyles.bodyMedium,
    color: colors.blue,
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
