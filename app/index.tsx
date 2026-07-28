import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Entry route. The root layout holds the splash until auth resolves, so by the
 * time this renders we know which stack to land on (brief Section 6).
 */
export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/(app)' : '/(auth)/sign-in'} />;
}
