/**
 * The compression pipeline, worker-side.
 *
 * decode → resize → flatten (if needed) → encode → metadata → honesty checks.
 * Every number it reports is measured from the bytes it actually produced.
 */

import {
  DecodeError,
  decode,
  encode,
  flattenAlpha,
  optimiseExistingPng,
  resizeImage,
  type EncodeParams,
} from './codecs';
import { fitWithin, sameSize, scaleSize, type Size } from './dimensions';
import { resolveOutputFormat } from './output-format';
import { injectExifSegment, prepareExifForReuse } from './exif';
import {
  detectFormat,
  isAnimated,
  MIME_BY_FORMAT,
  supportsTransparency,
  type DetectedFormat,
  type EncodableFormat,
} from './formats';
import { avifSpeed, oxipngLevel, qualityFor, webpMethod } from './presets';
import { probeImage } from './probe';
import { hasTransparency } from './quantize';
import { DEFAULT_TARGET_OPTIONS, searchForTargetSize } from './target';
import type { CompressionOutcome, CompressionSettings } from './types';

export interface PipelineResult {
  bytes: Uint8Array;
  outcome: CompressionOutcome;
}

export type ProgressReporter = (
  phase: 'decoding' | 'resizing' | 'encoding' | 'searching' | 'optimising',
  value: number,
) => void;

export async function compressImage(
  input: Uint8Array,
  mimeType: string,
  settings: CompressionSettings,
  report: ProgressReporter,
): Promise<PipelineResult> {
  const sourceFormat = detectFormat(input);

  if (sourceFormat === 'svg') {
    throw new DecodeError(
      'SVG is a vector format — there are no pixels to compress. Export it as PNG or WebP first.',
    );
  }
  if (sourceFormat === 'unknown') {
    throw new DecodeError('This file is not an image format we recognise.');
  }
  if (isAnimated(input, sourceFormat)) {
    throw new DecodeError(
      'This image is animated. Compressing it would keep only the first frame, so it has been left alone.',
    );
  }

  const notes: string[] = [];
  const originalBytes = input.byteLength;

  // Lossless pass-through: an unmodified PNG only needs oxipng, which rewrites
  // the container without touching a single pixel.
  if (canPassThroughPng(sourceFormat, settings)) {
    report('optimising', 0.3);
    const optimised = await optimiseExistingPng(input, oxipngLevel(settings.preset));
    report('optimising', 1);
    const useOriginal = optimised.byteLength >= originalBytes;
    const bytes = useOriginal ? input : optimised;
    if (useOriginal) {
      notes.push('This PNG is already fully optimised — the original is the smallest version.');
    } else {
      notes.push('Lossless: every pixel is identical to the original.');
    }
    const probe = measurePng(input);
    return {
      bytes,
      outcome: {
        outputFormat: 'png',
        outputBytes: bytes.byteLength,
        outputWidth: probe.width,
        outputHeight: probe.height,
        qualityUsed: null,
        paletteColors: null,
        passThrough: useOriginal,
        grew: false,
        notes,
      },
    };
  }

  report('decoding', 0.1);
  const decoded = await decode(input, mimeType || MIME_BY_FORMAT.png);
  report('decoding', 0.25);

  const sourceSize: Size = { width: decoded.width, height: decoded.height };
  const sourceHasAlpha = hasTransparency(decoded.imageData.data);

  const resolved = resolveOutputFormat(sourceFormat, settings.outputFormat, sourceHasAlpha);
  const outputFormat = resolved.format;
  if (resolved.note) notes.push(resolved.note);

  // The requested dimensions, before any target-size search gets involved.
  const requestedSize = settings.resizeEnabled
    ? fitWithin(sourceSize, {
        maxWidth: settings.maxWidth,
        maxHeight: settings.maxHeight,
        preserveAspectRatio: settings.preserveAspectRatio,
      })
    : sourceSize;

  if (settings.resizeEnabled && sameSize(requestedSize, sourceSize)) {
    notes.push('Already smaller than the size limit, so dimensions were left as they are.');
  }

  const flattening = sourceHasAlpha && !supportsTransparency(outputFormat);
  if (flattening) {
    notes.push('JPEG has no transparency, so transparent areas were filled with white.');
  }

  const params: EncodeParams = {
    format: outputFormat,
    quality: qualityFor(settings, outputFormat),
    pngLevel: oxipngLevel(settings.preset),
    webpMethod: webpMethod(settings.preset),
    avifSpeed: avifSpeed(settings.preset),
    pngColors: settings.pngLossy ? settings.pngColors : null,
    pngDither: settings.pngDither,
  };

  // Resized pixel buffers are expensive; one scale is reused across the
  // quality binary search, which only varies the quality parameter.
  let cachedScale = -1;
  let cachedPixels: ImageData | null = null;

  const pixelsAt = async (scale: number): Promise<ImageData> => {
    if (cachedScale === scale && cachedPixels) return cachedPixels;
    const size = scale === 1 ? requestedSize : scaleSize(requestedSize, scale);
    let pixels = decoded.imageData;
    if (!sameSize(size, sourceSize)) {
      report('resizing', 0.35);
      pixels = await resizeImage(decoded.imageData, size.width, size.height);
    }
    if (flattening) pixels = flattenAlpha(pixels);
    cachedScale = scale;
    cachedPixels = pixels;
    return pixels;
  };

  let encoded: Uint8Array;
  let qualityUsed = params.quality;
  let finalSize: Size;
  let target: CompressionOutcome['target'];

  if (settings.targetSizeEnabled) {
    const targetBytes = Math.max(1024, Math.round(settings.targetSizeKb * 1024));
    report('searching', 0.4);
    let progress = 0.4;

    const outcome = await searchForTargetSize(
      async (quality, scale) => {
        const pixels = await pixelsAt(scale);
        const bytes = await encode(pixels, { ...params, quality });
        progress = Math.min(0.92, progress + 0.07);
        report('searching', progress);
        return { byteLength: bytes.byteLength, bytes, width: pixels.width, height: pixels.height };
      },
      {
        ...DEFAULT_TARGET_OPTIONS,
        targetBytes,
        allowResize: settings.allowResizeForTarget,
      },
    );

    encoded = outcome.result.bytes;
    qualityUsed = outcome.quality;
    finalSize = { width: outcome.result.width, height: outcome.result.height };
    target = {
      requestedBytes: targetBytes,
      reached: outcome.reached,
      attempts: outcome.attempts,
      scale: outcome.scale,
    };
    notes.push(
      outcome.reached
        ? `Reached ${formatKb(encoded.byteLength)} against a ${formatKb(targetBytes)} target.`
        : `Could not reach ${formatKb(targetBytes)}. The smallest this image would go with these settings is ${formatKb(encoded.byteLength)}.`,
    );
    if (outcome.scale < 1) {
      notes.push(`Dimensions were reduced to ${finalSize.width} × ${finalSize.height} to approach the target.`);
    }
  } else {
    const pixels = await pixelsAt(1);
    report('encoding', 0.55);
    encoded = await encode(pixels, params);
    finalSize = { width: pixels.width, height: pixels.height };
  }

  report('encoding', 0.95);

  // Carry EXIF across, but only where it is actually possible.
  if (settings.keepMetadata) {
    if (outputFormat === 'jpeg' && sourceFormat === 'jpeg') {
      const exif = prepareExifForReuse(input);
      if (exif) {
        encoded = injectExifSegment(encoded, exif);
        notes.push('Camera metadata (EXIF) was copied across.');
      } else {
        notes.push('The original had no EXIF block to copy.');
      }
    } else {
      notes.push(
        'Metadata can only be carried across for JPEG → JPEG. This output has none.',
      );
    }
  } else if (sourceFormat === 'jpeg') {
    notes.push('Metadata (EXIF, GPS, camera details) was removed.');
  }

  const grew = encoded.byteLength >= originalBytes;
  if (grew) {
    notes.push(
      'The result is not smaller than the original — this image is already well compressed. Keep the original.',
    );
  }

  report('encoding', 1);

  return {
    bytes: encoded,
    outcome: {
      outputFormat,
      outputBytes: encoded.byteLength,
      outputWidth: finalSize.width,
      outputHeight: finalSize.height,
      // PNG has no quality number to report; its dial is the palette.
      qualityUsed: outputFormat === 'png' ? null : qualityUsed,
      paletteColors:
        outputFormat === 'png' ? (settings.pngLossy ? settings.pngColors : null) : undefined,
      passThrough: false,
      grew,
      notes,
      ...(target ? { target } : {}),
    },
  };
}

