import { StyleSheet, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

import { Button } from '@/components/Button';
import { colors, spacing, textStyles } from '@/theme';

/**
 * Friendly fallback for unexpected render errors (brief Section 12: error
 * states). Wired up by re-exporting it as `ErrorBoundary` from the root layout,
 * so Expo Router uses it instead of the default red box.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        ProCount hit an unexpected error. Your synced counts are safe.
      </Text>
      {__DEV__ && <Text style={styles.detail}>{error.message}</Text>}
      <Button label="Try again" onPress={() => void retry()} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.white,
  },
  title: {
    ...textStyles.heading,
    color: colors.grey900,
    textAlign: 'center',
  },
  body: {
    ...textStyles.body,
    color: colors.grey700,
    textAlign: 'center',
  },
  detail: {
    ...textStyles.caption,
    color: colors.grey500,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
});
