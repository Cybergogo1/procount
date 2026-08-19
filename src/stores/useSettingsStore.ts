import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Device-local app preferences (client request). Persisted so a choice like the
 * scanner type survives app restarts. Distinct from the session store, which
 * holds the live count.
 */

export type ScanMode = 'barcode' | 'qr';

type SettingsState = {
  /** Which symbology the camera looks for. Set from Settings ("Scan QR codes"). */
  scanMode: ScanMode;
  setScanMode: (mode: ScanMode) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      scanMode: 'barcode',
      setScanMode: (scanMode) => set({ scanMode }),
    }),
    {
      name: 'procount.settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
