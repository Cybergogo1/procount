import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';
import { ADD, evaluateExpression, MULTIPLY } from './evaluate';

type CalculatorModalProps = {
  visible: boolean;
  /** Pre-fill when editing an existing line; empty for a fresh count. */
  initialExpression?: string;
  title?: string;
  onCancel: () => void;
  onSave: (expression: string, total: number) => void;
};

/**
 * Count calculator (client request). A keypad for building a `+` / `×`
 * expression that mirrors how stock is stacked; the live total is the value
 * that gets saved. Used both for the in-progress scan and for editing a line.
 */
export function CalculatorModal({
  visible,
  initialExpression = '',
  title = 'Count',
  onCancel,
  onSave,
}: CalculatorModalProps) {
  const [expression, setExpression] = useState(initialExpression);

  // Load the starting expression each time the modal opens.
  useEffect(() => {
    if (visible) setExpression(initialExpression);
  }, [visible, initialExpression]);

  const total = useMemo(() => evaluateExpression(expression), [expression]);

  const isOperator = (ch: string) => ch === ADD || ch === MULTIPLY;

  const pressDigit = (d: string) => setExpression((e) => e + d);

  const pressOperator = (op: string) =>
    setExpression((e) => {
      if (e === '') return e; // no leading operator
      const last = e[e.length - 1];
      if (isOperator(last)) return e.slice(0, -1) + op; // swap consecutive ops
      return e + op;
    });

  const backspace = () => setExpression((e) => e.slice(0, -1));
  const clear = () => setExpression('');

  const save = () => {
    if (total != null) onSave(expression, total);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {/* Expression + live total. */}
          <View style={styles.display}>
            <Text style={styles.expression} numberOfLines={2}>
              {expression || '0'}
            </Text>
            <Text style={styles.total}>= {total ?? '—'}</Text>
          </View>

          {/* Keypad. */}
          <View style={styles.grid}>
            <View style={styles.row}>
              <Key label="7" onPress={() => pressDigit('7')} />
              <Key label="8" onPress={() => pressDigit('8')} />
              <Key label="9" onPress={() => pressDigit('9')} />
              <Key label={MULTIPLY} variant="op" onPress={() => pressOperator(MULTIPLY)} />
            </View>
            <View style={styles.row}>
              <Key label="4" onPress={() => pressDigit('4')} />
              <Key label="5" onPress={() => pressDigit('5')} />
              <Key label="6" onPress={() => pressDigit('6')} />
              <Key label={ADD} variant="op" onPress={() => pressOperator(ADD)} />
            </View>
            <View style={styles.row}>
              <Key label="1" onPress={() => pressDigit('1')} />
              <Key label="2" onPress={() => pressDigit('2')} />
              <Key label="3" onPress={() => pressDigit('3')} />
              <Key label="⌫" variant="op" onPress={backspace} accessibilityLabel="Backspace" />
            </View>
            <View style={styles.row}>
              <Key label="C" variant="danger" onPress={clear} accessibilityLabel="Clear" />
              <Key label="0" onPress={() => pressDigit('0')} />
              <Key
                label="Save"
                variant="save"
                flex={2}
                disabled={total == null}
                onPress={save}
              />
            </View>
          </View>

          <Pressable onPress={onCancel} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type KeyVariant = 'digit' | 'op' | 'danger' | 'save';

function Key({
  label,
  onPress,
  variant = 'digit',
  flex = 1,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: KeyVariant;
  flex?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.key,
        { flex },
        keyVariant[variant],
        pressed && !disabled && styles.keyPressed,
        disabled && styles.keyDisabled,
      ]}
    >
      <Text style={[styles.keyLabel, keyLabelVariant[variant]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(31,32,36,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...textStyles.sectionLabel,
    color: colors.grey500,
    textAlign: 'center',
  },
  display: {
    backgroundColor: colors.grey100,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 72,
    justifyContent: 'center',
  },
  expression: {
    ...textStyles.bodyMedium,
    color: colors.grey700,
    textAlign: 'right',
  },
  total: {
    ...textStyles.heading,
    color: colors.grey900,
    textAlign: 'right',
  },
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  key: {
    height: 56,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.7,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyLabel: {
    ...textStyles.heading,
    fontSize: 22,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    ...textStyles.button,
    color: colors.grey700,
  },
});

const keyVariant: Record<KeyVariant, object> = {
  digit: { backgroundColor: colors.grey100 },
  op: { backgroundColor: colors.blueTint },
  danger: { backgroundColor: '#FBE9E9' },
  save: { backgroundColor: colors.blue },
};

const keyLabelVariant: Record<KeyVariant, { color: string }> = {
  digit: { color: colors.grey900 },
  op: { color: colors.blue },
  danger: { color: colors.danger },
  save: { color: colors.white },
};
