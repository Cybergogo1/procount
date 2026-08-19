import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScanRow } from '@/components/ScanRow';
import { TextField } from '@/components/TextField';
import { UndoToast } from '@/components/UndoToast';
import { CalculatorModal } from '@/features/calculator/CalculatorModal';
import { useScanActions } from '@/features/session/useScanActions';
import { useSessionStore, type ScanItem } from '@/stores/useSessionStore';
import { colors, spacing, textStyles } from '@/theme';

/**
 * "View all" scans (client request). The full count in one searchable list —
 * filter by barcode, edit a quantity (via the calculator) or delete inline, then
 * a quick Back to the live camera. Edits go through the same sync layer as the
 * main screen (useScanActions), so the store and Supabase stay in step.
 */
export default function AllScansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scans = useSessionStore((s) => s.scans);
  const { editScan, deleteScan, restoreScan } = useScanActions();

  const [query, setQuery] = useState('');
  const [undo, setUndo] = useState<{ item: ScanItem; index: number } | null>(null);
  const [editing, setEditing] = useState<ScanItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    return q ? scans.filter((s) => s.barcode.includes(q)) : scans;
  }, [scans, query]);

  const handleDelete = useCallback(
    (id: string) => {
      const removed = deleteScan(id);
      if (removed) setUndo(removed);
    },
    [deleteScan],
  );

  const handleUndo = () => {
    if (undo) restoreScan(undo.item, undo.index);
    setUndo(null);
  };

  const handleCalcSave = (expression: string, total: number) => {
    if (editing) editScan(editing.id, total, expression);
    setEditing(null);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to scanner"
        >
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          All scans ({scans.length})
        </Text>
        {/* Balances the Back button so the title stays centred. */}
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchWrap}>
        <TextField
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Filter by barcode…"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContent : undefined}
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        indicatorStyle="black"
        renderItem={({ item }) => (
          <ScanRow
            scan={item}
            onEditQuantity={(scan) => setEditing(scan)}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {scans.length === 0
              ? 'No scans yet.'
              : 'No scans match your search.'}
          </Text>
        }
      />

      <UndoToast
        visible={undo != null}
        message="Removed"
        onUndo={handleUndo}
        onDismiss={() => setUndo(null)}
      />

      <CalculatorModal
        visible={editing != null}
        title={editing ? editing.barcode : 'Count'}
        initialExpression={editing ? editing.expression : ''}
        onCancel={() => setEditing(null)}
        onSave={handleCalcSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  back: {
    ...textStyles.button,
    color: colors.blue,
  },
  title: {
    ...textStyles.heading,
    color: colors.grey900,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    // Roughly the Back button's width so the title reads centred.
    width: 48,
  },
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  list: {
    flex: 1,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    ...textStyles.body,
    color: colors.grey500,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
