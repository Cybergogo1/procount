import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

/** Labelled text input with inline validation error (used by the auth forms). */
export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, style, ...inputProps }, ref) => {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.grey500}
          style={[styles.input, error != null && styles.inputError, style]}
          {...inputProps}
        />
        {error != null && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  },
);

TextField.displayName = 'TextField';

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...textStyles.label,
    color: colors.grey700,
  },
  input: {
    ...textStyles.body,
    color: colors.grey900,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.grey300,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    ...textStyles.caption,
    color: colors.danger,
  },
});
