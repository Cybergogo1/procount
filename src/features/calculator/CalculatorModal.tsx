import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { keypadHaptic } from '@/lib/haptics';
import { colors, fonts, radii, spacing, textStyles } from '@/theme';
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

  // Sharp haptic on every keypress. Key sound removed per client request —
  // vibration only on the keypad; the scan confirmation ding is unaffected.
  const feedback = useCallback(() => {
    keypadHaptic();
  }, []);

  const isOperator = (ch: string) => ch === ADD || ch === MULTIPLY;

  const pressDigit = (d: string) => {
    feedback();
    setExpression((e) => e + d);
  };

  const pressOperator = (op: string) => {
    feedback();
    setExpression((e) => {
      if (e === '') return e; // no leading operator
      const last = e[e.length - 1];
      if (isOperator(last)) return e.slice(0, -1) + op; // swap consecutive ops
      return e + op;
    });
  };

  const backspace = () => {
    feedback();
    setExpression((e) => e.slice(0, -1));
  };

  const clear = () => {
    feedback();
    setExpression('');
  };

  const save = () => {
    if (total != null) {
      feedback();
      onSave(expression, total);
    }
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

          {/* Keypad — layout per client spec: right column C / ⌫ / ×,
              bottom row + / 0 / SAVE (double-wide). */}
          <View style={styles.grid}>
            <View style={styles.row}>
              <Key label="7" onPress={() => pressDigit('7')} />
              <Key label="8" onPress={() => pressDigit('8')} />
              <Key label="9" onPress={() => pressDigit('9')} />
              <Key label="C" variant="danger" onPress={clear} accessibilityLabel="Clear" />
            </View>
            <View style={styles.row}>
              <Key label="4" onPress={() => pressDigit('4')} />
              <Key label="5" onPress={() => pressDigit('5')} />
              <Key label="6" onPress={() => pressDigit('6')} />
              <Key label="⌫" variant="op" onPress={backspace} accessibilityLabel="Backspace" />
            </View>
            <View style={styles.row}>
              <Key label="1" onPress={() => pressDigit('1')} />
              <Key label="2" onPress={() => pressDigit('2')} />
              <Key label="3" onPress={() => pressDigit('3')} />
              <Key label={MULTIPLY} variant="op" onPress={() => pressOperator(MULTIPLY)} />
            </View>
            <View style={styles.row}>
              <Key label={ADD} variant="op" onPress={() => pressOperator(ADD)} />
              <Key label="0" onPress={() => pressDigit('0')} />
              <Key
                label="SAVE"
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
    // Small outer margin so the keypad fills nearly the full width for the
    // largest possible tap targets (client request).
    padding: spacing.sm,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: spacing.sm,
    gap: spacing.sm,
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
    paddingVertical: spacing.sm,
    minHeight: 64,
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
    // Tall keys for fast, look-free entry (client request).
    height: 72,
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
    // Clean UI font, centred, with generous line height so nothing clips
    // (Oswald was cropping the tops and rendering ×/+ small).
    fontFamily: fonts.interBold,
    fontSize: 30,
    lineHeight: 40,
    textAlign: 'center',
    includeFontPadding: false,
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

const keyLabelVariant: Record<KeyVariant, { color: string; fontSize?: number }> = {
  digit: { color: colors.grey900 },
  // Operators get a larger glyph so × and + read clearly.
  op: { color: colors.blue, fontSize: 36 },
  danger: { color: colors.danger },
  save: { color: colors.white, fontSize: 26 },
};
