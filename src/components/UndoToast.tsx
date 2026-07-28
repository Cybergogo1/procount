import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';

type UndoToastProps = {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** Auto-dismiss window in ms (brief Section 7: 4-second undo window). */
  durationMs?: number;
};

/**
 * Bottom-anchored toast with an undo action. Auto-dismisses after `durationMs`.
 * Used for the instant-delete flow (no confirmation modal, per the brief).
 */
export function UndoToast({
  visible,
  message,
  onUndo,
  onDismiss,
  durationMs = 4000,
}: UndoToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.toast}>
        <Text style={styles.message}>{message}</Text>
        <Pressable onPress={onUndo} hitSlop={8} accessibilityRole="button">
          <Text style={styles.undo}>UNDO</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.grey900,
    gap: spacing.lg,
  },
  message: {
    ...textStyles.bodyMedium,
    color: colors.white,
    flexShrink: 1,
  },
  undo: {
    ...textStyles.button,
    color: colors.blueTint,
  },
});
