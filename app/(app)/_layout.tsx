import { Stack } from 'expo-router';

import { colors } from '@/theme';

/**
 * Authenticated stack. This is where the subscription gate lives
 * (brief Sections 10 & 12). For now access is always granted — real trial /
 * RevenueCat entitlement checks arrive in Section 10. Settings and Paywall are
 * presented as modal sheets over the Scanner.
 */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      {/* Paywall is a hard gate (not a dismissable modal) — a swipe-down would
          just bounce back via the access redirect. */}
      <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
