import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  CameraView,
  type BarcodeScanningResult,
  type BarcodeType,
} from 'expo-camera';

import { useScanBeep } from '@/lib/audio';
import { scanSuccessHaptic } from '@/lib/haptics';
import { colors, radii, spacing, textStyles } from '@/theme';

type BarcodeScannerProps = {
  /** When false the scanner is paused (brief Section 7: pause after a read). */
  active: boolean;
  onScan: (barcode: string) => void;
  style?: StyleProp<ViewStyle>;
};

// Retail product symbologies plus common fallbacks. QR/aztec etc. are left out
// to avoid counting non-product codes during a stock count.
const BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
];

/**
 * Live barcode scanner (brief Section 7.3). The camera runs continuously; when
 * `active` is false we stop handling reads and dim the viewfinder. On a
 * successful read we fire the success haptic + beep and bubble the value up via
 * onScan — the parent parks it as the pending scan and flips `active` to false.
 */
export function BarcodeScanner({ active, onScan, style }: BarcodeScannerProps) {
  const playBeep = useScanBeep();
  // Guards against expo-camera firing onBarcodeScanned several times for the
  // same frame before the parent re-renders to pause us.
  const lockRef = useRef(false);

  useEffect(() => {
    // Re-arm the lock whenever scanning resumes.
    if (active) lockRef.current = false;
  }, [active]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (lockRef.current) return;
    lockRef.current = true;

    scanSuccessHaptic();
    playBeep();
    onScan(result.data);
  };

  return (
    <View style={[styles.container, style]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={active ? handleBarcode : undefined}
      />

      {/* Reticle + blue corner overlay. */}
      <View style={styles.reticleWrap} pointerEvents="none">
        <View style={styles.reticle}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      {/* Darken + prompt while paused (brief Section 7.3). */}
      {!active && (
        <View style={styles.pausedOverlay} pointerEvents="none">
          <Text style={styles.pausedText}>Confirm to scan again</Text>
        </View>
      )}
    </View>
  );
}

const RETICLE_SIZE = 220;
const CORNER = 28;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.grey900,
  },
  reticleWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE * 0.62,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.blue,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radii.button,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radii.button,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radii.button,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radii.button,
  },
  pausedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(31,32,36,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedText: {
    ...textStyles.bodyMedium,
    color: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
