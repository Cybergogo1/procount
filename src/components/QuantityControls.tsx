import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';

type QuantityControlsProps = {
  value: number;
  onChange: (value: number) => void;
};

const MAX_QUANTITY = 9999;

/**
 * Quantity row for the scanner (brief Section 7.4): minus, an editable number
 * (tap to type), and plus. Quantity is clamped to >= 1 to match the DB check
 * constraint.
 */
export function QuantityControls({ value, onChange }: QuantityControlsProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const clamp = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, n));

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10);
    onChange(Number.isNaN(parsed) ? 1 : clamp(parsed));
    setEditing(false);
  };

  return (
    <View style={styles.row}>
      <StepperButton
        label="−"
        accessibilityLabel="Decrease quantity"
        onPress={() => onChange(clamp(value - 1))}
        disabled={value <= 1}
      />

      <Pressable
        style={styles.valueBox}
        onPress={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Quantity ${value}, tap to edit`}
      >
        {editing ? (
          <TextInput
            style={styles.valueInput}
            value={draft}
            onChangeText={setDraft}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="number-pad"
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            maxLength={4}
          />
        ) : (
          <Text style={styles.valueText}>{value}</Text>
        )}
      </Pressable>

      <StepperButton
        label="+"
        accessibilityLabel="Increase quantity"
        onPress={() => onChange(clamp(value + 1))}
      />
    </View>
  );
}

function StepperButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.stepper,
        pressed && !disabled && styles.stepperPressed,
        disabled && styles.stepperDisabled,
      ]}
    >
      <Text style={styles.stepperLabel}>{label}</Text>
    </Pressable>
  );
}

const CONTROL_HEIGHT = 56;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepper: {
    width: CONTROL_HEIGHT,
    height: CONTROL_HEIGHT,
    borderRadius: radii.button,
    backgroundColor: colors.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperPressed: {
    backgroundColor: colors.grey300,
  },
  stepperDisabled: {
    opacity: 0.4,
  },
  stepperLabel: {
    fontFamily: textStyles.heading.fontFamily,
    fontSize: 28,
    color: colors.blue,
    lineHeight: 32,
  },
  valueBox: {
    flex: 1,
    height: CONTROL_HEIGHT,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.grey300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    ...textStyles.heading,
    color: colors.grey900,
  },
  valueInput: {
    ...textStyles.heading,
    color: colors.grey900,
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
});
