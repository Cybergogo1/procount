import { useEffect, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';

import { Button } from '@/components/Button';
import { colors, spacing, textStyles } from '@/theme';

type CameraPermissionGateProps = {
  children: ReactNode;
};

/**
 * Gates the camera UI behind the camera permission (brief Section 13). On first
 * mount it requests permission once; if denied it explains why and offers to
 * open the OS settings. Children (the live camera) only mount once granted.
 */
export function CameraPermissionGate({ children }: CameraPermissionGateProps) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    // Ask once automatically when the status is still undetermined.
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Still resolving the initial permission status.
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (permission.granted) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📷</Text>
      <Text style={styles.title}>Camera access needed</Text>
      <Text style={styles.body}>
        ProCount uses your camera to scan barcodes during inventory counts.
        Without it, there&apos;s nothing to count.
      </Text>
      {permission.canAskAgain ? (
        <Button label="Allow camera" onPress={() => void requestPermission()} />
      ) : (
        <Button label="Open settings" onPress={() => void Linking.openSettings()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.white,
  },
  icon: {
    fontSize: 44,
  },
  title: {
    ...textStyles.heading,
    color: colors.grey900,
    textAlign: 'center',
  },
  body: {
    ...textStyles.body,
    color: colors.grey700,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
