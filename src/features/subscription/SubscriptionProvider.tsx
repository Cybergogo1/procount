import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  addCustomerInfoListener,
  configureRevenueCat,
  getCurrentOffering,
  getCustomerInfoSafe,
  getProEntitlement,
  isProActive,
  isRevenueCatAvailable,
  purchasePackage,
  restorePurchases,
} from '@/lib/revenuecat';

type SubscriptionContextValue = {
  /** True while RevenueCat is initialising / fetching customer info. */
  loading: boolean;
  /** Whether the `procount_pro` entitlement is currently active. */
  entitlementActive: boolean;
  /** Active entitlement is a store-level free trial (periodType TRIAL). */
  isStoreTrial: boolean;
  /** Current offering — its packages carry the dynamic price string. */
  offering: PurchasesOffering | null;
  /** Whether RevenueCat keys are configured at all. */
  available: boolean;
  refresh: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  /** Resolves true when an active pro entitlement was restored. */
  restore: () => Promise<boolean>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
);

/**
 * Initialises RevenueCat for the signed-in user and tracks entitlement state
 * (brief Section 10). Re-checks on app foreground and via the customer-info
 * listener so a purchase made anywhere reflects immediately.
 */
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const configuredUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const info = await getCustomerInfoSafe();
    setCustomerInfo(info);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setCustomerInfo(null);
      setOffering(null);
      setLoading(false);
      configuredUserId.current = null;
      return;
    }

    setLoading(true);
    (async () => {
      await configureRevenueCat(user.id);
      configuredUserId.current = user.id;
      const [info, current] = await Promise.all([
        getCustomerInfoSafe(),
        getCurrentOffering(),
      ]);
      if (cancelled) return;
      setCustomerInfo(info);
      setOffering(current);
      setLoading(false);
    })();

    // Reflect purchases/renewals pushed by the SDK.
    const removeListener = addCustomerInfoListener((info) => {
      setCustomerInfo(info);
    });

    return () => {
      cancelled = true;
      removeListener();
    };
  }, [user]);

  // Re-check entitlement when returning to the foreground (brief Section 10).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && configuredUserId.current) {
        void refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      const info = await purchasePackage(pkg);
      setCustomerInfo(info);
    },
    [],
  );

  const restore = useCallback(async () => {
    const info = await restorePurchases();
    if (info) setCustomerInfo(info);
    return isProActive(info);
  }, []);

  const value = useMemo<SubscriptionContextValue>(() => {
    const entitlement = getProEntitlement(customerInfo);
    return {
      loading,
      entitlementActive: isProActive(customerInfo),
      isStoreTrial: entitlement?.periodType === 'TRIAL',
      offering,
      available: isRevenueCatAvailable(),
      refresh,
      purchase,
      restore,
    };
  }, [loading, customerInfo, offering, refresh, purchase, restore]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return ctx;
}
