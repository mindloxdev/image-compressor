/**
 * Memory budgeting.
 *
 * Every running job holds decoded pixels in the JavaScript heap, and a browser
 * tab that exceeds its heap is killed outright — no exception to catch, no
 * error to report, the page simply dies. So the pool admits work against a
 * budget rather than running a fixed number of jobs regardless of their size.
 *
 * Pure arithmetic, so the thresholds are testable without a browser.
 */

/** RGBA is 4 bytes per pixel. */
const BYTES_PER_PIXEL = 4;

/**
 * Peak working set for one job, as a multiple of the decoded image.
 *
 * At its worst the pipeline holds the decoded buffer, a resized copy, and the
 * encoder's own view of that copy at the same time. Three is the honest figure
 * for a resize-and-encode pass; the encoded output is small by comparison.
 */
const PEAK_COPIES = 3;

/** Nothing is free — the worker, its WebAssembly heaps and the codec tables. */
const WORKER_OVERHEAD_BYTES = 48 * 1024 * 1024;

/** Estimated peak heap for a job on an image of these dimensions. */
export function estimateJobBytes(width: number, height: number): number {
  const pixels = Math.max(0, Math.round(width)) * Math.max(0, Math.round(height));
  if (pixels === 0) return WORKER_OVERHEAD_BYTES;
  return pixels * BYTES_PER_PIXEL * PEAK_COPIES + WORKER_OVERHEAD_BYTES;
}

/**
 * How much heap we are willing to have in flight at once.
 *
 * `navigator.deviceMemory` reports total device RAM in gigabytes, rounded down
 * and capped at 8, and only Chromium implements it. A browser tab gets a
 * fraction of that, and we take a fraction again, because the page, the
 * previews and the finished results all have to live alongside the work.
 */
export function memoryBudgetBytes(deviceMemoryGb?: number): number {
  const gb = typeof deviceMemoryGb === 'number' && deviceMemoryGb > 0 ? deviceMemoryGb : 4;
  const budget = gb * 1024 * 1024 * 1024 * 0.18;
  // Never below 256 MB — one ordinary photo has to be able to run.
  // Never above 1.5 GB — beyond that we are guessing, and the guess is costly.
  return Math.min(Math.max(budget, 256 * 1024 * 1024), 1536 * 1024 * 1024);
}

/** Read the device hint, where the browser offers one. */
export function readDeviceMemoryGb(): number | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const value = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof value === 'number' && value > 0 ? value : undefined;
}

/**
 * An image big enough that it should not share the pool with anything else.
 * Running two of these together is the reliable way to lose the tab.
 */
export function isExclusive(costBytes: number, budgetBytes: number): boolean {
  return costBytes > budgetBytes * 0.5;
}

/**
 * Hard ceiling on a single image, scaled to the device.
 *
 * A 100 MP image is 400 MB decoded and 1.2 GB at peak, which no phone and few
 * laptops will survive. Refusing it with an explanation is better than a tab
 * that disappears mid-batch.
 */
export function maxPixelsForDevice(deviceMemoryGb?: number): number {
  const budget = memoryBudgetBytes(deviceMemoryGb);
  // Leave half the budget spare so a large image still has room to encode.
  const pixels = Math.floor((budget * 0.5) / (BYTES_PER_PIXEL * PEAK_COPIES));
  // Clamp to a sane range: at least 12 MP (a phone photo), at most 80 MP.
  return Math.min(Math.max(pixels, 12_000_000), 80_000_000);
}

/** Concurrency ceiling from the core count, before the budget narrows it. */
export function concurrencyForDevice(cores?: number, deviceMemoryGb?: number): number {
  const byCores = Math.max(1, Math.min(4, (cores ?? 2) - 1));
  // Under 4 GB, extra workers cost more in WebAssembly heaps than they return.
  if (deviceMemoryGb !== undefined && deviceMemoryGb < 4) return 1;
  if (deviceMemoryGb !== undefined && deviceMemoryGb < 8) return Math.min(byCores, 2);
  return byCores;
}
