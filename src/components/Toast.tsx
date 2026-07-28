import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';

type ToastProps = {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  durationMs?: number;
  tone?: 'success' | 'neutral';
};

/** Bottom-anchored auto-dismissing toast (e.g. export success confirmation). */
export function Toast({
  visible,
  message,
  onDismiss,
  durationMs = 3000,
  tone = 'success',
}: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <View
        style={[
          styles.toast,
          { backgroundColor: tone === 'success' ? colors.success : colors.grey900 },
        ]}
      >
        <Text style={styles.message}>{message}</Text>
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
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
  },
  message: {
    ...textStyles.bodyMedium,
    color: colors.white,
    textAlign: 'center',
  },
});
