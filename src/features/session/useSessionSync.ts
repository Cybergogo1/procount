import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useSessionStore, type ScanItem } from '@/stores/useSessionStore';
import { getOrCreateActiveSession } from './api';
import { bindConnectivity, syncQueue } from './queueInstance';
import type { SyncStatus } from './types';

type SessionSync = {
  /** 'idle' when the queue is empty, 'syncing' when writes are pending. */
  status: SyncStatus;
  /** True until the active session row exists (writes can't be enqueued yet). */
  sessionReady: boolean;
  addScan: (input: {
    barcode: string;
    quantity: number;
    expression: string;
  }) => void;
  editScan: (id: string, quantity: number, expression: string) => void;
  deleteScan: (id: string) => { item: ScanItem; index: number } | null;
  restoreScan: (item: ScanItem, index: number) => void;
  /** Resolves once all pending writes have flushed (brief Section 8). */
  waitUntilDrained: () => Promise<void>;
};

/**
 * Bridges the optimistic Zustand store (UI truth) to the background sync queue
 * (brief Sections 7–8). Every action updates the store synchronously and
 * enqueues the corresponding Supabase write. Also ensures an active session row
 * exists, retrying when connectivity returns.
 */
export function useSessionSync(): SessionSync {
  const { user } = useAuth();
  const sessionId = useSessionStore((s) => s.sessionId);
  const setSessionId = useSessionStore((s) => s.setSessionId);

  const [status, setStatus] = useState<SyncStatus>(syncQueue.status);

  useEffect(() => {
    const unbindNet = bindConnectivity();
    const unsubStatus = syncQueue.subscribe(setStatus);
    return () => {
      unsubStatus();
      unbindNet();
    };
  }, []);

  // Ensure the active session exists. Retries on connectivity change via the
  // NetInfo listener bumping a tick, and on failure after a short delay.
  useEffect(() => {
    if (!user || sessionId) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const ensure = () => {
      getOrCreateActiveSession(user.id)
        .then((session) => {
          if (!cancelled) setSessionId(session.id);
        })
        .catch(() => {
          if (!cancelled) retry = setTimeout(ensure, 3000);
        });
    };
    ensure();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [user, sessionId, setSessionId]);

  const store = useSessionStore;

  const addScan = useCallback(
    ({
      barcode,
      quantity,
      expression,
    }: {
      barcode: string;
      quantity: number;
      expression: string;
    }) => {
      const item = store.getState().addScan({ barcode, quantity, expression });
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

  const waitUntilDrained = useCallback(() => syncQueue.waitUntilDrained(), []);

  return {
    status,
    sessionReady: sessionId != null,
    addScan,
    editScan,
    deleteScan,
    restoreScan,
    waitUntilDrained,
  };
}
