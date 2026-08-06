import { useCallback, useEffect } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Short scan-confirmation beep packaged with the app (brief Section 7).
const BEEP_SOURCE = require('../../assets/beep.wav');
// Soft, dull key-click for the calculator (client request).
const KEY_SOURCE = require('../../assets/key.wav');

// Scan tone softened a touch per client feedback (0.0–1.0).
const BEEP_VOLUME = 0.7;

/**
 * Returns a `playBeep()` to fire on a successful scan. Built on expo-audio's
 * useAudioPlayer (SDK 56). seekTo() is async, so we AWAIT the rewind before
 * calling play() — firing play() before the seek landed was leaving the player
 * parked at the end and swallowing every other beep. We also configure the
 * audio mode so the beep is heard even when the ringer is muted.
 */
export function useScanBeep(): () => void {
  const player = useAudioPlayer(BEEP_SOURCE);

  useEffect(() => {
    // playsInSilentMode keeps the cue audible on iOS silent switch; a barcode
    // beep is functional feedback, not media.
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    player.volume = BEEP_VOLUME;
  }, [player]);

  return useCallback(async () => {
    try {
      await player.seekTo(0);
      player.play();
    } catch {
      // Audio is non-essential feedback — never block the scan loop.
    }
  }, [player]);
}

/**
 * Returns a `playKeyClick()` for calculator keypresses (client request). Same
 * awaited-rewind pattern so fast entry retriggers the soft click every time
 * (an un-awaited seek was dropping every other click).
 */
export function useKeyClick(): () => void {
  const player = useAudioPlayer(KEY_SOURCE);

  return useCallback(async () => {
    try {
      await player.seekTo(0);
      player.play();
    } catch {
      // Non-essential feedback — never block key entry.
    }
  }, [player]);
}
