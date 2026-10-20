/**
 * The workspace state machine.
 *
 * Holds one entry per file, the batch settings, and the lifecycle of every
 * object URL. Files themselves are never read into memory here — a `File` is a
 * lazy handle onto disk, and the worker reads each one only when its turn
 * comes, which is what lets a hundred-image batch stay flat on memory.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MAX_PIXELS } from '@/engine/codecs';
import { detectFormat, isAnimated, FORMAT_LABEL, MIME_BY_FORMAT } from '@/engine/formats';
import type { DetectedFormat, EncodableFormat } from '@/engine/formats';
import { CancelledError, CompressionError, getPool } from '@/engine/pool';
import { probeImage, type Probe } from '@/engine/probe';
import type { ProgressPhase } from '@/engine/protocol';
import { DEFAULT_SETTINGS, type CompressionSettings, type CompressionOutcome, type JobStatus } from '@/engine/types';
import { downloadArchive, downloadBlob, type ArchiveProgress } from '@/lib/download';
import { outputFileName, sanitiseFileName } from '@/lib/filenames';
import { recommend, type Recommendation } from '@/lib/recommend';

/** Above this, a single image reliably exhausts a mobile browser. */
export const MAX_FILE_BYTES = 60 * 1024 * 1024;
export const MAX_FILES = 100;
/** Bytes read from the front of each file to identify and measure it. */
const HEADER_BYTES = 65_536;

export interface QueueResult {
  /**
   * The output as a Blob, not a typed array. The browser can page a Blob out
   * to disk; a Uint8Array is pinned in the JavaScript heap, and a hundred of
   * them alongside the work in progress is what kills the tab.
   */
  blob: Blob;
  outcome: CompressionOutcome;
  url: string;
  name: string;
}

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  sourceBytes: number;
  sourceFormat: DetectedFormat;
  probe: Probe | null;
  status: JobStatus;
  progress: number;
  phase: ProgressPhase | null;
  /** Set when the file cannot be processed at all (animated, SVG, too large). */
  blockedReason: string | null;
  error: string | null;
  result: QueueResult | null;
  previewUrl: string | null;
  recommendation: Recommendation | null;
  /** Per-file override; falls back to the batch settings when null. */
  override: CompressionSettings | null;
}

export interface BatchTotals {
  files: number;
  done: number;
  failed: number;
  blocked: number;
  originalBytes: number;
  outputBytes: number;
  savedBytes: number;
  savedPercent: number;
  grewCount: number;
}

export interface RejectedFile {
  name: string;
  reason: string;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `f${counter}-${Date.now().toString(36)}`;
}

function revoke(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}

export interface UseCompressionQueue {
  items: QueueItem[];
  settings: CompressionSettings;
  setSettings: (next: CompressionSettings | ((current: CompressionSettings) => CompressionSettings)) => void;
  rejected: RejectedFile[];
  dismissRejected: () => void;
  totals: BatchTotals;
  isBusy: boolean;
  zipProgress: ArchiveProgress | null;
  /** Set once the pool narrows itself after running out of memory. */
  degradedReason: string | null;
  addFiles: (files: Iterable<File>) => Promise<void>;
  compressAll: () => Promise<void>;
  compressOne: (id: string) => Promise<void>;
  cancel: (id: string) => void;
  cancelAll: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  setOverride: (id: string, override: CompressionSettings | null) => void;
  downloadOne: (id: string) => void;
  downloadAll: () => Promise<void>;
}

