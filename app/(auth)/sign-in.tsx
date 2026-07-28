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
import { signIn } from '@/features/auth/api';
import { signInSchema, type SignInValues } from '@/features/auth/schema';
import { colors, spacing, textStyles } from '@/theme';

/**
 * Sign In (brief Sections 4 & 6). On success the Supabase auth listener updates
 * the session and the root gate routes to the Scanner — no manual navigation
 * needed here.
 */
export default function SignInScreen() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not sign in. Try again.',
      );
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>
              <Text style={{ color: colors.blue }}>PRO</Text>
              <Text style={{ color: colors.grey700 }}>COUNT</Text>
            </Text>
            <Text style={styles.tagline}>Scan. Count. Done.</Text>
          </View>

          <View style={styles.form}>
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
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                />
              )}
            />
            {formError != null && <Text style={styles.formError}>{formError}</Text>}
          </View>

          <View style={styles.actions}>
            <Button label="Sign in" onPress={onSubmit} loading={isSubmitting} />
            <Button
              label="Create an account"
              variant="text"
              onPress={() => router.push('/(auth)/sign-up')}
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
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  wordmark: {
    ...textStyles.heading,
    fontSize: 34,
    letterSpacing: 1,
  },
  tagline: {
    ...textStyles.body,
    color: colors.grey500,
    marginTop: spacing.sm,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  formError: {
    ...textStyles.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
});
