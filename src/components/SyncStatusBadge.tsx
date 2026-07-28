import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { SyncStatus } from '@/features/session/types';
import { colors, radii, spacing, textStyles } from '@/theme';

/**
 * Small top-bar indicator (brief Section 8): "Syncing…" while writes are
 * pending, "Synced" when the queue is empty.
 */
export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const syncing = status === 'syncing';

  return (
    <View style={styles.container}>
      {syncing ? (
        <ActivityIndicator size="small" color={colors.grey500} />
      ) : (
        <View style={styles.dot} />
      )}
      <Text style={styles.label}>{syncing ? 'Syncing…' : 'Synced'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.grey100,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  label: {
    ...textStyles.caption,
    color: colors.grey700,
  },
});
