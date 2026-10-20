import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Dialog } from '@/components/ui/Dialog';
import { formatBytes, savingsPercent } from '@/engine/bytes';
import { FORMAT_LABEL, MIME_BY_FORMAT, type EncodableFormat } from '@/engine/formats';
import { getPool } from '@/engine/pool';
import { resolveOutputFormat } from '@/engine/output-format';
import type { QueueItem } from '@/hooks/useCompressionQueue';
import type { CompressionSettings } from '@/engine/types';

export interface QualityCompareDialogProps {
  item: QueueItem | null;
  settings: CompressionSettings;
  onClose: () => void;
  onPick: (quality: number) => void;
}

const QUALITIES = [90, 75, 60];

interface Sample {
  quality: number;
  bytes: number;
  url: string;
}

/**
 * Encode one image at three quality levels and show the real numbers.
 *
 * This is deliberately behind a button. Three full-resolution encodes is real
 * work — the whole point is that the sizes shown are the sizes you would
 * actually get, which rules out cheating with downscaled previews.
 */
export function QualityCompareDialog({
  item,
  settings,
  onClose,
  onPick,
}: QualityCompareDialogProps) {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const urls = useRef<string[]>([]);

  const format: EncodableFormat = item
    ? resolveOutputFormat(
        item.sourceFormat,
        settings.outputFormat,
        item.probe?.mayHaveAlpha ?? false,
      ).format
    : 'jpeg';

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    const jobId = `${item.id}-samples`;

    setSamples(null);
    setError(null);
    setProgress(0);

    void (async () => {
      try {
        const result = await getPool().sample(
          jobId,
          () => item.file.arrayBuffer(),
          item.file.type || MIME_BY_FORMAT.png,
          format,
          QUALITIES,
          settings,
          (_phase, value) => {
            if (!cancelled) setProgress(value);
          },
          item.probe ? { width: item.probe.width, height: item.probe.height } : undefined,
        );
        if (cancelled) return;
        const mapped = result.samples.map((sample) => {
          const url = URL.createObjectURL(
            new Blob([sample.bytes as unknown as BlobPart], { type: MIME_BY_FORMAT[format] }),
          );
          urls.current.push(url);
          return { quality: sample.quality, bytes: sample.bytes.byteLength, url };
        });
        setSamples(mapped);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not generate the comparison.');
        }
      }
    })();

    return () => {
      cancelled = true;
      getPool().cancel(jobId);
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current = [];
    };
  }, [item, format, settings]);

  if (!item) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      size="wide"
      title={`Try quality settings — ${item.name}`}
      description={`Three real ${FORMAT_LABEL[format]} encodes at the resolution you would actually download.`}
      footer={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      }
    >
      {error ? (
        <p className="rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>
      ) : !samples ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 size={24} className="animate-spin text-brand" aria-hidden="true" />
          <p className="text-sm text-muted" aria-live="polite">
            Encoding {QUALITIES.length} versions… {Math.round(progress * 100)}%
          </p>
          <p className="max-w-sm text-center text-xs text-faint">
            {format === 'avif'
              ? 'AVIF is the slowest of the four codecs — this can take a while on a large image.'
              : 'Each version is encoded at full size so the file sizes below are the real ones.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {samples.map((sample) => (
              <figure key={sample.quality} className="m-0">
                <div className="alpha-grid overflow-hidden rounded-control border border-line">
                  <img
                    src={sample.url}
                    alt={`${item.name} at quality ${sample.quality}`}
                    className="block aspect-4/3 w-full object-cover"
                  />
                </div>
                <figcaption className="mt-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="tabular text-sm font-semibold text-ink">
                      Quality {sample.quality}
                    </span>
                    <span className="tabular text-sm text-ink">{formatBytes(sample.bytes)}</span>
                  </div>
                  <p className="tabular mt-0.5 text-xs text-save">
                    {savingsPercent(item.sourceBytes, sample.bytes)}% smaller than the original
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost mt-2 h-9 w-full text-sm"
                    onClick={() => {
                      onPick(sample.quality);
                      onClose();
                    }}
                  >
                    Use quality {sample.quality}
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-4 text-xs text-faint">
            Previews are shown cropped to a common shape so the three sit side by side. Open the
            full comparison after compressing to inspect detail at 1:1.
          </p>
        </>
      )}
    </Dialog>
  );
}
