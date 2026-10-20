import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Columns2,
  Download,
  Info,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { formatBytes, savingsPercent } from '@/engine/bytes';
import { FORMAT_LABEL } from '@/engine/formats';
import type { ProgressPhase } from '@/engine/protocol';
import type { QueueItem } from '@/hooks/useCompressionQueue';

export interface FileRowProps {
  item: QueueItem;
  onRemove: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onCompare: () => void;
  onCompareSettings: () => void;
  onDownload: () => void;
}

const PHASE_LABEL: Record<ProgressPhase, string> = {
  decoding: 'Reading the image',
  resizing: 'Resizing',
  encoding: 'Compressing',
  searching: 'Searching for the target size',
  optimising: 'Optimising',
};

export function FileRow({
  item,
  onRemove,
  onRetry,
  onCancel,
  onCompare,
  onCompareSettings,
  onDownload,
}: FileRowProps) {
  const result = item.result;
  const outcome = result?.outcome;
  const percent = outcome ? savingsPercent(item.sourceBytes, outcome.outputBytes) : 0;
  const working = item.status === 'processing';
  const waiting = item.status === 'waiting';

  return (
    <li className="animate-in card flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4">
      {/* Thumbnail */}
      <div className="alpha-grid relative h-20 w-20 shrink-0 overflow-hidden rounded-control border border-line">
        {item.previewUrl ? (
          <img
            src={result?.url ?? item.previewUrl}
            alt={`Preview of ${item.name}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : null}
        {working || waiting ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45">
            <Loader2
              size={20}
              className={working ? 'animate-spin text-white' : 'text-white/70'}
              aria-hidden="true"
            />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={item.name}>
            {item.name}
          </p>
          <StatusBadge item={item} percent={percent} />
        </div>

        {/* Facts: always measured, never estimated. */}
        <dl className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <div className="flex gap-1">
            <dt className="sr-only">Original size</dt>
            <dd className="tabular">{formatBytes(item.sourceBytes)}</dd>
          </div>
          {outcome ? (
            <>
              <span aria-hidden="true" className="text-faint">
                →
              </span>
              <div className="flex gap-1">
                <dt className="sr-only">Compressed size</dt>
                <dd className="tabular font-semibold text-ink">
                  {formatBytes(outcome.outputBytes)}
                </dd>
              </div>
            </>
          ) : null}
          <span aria-hidden="true" className="text-line-strong">
            |
          </span>
          <div className="flex gap-1">
            <dt className="sr-only">Format</dt>
            <dd>
              {FORMAT_LABEL[item.sourceFormat]}
              {outcome && outcome.outputFormat !== item.sourceFormat
                ? ` → ${FORMAT_LABEL[outcome.outputFormat]}`
                : ''}
            </dd>
          </div>
          {item.probe ? (
            <>
              <span aria-hidden="true" className="text-line-strong">
                |
              </span>
              <div className="flex gap-1">
                <dt className="sr-only">Dimensions</dt>
                <dd className="tabular">
                  {item.probe.width} × {item.probe.height}
                  {outcome &&
                  (outcome.outputWidth !== item.probe.width ||
                    outcome.outputHeight !== item.probe.height)
                    ? ` → ${outcome.outputWidth} × ${outcome.outputHeight}`
                    : ''}
                </dd>
              </div>
            </>
          ) : null}
          {outcome?.qualityUsed !== null && outcome?.qualityUsed !== undefined ? (
            <>
              <span aria-hidden="true" className="text-line-strong">
                |
              </span>
              <div className="flex gap-1">
                <dt className="sr-only">Quality used</dt>
                <dd className="tabular">q{outcome.qualityUsed}</dd>
              </div>
            </>
          ) : null}
          {outcome?.paletteColors ? (
            <>
              <span aria-hidden="true" className="text-line-strong">
                |
              </span>
              <dd className="tabular">{outcome.paletteColors} colours</dd>
            </>
          ) : null}
        </dl>

        {working ? (
          <div className="mt-2.5">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress * 100)}
              aria-label={`Compressing ${item.name}`}
              className="relative h-1.5 w-full overflow-hidden rounded-full bg-sunken"
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(4, item.progress * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-faint" aria-live="polite">
              {item.phase ? PHASE_LABEL[item.phase] : 'Starting'}…
            </p>
          </div>
        ) : null}

        {item.blockedReason ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-control bg-warn-soft px-2.5 py-1.5 text-xs text-warn">
            <Ban size={13} className="mt-px shrink-0" aria-hidden="true" />
            <span>{item.blockedReason}</span>
          </p>
        ) : null}

        {item.error ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-control bg-bad-soft px-2.5 py-1.5 text-xs text-bad">
            <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
            <span>{item.error}</span>
          </p>
        ) : null}

        {outcome?.grew ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-control bg-warn-soft px-2.5 py-1.5 text-xs text-warn">
            <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
            <span>
              This came out larger than the original. Keep the original file — it is already better
              compressed than these settings can manage.
            </span>
          </p>
        ) : null}

        {item.recommendation && item.status === 'queued' ? (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer list-none text-brand">
              <span className="inline-flex items-center gap-1.5">
                <Info size={13} aria-hidden="true" />
                {item.recommendation.headline}
              </span>
            </summary>
            <ul className="mt-1.5 ml-4 list-disc space-y-1 text-muted">
              {item.recommendation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {outcome && outcome.notes.length > 0 ? (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer list-none text-muted hover:text-ink">
              What happened to this image ({outcome.notes.length})
            </summary>
            <ul className="mt-1.5 ml-4 list-disc space-y-1 text-muted">
              {outcome.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {/* Actions. A wrapping row rather than a column: batch work means long
          lists, and a stacked column made every row tall enough to halve how
          many files fit on screen. */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
        {result ? (
          <>
            <button type="button" className="btn btn-primary h-9 px-3 text-sm" onClick={onDownload}>
              <Download size={15} aria-hidden="true" />
              Save
            </button>
            <button type="button" className="btn btn-ghost h-9 px-3 text-sm" onClick={onCompare}>
              <Columns2 size={15} aria-hidden="true" />
              Compare
            </button>
          </>
        ) : null}

        {working ? (
          <button type="button" className="btn btn-ghost h-9 px-3 text-sm" onClick={onCancel}>
            Stop
          </button>
        ) : null}

        {!working && !result && item.status !== 'blocked' ? (
          <button
            type="button"
            className="btn btn-ghost h-9 px-3 text-sm"
            onClick={onCompareSettings}
            title="Encode this image at three quality levels and compare the real file sizes"
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            Try settings
          </button>
        ) : null}

        {(item.status === 'failed' || item.status === 'cancelled' || result) && !working ? (
          <button
            type="button"
            className="btn btn-quiet h-9 w-9 px-0"
            onClick={onRetry}
            aria-label={`Compress ${item.name} again`}
            title="Compress again with the current settings"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          className="btn btn-quiet h-9 w-9 px-0"
          onClick={onRemove}
          aria-label={`Remove ${item.name} from the list`}
          title="Remove from the list"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function StatusBadge({ item, percent }: { item: QueueItem; percent: number }) {
  if (item.status === 'done') {
    if (item.result?.outcome.grew) {
      return (
        <span className="chip shrink-0 border-warn/40 bg-warn-soft text-warn">No saving</span>
      );
    }
    return (
      <span className="chip tabular shrink-0 border-transparent bg-save-soft font-semibold text-save">
        <CheckCircle2 size={12} aria-hidden="true" />
        {percent}% smaller
      </span>
    );
  }
  if (item.status === 'processing') {
    return <span className="chip shrink-0">Working…</span>;
  }
  if (item.status === 'waiting') {
    return <span className="chip shrink-0">Queued</span>;
  }
  if (item.status === 'failed') {
    return <span className="chip shrink-0 border-bad/40 bg-bad-soft text-bad">Failed</span>;
  }
  if (item.status === 'blocked') {
    return <span className="chip shrink-0 border-warn/40 bg-warn-soft text-warn">Skipped</span>;
  }
  if (item.status === 'cancelled') {
    return <span className="chip shrink-0">Stopped</span>;
  }
  return <span className="chip shrink-0">Ready</span>;
}
