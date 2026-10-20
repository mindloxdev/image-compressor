import type { DetectedFormat, EncodableFormat } from './formats';

export type PresetId = 'best' | 'balanced' | 'smallest' | 'custom';

/** `keep` means "re-encode as whatever came in". */
export type OutputFormatChoice = EncodableFormat | 'keep';

export interface CompressionSettings {
  preset: PresetId;
  /** 1–100. Meaning differs per codec but higher is always better looking. */
  quality: number;
  outputFormat: OutputFormatChoice;

  resizeEnabled: boolean;
  maxWidth: number | null;
  maxHeight: number | null;
  preserveAspectRatio: boolean;

  /** Copy the source EXIF block into JPEG output instead of dropping it. */
  keepMetadata: boolean;

  targetSizeEnabled: boolean;
  /** Desired ceiling in kilobytes (1 KB = 1024 B). */
  targetSizeKb: number;
  /** Allow the target-size search to shrink dimensions once quality bottoms out. */
  allowResizeForTarget: boolean;

  /** Reduce a PNG to a colour palette before encoding (real lossy PNG). */
  pngLossy: boolean;
  /** Palette size, 2–256. */
  pngColors: number;
  /** 0 = banding, 1 = full Floyd–Steinberg dithering. */
  pngDither: number;
}

export interface SourceImageInfo {
  format: DetectedFormat;
  width: number;
  height: number;
  bytes: number;
  animated: boolean;
  hasAlpha: boolean;
}

export interface CompressionOutcome {
  outputFormat: EncodableFormat;
  outputBytes: number;
  outputWidth: number;
  outputHeight: number;
  /**
   * Quality actually used — the target-size search may lower it.
   * `null` for PNG, which has no quality dial; see `paletteColors`.
   */
  qualityUsed: number | null;
  /** Palette size for a lossy PNG, `null` when the PNG stayed lossless. */
  paletteColors?: number | null;
  /** True when the bytes are the untouched source (lossless PNG pass-through). */
  passThrough: boolean;
  /** True when the output ended up larger than the input. */
  grew: boolean;
  /** Human-readable notes: alpha flattened, metadata dropped, target missed… */
  notes: string[];
  /** Populated when target-size mode ran. */
  target?: {
    requestedBytes: number;
    reached: boolean;
    attempts: number;
    scale: number;
  };
}

/** One entry of the "compare settings" grid. */
export interface QualitySample {
  quality: number;
  bytes: number;
  url: string;
}

export type JobStatus =
  | 'queued'
  /** Submitted to the pool, waiting for a free worker and memory budget. */
  | 'waiting'
  | 'analysing'
  | 'processing'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'blocked';

export const DEFAULT_SETTINGS: CompressionSettings = {
  preset: 'balanced',
  quality: 75,
  outputFormat: 'keep',
  resizeEnabled: false,
  maxWidth: 1920,
  maxHeight: null,
  preserveAspectRatio: true,
  keepMetadata: false,
  targetSizeEnabled: false,
  targetSizeKb: 200,
  allowResizeForTarget: true,
  pngLossy: true,
  pngColors: 128,
  pngDither: 0.5,
};
