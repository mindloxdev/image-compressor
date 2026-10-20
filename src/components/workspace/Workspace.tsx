import { AlertTriangle, Download, FileArchive, Loader2, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatBytes } from '@/engine/bytes';
import type { DetectedFormat, EncodableFormat } from '@/engine/formats';
import { applyPreset } from '@/engine/presets';
import type { CompressionSettings, PresetId } from '@/engine/types';
import { useCompressionQueue } from '@/hooks/useCompressionQueue';

import { AdvancedPanel } from './AdvancedPanel';
import { CompareDialog } from './CompareDialog';
import { Dropzone } from './Dropzone';
import { FileRow } from './FileRow';
import { PresetPicker } from './PresetPicker';
import { QualityCompareDialog } from './QualityCompareDialog';

export interface WorkspaceProps {
  /** Starting settings for this page — a /compress-jpg page differs from home. */
  initialSettings?: Partial<CompressionSettings>;
  /** Restrict which input formats this page accepts. */
  accept?: readonly DetectedFormat[];
  acceptAttribute?: string;
  formatChips?: readonly string[];
  /** Heading rendered above the workspace, if any. */
  heading?: string;
  id?: string;
}

export function Workspace({
  initialSettings,
  accept,
  acceptAttribute,
  formatChips,
  heading,
  id = 'workspace',
}: WorkspaceProps) {
  const queue = useCompressionQueue(initialSettings, accept);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [trialId, setTrialId] = useState<string | null>(null);

  const {
    items,
    settings,
    setSettings,
    totals,
    isBusy,
    rejected,
    dismissRejected,
    zipProgress,
    degradedReason,
  } = queue;

  /** The format most of the list will be written in, used to label controls. */
  const likelyFormat: EncodableFormat = useMemo(() => {
    if (settings.outputFormat !== 'keep') return settings.outputFormat;
    const counts = new Map<EncodableFormat, number>();
    for (const item of items) {
      const format: EncodableFormat =
        item.sourceFormat === 'jpeg' ||
        item.sourceFormat === 'png' ||
        item.sourceFormat === 'webp' ||
        item.sourceFormat === 'avif'
          ? item.sourceFormat
          : 'png';
      counts.set(format, (counts.get(format) ?? 0) + 1);
    }
    let best: EncodableFormat = 'jpeg';
    let bestCount = -1;
    for (const [format, count] of counts) {
      if (count > bestCount) {
        best = format;
        bestCount = count;
      }
    }
    return bestCount < 0 ? 'jpeg' : best;
  }, [items, settings.outputFormat]);

  const readyCount = items.filter(
    (item) => item.status === 'queued' || item.status === 'cancelled' || item.status === 'failed',
  ).length;
  const doneCount = items.filter((item) => item.result).length;
  const compareItem = items.find((item) => item.id === compareId) ?? null;
  const trialItem = items.find((item) => item.id === trialId) ?? null;

  const onPreset = (preset: Exclude<PresetId, 'custom'>) => {
    setSettings((current) => applyPreset(current, preset, likelyFormat));
  };

  return (
    <section id={id} className="scroll-mt-20">
      {heading ? (
        <h2 className="mb-4 text-xl font-semibold text-ink sm:text-2xl">{heading}</h2>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Files */}
        <div className="min-w-0 space-y-4">
          {items.length === 0 ? (
            <Dropzone
              onFiles={(files) => void queue.addFiles(files)}
              accept={acceptAttribute}
              formats={formatChips}
            />
          ) : (
            <>
              <div className="card flex flex-wrap items-center gap-2 p-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={readyCount === 0 || isBusy}
                  onClick={() => void queue.compressAll()}
                >
                  {isBusy ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Zap size={16} aria-hidden="true" />
                  )}
                  {isBusy
                    ? 'Compressing…'
                    : readyCount === items.length
                      ? `Compress ${readyCount} image${readyCount === 1 ? '' : 's'}`
                      : `Compress ${readyCount} remaining`}
                </button>

                {doneCount > 1 ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void queue.downloadAll()}
                    disabled={zipProgress !== null}
                  >
                    {zipProgress !== null ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <FileArchive size={16} aria-hidden="true" />
                    )}
                    {zipProgress !== null
                      ? zipProgress.partCount > 1
                        ? `Building ZIP ${zipProgress.part} of ${zipProgress.partCount} — ${Math.round(zipProgress.fraction * 100)}%`
                        : `Building ZIP ${Math.round(zipProgress.fraction * 100)}%`
                      : `Download all (${doneCount}) as ZIP`}
                  </button>
                ) : null}

                {isBusy ? (
                  <button type="button" className="btn btn-ghost" onClick={queue.cancelAll}>
                    Stop all
                  </button>
                ) : null}

                <label className="btn btn-ghost ml-auto cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept={acceptAttribute}
                    className="sr-only"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      if (files.length) void queue.addFiles(files);
                      event.target.value = '';
                    }}
                  />
                  Add more images
                </label>

                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={queue.clearAll}
                  aria-label="Remove every image and clear all previews"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Clear
                </button>
              </div>

              {/* Savings dashboard — only ever shows measured output sizes. */}
              {doneCount > 0 ? (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-ink">
                    {doneCount} of {items.length - totals.blocked} compressed
                  </h3>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                    <Metric label="Original total" value={formatBytes(totals.originalBytes)} />
                    <Metric label="Compressed total" value={formatBytes(totals.outputBytes)} />
                    <Metric
                      label="Space saved"
                      value={formatBytes(totals.savedBytes)}
                      tone="save"
                      large
                    />
                    <Metric
                      label="Reduction"
                      value={`${totals.savedPercent}%`}
                      tone="save"
                      large
                    />
                  </dl>
                  <p className="sr-only" aria-live="polite">
                    {doneCount} images compressed, {formatBytes(totals.savedBytes)} saved,{' '}
                    {totals.savedPercent} percent smaller.
                  </p>
                  {totals.grewCount > 0 ? (
                    <p className="mt-3 flex items-start gap-2 rounded-control bg-warn-soft px-3 py-2 text-xs text-warn">
                      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                      <span>
                        {totals.grewCount} image{totals.grewCount === 1 ? '' : 's'} came out larger
                        than the original and {totals.grewCount === 1 ? 'is' : 'are'} counted above
                        as-is. Those files are already well compressed — keep the originals.
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <ul className="space-y-2.5">
                {items.map((item) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    onRemove={() => queue.remove(item.id)}
                    onRetry={() => void queue.compressOne(item.id)}
                    onCancel={() => queue.cancel(item.id)}
                    onCompare={() => setCompareId(item.id)}
                    onCompareSettings={() => setTrialId(item.id)}
                    onDownload={() => queue.downloadOne(item.id)}
                  />
                ))}
              </ul>

              <Dropzone
                onFiles={(files) => void queue.addFiles(files)}
                accept={acceptAttribute}
                formats={formatChips}
                compact
              />
            </>
          )}

          {degradedReason ? (
            <p
              role="status"
              className="card flex items-start gap-2 border-warn/40 bg-warn-soft p-3 text-xs text-warn"
            >
              <AlertTriangle size={15} className="mt-px shrink-0" aria-hidden="true" />
              <span>{degradedReason}</span>
            </p>
          ) : null}

          {rejected.length > 0 ? (
            <div className="card border-warn/40 bg-warn-soft p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-warn">
                    {rejected.length} file{rejected.length === 1 ? '' : 's'} not added
                  </h3>
                  <ul className="mt-1 space-y-1 text-xs text-warn">
                    {rejected.map((entry, index) => (
                      <li key={`${entry.name}-${index}`}>
                        <span className="font-medium">{entry.name}</span> — {entry.reason}
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="button" className="btn btn-quiet shrink-0" onClick={dismissRejected}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Settings */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">Compression</h3>
            <PresetPicker value={settings.preset} onChange={onPreset} />
          </div>

          <AdvancedPanel
            settings={settings}
            onChange={(next) => setSettings(next)}
            likelyFormat={likelyFormat}
          />

          {doneCount > 0 ? (
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => void queue.downloadAll()}
              disabled={zipProgress !== null}
            >
              <Download size={16} aria-hidden="true" />
              Download {doneCount} result{doneCount === 1 ? '' : 's'}
            </button>
          ) : null}
        </div>
      </div>

      <CompareDialog
        item={compareItem}
        onClose={() => setCompareId(null)}
        onDownload={() => {
          if (compareItem) queue.downloadOne(compareItem.id);
        }}
      />

      <QualityCompareDialog
        item={trialItem}
        settings={settings}
        onClose={() => setTrialId(null)}
        onPick={(quality) =>
          setSettings((current) => ({ ...current, quality, preset: 'custom' }))
        }
      />
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
  large,
}: {
  label: string;
  value: string;
  tone?: 'save';
  large?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd
        className={`tabular mt-0.5 font-semibold ${large ? 'text-lg' : 'text-base'} ${
          tone === 'save' ? 'text-save' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
