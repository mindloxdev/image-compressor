/**
 * Worker pool.
 *
 * The failure this is built to prevent is the tab being killed. Everything
 * runs client-side, so a hundred large images is a hundred large decoded
 * buffers competing for one heap, and a browser that runs out does not throw —
 * it discards the page. So admission is governed by an estimated memory cost
 * rather than a fixed worker count:
 *
 *   - a job starts only if its estimated peak fits the remaining budget;
 *   - one job is always allowed to run, however large, so nothing deadlocks;
 *   - a job that alone would take half the budget runs on its own;
 *   - workers are torn down when idle, releasing their WebAssembly heaps;
 *   - a job that stops reporting progress is killed rather than hanging;
 *   - an out-of-memory failure permanently narrows the pool for the session.
 *
 * Cancellation terminates the worker. There is no way to interrupt a running
 * WebAssembly encode from the outside, so the worker is replaced instead.
 */

import type { EncodableFormat } from './formats';
import {
  concurrencyForDevice,
  estimateJobBytes,
  isExclusive,
  memoryBudgetBytes,
  readDeviceMemoryGb,
} from './memory';
import type {
  ProgressPhase,
  SampleDoneMessage,
  WorkerRequest,
  WorkerResponse,
} from './protocol';
import type { CompressionOutcome, CompressionSettings } from './types';

export interface CompressJobResult {
  bytes: Uint8Array;
  outcome: CompressionOutcome;
}

export interface SampleJobResult {
  samples: { quality: number; bytes: Uint8Array }[];
  width: number;
  height: number;
  format: EncodableFormat;
}

/** Dimensions, so the pool can price a job before it starts. */
export interface JobCost {
  width: number;
  height: number;
}

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

export class CompressionError extends Error {
  readonly code: string;
  constructor(message: string, code = 'internal') {
    super(message);
    this.name = 'CompressionError';
    this.code = code;
  }
}

type ProgressHandler = (phase: ProgressPhase, value: number) => void;

interface QueuedJob {
  id: string;
  /** Read lazily so a queued batch does not hold every file in memory twice. */
  load: () => Promise<ArrayBuffer>;
  request: (bytes: ArrayBuffer) => WorkerRequest;
  onProgress?: ProgressHandler;
  reject: (error: unknown) => void;
  settle: (message: WorkerResponse) => boolean;
  /** Estimated peak heap, in bytes. */
  cost: number;
  /** True when this job must not share the pool. */
  exclusive: boolean;
}

interface Slot {
  worker: Worker;
  job: QueuedJob | null;
  /** When this slot last saw progress or a result, for the watchdog. */
  lastActivity: number;
}

/** No progress for this long means the job is wedged. */
const JOB_STALL_MS = 5 * 60 * 1000;
const WATCHDOG_INTERVAL_MS = 15_000;
/** Idle this long and the workers are released, freeing their codec heaps. */
const IDLE_SHUTDOWN_MS = 30_000;

export class CompressionPool {
  private readonly slots: Slot[] = [];
  private readonly queue: QueuedJob[] = [];
  private limit: number;
  private budget: number;
  private inFlightCost = 0;
  private disposed = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  /** Set once an out-of-memory failure is seen; the pool never widens again. */
  private degraded = false;
  private onDegrade: ((reason: string) => void) | null = null;

  constructor(limit?: number, budgetBytes?: number) {
    const memory = readDeviceMemoryGb();
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
    this.limit = Math.max(1, limit ?? concurrencyForDevice(cores, memory));
    this.budget = budgetBytes ?? memoryBudgetBytes(memory);
  }

  get concurrency(): number {
    return this.limit;
  }

  get memoryBudget(): number {
    return this.budget;
  }

  get isDegraded(): boolean {
    return this.degraded;
  }

  /** Jobs waiting plus jobs running. */
  get pending(): number {
    return this.queue.length + this.slots.filter((slot) => slot.job !== null).length;
  }

  /** Called when the pool narrows itself after an out-of-memory failure. */
  setDegradeHandler(handler: ((reason: string) => void) | null): void {
    this.onDegrade = handler;
  }

