import type { EncodableFormat } from './formats';
import type { CompressionSettings, PresetId } from './types';

/** Formats whose size is steered by a 1-100 quality number. PNG is not one. */
export type LossyFormat = 'jpeg' | 'webp' | 'avif';

export interface PresetDefinition {
  id: Exclude<PresetId, 'custom'>;
  name: string;
  tagline: string;
  /** What actually changes, in plain language — shown under the preset name. */
  description: string;
  /** Quality value per codec. The same number means different things to each. */
  quality: Record<LossyFormat, number>;
  /** Palette size for lossy PNG, or `null` to keep PNG lossless. */
  pngColors: number | null;
  pngDither: number;
  /** Warn the user before they pick it. */
  caution?: string;
}

/**
 * Three presets, deliberately. Each number below was chosen to sit in the range
 * where that codec stops gaining size and starts losing detail; they are
 * starting points, and the advanced panel exposes the real sliders.
 */
export const PRESETS: readonly PresetDefinition[] = [
  {
    id: 'best',
    name: 'Best Quality',
    tagline: 'Hard to tell apart',
    description:
      'Keeps fine detail and smooth gradients. PNGs stay lossless — only redundant data is stripped. Expect smaller savings on photos that are already optimised.',
    quality: { jpeg: 88, webp: 90, avif: 65 },
    pngColors: null,
    pngDither: 0,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    tagline: 'Recommended for the web',
    description:
      'The setting most websites want: a large drop in file size with differences that are hard to spot at normal viewing size.',
    quality: { jpeg: 75, webp: 78, avif: 50 },
    pngColors: 128,
    pngDither: 0.5,
  },
  {
    id: 'smallest',
    name: 'Smallest File',
    tagline: 'Size above all',
    description:
      'Pushes quality down until the file is as small as the codec will go. Good for thumbnails and previews.',
    quality: { jpeg: 55, webp: 58, avif: 35 },
    pngColors: 64,
    pngDither: 0.35,
    caution:
      'Visible quality loss is likely — look for blotchy skies, soft text and colour banding before you publish.',
  },
] as const;

export function getPreset(id: PresetId): PresetDefinition {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[1]!;
}

/**
 * Apply a preset to the current settings. `format` is the format the output
 * will actually be written in, so the right per-codec quality is picked.
 */
export function applyPreset(
  settings: CompressionSettings,
  id: Exclude<PresetId, 'custom'>,
  format: EncodableFormat,
): CompressionSettings {
  const preset = getPreset(id);
  return {
    ...settings,
    preset: id,
    // PNG has no quality dial — its preset lives in pngColors below.
    quality: format === 'png' ? settings.quality : preset.quality[format],
    pngLossy: preset.pngColors !== null,
    pngColors: preset.pngColors ?? settings.pngColors,
    pngDither: preset.pngDither,
  };
}

/**
 * Quality for a format under a preset, falling back to the custom value.
 * PNG returns 100: the PNG encoder ignores this value entirely, and its real
 * quality control is the palette size.
 */
export function qualityFor(settings: CompressionSettings, format: EncodableFormat): number {
  if (format === 'png') return 100;
  if (settings.preset === 'custom') return settings.quality;
  return getPreset(settings.preset).quality[format];
}

/** oxipng search effort. Level 3 is noticeably slower for a few percent more. */
export function oxipngLevel(preset: PresetId): number {
  return preset === 'best' ? 3 : 2;
}

/**
 * libwebp encode method: higher spends more CPU looking for smaller output.
 * 4 is libwebp's default; 5 is the last step with a worthwhile size return.
 */
export function webpMethod(preset: PresetId): number {
  return preset === 'smallest' ? 5 : 4;
}

/** libavif speed: lower is slower and smaller. 6 is a sane browser default. */
export function avifSpeed(preset: PresetId): number {
  return preset === 'best' ? 5 : 6;
}
