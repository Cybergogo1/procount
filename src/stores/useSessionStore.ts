import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

/**
 * Active-session store (brief Sections 7 & 8). Single source of truth for what's
 * on screen during a count. Every action mutates it synchronously so the UI
 * never waits on the network — the background sync layer mirrors changes to
 * Supabase separately.
 *
 * Each scan is its own line — scanning the same barcode twice shows twice, for
 * verification (client's counting workflow). Each scan carries the calculator
 * `expression` that produced its quantity so it can be shown on screen and
 * included in the export. Combining like items is an export-time choice.
 */

export type ScanItem = {
  id: string;
  barcode: string;
  quantity: number;
  /** The +/× expression that evaluates to `quantity` (e.g. "12×12×5+10"). */
  expression: string;
  /** ISO timestamp from the device clock at scan time (brief Section 18). */
  scannedAt: string;
};

type SessionState = {
  sessionId: string | null;
  /** Newest first (brief Section 7.6). */
  scans: ScanItem[];

  setSessionId: (sessionId: string | null) => void;
  /** Add a scan as a new line (same barcode is allowed and kept separate). */
  addScan: (input: {
    barcode: string;
    quantity: number;
    expression: string;
  }) => ScanItem;
  /** Replace a line's quantity + expression (used when editing via calculator). */
  updateScan: (id: string, quantity: number, expression: string) => void;
  /** Remove a scan; returns it plus its index so a delete can be undone. */
  removeScan: (id: string) => { item: ScanItem; index: number } | null;
  /** Re-insert a previously removed scan at its original position (undo). */
  restoreScan: (item: ScanItem, index: number) => void;
  /** Clear everything — used when a session ends and a new one starts. */
  reset: () => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  scans: [],

  setSessionId: (sessionId) => set({ sessionId }),

  addScan: ({ barcode, quantity, expression }) => {
    const item: ScanItem = {
      id: randomUUID(),
      barcode,
      quantity,
      expression,
      scannedAt: new Date().toISOString(),
    };
    set((state) => ({ scans: [item, ...state.scans] }));
    return item;
  },

  updateScan: (id, quantity, expression) => {
    if (quantity < 1) return; // quantity must be positive (DB check constraint)
    set((state) => ({
      scans: state.scans.map((scan) =>
        scan.id === id ? { ...scan, quantity, expression } : scan,
      ),
    }));
  },

  removeScan: (id) => {
    const index = get().scans.findIndex((scan) => scan.id === id);
    if (index === -1) return null;
    const item = get().scans[index];
    set((state) => ({ scans: state.scans.filter((scan) => scan.id !== id) }));
    return { item, index };
  },

  restoreScan: (item, index) => {
    set((state) => {
      const next = state.scans.slice();
      next.splice(index, 0, item);
      return { scans: next };
    });
  },

  reset: () => set({ scans: [], sessionId: null }),
}));

/**
 * Derived live total = sum of all scan quantities (brief Section 7.2).
 * Exposed as a selector hook so components re-render only when it changes.
 */
export function useTotalCount(): number {
  return useSessionStore((state) =>
    state.scans.reduce((sum, scan) => sum + scan.quantity, 0),
  );
}