  compress(
    id: string,
    load: () => Promise<ArrayBuffer>,
    mimeType: string,
    settings: CompressionSettings,
    onProgress?: ProgressHandler,
    size?: JobCost,
  ): Promise<CompressJobResult> {
    return new Promise<CompressJobResult>((resolve, reject) => {
      this.enqueue({
        id,
        load,
        request: (bytes) => ({ type: 'compress', id, bytes, mimeType, settings }),
        onProgress,
        reject,
        settle: (message) => {
          if (message.type !== 'done') return false;
          resolve({ bytes: new Uint8Array(message.bytes), outcome: message.outcome });
          return true;
        },
        ...this.priceJob(size),
      });
    });
  }

  sample(
    id: string,
    load: () => Promise<ArrayBuffer>,
    mimeType: string,
    format: EncodableFormat,
    qualities: number[],
    settings: CompressionSettings,
    onProgress?: ProgressHandler,
    size?: JobCost,
  ): Promise<SampleJobResult> {
    return new Promise<SampleJobResult>((resolve, reject) => {
      this.enqueue({
        id,
        load,
        request: (bytes) => ({ type: 'sample', id, bytes, mimeType, format, qualities, settings }),
        onProgress,
        reject,
        settle: (message) => {
          if (message.type !== 'sampled') return false;
          const done = message as SampleDoneMessage;
          resolve({
            samples: done.samples.map((sample) => ({
              quality: sample.quality,
              bytes: new Uint8Array(sample.bytes),
            })),
            width: done.width,
            height: done.height,
            format: done.format,
          });
          return true;
        },
        ...this.priceJob(size),
      });
    });
  }

  private priceJob(size?: JobCost): { cost: number; exclusive: boolean } {
    // Without dimensions, assume a middling photo rather than nothing.
    const cost = size
      ? estimateJobBytes(size.width, size.height)
      : estimateJobBytes(4000, 3000);
    return { cost, exclusive: isExclusive(cost, this.budget) };
  }

  /** Abort one job, whether it is queued or already running. */
  cancel(id: string): void {
    const queuedIndex = this.queue.findIndex((job) => job.id === id);
    if (queuedIndex >= 0) {
      const [job] = this.queue.splice(queuedIndex, 1);
      job?.reject(new CancelledError());
      return;
    }
    const slot = this.slots.find((candidate) => candidate.job?.id === id);
    if (slot?.job) {
      const job = slot.job;
      this.release(slot);
      slot.worker.terminate();
      this.replaceWorker(slot);
      job.reject(new CancelledError());
      this.drain();
    }
  }

  cancelAll(): void {
    while (this.queue.length) {
      this.queue.pop()?.reject(new CancelledError());
    }
    for (const slot of this.slots) {
      if (!slot.job) continue;
      const job = slot.job;
      this.release(slot);
      slot.worker.terminate();
      this.replaceWorker(slot);
      job.reject(new CancelledError());
    }
  }

