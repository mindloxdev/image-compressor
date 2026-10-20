/**
 * Saving results to disk: one file, or an archive for a batch.
 *
 * Results are held as `Blob`s rather than `Uint8Array`s throughout. A Blob is
 * managed by the browser and can be spilled to disk; a typed array is pinned in
 * the JavaScript heap, and a hundred results sitting in the heap alongside the
 * work in progress is exactly how a tab gets killed.
 */

import { memoryBudgetBytes, readDeviceMemoryGb } from '@/engine/memory';

import { archiveName, deduplicateNames } from './filenames';

export interface ArchiveEntry {
  name: string;
  blob: Blob;
}

/**
 * Trigger a download. The object URL is released on a timer — revoking it
 * synchronously cancels the download in Safari.
 */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Long enough for every browser to have taken the blob, short enough that a
  // large archive is not pinned in memory for a minute after it is saved.
  setTimeout(() => URL.revokeObjectURL(url), 20_000);
}

/**
 * Largest archive we will build in one go.
 *
 * JSZip assembles the whole archive in memory before handing back a Blob, and
 * measurement puts the peak at roughly twice the finished archive: a 58 MB zip
 * of 42 images cost about 116 MB of heap. An unbounded batch would therefore
 * need twice its entire output resident at once, which is the one place in
 * this application where a large job can still spike memory on the main
 * thread. Splitting keeps that peak bounded however much was compressed.
 */
export function maxArchiveBytes(deviceMemoryGb = readDeviceMemoryGb()): number {
  const budget = memoryBudgetBytes(deviceMemoryGb);
  // A sixth of the budget, so the doubling above still leaves plenty spare.
  return Math.min(150 * 1024 * 1024, Math.max(32 * 1024 * 1024, budget / 6));
}

export const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;

/**
 * Group entries into archives that each stay under `maxBytes`.
 * A single entry larger than the cap gets an archive to itself rather than
 * being dropped. Pure, so the packing is unit-tested.
 */
export function planArchives<T extends { blob: { size: number } }>(
  entries: readonly T[],
  maxBytes: number = maxArchiveBytes(),
): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;

  for (const entry of entries) {
    const size = entry.blob.size;
    if (current.length > 0 && currentBytes + size > maxBytes) {
      parts.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(entry);
    currentBytes += size;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

export interface ArchiveProgress {
  /** 0-1 across the whole operation, every part included. */
  fraction: number;
  part: number;
  partCount: number;
}

/**
 * Build and download one or more ZIPs.
 *
 * Entries are stored, not deflated: JPEG, PNG, WebP and AVIF are already
 * compressed, so deflate costs seconds of main-thread time to save a fraction
 * of a percent — and holding the deflate buffers is memory we would rather not
 * spend.
 */
export async function downloadArchive(
  entries: readonly ArchiveEntry[],
  onProgress?: (progress: ArchiveProgress) => void,
): Promise<void> {
  if (entries.length === 0) return;

  // Loaded on demand: a visitor who never downloads a batch never pays for it.
  const { default: JSZip } = await import('jszip');

  const names = deduplicateNames(entries.map((entry) => entry.name));
  const named = entries.map((entry, index) => ({ ...entry, name: names[index] ?? entry.name }));
  const parts = planArchives(named);

  for (let part = 0; part < parts.length; part += 1) {
    const zip = new JSZip();
    for (const entry of parts[part]!) {
      zip.file(entry.name, entry.blob, { compression: 'STORE' });
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (metadata) => {
      const within = Math.max(0, Math.min(1, metadata.percent / 100));
      onProgress?.({
        fraction: (part + within) / parts.length,
        part: part + 1,
        partCount: parts.length,
      });
    });

    downloadBlob(blob, archiveName(parts[part]!.length, new Date(), part, parts.length));

    // Browsers rate-limit rapid successive downloads; give each one a moment
    // and let the finished archive be collected before building the next.
    if (parts.length > 1) await new Promise((resolve) => setTimeout(resolve, 800));
  }

  onProgress?.({ fraction: 1, part: parts.length, partCount: parts.length });
}
