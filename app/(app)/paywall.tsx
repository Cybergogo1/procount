import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Image, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useSubscription } from '@/features/subscription/SubscriptionProvider';
import { colors, spacing, textStyles } from '@/theme';

// Combined Privacy Policy + Terms of Service page (provided by the client).
const TERMS_URL = 'https://www.procountusa.com/privacy';
const PRIVACY_URL = 'https://www.procountusa.com/privacy';

/**
 * Paywall (brief Sections 4 & 10). The price string is pulled from the
 * RevenueCat offering — never hardcoded. Subscribing or restoring updates the
 * entitlement, after which the access gate lets the user back into the Scanner.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const { offering, purchase, restore, available } = useSubscription();
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  const pkg = offering?.availablePackages[0] ?? null;
  const priceString = pkg?.product.priceString;

  const goBackIfAllowed = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)');
  };

  const handleSubscribe = async () => {
    if (!pkg) {
      Alert.alert(
        'Unavailable',
        'Subscriptions aren’t available right now. Please try again later.',
      );
      return;
    }
    setBusy('purchase');
    try {
      await purchase(pkg);
      // Entitlement now active — return to the app.
      goBackIfAllowed();
    } catch (err) {
      // RevenueCat throws userCancelled when the user backs out of the sheet.
      const cancelled =
        typeof err === 'object' && err !== null && 'userCancelled' in err &&
        (err as { userCancelled?: boolean }).userCancelled;
      if (!cancelled) {
        Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    setBusy('restore');
    try {
      await restore();
      goBackIfAllowed();
    } catch {
      Alert.alert('Restore failed', 'We couldn’t restore your purchases.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.body}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="ProCount"
          />
          <Text style={styles.heading}>Keep counting</Text>
          <Text style={styles.paragraph}>
            Unlimited scanning, email exports, and every feature. One simple
            subscription.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={
              priceString
                ? `Subscribe for ${priceString}/month`
                : 'Subscribe'
            }
            onPress={handleSubscribe}
            loading={busy === 'purchase'}
            disabled={busy !== null || (available && !pkg)}
          />
          <Button
            label="Restore Purchases"
            variant="text"
            onPress={handleRestore}
            loading={busy === 'restore'}
            disabled={busy !== null}
          />

          {!available && (
            <Text style={styles.devNote}>
              RevenueCat isn’t configured in this build.
            </Text>
          )}

          <View style={styles.legalRow}>
            <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>
              Terms
            </Text>
            <Text style={styles.legalDot}>·</Text>
            <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
              Privacy
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 62, // 220 / 3.56 aspect ratio
    marginBottom: spacing.xl,
  },
  heading: {
    ...textStyles.heading,
    fontSize: 30,
    color: colors.grey900,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  paragraph: {
    ...textStyles.body,
    color: colors.grey700,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  devNote: {
    ...textStyles.caption,
    color: colors.grey500,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legalLink: {
    ...textStyles.caption,
    color: colors.grey500,
    textDecorationLine: 'underline',
  },
  legalDot: {
    ...textStyles.caption,
    color: colors.grey500,
  },
});