  /** Release every worker. The pool can still accept new work afterwards. */
  shutdownIdleWorkers(): void {
    for (let i = this.slots.length - 1; i >= 0; i -= 1) {
      const slot = this.slots[i]!;
      if (slot.job) continue;
      slot.worker.terminate();
      this.slots.splice(i, 1);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelAll();
    for (const slot of this.slots) slot.worker.terminate();
    this.slots.length = 0;
    this.stopTimers();
  }

  private enqueue(job: QueuedJob): void {
    if (this.disposed) {
      job.reject(new CompressionError('The compressor has been shut down.'));
      return;
    }
    this.cancelIdleShutdown();
    this.startWatchdog();
    this.queue.push(job);
    this.drain();
  }

  private spawn(): Worker {
    return new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
      name: 'pixelpress-codec',
    });
  }

  private replaceWorker(slot: Slot): void {
    if (this.disposed) return;
    slot.worker = this.spawn();
    this.attach(slot);
  }

  /** Free a slot and give its memory reservation back to the budget. */
  private release(slot: Slot): void {
    if (!slot.job) return;
    this.inFlightCost = Math.max(0, this.inFlightCost - slot.job.cost);
    slot.job = null;
  }

  private attach(slot: Slot): void {
    slot.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const job = slot.job;
      if (!job || job.id !== message.id) return; // stale message from a replaced job

      slot.lastActivity = Date.now();

      if (message.type === 'progress') {
        job.onProgress?.(message.phase, message.value);
        return;
      }
      if (message.type === 'error') {
        this.release(slot);
        if (message.code === 'oom') this.degrade('an image ran the browser out of memory');
        job.reject(new CompressionError(message.message, message.code ?? 'internal'));
        this.afterJob();
        return;
      }
      if (job.settle(message)) {
        this.release(slot);
        this.afterJob();
      }
    });

    slot.worker.addEventListener('error', (event: ErrorEvent) => {
      const job = slot.job;
      this.release(slot);
      if (job) {
        // A worker that dies outright is usually memory; narrow the pool.
        this.degrade('a compression worker stopped unexpectedly');
        job.reject(
          new CompressionError(
            event.message || 'The compression worker stopped unexpectedly.',
            'internal',
          ),
        );
      }
      slot.worker.terminate();
      this.replaceWorker(slot);
      this.afterJob();
    });
  }

  /**
   * Narrow the pool permanently for this session. Recovering from an
   * out-of-memory failure by trying the same concurrency again is how a tab
   * dies on the second attempt instead of the first.
   */
  private degrade(reason: string): void {
    if (this.degraded) return;
    this.degraded = true;
    this.limit = 1;
    this.budget = Math.max(192 * 1024 * 1024, Math.floor(this.budget * 0.6));
    this.shutdownIdleWorkers();
    this.onDegrade?.(reason);
  }

  private afterJob(): void {
    this.drain();
    if (this.pending === 0) this.scheduleIdleShutdown();
  }

  private freeSlot(): Slot | null {
    const idle = this.slots.find((slot) => slot.job === null);
    if (idle) return idle;
    if (this.slots.length >= this.limit) return null;
    const slot: Slot = { worker: this.spawn(), job: null, lastActivity: Date.now() };
    this.slots.push(slot);
    this.attach(slot);
    return slot;
  }

  private get runningCount(): number {
    return this.slots.filter((slot) => slot.job !== null).length;
  }

  private drain(): void {
    if (this.disposed) return;

    while (this.queue.length > 0) {
      const next = this.queue[0]!;
      const running = this.runningCount;

      // An exclusive job waits for an empty pool, then runs alone.
      if (next.exclusive && running > 0) return;
      // Admission against the budget, but one job always gets to run so a
      // single image larger than the whole budget cannot deadlock the queue.
      if (running > 0 && this.inFlightCost + next.cost > this.budget) return;

      const slot = this.freeSlot();
      if (!slot) return;

      this.queue.shift();
      slot.job = next;
      slot.lastActivity = Date.now();
      this.inFlightCost += next.cost;
      void this.start(slot, next);

      // Nothing else may start alongside an exclusive job.
      if (next.exclusive) return;
    }
  }

  private async start(slot: Slot, job: QueuedJob): Promise<void> {
    try {
      const bytes = await job.load();
      // The job may have been cancelled while the file was being read.
      if (slot.job !== job) return;
      slot.lastActivity = Date.now();
      slot.worker.postMessage(job.request(bytes), [bytes]);
    } catch (error) {
      if (slot.job === job) this.release(slot);
      job.reject(
        error instanceof Error
          ? new CompressionError(`Could not read the file: ${error.message}`, 'decode')
          : new CompressionError('Could not read the file.', 'decode'),
      );
      this.afterJob();
    }
  }

  /* ---------------------------------------------------------- timers ---- */

  private startWatchdog(): void {
    if (this.watchdog || this.disposed) return;
    this.watchdog = setInterval(() => this.checkForStalls(), WATCHDOG_INTERVAL_MS);
  }

  private checkForStalls(): void {
    const now = Date.now();
    for (const slot of this.slots) {
      const job = slot.job;
      if (!job) continue;
      if (now - slot.lastActivity < JOB_STALL_MS) continue;

      this.release(slot);
      slot.worker.terminate();
      this.replaceWorker(slot);
      job.reject(
        new CompressionError(
          'This image stopped responding and was given up on. It may be larger than this device can handle.',
          'stalled',
        ),
      );
    }
    this.drain();
    if (this.pending === 0) this.scheduleIdleShutdown();
  }

  private scheduleIdleShutdown(): void {
    if (this.idleTimer || this.disposed) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.pending > 0) return;
      // Each idle worker is holding codec heaps worth tens of megabytes.
      this.shutdownIdleWorkers();
      this.stopTimers();
    }, IDLE_SHUTDOWN_MS);
  }

  private cancelIdleShutdown(): void {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private stopTimers(): void {
    this.cancelIdleShutdown();
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }
}

let shared: CompressionPool | null = null;

/** One pool for the whole page; workers are expensive to spin up. */
export function getPool(): CompressionPool {
  if (!shared) shared = new CompressionPool();
  return shared;
}
