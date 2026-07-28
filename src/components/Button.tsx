import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, sizes, textStyles } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'text';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Use the taller 64px height for the scanner Confirm action. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The single dominant CTA pattern from the brief (Section 3): one blue primary
 * per screen, secondary is white-with-blue-border, text is link-style.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  large = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { height: large ? sizes.confirmButtonHeight : sizes.primaryButtonHeight },
        variantContainer[variant],
        pressed && !isDisabled && variantPressed[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.blue}
        />
      ) : (
        <View style={styles.contentRow}>
          <Text style={[styles.label, variantLabel[variant]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...textStyles.button,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantContainer: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.blue },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  text: { backgroundColor: 'transparent' },
};

const variantPressed: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.blueDark },
  secondary: { backgroundColor: colors.blueTint },
  text: { opacity: 0.6 },
};

const variantLabel: Record<ButtonVariant, { color: string }> = {
  primary: { color: colors.white },
  secondary: { color: colors.blue },
  text: { color: colors.blue },
};
