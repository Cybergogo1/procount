/// <reference types="jest" />
import { SyncQueue, defaultBackoff, type ProcessFn } from '../syncQueue';
import type { SyncOp } from '../types';

/**
 * Unit tests for the background sync queue (brief Sections 7–8 + Section 15:
 * the sync queue is one of the "trickiest parts and worth covering").
 *
 * Timers are injected so backoff scheduling is deterministic — we capture the
 * pending timer and fire it manually rather than relying on wall-clock delays.
 */

// Flush pending microtasks (the promise `.then` chains inside the queue).
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type Harness = {
  queue: SyncQueue;
  process: jest.Mock<Promise<void>, [SyncOp]>;
  /** Run the currently-scheduled retry timer, if any. */
  runTimer: () => Promise<void>;
  /** Delay (ms) of the currently-scheduled timer, or null. */
  pendingDelay: () => number | null;
};

function makeHarness(process: ProcessFn): Harness {
  let pending: { fn: () => void; ms: number } | null = null;
  const mockProcess = process as jest.Mock<Promise<void>, [SyncOp]>;

  const queue = new SyncQueue({
    process,
    setTimer: (fn, ms) => {
      pending = { fn, ms };
      return 0 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: () => {
      pending = null;
    },
  });

  return {
    queue,
    process: mockProcess,
    pendingDelay: () => pending?.ms ?? null,
    runTimer: async () => {
      const t = pending;
      pending = null;
      t?.fn();
      await flush();
    },
  };
}

const insertOp = (id: string): SyncOp => ({
  type: 'insert_scan',
  id,
  sessionId: 'session-1',
  userId: 'user-1',
  barcode: `barcode-${id}`,
  quantity: 1,
  expression: '1',
  scannedAt: '2026-06-16T10:00:00.000Z',
});

describe('defaultBackoff', () => {
  it('doubles each attempt and caps at 30s', () => {
    expect(defaultBackoff(0)).toBe(1000);
    expect(defaultBackoff(1)).toBe(2000);
    expect(defaultBackoff(2)).toBe(4000);
    expect(defaultBackoff(3)).toBe(8000);
    expect(defaultBackoff(4)).toBe(16000);
    expect(defaultBackoff(5)).toBe(30000); // 32s clamped
    expect(defaultBackoff(10)).toBe(30000);
  });
});

describe('SyncQueue', () => {
  it('processes a single op and drains', async () => {
    const h = makeHarness(jest.fn().mockResolvedValue(undefined));
    h.queue.enqueue(insertOp('a'));
    await flush();

    expect(h.process).toHaveBeenCalledTimes(1);
    expect(h.queue.size).toBe(0);
    expect(h.queue.status).toBe('idle');
  });

  it('processes ops one at a time in FIFO order', async () => {
    const seen: string[] = [];
    const h = makeHarness(
      jest.fn().mockImplementation(async (op: SyncOp) => {
        seen.push(op.id);
      }),
    );

    h.queue.enqueue(insertOp('a'));
    h.queue.enqueue(insertOp('b'));
    h.queue.enqueue(insertOp('c'));
    await flush();
    await flush();
    await flush();

    expect(seen).toEqual(['a', 'b', 'c']);
    expect(h.queue.size).toBe(0);
  });

  it('reports "syncing" while pending and "idle" once drained', async () => {
    const statuses: string[] = [];
    const h = makeHarness(jest.fn().mockResolvedValue(undefined));
    h.queue.subscribe((s) => statuses.push(s));

    h.queue.enqueue(insertOp('a'));
    await flush();

    // initial 'idle', then 'syncing' on enqueue, then 'idle' on drain.
    expect(statuses[0]).toBe('idle');
    expect(statuses).toContain('syncing');
    expect(statuses[statuses.length - 1]).toBe('idle');
  });

  it('retries a failed write with exponential backoff', async () => {
    const process = jest
      .fn<Promise<void>, [SyncOp]>()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    const h = makeHarness(process);

    h.queue.enqueue(insertOp('a'));
    await flush();
    expect(h.process).toHaveBeenCalledTimes(1);
    expect(h.pendingDelay()).toBe(1000); // attempt 0

    await h.runTimer();
    expect(h.process).toHaveBeenCalledTimes(2);
    expect(h.pendingDelay()).toBe(2000); // attempt 1

    await h.runTimer();
    expect(h.process).toHaveBeenCalledTimes(3);
    expect(h.queue.size).toBe(0); // succeeded on third try
  });

  it('does not process while offline and resumes on reconnect', async () => {
    const h = makeHarness(jest.fn().mockResolvedValue(undefined));
    h.queue.setOnline(false);

    h.queue.enqueue(insertOp('a'));
    await flush();
    expect(h.process).not.toHaveBeenCalled();
    expect(h.queue.size).toBe(1);

    h.queue.setOnline(true);
    await flush();
    expect(h.process).toHaveBeenCalledTimes(1);
    expect(h.queue.size).toBe(0);
  });

  it('coalesces consecutive edits to the same scan', async () => {
    const h = makeHarness(jest.fn().mockResolvedValue(undefined));
    h.queue.setOnline(false); // hold everything in the queue

    h.queue.enqueue({ type: 'update_scan', id: 'x', quantity: 2, expression: '2' });
    h.queue.enqueue({ type: 'update_scan', id: 'x', quantity: 5, expression: '5' });
    h.queue.enqueue({ type: 'update_scan', id: 'x', quantity: 9, expression: '9' });
    expect(h.queue.size).toBe(1);

    h.queue.setOnline(true);
    await flush();

    expect(h.process).toHaveBeenCalledTimes(1);
    expect(h.process).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'update_scan', id: 'x', quantity: 9 }),
    );
  });

  it('keeps edits to different scans separate', () => {
    const h = makeHarness(jest.fn().mockResolvedValue(undefined));
    h.queue.setOnline(false);

    h.queue.enqueue({ type: 'update_scan', id: 'x', quantity: 2, expression: '2' });
    h.queue.enqueue({ type: 'update_scan', id: 'y', quantity: 3, expression: '3' });
    expect(h.queue.size).toBe(2);
  });

  it('resolves waitUntilDrained once the queue empties', async () => {
    let resolveWrite: (() => void) | undefined;
    const process = jest.fn<Promise<void>, [SyncOp]>().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    const h = makeHarness(process);

    h.queue.enqueue(insertOp('a'));
    await flush();

    let drained = false;
    const drainPromise = h.queue.waitUntilDrained().then(() => {
      drained = true;
    });

    expect(drained).toBe(false);
    resolveWrite?.();
    await flush();
    await drainPromise;
    expect(drained).toBe(true);
  });

  it('resolves waitUntilDrained immediately when already empty', async () => {
    const h = makeHarness(jest.fn().mockResolvedValue(undefined));
    await expect(h.queue.waitUntilDrained()).resolves.toBeUndefined();
  });
});
