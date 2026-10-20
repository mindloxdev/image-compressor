import { Crop, FileDown, Images, Info, Settings2, Tag } from 'lucide-react';

import { Collapsible } from '@/components/ui/Collapsible';
import { ENCODABLE_FORMATS, FORMAT_LABEL, type EncodableFormat } from '@/engine/formats';
import { qualityFor } from '@/engine/presets';
import type { CompressionSettings } from '@/engine/types';
import { PRESET_GROUP_LABELS, SIZE_PRESETS, findSizePreset } from '@/lib/social';

export interface AdvancedPanelProps {
  settings: CompressionSettings;
  onChange: (next: CompressionSettings) => void;
  /** Format most of the current batch will be written in, for labelling. */
  likelyFormat: EncodableFormat;
}

const FORMAT_NOTES: Record<EncodableFormat, string> = {
  jpeg: 'Smallest for photographs. Cannot store transparency — transparent areas become white.',
  png: 'Lossless by default, and the only format here that is pixel-for-pixel identical. Best for screenshots, logos and flat graphics.',
  webp: 'Smaller than JPEG at the same quality and keeps transparency. Supported by every current browser.',
  avif: 'The smallest files of the four, and noticeably slower to produce. Supported in current Chrome, Firefox and Safari.',
};

export function AdvancedPanel({ settings, onChange, likelyFormat }: AdvancedPanelProps) {
  // Any manual change means the presets no longer describe what will happen.
  const update = (changes: Partial<CompressionSettings>, custom = true) => {
    onChange({ ...settings, ...changes, ...(custom ? { preset: 'custom' as const } : {}) });
  };

  const quality = qualityFor(settings, likelyFormat);
  const activeSizePreset = SIZE_PRESETS.find(
    (preset) =>
      settings.resizeEnabled &&
      preset.width === settings.maxWidth &&
      (preset.height ?? null) === settings.maxHeight,
  );

  return (
    <div className="space-y-2">
      <Collapsible
        title="Quality and format"
        icon={<Settings2 size={15} />}
        summary={
          likelyFormat === 'png'
            ? settings.pngLossy
              ? `${settings.pngColors} colours`
              : 'Lossless'
            : `Quality ${quality}`
        }
      >
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="output-format">
              Output format
            </label>
            <select
              id="output-format"
              className="field cursor-pointer"
              value={settings.outputFormat}
              onChange={(event) =>
                update({ outputFormat: event.target.value as CompressionSettings['outputFormat'] }, false)
              }
            >
              <option value="keep">Keep the original format</option>
              {ENCODABLE_FORMATS.map((format) => (
                <option key={format} value={format}>
                  Convert to {FORMAT_LABEL[format]}
                </option>
              ))}
            </select>
            <p className="hint mt-1.5">
              {settings.outputFormat === 'keep'
                ? 'Each image is written back out in the format it came in. GIF, BMP and TIFF are saved as PNG or JPEG, since they cannot be written back.'
                : FORMAT_NOTES[settings.outputFormat]}
            </p>
          </div>

          {likelyFormat === 'png' ? (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--c-brand)]"
                  checked={settings.pngLossy}
                  onChange={(event) => update({ pngLossy: event.target.checked })}
                />
                <span>
                  <span className="text-sm font-medium text-ink">Reduce the colour palette</span>
                  <span className="hint mt-0.5 block">
                    PNG is always lossless, so the only way to make one much smaller is to store
                    fewer colours. Turn this off to keep every pixel exactly as it is.
                  </span>
                </span>
              </label>

              {settings.pngLossy ? (
                <>
                  <div>
                    <div className="mb-1 flex items-baseline justify-between">
                      <label className="label mb-0" htmlFor="png-colours">
                        Colours
                      </label>
                      <span className="tabular text-sm text-ink">{settings.pngColors}</span>
                    </div>
                    <input
                      id="png-colours"
                      type="range"
                      className="slider"
                      min={2}
                      max={256}
                      step={2}
                      value={settings.pngColors}
                      aria-valuetext={`${settings.pngColors} colours`}
                      onChange={(event) => update({ pngColors: Number(event.target.value) })}
                    />
                    <p className="hint">
                      256 is the most a palette PNG can hold. Flat graphics often look unchanged at
                      64; photographs show banding below about 128.
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 flex items-baseline justify-between">
                      <label className="label mb-0" htmlFor="png-dither">
                        Dithering
                      </label>
                      <span className="tabular text-sm text-ink">
                        {Math.round(settings.pngDither * 100)}%
                      </span>
                    </div>
                    <input
                      id="png-dither"
                      type="range"
                      className="slider"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(settings.pngDither * 100)}
                      onChange={(event) => update({ pngDither: Number(event.target.value) / 100 })}
                    />
                    <p className="hint">
                      Scatters the colour error to hide banding in gradients. More dithering looks
                      smoother but compresses slightly worse.
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <label className="label mb-0" htmlFor="quality">
                  Quality
                </label>
                <span className="tabular text-sm text-ink">{quality}</span>
              </div>
              <input
                id="quality"
                type="range"
                className="slider"
                min={1}
                max={100}
                value={quality}
                aria-valuetext={`Quality ${quality} of 100`}
                onChange={(event) => update({ quality: Number(event.target.value) })}
              />
              <div className="flex justify-between text-xs text-faint">
                <span>Smaller file</span>
                <span>Better looking</span>
              </div>
              <p className="hint mt-1.5">
                {likelyFormat === 'avif'
                  ? 'AVIF quality numbers run lower than JPEG for the same look — 50 is a good default.'
                  : 'Quality is not a percentage of the original and is not comparable between formats. Around 75 is where most people stop seeing a difference in a JPEG.'}
              </p>
            </div>
          )}
        </div>
      </Collapsible>

      <Collapsible
        title="Resize"
        icon={<Crop size={15} />}
        summary={
          settings.resizeEnabled
            ? `${settings.maxWidth ?? 'auto'} × ${settings.maxHeight ?? 'auto'}`
            : 'Off'
        }
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--c-brand)]"
              checked={settings.resizeEnabled}
              onChange={(event) => update({ resizeEnabled: event.target.checked }, false)}
            />
            <span>
              <span className="text-sm font-medium text-ink">Limit the dimensions</span>
              <span className="hint mt-0.5 block">
                Resizing before compressing saves far more than quality settings alone. Images
                already smaller than the limit are left alone — nothing is ever enlarged.
              </span>
            </span>
          </label>

          {settings.resizeEnabled ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="max-width">
                    Max width (px)
                  </label>
                  <input
                    id="max-width"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20000}
                    className="field tabular"
                    value={settings.maxWidth ?? ''}
                    placeholder="Any"
                    onChange={(event) =>
                      update(
                        { maxWidth: event.target.value ? Number(event.target.value) : null },
                        false,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor="max-height">
                    Max height (px)
                  </label>
                  <input
                    id="max-height"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20000}
                    className="field tabular"
                    value={settings.maxHeight ?? ''}
                    placeholder="Any"
                    onChange={(event) =>
                      update(
                        { maxHeight: event.target.value ? Number(event.target.value) : null },
                        false,
                      )
                    }
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-[var(--c-brand)]"
                  checked={settings.preserveAspectRatio}
                  onChange={(event) => update({ preserveAspectRatio: event.target.checked }, false)}
                />
                <span className="text-sm text-ink">Keep the aspect ratio</span>
              </label>
              {!settings.preserveAspectRatio ? (
                <p className="rounded-control bg-warn-soft px-3 py-2 text-xs text-warn">
                  With this off, images are stretched to fit the box instead of being scaled.
                  Nothing is cropped.
                </p>
              ) : null}

              <div>
                <label className="label" htmlFor="size-preset">
                  Or pick a standard size
                </label>
                <select
                  id="size-preset"
                  className="field cursor-pointer"
                  value={activeSizePreset?.id ?? ''}
                  onChange={(event) => {
                    const preset = findSizePreset(event.target.value);
                    if (!preset) return;
                    update(
                      {
                        resizeEnabled: true,
                        maxWidth: preset.width,
                        maxHeight: preset.height,
                        preserveAspectRatio: true,
                      },
                      false,
                    );
                  }}
                >
                  <option value="">Custom dimensions</option>
                  {(['social', 'web', 'commerce'] as const).map((group) => (
                    <optgroup key={group} label={PRESET_GROUP_LABELS[group]}>
                      {SIZE_PRESETS.filter((preset) => preset.group === group).map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} — {preset.width}
                          {preset.height ? ` × ${preset.height}` : ' wide'}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="hint mt-1.5">
                  {activeSizePreset
                    ? activeSizePreset.note
                    : 'These are widely used sizes, not promises about what a platform will accept — every one of them publishes its own specification and changes it from time to time.'}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </Collapsible>

      <Collapsible
        title="Target file size"
        icon={<FileDown size={15} />}
        summary={settings.targetSizeEnabled ? `${settings.targetSizeKb} KB` : 'Off'}
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--c-brand)]"
              checked={settings.targetSizeEnabled}
              onChange={(event) => update({ targetSizeEnabled: event.target.checked }, false)}
            />
            <span>
              <span className="text-sm font-medium text-ink">Aim for a maximum file size</span>
              <span className="hint mt-0.5 block">
                Each image is encoded several times, narrowing in on the size you asked for. The
                result is measured, not estimated — if it cannot be reached, the report says so.
              </span>
            </span>
          </label>

          {settings.targetSizeEnabled ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {[50, 100, 200, 500, 1000].map((kb) => (
                  <button
                    key={kb}
                    type="button"
                    aria-pressed={settings.targetSizeKb === kb}
                    onClick={() => update({ targetSizeKb: kb }, false)}
                    className={`chip cursor-pointer transition-colors duration-150 ${
                      settings.targetSizeKb === kb
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`}
                  </button>
                ))}
              </div>

              <div>
                <label className="label" htmlFor="target-size">
                  Target (KB)
                </label>
                <input
                  id="target-size"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={20000}
                  className="field tabular"
                  value={settings.targetSizeKb}
                  onChange={(event) =>
                    update({ targetSizeKb: Math.max(5, Number(event.target.value) || 5) }, false)
                  }
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--c-brand)]"
                  checked={settings.allowResizeForTarget}
                  onChange={(event) => update({ allowResizeForTarget: event.target.checked }, false)}
                />
                <span>
                  <span className="text-sm text-ink">Shrink the dimensions if quality is not enough</span>
                  <span className="hint mt-0.5 block">
                    Without this, a large photo may not reach a small target at any quality.
                  </span>
                </span>
              </label>

              <p className="flex items-start gap-2 rounded-control bg-sunken px-3 py-2 text-xs text-muted">
                <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  An exact size cannot always be hit without visible quality loss. Small targets on
                  large photographs are the usual case.
                </span>
              </p>
            </>
          ) : null}
        </div>
      </Collapsible>

      <Collapsible
        title="Metadata"
        icon={<Tag size={15} />}
        summary={settings.keepMetadata ? 'Kept where possible' : 'Removed'}
      >
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--c-brand)]"
            checked={settings.keepMetadata}
            onChange={(event) => update({ keepMetadata: event.target.checked }, false)}
          />
          <span>
            <span className="text-sm font-medium text-ink">Keep camera metadata (EXIF)</span>
            <span className="hint mt-0.5 block">
              Only possible for JPEG saved as JPEG, where the original block is copied across with
              the rotation tag normalised. Every other combination comes out with no metadata at
              all, which is usually what you want — EXIF can include GPS coordinates.
            </span>
          </span>
        </label>
      </Collapsible>

      <p className="flex items-start gap-2 px-1 pt-1 text-xs text-faint">
        <Images size={14} className="mt-px shrink-0" aria-hidden="true" />
        <span>
          These settings apply to every image in the list. Change them and press Compress again to
          re-run with the new values.
        </span>
      </p>
    </div>
  );
}
