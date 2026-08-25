import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Calculator } from '@/features/calculator/CalculatorModal';
import { colors, spacing, textStyles } from '@/theme';

type ManualAddSheetProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: { barcode: string; quantity: number; expression: string }) => void;
};

/**
 * Manual entry (client request): add an item that can't be scanned — type the
 * barcode/SKU and set the quantity with the same calculator used for scans. The
 * result is a line identical to a scanned one, so it flows through the count and
 * export with no special handling.
 *
 * The calculator is shown INLINE (swapping the sheet's content), not as a second
 * modal — stacking RN modals doesn't work and left the screen unresponsive.
 */
export function ManualAddSheet({ visible, onClose, onAdd }: ManualAddSheetProps) {
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [expression, setExpression] = useState('1');
  const [mode, setMode] = useState<'form' | 'calc'>('form');
  const [error, setError] = useState<string | null>(null);

  const showsExpression = /\d[+×]/.test(expression);

  const reset = () => {
    setBarcode('');
    setQuantity(1);
    setExpression('1');
    setMode('form');
    setError(null);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    reset();
    onClose();
  };

  const handleAdd = () => {
    const code = barcode.trim();
    if (!code) {
      setError('Enter a barcode or SKU');
      return;
    }
    Keyboard.dismiss();
    onAdd({ barcode: code, quantity, expression });
    reset();
    onClose();
  };

  const openCalculator = () => {
    Keyboard.dismiss(); // so the keypad isn't hidden behind the keyboard
    setMode('calc');
  };

  const handleCalcSave = (expr: string, total: number) => {
    setQuantity(total);
    setExpression(expr);
    setMode('form');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropFill} onPress={handleClose} />
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {mode === 'calc' ? (
              <View style={styles.calcWrap}>
                <Calculator
                  initialExpression={showsExpression ? expression : ''}
                  title="Quantity"
                  onCancel={() => setMode('form')}
                  onSave={handleCalcSave}
                />
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.heading}>Add an item manually</Text>
                <Text style={styles.sub}>
                  For an item that won’t scan, type the code and set the quantity.
                </Text>

                <TextField
                  label="Barcode or SKU"
                  value={barcode}
                  onChangeText={(text) => {
                    setBarcode(text);
                    if (error) setError(null);
                  }}
                  error={error ?? undefined}
                  placeholder="e.g. 5012345678900"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="done"
                />

                <View style={styles.qtyRow}>
                  <View style={styles.qtyInfo}>
                    <Text style={styles.qtyLabel}>Quantity</Text>
                    <Text style={styles.qtyValue}>
                      {quantity}
                      {showsExpression ? `  ·  ${expression}` : ''}
                    </Text>
                  </View>
                  <Button
                    label="🧮 Calculator"
                    variant="secondary"
                    onPress={openCalculator}
                  />
                </View>

                <Button label="Add to count" onPress={handleAdd} />
                <Button label="Cancel" variant="text" onPress={handleClose} />
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31,32,36,0.45)',
  },
  backdropFill: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.md,
    maxHeight: '92%',
  },
  calcWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey300,
    marginBottom: spacing.sm,
  },
  heading: {
    ...textStyles.heading,
    color: colors.grey900,
  },
  sub: {
    ...textStyles.body,
    color: colors.grey500,
    marginTop: -spacing.md,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  qtyInfo: {
    gap: 2,
  },
  qtyLabel: {
    ...textStyles.label,
    color: colors.grey700,
  },
  qtyValue: {
    ...textStyles.heading,
    color: colors.grey900,
    fontVariant: ['tabular-nums'],
  },
});
