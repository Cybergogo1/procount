import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  /** Which edges to apply safe-area insets to. Defaults to all. */
  edges?: readonly Edge[];
  /** Disable the default horizontal padding (e.g. full-bleed camera screens). */
  padded?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

/** Standard screen container: safe-area aware, light background. */
export function Screen({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  padded = true,
  backgroundColor = colors.white,
  style,
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor }]}>
      <View style={[styles.inner, padded && styles.padded, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.xl,
  },
});
