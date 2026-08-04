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
import { z } from 'zod';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radii, spacing, textStyles } from '@/theme';
import {
  requestSessionReport,
  setSessionExportEmail,
  type ExportFormat,
} from './api';

type EndSessionSheetProps = {
  visible: boolean;
  onClose: () => void;
  sessionId: string | null;
  totalItems: number;
  lineItems: number;
  /** Called after a successful send. The session/count is kept intact. */
  onSent: () => void;
};

const emailSchema = z.string().trim().email();

/**
 * Export modal sheet (brief Section 9). Collects the manager's email + format
 * and invokes the Edge Function. The session stays active and its scans are
 * kept afterwards (client request) — on success the sheet closes and the user
 * returns to their count; on failure it stays open for retry.
 */
export function EndSessionSheet({
  visible,
  onClose,
  sessionId,
  totalItems,
  lineItems,
  onSent,
}: EndSessionSheetProps) {
  const [email, setEmail] = useState('');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  // Default to separated (every scan, one row) — the raw count is source of
  // truth; combining like items is the optional summary view.
  const [combine, setCombine] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setFormat('xlsx');
    setCombine(false);
    setError(null);
  };

  const handleClose = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const handleSend = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError('Enter a valid email address');
      return;
    }
    if (!sessionId) {
      setError('No active session to export');
      return;
    }

    setSending(true);
    setError(null);
    try {
      await setSessionExportEmail(sessionId, parsed.data);
      await requestSessionReport(sessionId, format, combine);
      reset();
      onSent();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not send the report. Please try again.',
      );
    } finally {
      setSending(false);
    }
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
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.heading}>Send this count to a manager</Text>

              <TextField
              label="Manager email"
              value={email}
              onChangeText={setEmail}
              error={error ?? undefined}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="name@store.com"
              editable={!sending}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Format</Text>
              <View style={styles.formatRow}>
                <FormatOption
                  label="Excel (.xlsx)"
                  selected={format === 'xlsx'}
                  onPress={() => setFormat('xlsx')}
                  disabled={sending}
                />
                <FormatOption
                  label="CSV"
                  selected={format === 'csv'}
                  onPress={() => setFormat('csv')}
                  disabled={sending}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Like items</Text>
              <View style={styles.formatRow}>
                <FormatOption
                  label="Separated"
                  selected={!combine}
                  onPress={() => setCombine(false)}
                  disabled={sending}
                />
                <FormatOption
                  label="Combined"
                  selected={combine}
                  onPress={() => setCombine(true)}
                  disabled={sending}
                />
              </View>
              <Text style={styles.hint}>
                {combine
                  ? 'One row per item, quantities summed (with a count of how many times each was scanned).'
                  : 'One row per scan, with timestamps and a Duplicate flag for repeated items.'}
              </Text>
            </View>

            <Text style={styles.summary}>
              {totalItems} item{totalItems === 1 ? '' : 's'} counted across{' '}
              {lineItems} line{lineItems === 1 ? '' : 's'}.
            </Text>

              <Button label="Send Report" onPress={handleSend} loading={sending} />
              <Button
                label="Cancel"
                variant="text"
                onPress={handleClose}
                disabled={sending}
              />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormatOption({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[styles.formatOption, selected && styles.formatOptionSelected]}
    >
      <Text
        style={[
          styles.formatLabel,
          selected && styles.formatLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
    // Cap height so it always fits above the keyboard; content scrolls.
    maxHeight: '92%',
  },
  sheetContent: {
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
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...textStyles.label,
    color: colors.grey700,
  },
  hint: {
    ...textStyles.caption,
    color: colors.grey500,
  },
  formatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formatOption: {
    flex: 1,
    height: 52,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.grey300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatOptionSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.blueTint,
  },
  formatLabel: {
    ...textStyles.bodyMedium,
    color: colors.grey700,
  },
  formatLabelSelected: {
    color: colors.blue,
  },
  summary: {
    ...textStyles.body,
    color: colors.grey500,
  },
});
