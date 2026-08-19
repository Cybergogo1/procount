import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useSessionStore, type ScanItem } from '@/stores/useSessionStore';
import { getOrCreateActiveSession, getSessionScans } from './api';
import { bindConnectivity, syncQueue } from './queueInstance';
import type { SyncStatus } from './types';
import { useScanActions } from './useScanActions';

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

  // Load the active session's scans once it's known, so the on-screen list
  // survives an app restart (client request). Only populates when the list is
  // empty, so it never clobbers scans the user is actively adding.
  const loadedSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId || loadedSessionRef.current === sessionId) return;
    loadedSessionRef.current = sessionId;
    let cancelled = false;
    getSessionScans(sessionId)
      .then((scans) => {
        if (cancelled || scans.length === 0) return;
        useSessionStore.setState((s) => (s.scans.length === 0 ? { scans } : {}));
      })
      .catch(() => {
        // Non-fatal — the list just starts empty; scans still sync normally.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const { addScan, editScan, deleteScan, restoreScan } = useScanActions();

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
