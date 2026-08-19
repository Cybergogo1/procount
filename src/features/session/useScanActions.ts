import { useCallback } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useSessionStore, type ScanItem } from '@/stores/useSessionStore';
import { syncQueue } from './queueInstance';

/**
 * The scan mutations (add / edit / delete / restore), split out of
 * useSessionSync so any screen can edit the count without re-binding
 * connectivity or the session lifecycle — e.g. the "View all" list. Each
 * updates the Zustand store synchronously and mirrors the change to Supabase
 * via the background sync queue (brief Sections 7–8).
 */
export function useScanActions() {
  const { user } = useAuth();
  const store = useSessionStore;

  const addScan = useCallback(
    (input: { barcode: string; quantity: number; expression: string }) => {
      const item = store.getState().addScan(input);
      const sid = store.getState().sessionId;
      if (!(user && sid)) return;
      syncQueue.enqueue({
        type: 'insert_scan',
        id: item.id,
        sessionId: sid,
        userId: user.id,
        barcode: item.barcode,
        quantity: item.quantity,
        expression: item.expression,
        scannedAt: item.scannedAt,
      });
    },
    [store, user],
  );

  const editScan = useCallback(
    (id: string, quantity: number, expression: string) => {
      store.getState().updateScan(id, quantity, expression);
      if (store.getState().sessionId) {
        syncQueue.enqueue({ type: 'update_scan', id, quantity, expression });
      }
    },
    [store],
  );

  const deleteScan = useCallback(
    (id: string) => {
      const removed = store.getState().removeScan(id);
      if (removed && store.getState().sessionId) {
        syncQueue.enqueue({ type: 'delete_scan', id });
      }
      return removed;
    },
    [store],
  );

  const restoreScan = useCallback(
    (item: ScanItem, index: number) => {
      store.getState().restoreScan(item, index);
      const sid = store.getState().sessionId;
      if (user && sid) {
        // Re-insert with the same id — idempotent against the prior delete.
        syncQueue.enqueue({
          type: 'insert_scan',
          id: item.id,
          sessionId: sid,
          userId: user.id,
          barcode: item.barcode,
          quantity: item.quantity,
          expression: item.expression,
          scannedAt: item.scannedAt,
        });
      }
    },
    [store, user],
  );

  return { addScan, editScan, deleteScan, restoreScan };
}
