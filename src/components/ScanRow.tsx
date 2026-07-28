import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ScanItem } from '@/stores/useSessionStore';
import { formatScanTime } from '@/lib/format';
import { colors, radii, spacing, textStyles } from '@/theme';

type ScanRowProps = {
  scan: ScanItem;
  onEditQuantity: (scan: ScanItem) => void;
  onDelete: (id: string) => void;
};

/**
 * A row in the recent-scans list (brief Section 7.6): barcode, exact timestamp,
 * the quantity (tap to edit in a centred dialog — see the scanner screen), and
 * a trash icon. Memoised since the list can grow long within a session.
 */
function ScanRowComponent({ scan, onEditQuantity, onDelete }: ScanRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.barcode} numberOfLines={1}>
          {scan.barcode}
        </Text>
        {/* Show the working when the count came from a calculation. */}
        {/\d[+×]/.test(scan.expression) ? (
          <Text style={styles.expression} numberOfLines={1}>
            {scan.expression}
          </Text>
        ) : (
          <Text style={styles.time}>{formatScanTime(scan.scannedAt)}</Text>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.qtyBox, pressed && styles.qtyBoxPressed]}
        onPress={() => onEditQuantity(scan)}
        accessibilityRole="button"
        accessibilityLabel={`Quantity ${scan.quantity}, tap to edit`}
      >
        <Text style={styles.qtyText}>×{scan.quantity}</Text>
      </Pressable>

      <Pressable
        onPress={() => onDelete(scan.id)}
        accessibilityRole="button"
        accessibilityLabel={`Delete scan ${scan.barcode}`}
        hitSlop={10}
        style={({ pressed }) => [styles.trash, pressed && styles.trashPressed]}
      >
        <Text style={styles.trashIcon}>🗑</Text>
      </Pressable>
    </View>
  );
}

export const ScanRow = memo(ScanRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey300,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  barcode: {
    ...textStyles.bodyMedium,
    color: colors.grey900,
  },
  time: {
    ...textStyles.caption,
    color: colors.grey500,
    fontVariant: ['tabular-nums'],
  },
  expression: {
    ...textStyles.caption,
    color: colors.blue,
    fontVariant: ['tabular-nums'],
  },
  qtyBox: {
    minWidth: 56,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    backgroundColor: colors.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBoxPressed: {
    backgroundColor: colors.grey300,
  },
  qtyText: {
    ...textStyles.bodyMedium,
    color: colors.blue,
  },
  trash: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
  },
  trashPressed: {
    backgroundColor: colors.grey100,
  },
  trashIcon: {
    fontSize: 18,
  },
});
