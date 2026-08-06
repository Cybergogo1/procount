import { supabase } from '@/lib/supabase';
import type { ScanItem } from '@/stores/useSessionStore';
import type { Session } from '@/types/database';
import type { SyncOp } from './types';

/**
 * Supabase wrappers for the active session (brief Section 12: components and
 * the sync queue go through typed wrappers, never the client directly).
 */

/**
 * Return the user's active session, creating one if none exists. The
 * `ensure_one_active_session` trigger guarantees at most one stays active.
 */
export async function getOrCreateActiveSession(userId: string): Promise<Session> {
  const existing = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from('sessions')
    .insert({ user_id: userId })
    .select('*')
    .single();

  if (created.error) throw created.error;
  return created.data;
}

/**
 * Insert a brand-new active session. The `ensure_one_active_session` trigger
 * completes any previously-active session for the user, so this cleanly starts
 * a fresh count (client request: reset without exporting).
 */
export async function startNewSession(userId: string): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Load an active session's scans so the on-screen list survives an app restart
 * (client request: the list persists until explicitly reset). Newest first, to
 * match how the store keeps them.
 */
export async function getSessionScans(sessionId: string): Promise<ScanItem[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('id, barcode, quantity, expression, scanned_at')
    .eq('session_id', sessionId)
    .order('scanned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    barcode: row.barcode,
    quantity: row.quantity,
    expression: row.expression ?? String(row.quantity),
    scannedAt: row.scanned_at,
  }));
}

/**
 * Execute a single sync operation. Rejects on failure so the queue can apply
 * backoff. Updates/deletes are naturally idempotent (they affect 0 rows if the
 * row is gone), which keeps retries and out-of-order recovery safe.
 */
export async function processSyncOp(op: SyncOp): Promise<void> {
  switch (op.type) {
    case 'insert_scan': {
      const { error } = await supabase.from('scans').insert({
        id: op.id,
        session_id: op.sessionId,
        user_id: op.userId,
        barcode: op.barcode,
        quantity: op.quantity,
        expression: op.expression,
        scanned_at: op.scannedAt,
      });
      if (error) throw error;
      return;
    }
    case 'update_scan': {
      const { error } = await supabase
        .from('scans')
        .update({ quantity: op.quantity, expression: op.expression })
        .eq('id', op.id);
      if (error) throw error;
      return;
    }
    case 'delete_scan': {
      const { error } = await supabase.from('scans').delete().eq('id', op.id);
      if (error) throw error;
      return;
    }
  }
}
