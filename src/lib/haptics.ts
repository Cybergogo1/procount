import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Haptic cues (brief Section 7). Wrapped so the scanner doesn't have to care
 * about platform support — haptics are a no-op on web and fire-and-forget
 * (a failed haptic must never interrupt the scan loop).
 */

export function scanSuccessHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {
      // Ignore — haptics are non-essential feedback.
    },
  );
}

export function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
