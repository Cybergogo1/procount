import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const REVIEW_REQUESTED_KEY = 'procount.reviewRequested';

/**
 * Request a native in-app review prompt once, right after the user's first
 * successful export (client request). A persisted flag guarantees we only ever
 * ask once, so it never disrupts later exports.
 *
 * Note: the OS ultimately decides whether to show the prompt — Apple/Google
 * rate-limit it and suppress it entirely in TestFlight/dev builds, so it only
 * really appears for production App Store installs.
 */
export async function maybeRequestReviewAfterExport(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(REVIEW_REQUESTED_KEY)) return;
    // Mark first so a repeat export (or a failed call) can never re-prompt.
    await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, '1');

    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
  } catch {
    // Non-essential — never disrupt the export flow.
  }
}
