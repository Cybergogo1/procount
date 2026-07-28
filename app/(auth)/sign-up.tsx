import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { signUp } from '@/features/auth/api';
import { signUpSchema, type SignUpValues } from '@/features/auth/schema';
import { colors, spacing, textStyles } from '@/theme';

/**
 * Sign Up (brief Sections 4 & 6). Email confirmation is required before first
 * sign-in, so a successful sign-up shows a "check your email" state rather than
 * dropping straight into the app.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { needsConfirmation } = await signUp(values);
      if (needsConfirmation) {
        setConfirmationEmail(values.email);
      }
      // If confirmation is disabled, the auth listener picks up the new session
      // and the root gate routes into the app automatically.
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not sign up. Try again.',
      );
    }
  });

  if (confirmationEmail != null) {
    return (
      <Screen>
        <View style={styles.confirmContainer}>
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.confirmBody}>
            We sent a confirmation link to{' '}
            <Text style={styles.email}>{confirmationEmail}</Text>. Confirm your
            address, then sign in to start your 7-day free trial.
          </Text>
          <Button label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.form}>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subhead}>Starts a 7-day free trial.</Text>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                />
              )}
            />
            {formError != null && <Text style={styles.formError}>{formError}</Text>}
          </View>

          <View style={styles.actions}>
            <Button label="Create account" onPress={onSubmit} loading={isSubmitting} />
            <Button
              label="I already have an account"
              variant="text"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  heading: {
    ...textStyles.heading,
    color: colors.grey900,
  },
  subhead: {
    ...textStyles.body,
    color: colors.grey500,
    marginTop: -spacing.sm,
  },
  formError: {
    ...textStyles.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
  confirmContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  confirmBody: {
    ...textStyles.body,
    color: colors.grey700,
  },
  email: {
    ...textStyles.bodyMedium,
    color: colors.grey900,
  },
});
