import { useState } from 'react';
import {
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
import { CalculatorModal } from '@/features/calculator/CalculatorModal';
import { colors, radii, spacing, textStyles } from '@/theme';

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
 */
export function ManualAddSheet({ visible, onClose, onAdd }: ManualAddSheetProps) {
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [expression, setExpression] = useState('1');
  const [calcOpen, setCalcOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showsExpression = /\d[+×]/.test(expression);

  const reset = () => {
    setBarcode('');
    setQuantity(1);
    setExpression('1');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAdd = () => {
    const code = barcode.trim();
    if (!code) {
      setError('Enter a barcode or SKU');
      return;
    }
    onAdd({ barcode: code, quantity, expression });
    reset();
    onClose();
  };

  const handleCalcSave = (expr: string, total: number) => {
    setQuantity(total);
    setExpression(expr);
    setCalcOpen(false);
  };

  return (
    <>
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
              <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.heading}>Add an item manually</Text>
                <Text style={styles.sub}>
                  For an item that won’t scan — type the code and set the quantity.
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
                    onPress={() => setCalcOpen(true)}
                  />
                </View>

                <Button label="Add to count" onPress={handleAdd} />
                <Button label="Cancel" variant="text" onPress={handleClose} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Same calculator as the scan flow, for building a stacked quantity. */}
      <CalculatorModal
        visible={calcOpen}
        title="Quantity"
        initialExpression={showsExpression ? expression : ''}
        onCancel={() => setCalcOpen(false)}
        onSave={handleCalcSave}
      />
    </>
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