function canPassThroughPng(source: DetectedFormat, settings: CompressionSettings): boolean {
  return (
    source === 'png' &&
    (settings.outputFormat === 'keep' || settings.outputFormat === 'png') &&
    !settings.pngLossy &&
    !settings.resizeEnabled &&
    !settings.targetSizeEnabled
  );
}

/** IHDR dimensions, so the pass-through path can report size without decoding. */
function measurePng(bytes: Uint8Array): Size {
  const probe = probeImage(bytes, 'png');
  return probe ? { width: probe.width, height: probe.height } : { width: 0, height: 0 };
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(bytes < 102_400 ? 1 : 0)} KB`;
}

/**
 * Encode the same image at several qualities so the user can compare them.
 *
 * These run at the real output resolution, honouring the resize settings in
 * force, because a size measured from a shrunken preview would be a different
 * number from the file they end up downloading. That makes this expensive, so
 * it is only ever triggered by an explicit button.
 */
export async function sampleQualities(
  input: Uint8Array,
  mimeType: string,
  format: EncodableFormat,
  qualities: number[],
  settings: CompressionSettings,
  report?: ProgressReporter,
): Promise<{ samples: { quality: number; bytes: Uint8Array }[]; width: number; height: number }> {
  const decoded = await decode(input, mimeType);
  const sourceSize: Size = { width: decoded.width, height: decoded.height };
  const size = settings.resizeEnabled
    ? fitWithin(sourceSize, {
        maxWidth: settings.maxWidth,
        maxHeight: settings.maxHeight,
        preserveAspectRatio: settings.preserveAspectRatio,
      })
    : sourceSize;

  let pixels = decoded.imageData;
  if (!sameSize(size, sourceSize)) {
    pixels = await resizeImage(decoded.imageData, size.width, size.height);
  }
  if (!supportsTransparency(format) && hasTransparency(pixels.data)) {
    pixels = flattenAlpha(pixels);
  }

  const samples: { quality: number; bytes: Uint8Array }[] = [];
  for (let i = 0; i < qualities.length; i += 1) {
    const quality = qualities[i]!;
    const bytes = await encode(pixels, {
      format,
      quality,
      pngLevel: oxipngLevel(settings.preset),
      webpMethod: webpMethod(settings.preset),
      avifSpeed: avifSpeed(settings.preset),
      pngColors: settings.pngLossy ? settings.pngColors : null,
      pngDither: settings.pngDither,
    });
    samples.push({ quality, bytes });
    report?.('encoding', (i + 1) / qualities.length);
  }

  return { samples, width: size.width, height: size.height };
}

export { resolveOutputFormat };
