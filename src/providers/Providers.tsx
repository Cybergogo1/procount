import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { SubscriptionProvider } from '@/features/subscription/SubscriptionProvider';
import { queryClient } from '@/lib/queryClient';

/**
 * App-wide providers, composed once at the root (app/_layout.tsx).
 * Order: Query (data layer) wraps Auth, which wraps Subscription (needs the
 * authenticated user to init RevenueCat).
 *
 * NB: this lives in src/providers (not src/app) — Expo Router treats a `src/app`
 * directory as a routes root, which would shadow the real routes in /app.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>{children}</SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
