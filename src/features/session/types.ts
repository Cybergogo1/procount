/**
 * Sync operation types (brief Sections 7–8). Each user action on the active
 * session enqueues one of these for the background sync worker to flush to
 * Supabase. Payloads carry everything the write needs so the queue stays a pure
 * data structure with no dependency on the store or auth state.
 */

export type InsertScanOp = {
  type: 'insert_scan';
  /** Client-generated scan id (matches the Supabase row id). */
  id: string;
  sessionId: string;
  userId: string;
  barcode: string;
  quantity: number;
  /** The +/× expression that produced the quantity (client request). */
  expression: string;
  /** ISO timestamp from the device clock at scan time. */
  scannedAt: string;
};

/** Update a line's quantity + expression (a same-barcode merge or an edit). */
export type UpdateScanOp = {
  type: 'update_scan';
  id: string;
  quantity: number;
  expression: string;
};

export type DeleteScanOp = {
  type: 'delete_scan';
  id: string;
};

export type SyncOp = InsertScanOp | UpdateScanOp | DeleteScanOp;

export type SyncStatus = 'idle' | 'syncing';
