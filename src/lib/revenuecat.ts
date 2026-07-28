import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesEntitlementInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

/**
 * RevenueCat wrapper (brief Section 10). A single entitlement (`procount_pro`)
 * unlocks everything. Public SDK keys come from EXPO_PUBLIC_* env (one per
 * platform). If no key is configured the wrapper degrades gracefully — every
 * call is a safe no-op — so the app still runs in dev without RevenueCat set up
 * (trial access is then driven purely by the profile's trial_started_at).
 */

export const ENTITLEMENT_ID = 'procount_pro';

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY,
});

let configured = false;

export function isRevenueCatAvailable(): boolean {
  return !!apiKey;
}

/**
 * Configure RevenueCat with the Supabase user id as the App User ID (brief
 * Section 10). Safe to call on every auth change — switches user via logIn once
 * configured. Returns whether RevenueCat is usable.
 */
export async function configureRevenueCat(userId: string): Promise<boolean> {
  if (!apiKey) return false;

  try {
    if (!configured) {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({ apiKey, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
    return true;
  } catch {
    return false;
  }
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function getProEntitlement(
  info: CustomerInfo | null,
): PurchasesEntitlementInfo | undefined {
  return info?.entitlements.active[ENTITLEMENT_ID];
}

export function isProActive(info: CustomerInfo | null): boolean {
  return getProEntitlement(info)?.isActive === true;
}

/** The current offering (its packages carry the dynamic price string). */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  return Purchases.restorePurchases();
}

export function addCustomerInfoListener(
  listener: (info: CustomerInfo) => void,
): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}
