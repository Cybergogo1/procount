import { useCallback, useEffect, useState } from 'react';
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
import { BarcodeScanner } from '@/features/scanner/BarcodeScanner';
import { CameraPermissionGate } from '@/features/scanner/CameraPermissionGate';
import { useSessionSync } from '@/features/session/useSessionSync';
import { useAccess } from '@/features/subscription/useAccess';
import {
  useSessionStore,
  useTotalCount,
  type ScanItem,
} from '@/stores/useSessionStore';
import { colors, radii, spacing, textStyles } from '@/theme';

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
    resetForNewSession,
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

  const handleScanned = useCallback(
    (barcode: string) => {
      // The camera is paused by the parent once a barcode is pending, but guard
      // here too against an in-flight read landing after pause.
      setPendingBarcode((current) => current ?? barcode);
    },
    [],
  );

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

  const handleExported = () => {
    // Brief Section 9, step 5: clear the screen and start a new session.
    setExportOpen(false);
    resetForNewSession();
    setExportSuccess(true);
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
            active={pendingBarcode == null}
            onScan={handleScanned}
            style={StyleSheet.absoluteFill}
          />
        </CameraPermissionGate>

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
          +/× count calculator for complex stacks (client request). */}
      <View style={styles.controls}>
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

      {/* End session (brief Sections 7.7 & 8: hold while writes drain). */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label={
            syncStatus === 'syncing'
              ? 'Finishing up — just a moment…'
              : 'End Session & Export'
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
        message="Report sent — new session started"
        onDismiss={() => setExportSuccess(false)}
      />

      <EndSessionSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        sessionId={sessionId}
        totalItems={total}
        lineItems={scans.length}
        onExported={handleExported}
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
