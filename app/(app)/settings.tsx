import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { startNewCount } from '@/features/session/startNewCount';
import { useSubscription } from '@/features/subscription/SubscriptionProvider';
import { useAccess } from '@/features/subscription/useAccess';
import { colors, radii, spacing, textStyles } from '@/theme';

const SUPPORT_EMAIL = 'support@procount.app';
const MANAGE_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
  default: 'https://apps.apple.com/account/subscriptions',
});

/** Subscription status row text (brief Section 11). */
function subscriptionLabel(access: ReturnType<typeof useAccess>): string {
  if (access.status === 'loading') return 'Checking…';
  if (access.hasActiveSubscription) {
    return access.isStoreTrial ? 'Free trial' : 'Active subscription';
  }
  if (access.trialDaysLeft != null) {
    return `Trial — ${access.trialDaysLeft} day${access.trialDaysLeft === 1 ? '' : 's'} left`;
  }
  return 'No active subscription';
}

/**
 * Settings (brief Section 11). Account email + sign-out are live; subscription
 * status, manage and restore are wired to RevenueCat.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const access = useAccess();
  const { restore } = useSubscription();
  const [signingOut, setSigningOut] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleManage = () => {
    if (MANAGE_URL) void Linking.openURL(MANAGE_URL);
  };

  const handleNewCount = () => {
    Alert.alert(
      'Start a new count?',
      'This clears the current count and starts fresh. Export it first if you need to keep it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start new count',
          style: 'destructive',
          onPress: async () => {
            if (user) await startNewCount(user.id);
            router.back(); // return to the freshly-cleared scanner
          },
        },
      ],
    );
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restore();
      Alert.alert('Restore complete', 'Your purchases have been restored.');
    } catch {
      Alert.alert('Restore failed', 'We couldn’t restore your purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch {
            setSigningOut(false);
            Alert.alert('Could not sign out', 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.heading}>Settings</Text>
        <Button label="Done" variant="text" onPress={() => router.back()} />
      </View>

      <View style={styles.list}>
        <Row label="Account" value={user?.email ?? '—'} />
        <Row label="Subscription" value={subscriptionLabel(access)} />
        {/* Reachable while on trial so users (and testers) can subscribe early. */}
        {!access.hasActiveSubscription && (
          <ActionRow
            label="Upgrade to Pro"
            onPress={() => router.push('/(app)/paywall')}
          />
        )}
        <ActionRow label="Start new count" onPress={handleNewCount} />
        <ActionRow label="Manage subscription" onPress={handleManage} />
        <ActionRow
          label={restoring ? 'Restoring…' : 'Restore purchases'}
          onPress={handleRestore}
          disabled={restoring}
        />
        <ActionRow
          label="Contact support"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
        <ActionRow label="Sign out" destructive onPress={handleSignOut} last />
      </View>

      {signingOut && <Text style={styles.signingOut}>Signing out…</Text>}

      <Text style={styles.version}>
        ProCount v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionRow({
  label,
  onPress,
  destructive = false,
  disabled = false,
  last = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        last && styles.rowLast,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <Text style={[styles.rowLabel, destructive && { color: colors.danger }]}>
        {label}
      </Text>
      {!destructive && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  heading: {
    ...textStyles.heading,
    color: colors.grey900,
  },
  list: {
    marginTop: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.grey100,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey300,
    gap: spacing.lg,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: colors.grey300,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLabel: {
    ...textStyles.bodyMedium,
    color: colors.grey900,
  },
  rowValue: {
    ...textStyles.body,
    color: colors.grey500,
    flexShrink: 1,
    textAlign: 'right',
  },
  chevron: {
    ...textStyles.body,
    color: colors.grey500,
    fontSize: 22,
  },
  signingOut: {
    ...textStyles.caption,
    color: colors.grey500,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  version: {
    ...textStyles.caption,
    color: colors.grey500,
    textAlign: 'center',
    marginTop: 'auto',
    paddingVertical: spacing.lg,
  },
});
