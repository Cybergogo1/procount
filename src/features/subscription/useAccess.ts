import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { getProfile } from './api';
import { useSubscription } from './SubscriptionProvider';

/**
 * Access gate (brief Section 10). The user may use the gated surfaces (Scanner
 * + export) when EITHER:
 *   - they are inside the 7-day in-app trial (`trial_started_at + 7d > now`), OR
 *   - the RevenueCat `procount_pro` entitlement is active (incl. store-level
 *     free trial, which takes precedence over the in-app trial field).
 *
 * Otherwise they are blocked and routed to the paywall.
 */

export type AccessStatus = 'loading' | 'granted' | 'blocked';

export type AccessState = {
  status: AccessStatus;
  /** Whether a paid/entitled subscription (or store trial) is active. */
  hasActiveSubscription: boolean;
  /** Active entitlement is a store-level free trial. */
  isStoreTrial: boolean;
  /** Days left in the in-app trial, or null if not in the in-app trial. */
  trialDaysLeft: number | null;
};

const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Temporary override for demo/test builds where RevenueCat isn't configured yet
 * — set EXPO_PUBLIC_DISABLE_PAYWALL=true to always grant access so testers
 * aren't locked out when the trial lapses. Remove (or set false) once real
 * subscriptions are wired up (Section 10).
 */
const PAYWALL_DISABLED = process.env.EXPO_PUBLIC_DISABLE_PAYWALL === 'true';

export function useAccess(): AccessState {
  const { user } = useAuth();
  const subscription = useSubscription();

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });

  const profile = profileQuery.data;

  let trialDaysLeft: number | null = null;
  let localTrialActive = false;
  if (profile) {
    const msLeft =
      new Date(profile.trial_started_at).getTime() + TRIAL_MS - Date.now();
    localTrialActive = msLeft > 0;
    trialDaysLeft = localTrialActive ? Math.ceil(msLeft / DAY_MS) : null;
  } else if (profileQuery.isError) {
    // Fail open if the profile can't be loaded (e.g. offline) so a legitimate
    // trial/paid user is never locked out by a transient error. The gate is
    // re-evaluated on reconnect/foreground.
    localTrialActive = true;
  }

  const stillLoading =
    subscription.loading || (!!user && profileQuery.isLoading);

  const granted = subscription.entitlementActive || localTrialActive;

  let status: AccessStatus;
  if (PAYWALL_DISABLED) {
    status = 'granted'; // demo/test builds — bypass the gate entirely
  } else if (stillLoading) {
    status = 'loading';
  } else {
    status = granted ? 'granted' : 'blocked';
  }

  return {
    status,
    hasActiveSubscription: subscription.entitlementActive,
    isStoreTrial: subscription.isStoreTrial,
    trialDaysLeft,
  };
}
