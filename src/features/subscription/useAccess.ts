import { useSubscription } from './SubscriptionProvider';

/**
 * Access gate (brief Section 10, revised per client). Day-one users open the
 * app straight into the trial/subscribe prompt, so access is granted purely by
 * the RevenueCat `procount_pro` entitlement — which includes the store-level
 * 7-day free trial. Without it the user is blocked and routed to the paywall.
 *
 * (The old in-app 7-day trial is retired: the App Store free trial is now the
 * trial, matching the frictionless "open → subscribe/trial → scan" flow.)
 */

export type AccessStatus = 'loading' | 'granted' | 'blocked';

export type AccessState = {
  status: AccessStatus;
  /** Whether a paid/entitled subscription (or store trial) is active. */
  hasActiveSubscription: boolean;
  /** Active entitlement is a store-level free trial. */
  isStoreTrial: boolean;
  /** Retained for callers; always null now the in-app trial is retired. */
  trialDaysLeft: number | null;
};

/**
 * Temporary override for demo/test builds where RevenueCat isn't configured yet
 * — set EXPO_PUBLIC_DISABLE_PAYWALL=true to always grant access so testers
 * aren't locked out. Production leaves this false so the paywall is enforced.
 */
const PAYWALL_DISABLED = process.env.EXPO_PUBLIC_DISABLE_PAYWALL === 'true';

export function useAccess(): AccessState {
  const subscription = useSubscription();

  let status: AccessStatus;
  if (PAYWALL_DISABLED) {
    status = 'granted'; // demo/test builds — bypass the gate entirely
  } else if (subscription.loading) {
    status = 'loading';
  } else {
    status = subscription.entitlementActive ? 'granted' : 'blocked';
  }

  return {
    status,
    hasActiveSubscription: subscription.entitlementActive,
    isStoreTrial: subscription.isStoreTrial,
    trialDaysLeft: null,
  };
}
