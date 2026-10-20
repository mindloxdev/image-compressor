import { Columns2, SquareSplitHorizontal, ZoomIn } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { Dialog } from '@/components/ui/Dialog';
import { formatBytes, savingsPercent } from '@/engine/bytes';
import { FORMAT_LABEL } from '@/engine/formats';
import type { QueueItem } from '@/hooks/useCompressionQueue';

export interface CompareDialogProps {
  item: QueueItem | null;
  onClose: () => void;
  onDownload: () => void;
}

type Mode = 'wipe' | 'split';

const ZOOM_LEVELS = [1, 2, 4] as const;

/**
 * Before-and-after viewer.
 *
 * The wipe handle can be dragged, but the position is also bound to a range
 * input — WCAG 2.2 requires a single-pointer alternative to any drag, and a
 * keyboard user needs to be able to inspect the seam too.
 */
export function CompareDialog({ item, onClose, onDownload }: CompareDialogProps) {
  const [mode, setMode] = useState<Mode>('wipe');
  const [position, setPosition] = useState(50);
  const [zoom, setZoom] = useState<(typeof ZOOM_LEVELS)[number]>(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromPointer = useCallback((clientX: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const fraction = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, fraction)));
  }, []);

  if (!item?.result) return null;

  const { outcome, url, name } = item.result;
  const percent = savingsPercent(item.sourceBytes, outcome.outputBytes);
  const resized =
    item.probe !== null &&
    (item.probe.width !== outcome.outputWidth || item.probe.height !== outcome.outputHeight);

  return (
    <Dialog
      open
      onClose={onClose}
      size="wide"
      title={name}
      description={`${formatBytes(item.sourceBytes)} → ${formatBytes(outcome.outputBytes)}${
        outcome.grew ? ' (larger)' : ` (${percent}% smaller)`
      }`}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={onDownload}>
            Save compressed image
          </button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Comparison layout"
          className="inline-flex rounded-control border border-line bg-surface p-0.5"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'wipe'}
            onClick={() => setMode('wipe')}
            className={`btn h-8 px-2.5 text-xs ${
              mode === 'wipe' ? 'bg-brand text-on-brand' : 'text-muted'
            }`}
          >
            <SquareSplitHorizontal size={14} aria-hidden="true" />
            Wipe
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'split'}
            onClick={() => setMode('split')}
            className={`btn h-8 px-2.5 text-xs ${
              mode === 'split' ? 'bg-brand text-on-brand' : 'text-muted'
            }`}
          >
            <Columns2 size={14} aria-hidden="true" />
            Side by side
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Zoom"
          className="inline-flex items-center gap-1 rounded-control border border-line bg-surface p-0.5"
        >
          <ZoomIn size={14} className="ml-1.5 text-faint" aria-hidden="true" />
          {ZOOM_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={zoom === level}
              onClick={() => setZoom(level)}
              className={`btn tabular h-8 px-2 text-xs ${
                zoom === level ? 'bg-brand text-on-brand' : 'text-muted'
              }`}
            >
              {level}×
            </button>
          ))}
        </div>

        {zoom > 1 ? (
          <span className="text-xs text-faint">Scroll inside the image to look around.</span>
        ) : null}
      </div>

      {mode === 'wipe' ? (
        <>
          <div className="alpha-grid overflow-auto rounded-control border border-line">
            <div
              ref={stageRef}
              className="relative select-none"
              style={{ width: `${zoom * 100}%` }}
              onPointerDown={(event) => {
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                setFromPointer(event.clientX);
              }}
              onPointerMove={(event) => {
                if (dragging.current) setFromPointer(event.clientX);
              }}
              onPointerUp={() => {
                dragging.current = false;
              }}
              onPointerCancel={() => {
                dragging.current = false;
              }}
            >
              <img
                src={item.previewUrl ?? ''}
                alt={`${name} before compression`}
                className="block w-full"
                draggable={false}
              />
              <img
                src={url}
                alt={`${name} after compression`}
                className="absolute inset-0 block w-full"
                style={{ clipPath: `inset(0 0 0 ${position}%)` }}
                draggable={false}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                style={{ left: `${position}%` }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white"
              >
                Original
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white"
              >
                Compressed
              </span>
            </div>
          </div>

          <label className="mt-3 block">
            <span className="label">Wipe position — {Math.round(position)}%</span>
            <input
              type="range"
              className="slider"
              min={0}
              max={100}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
              aria-valuetext={`${Math.round(position)}% across, original on the left`}
            />
          </label>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <figure className="m-0">
            <div className="alpha-grid overflow-auto rounded-control border border-line">
              <img
                src={item.previewUrl ?? ''}
                alt={`${name} before compression`}
                className="block"
                style={{ width: `${zoom * 100}%` }}
              />
            </div>
            <figcaption className="mt-1.5 text-xs text-muted">
              Original — <span className="tabular">{formatBytes(item.sourceBytes)}</span>
              {item.probe ? (
                <span className="tabular">
                  {' '}
                  · {item.probe.width} × {item.probe.height}
                </span>
              ) : null}
              {' '}· {FORMAT_LABEL[item.sourceFormat]}
            </figcaption>
          </figure>
          <figure className="m-0">
            <div className="alpha-grid overflow-auto rounded-control border border-line">
              <img
                src={url}
                alt={`${name} after compression`}
                className="block"
                style={{ width: `${zoom * 100}%` }}
              />
            </div>
            <figcaption className="mt-1.5 text-xs text-muted">
              Compressed —{' '}
              <span className="tabular font-semibold text-ink">
                {formatBytes(outcome.outputBytes)}
              </span>
              <span className="tabular">
                {' '}
                · {outcome.outputWidth} × {outcome.outputHeight}
              </span>{' '}
              · {FORMAT_LABEL[outcome.outputFormat]}
            </figcaption>
          </figure>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-control bg-sunken p-3 text-sm sm:grid-cols-4">
        <Stat label="Original" value={formatBytes(item.sourceBytes)} />
        <Stat label="Compressed" value={formatBytes(outcome.outputBytes)} strong />
        <Stat
          label={outcome.grew ? 'Increase' : 'Saved'}
          value={`${formatBytes(Math.abs(item.sourceBytes - outcome.outputBytes))} (${Math.abs(percent)}%)`}
          tone={outcome.grew ? 'bad' : 'save'}
        />
        <Stat
          label="Output"
          value={`${FORMAT_LABEL[outcome.outputFormat]}${
            outcome.qualityUsed !== null && outcome.qualityUsed !== undefined
              ? ` q${outcome.qualityUsed}`
              : outcome.paletteColors
                ? ` ${outcome.paletteColors}c`
                : ' lossless'
          }`}
        />
      </dl>

      {resized ? (
        <p className="mt-2 text-xs text-muted">
          Dimensions changed from{' '}
          <span className="tabular">
            {item.probe?.width} × {item.probe?.height}
          </span>{' '}
          to{' '}
          <span className="tabular">
            {outcome.outputWidth} × {outcome.outputHeight}
          </span>
          , so the two images above are shown at the same display width rather than the same scale.
        </p>
      ) : null}

      {outcome.notes.length > 0 ? (
        <ul className="mt-3 ml-4 list-disc space-y-1 text-xs text-muted">
          {outcome.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </Dialog>
  );
}

function Stat({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'save' | 'bad';
}) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd
        className={`tabular mt-0.5 ${strong ? 'font-semibold' : ''} ${
          tone === 'save' ? 'font-semibold text-save' : tone === 'bad' ? 'text-bad' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
