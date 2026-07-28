import { Stack } from 'expo-router';

import { colors } from '@/theme';

/**
 * Unauthenticated stack (brief Section 4: auth screens are a separate stack).
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
