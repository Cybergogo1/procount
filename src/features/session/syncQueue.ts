import type { SyncOp, SyncStatus } from './types';

/**
 * Background write queue for the active session (brief Sections 7–8).
 *
 * Design goals from the brief:
 *  - The UI never waits on the network; this queue runs independently.
 *  - FIFO, one op in flight at a time, so causal order is preserved (a row is
 *    inserted before it is updated/deleted).
 *  - Failed writes retry with exponential backoff: 1s, 2s, 4s, 8s, … capped at
 *    30s.
 *  - Online-gated: while offline we stop attempting and resume on reconnect.
 *  - NOT offline-first — the queue is in-memory. If the app is killed with
 *    pending writes, they are lost. That boundary is intentional.
 *
 * The class is deliberately free of React, NetInfo and Supabase imports so it
 * can be unit-tested in isolation. Side effects are injected:
 *  - `process(op)` performs the actual network write (rejects on failure).
 *  - `setTimer` / `clearTimer` schedule retries (swappable for fake timers).
 */

export type ProcessFn = (op: SyncOp) => Promise<void>;

export type SyncQueueOptions = {
  process: ProcessFn;
  /** Backoff for a given zero-based attempt index, in ms. */
  backoffMs?: (attempt: number) => number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
};

/** 1s, 2s, 4s, 8s, 16s, then capped at 30s (brief Section 8). */
export function defaultBackoff(attempt: number): number {
  return Math.min(2 ** attempt * 1000, 30_000);
}

type StatusListener = (status: SyncStatus) => void;

export class SyncQueue {
  private queue: SyncOp[] = [];
  private inFlight = false;
  private online = true;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<StatusListener>();
  private drainWaiters: (() => void)[] = [];

  private readonly process: ProcessFn;
  private readonly backoffMs: (attempt: number) => number;
  private readonly setTimer: NonNullable<SyncQueueOptions['setTimer']>;
  private readonly clearTimer: NonNullable<SyncQueueOptions['clearTimer']>;

  constructor(options: SyncQueueOptions) {
    this.process = options.process;
    this.backoffMs = options.backoffMs ?? defaultBackoff;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((h) => clearTimeout(h));
  }

  /** Number of operations still pending (including any in flight). */
  get size(): number {
    return this.queue.length;
  }

  get status(): SyncStatus {
    return this.queue.length > 0 ? 'syncing' : 'idle';
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /** Add an operation, applying light coalescing, then kick the worker. */
  enqueue(op: SyncOp): void {
    this.coalesce(op);
    this.notify();
    this.processNext();
  }

  /** Update connectivity (driven by NetInfo). Resumes flushing when online. */
  setOnline(online: boolean): void {
    const wasOffline = !this.online;
    this.online = online;
    if (online && wasOffline) {
      // Reconnected: retry immediately rather than waiting out the backoff.
      this.attempt = 0;
      if (this.timer) {
        this.clearTimer(this.timer);
        this.timer = null;
      }
      this.processNext();
    }
  }

  /**
   * Resolves once the queue is empty (brief Section 8: hold "End Session" until
   * writes drain). Resolves immediately if already empty.
   */
  waitUntilDrained(): Promise<void> {
    if (this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.drainWaiters.push(resolve);
    });
  }

  // --- internals ---------------------------------------------------------

  private coalesce(op: SyncOp): void {
    // Index 0 may be in flight; never mutate it.
    const firstMutable = this.inFlight ? 1 : 0;

    if (op.type === 'update_scan') {
      // Collapse a run of edits to the same row into the latest value.
      for (let i = this.queue.length - 1; i >= firstMutable; i -= 1) {
        const existing = this.queue[i];
        if (existing.type === 'update_scan' && existing.id === op.id) {
          this.queue[i] = op;
          return;
        }
        // Stop at the first op that touches this row to keep ordering intact.
        if ('id' in existing && existing.id === op.id) break;
      }
    }

    this.queue.push(op);
  }

  private processNext(): void {
    if (this.inFlight || this.timer) return;
    if (!this.online || this.queue.length === 0) return;

    const op = this.queue[0];
    this.inFlight = true;

    this.process(op).then(
      () => {
        this.inFlight = false;
        this.attempt = 0;
        this.queue.shift();
        this.notify();
        if (this.queue.length === 0) {
          this.resolveDrainWaiters();
        } else {
          this.processNext();
        }
      },
      () => {
        // Write failed. Back off and retry the same op (still at the head).
        this.inFlight = false;
        if (!this.online) return; // wait for setOnline(true) to resume
        const delay = this.backoffMs(this.attempt);
        this.attempt += 1;
        this.timer = this.setTimer(() => {
          this.timer = null;
          this.processNext();
        }, delay);
      },
    );
  }

  private resolveDrainWaiters(): void {
    const waiters = this.drainWaiters;
    this.drainWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  private notify(): void {
    const status = this.status;
    this.listeners.forEach((listener) => listener(status));
  }
}
