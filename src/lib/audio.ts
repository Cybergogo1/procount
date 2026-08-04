import { useCallback, useEffect } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Short scan-confirmation beep packaged with the app (brief Section 7).
const BEEP_SOURCE = require('../../assets/beep.wav');
// Soft, dull key-click for the calculator (client request).
const KEY_SOURCE = require('../../assets/key.wav');

/**
 * Returns a `playBeep()` to fire on a successful scan. Built on expo-audio's
 * useAudioPlayer (SDK 56). We rewind to the start before each play so rapid
 * consecutive scans always retrigger the sound, and configure the audio mode so
 * the beep is heard even when the ringer is muted.
 */
export function useScanBeep(): () => void {
  const player = useAudioPlayer(BEEP_SOURCE);

  useEffect(() => {
    // playsInSilentMode keeps the cue audible on iOS silent switch; a barcode
    // beep is functional feedback, not media.
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  return useCallback(() => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Audio is non-essential feedback — never block the scan loop.
    }
  }, [player]);
}

/**
 * Returns a `playKeyClick()` for calculator keypresses (client request). Rewinds
 * before each play so fast entry always retriggers the soft click.
 */
export function useKeyClick(): () => void {
  const player = useAudioPlayer(KEY_SOURCE);

  return useCallback(() => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Non-essential feedback — never block key entry.
    }
  }, [player]);
}