export function useCompressionQueue(
  initialSettings: Partial<CompressionSettings> = {},
  accept?: readonly DetectedFormat[],
): UseCompressionQueue {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [settings, setSettings] = useState<CompressionSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [zipProgress, setZipProgress] = useState<ArchiveProgress | null>(null);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);

  // Callbacks need the current list without re-binding on every render.
  const itemsRef = useRef<QueueItem[]>(items);
  itemsRef.current = items;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Every object URL ever handed out, so unmount can release all of them.
  const urlsRef = useRef<Set<string>>(new Set());

  const trackUrl = useCallback((url: string) => {
    urlsRef.current.add(url);
    return url;
  }, []);

  const releaseUrl = useCallback((url: string | null) => {
    if (!url) return;
    urlsRef.current.delete(url);
    revoke(url);
  }, []);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      for (const url of urls) revoke(url);
      urls.clear();
    };
  }, []);

  useEffect(() => {
    const pool = getPool();
    pool.setDegradeHandler((reason) => {
      setDegradedReason(
        `Processing has been slowed to one image at a time because ${reason}. ` +
          'Smaller batches, or a smaller maximum width, will be more reliable from here.',
      );
    });
    return () => pool.setDegradeHandler(null);
  }, []);

  const patch = useCallback((id: string, changes: Partial<QueueItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }, []);

  const addFiles = useCallback(
    async (files: Iterable<File>) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const refusals: RejectedFile[] = [];
      const room = MAX_FILES - itemsRef.current.length;
      const accepted = incoming.slice(0, Math.max(0, room));
      for (const file of incoming.slice(Math.max(0, room))) {
        refusals.push({
          name: file.name,
          reason: `The list is full at ${MAX_FILES} images. Compress these first, then add more.`,
        });
      }

      const prepared: QueueItem[] = [];

      for (const file of accepted) {
        if (file.size === 0) {
          refusals.push({ name: file.name, reason: 'The file is empty.' });
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          refusals.push({
            name: file.name,
            reason: `${(file.size / 1024 / 1024).toFixed(1)} MB is over the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.`,
          });
          continue;
        }

        // Identify from the bytes, not the extension — a .png that is really a
        // JPEG must be handled as a JPEG, and a .jpg that is a text file must
        // be refused before it reaches a worker.
        const header = new Uint8Array(
          await file.slice(0, Math.min(HEADER_BYTES, file.size)).arrayBuffer(),
        );
        const format = detectFormat(header);

        if (format === 'svg') {
          refusals.push({
            name: file.name,
            reason: 'SVG is a vector format with no pixels to compress. Export it as PNG or WebP first.',
          });
          continue;
        }
        if (format === 'unknown') {
          refusals.push({
            name: file.name,
            reason: 'This is not an image file we can read.',
          });
          continue;
        }
        if (accept && !accept.includes(format)) {
          refusals.push({
            name: file.name,
            reason: `This page takes ${accept.map((f) => FORMAT_LABEL[f]).join(', ')} files. ${FORMAT_LABEL[format]} works on the main compressor.`,
          });
          continue;
        }

        const probe = probeImage(header, format);
        const animated = isAnimated(header, format);

        // Refuse an image the device cannot decode, now, rather than after a
        // long read that ends with the tab being killed.
        if (probe && probe.width * probe.height > MAX_PIXELS) {
          refusals.push({
            name: file.name,
            reason:
              `${((probe.width * probe.height) / 1_000_000).toFixed(0)} megapixels ` +
              `(${probe.width} x ${probe.height}) is more than this device can decode safely. ` +
              `The limit here is ${Math.round(MAX_PIXELS / 1_000_000)} MP.`,
          });
          continue;
        }
        const previewUrl = trackUrl(URL.createObjectURL(file));

        prepared.push({
          id: nextId(),
          file,
          name: sanitiseFileName(file.name),
          sourceBytes: file.size,
          sourceFormat: format,
          probe,
          status: animated ? 'blocked' : 'queued',
          progress: 0,
          phase: null,
          blockedReason: animated
            ? `This ${FORMAT_LABEL[format]} is animated. Compressing it would keep only the first frame, so it has been left out.`
            : null,
          error: null,
          result: null,
          previewUrl,
          recommendation:
            probe && !animated
              ? recommend({
                  format,
                  width: probe.width,
                  height: probe.height,
                  bytes: file.size,
                  mayHaveAlpha: probe.mayHaveAlpha,
                })
              : null,
          override: null,
        });
      }

      if (prepared.length) setItems((current) => [...current, ...prepared]);
      if (refusals.length) setRejected((current) => [...current, ...refusals]);
    },
    [accept, trackUrl],
  );

  const runOne = useCallback(
    async (item: QueueItem) => {
      if (item.status === 'blocked') return;
      const effective = item.override ?? settingsRef.current;

      // Drop a previous result before replacing it.
      if (item.result) releaseUrl(item.result.url);
      // 'waiting', not 'processing': the pool meters jobs against its memory
      // budget, so a submitted job may sit in the queue for a while. Claiming
      // it is being worked on would be a small lie told many times over.
      patch(item.id, {
        status: 'waiting',
        progress: 0,
        phase: null,
        error: null,
        result: null,
      });
      let started = false;

      try {
        const { bytes, outcome } = await getPool().compress(
          item.id,
          async () => item.file.arrayBuffer(),
          item.file.type || MIME_BY_FORMAT.png,
          effective,
          (phase, value) => {
            if (!started) {
              started = true;
              patch(item.id, { status: 'processing', phase, progress: value });
              return;
            }
            patch(item.id, { phase, progress: value });
          },
          // Dimensions let the pool price the job against its memory budget.
          item.probe ? { width: item.probe.width, height: item.probe.height } : undefined,
        );

        const mimeType = MIME_BY_FORMAT[outcome.outputFormat as EncodableFormat];
        // Hand the bytes to a Blob and let the reference go: from here the
        // browser owns the memory and can page it out.
        const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
        const url = trackUrl(URL.createObjectURL(blob));
        patch(item.id, {
          status: 'done',
          progress: 1,
          phase: null,
          result: {
            blob,
            outcome,
            url,
            name: outputFileName(item.name, outcome.outputFormat),
          },
        });
      } catch (error) {
        if (error instanceof CancelledError) {
          patch(item.id, { status: 'cancelled', progress: 0, phase: null });
          return;
        }
        patch(item.id, {
          status: 'failed',
          progress: 0,
          phase: null,
          error:
            error instanceof CompressionError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Compression failed.',
        });
      }
    },
    [patch, releaseUrl, trackUrl],
  );

  const compressAll = useCallback(async () => {
    const pending = itemsRef.current.filter(
      (item) => item.status === 'queued' || item.status === 'cancelled' || item.status === 'failed',
    );
    if (pending.length === 0) return;
    // The pool decides how many run at once; queue them all and let it meter.
    await Promise.allSettled(pending.map((item) => runOne(item)));
  }, [runOne]);

  const compressOne = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((candidate) => candidate.id === id);
      if (item) await runOne(item);
    },
    [runOne],
  );

  const cancel = useCallback((id: string) => {
    getPool().cancel(id);
  }, []);

  const cancelAll = useCallback(() => {
    getPool().cancelAll();
  }, []);

  const remove = useCallback(
    (id: string) => {
      getPool().cancel(id);
      setItems((current) => {
        const target = current.find((item) => item.id === id);
        if (target) {
          releaseUrl(target.previewUrl);
          releaseUrl(target.result?.url ?? null);
        }
        return current.filter((item) => item.id !== id);
      });
    },
    [releaseUrl],
  );

  const clearAll = useCallback(() => {
    getPool().cancelAll();
    setItems((current) => {
      for (const item of current) {
        releaseUrl(item.previewUrl);
        releaseUrl(item.result?.url ?? null);
      }
      return [];
    });
    setRejected([]);
  }, [releaseUrl]);

  const setOverride = useCallback(
    (id: string, override: CompressionSettings | null) => {
      patch(id, { override });
    },
    [patch],
  );

  const downloadOne = useCallback((id: string) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item?.result) return;
    downloadBlob(item.result.blob, item.result.name);
  }, []);

  const downloadAll = useCallback(async () => {
    const entries = itemsRef.current
      .filter((item) => item.result)
      .map((item) => ({ name: item.result!.name, blob: item.result!.blob }));
    if (entries.length === 0) return;
    setZipProgress({ fraction: 0, part: 1, partCount: 1 });
    try {
      await downloadArchive(entries, setZipProgress);
    } finally {
      setZipProgress(null);
    }
  }, []);

  const dismissRejected = useCallback(() => setRejected([]), []);

  const totals = useMemo<BatchTotals>(() => {
    let originalBytes = 0;
    let outputBytes = 0;
    let done = 0;
    let failed = 0;
    let blocked = 0;
    let grewCount = 0;

    for (const item of items) {
      if (item.status === 'blocked') {
        blocked += 1;
        continue;
      }
      if (item.status === 'failed') {
        failed += 1;
        continue;
      }
      if (item.result) {
        done += 1;
        originalBytes += item.sourceBytes;
        outputBytes += item.result.outcome.outputBytes;
        if (item.result.outcome.grew) grewCount += 1;
      }
    }

    const savedBytes = originalBytes - outputBytes;
    return {
      files: items.length,
      done,
      failed,
      blocked,
      originalBytes,
      outputBytes,
      savedBytes,
      savedPercent: originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 1000) / 10 : 0,
      grewCount,
    };
  }, [items]);

  const isBusy = items.some(
    (item) => item.status === 'processing' || item.status === 'waiting',
  );

  return {
    items,
    settings,
    setSettings,
    rejected,
    dismissRejected,
    totals,
    isBusy,
    zipProgress,
    degradedReason,
    addFiles,
    compressAll,
    compressOne,
    cancel,
    cancelAll,
    remove,
    clearAll,
    setOverride,
    downloadOne,
    downloadAll,
  };
}
