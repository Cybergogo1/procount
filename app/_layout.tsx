import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Oswald_500Medium,
  Oswald_600SemiBold,
} from '@expo-google-fonts/oswald';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { Providers } from '@/providers/Providers';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme';

// Expo Router renders this for uncaught errors instead of the default red box.
export { ErrorBoundary } from '@/components/AppErrorBoundary';

// Keep the native splash visible until fonts AND the auth session are ready, so
// the first paint lands on the correct screen (brief Section 1: feel ready).
void SplashScreen.preventAutoHideAsync();

/**
 * Redirects the user into the correct stack based on auth state, and keeps them
 * out of the wrong one (e.g. a signed-in user can't sit on the auth screens).
 */
function useAuthGate(ready: boolean) {
  const { session, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready || initializing) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [ready, initializing, session, segments, router]);
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { initializing } = useAuth();
  const ready = fontsReady && !initializing;

  useAuthGate(ready);

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  // Hold on the native splash until fonts + session are resolved.
  if (!ready) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.white },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Oswald_500Medium,
    Oswald_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // fontError lets us fall through to system fonts rather than hang forever.
  const fontsReady = fontsLoaded || fontError != null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Providers>
          <RootNavigator fontsReady={fontsReady} />
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
