/**
 * Unit tests for the pure compression logic.
 *
 * Everything here runs in Node with no WebAssembly: format sniffing, dimension
 * arithmetic, the target-size search, colour quantisation, EXIF splicing and
 * filename handling. The codecs themselves are verified in a real browser by
 * `test/codec-check.ts` — see the README.
 */

import { describe, expect, it } from 'vitest';

import { bytesSaved, formatBytes, formatSavings, kbToBytes, savingsPercent } from '@/engine/bytes';
import { aspectRatioLabel, fitWithin, scaleSize } from '@/engine/dimensions';
import {
  extractExifSegment,
  injectExifSegment,
  normaliseOrientation,
  prepareExifForReuse,
} from '@/engine/exif';
import { detectFormat, isAnimated, supportsTransparency } from '@/engine/formats';
import { resolveOutputFormat } from '@/engine/output-format';
import { applyPreset, getPreset, qualityFor } from '@/engine/presets';
import { probeImage } from '@/engine/probe';
import { countDistinctColors, hasTransparency, quantize } from '@/engine/quantize';
import { searchForTargetSize } from '@/engine/target';
import { DEFAULT_SETTINGS } from '@/engine/types';
import {
  concurrencyForDevice,
  estimateJobBytes,
  isExclusive,
  maxPixelsForDevice,
  memoryBudgetBytes,
} from '@/engine/memory';
import { planArchives } from '@/lib/download';
import {
  archiveName,
  deduplicateNames,
  outputFileName,
  sanitiseFileName,
} from '@/lib/filenames';
import { bytesPerPixel, recommend } from '@/lib/recommend';

/* ------------------------------------------------------------------ helpers */

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function pad(data: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  out.set(data.subarray(0, Math.min(data.length, length)));
  return out;
}

/** A PNG signature plus a real IHDR chunk. */
function makePng(width: number, height: number, colourType: number, extra?: string): Uint8Array {
  const out = new Uint8Array(8 + 25 + (extra ? 12 : 0));
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(out.buffer);
  view.setUint32(8, 13); // IHDR length
  out.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
  view.setUint32(16, width);
  view.setUint32(20, height);
  out[24] = 8; // bit depth
  out[25] = colourType;
  if (extra) {
    view.setUint32(33, 0);
    for (let i = 0; i < 4; i += 1) out[37 + i] = extra.charCodeAt(i);
  }
  return out;
}

function makeJpeg(width: number, height: number): Uint8Array {
  // SOI, APP0/JFIF, SOF0 carrying the frame size.
  const out = new Uint8Array(32);
  out.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 0);
  out.set([0x4a, 0x46, 0x49, 0x46, 0x00], 6);
  const sof = 20;
  out.set([0xff, 0xc0, 0x00, 0x11, 0x08], sof);
  const view = new DataView(out.buffer);
  view.setUint16(sof + 5, height);
  view.setUint16(sof + 7, width);
  return out;
}

/** A JPEG with an APP1 Exif block whose IFD0 holds one Orientation tag. */
function makeJpegWithExif(orientation: number, littleEndian = false): Uint8Array {
  const payload = new Uint8Array(6 + 8 + 2 + 12 + 4);
  payload.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0); // 'Exif\0\0'
  const tiff = 6;
  const view = new DataView(payload.buffer);
  if (littleEndian) {
    payload.set([0x49, 0x49], tiff);
  } else {
    payload.set([0x4d, 0x4d], tiff);
  }
  view.setUint16(tiff + 2, 0x002a, littleEndian);
  view.setUint32(tiff + 4, 8, littleEndian); // IFD0 offset, relative to TIFF
  const ifd = tiff + 8;
  view.setUint16(ifd, 1, littleEndian); // one entry
  const entry = ifd + 2;
  view.setUint16(entry, 0x0112, littleEndian); // Orientation
  view.setUint16(entry + 2, 3, littleEndian); // SHORT
  view.setUint32(entry + 4, 1, littleEndian); // count
  view.setUint16(entry + 8, orientation, littleEndian);

  const segment = new Uint8Array(4 + payload.length);
  segment.set([0xff, 0xe1], 0);
  new DataView(segment.buffer).setUint16(2, payload.length + 2);
  segment.set(payload, 4);

  const jpeg = new Uint8Array(2 + segment.length + 4);
  jpeg.set([0xff, 0xd8], 0);
  jpeg.set(segment, 2);
  jpeg.set([0xff, 0xda, 0x00, 0x02], 2 + segment.length); // SOS
  return jpeg;
}

/* -------------------------------------------------------------------- bytes */

describe('byte formatting', () => {
  it('uses binary multiples and sensible precision', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(12 * 1024 * 1024)).toBe('12 MB');
  });

  it('handles values that are not numbers', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('reports savings, including negative ones', () => {
    expect(savingsPercent(1000, 250)).toBe(75);
    expect(savingsPercent(1000, 1000)).toBe(0);
    expect(savingsPercent(1000, 1200)).toBe(-20);
    expect(savingsPercent(0, 100)).toBe(0);
    expect(bytesSaved(1000, 250)).toBe(750);
    expect(formatSavings(1000, 250)).toBe('75% smaller');
    expect(formatSavings(1000, 1200)).toBe('20% larger');
    expect(formatSavings(1000, 1000)).toBe('No change');
  });

  it('converts kilobytes with the same 1024 convention', () => {
    expect(kbToBytes(100)).toBe(102_400);
  });
});

/* --------------------------------------------------------------- dimensions */

describe('fitWithin', () => {
  it('scales down to the tighter bound and keeps the ratio', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, { maxWidth: 1000, maxHeight: null, preserveAspectRatio: true }))
      .toEqual({ width: 1000, height: 750 });
    expect(fitWithin({ width: 4000, height: 3000 }, { maxWidth: 2000, maxHeight: 750, preserveAspectRatio: true }))
      .toEqual({ width: 1000, height: 750 });
  });

  it('never enlarges — inventing pixels cannot shrink a file', () => {
    expect(fitWithin({ width: 400, height: 300 }, { maxWidth: 1920, maxHeight: null, preserveAspectRatio: true }))
      .toEqual({ width: 400, height: 300 });
  });

  it('is a no-op when no bound is set', () => {
    expect(fitWithin({ width: 800, height: 600 }, { maxWidth: null, maxHeight: null, preserveAspectRatio: true }))
      .toEqual({ width: 800, height: 600 });
  });

  it('clamps each axis independently when the ratio is not preserved', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, { maxWidth: 1000, maxHeight: 1000, preserveAspectRatio: false }))
      .toEqual({ width: 1000, height: 1000 });
  });

  it('never produces a zero dimension', () => {
    const result = fitWithin({ width: 4000, height: 10 }, { maxWidth: 20, maxHeight: null, preserveAspectRatio: true });
    expect(result.width).toBe(20);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it('scales by a factor without collapsing', () => {
    expect(scaleSize({ width: 100, height: 50 }, 0.5)).toEqual({ width: 50, height: 25 });
    expect(scaleSize({ width: 3, height: 1 }, 0.01).height).toBe(1);
  });

  it('labels tidy aspect ratios and falls back for untidy ones', () => {
    expect(aspectRatioLabel({ width: 1920, height: 1080 })).toBe('16:9');
    expect(aspectRatioLabel({ width: 1000, height: 1000 })).toBe('1:1');
    expect(aspectRatioLabel({ width: 1853, height: 1047 })).toContain(':1');
  });
});

/* ------------------------------------------------------------------ formats */

describe('format detection', () => {
  it('identifies formats from their magic bytes', () => {
    expect(detectFormat(makeJpeg(100, 50))).toBe('jpeg');
    expect(detectFormat(makePng(10, 10, 6))).toBe('png');
    expect(detectFormat(pad(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61), 20))).toBe('gif');
    expect(detectFormat(pad(bytes(0x42, 0x4d, 1, 2, 3, 4), 20))).toBe('bmp');
    expect(detectFormat(pad(bytes(0x49, 0x49, 0x2a, 0x00), 20))).toBe('tiff');
  });

  it('identifies WebP only with both RIFF and WEBP present', () => {
    const webp = new Uint8Array(20);
    webp.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    webp.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(detectFormat(webp)).toBe('webp');

    const riffOnly = new Uint8Array(20);
    riffOnly.set([0x52, 0x49, 0x46, 0x46], 0);
    expect(detectFormat(riffOnly)).toBe('unknown');
  });

  it('identifies AVIF from the ftyp brand', () => {
    const avif = new Uint8Array(32);
    new DataView(avif.buffer).setUint32(0, 32);
    avif.set([0x66, 0x74, 0x79, 0x70], 4); // 'ftyp'
    avif.set([0x61, 0x76, 0x69, 0x66], 8); // 'avif'
    expect(detectFormat(avif)).toBe('avif');
  });

  it('recognises SVG text and refuses to treat it as a raster image', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectFormat(svg)).toBe('svg');
    const xmlSvg = new TextEncoder().encode('<?xml version="1.0"?><svg></svg>');
    expect(detectFormat(xmlSvg)).toBe('svg');
  });

  it('rejects files that are not images, and anything too short to tell', () => {
    expect(detectFormat(new TextEncoder().encode('just some text, honestly'))).toBe('unknown');
    expect(detectFormat(bytes(1, 2, 3))).toBe('unknown');
    expect(detectFormat(new Uint8Array(0))).toBe('unknown');
  });

  it('knows which formats can hold transparency', () => {
    expect(supportsTransparency('png')).toBe(true);
    expect(supportsTransparency('webp')).toBe(true);
    expect(supportsTransparency('avif')).toBe(true);
    expect(supportsTransparency('jpeg')).toBe(false);
  });
});

describe('animation detection', () => {
  it('spots an APNG by its acTL chunk', () => {
    expect(isAnimated(makePng(10, 10, 6, 'acTL'), 'png')).toBe(true);
    expect(isAnimated(makePng(10, 10, 6), 'png')).toBe(false);
  });

  it('spots an animated WebP by its ANIM chunk', () => {
    const webp = new Uint8Array(40);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    webp.set([0x41, 0x4e, 0x49, 0x4d], 12); // 'ANIM'
    expect(isAnimated(webp, 'webp')).toBe(true);
  });

  it('treats a single-frame GIF as still', () => {
    const gif = new Uint8Array(40);
    gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
    gif[10] = 0x00; // no global colour table
    gif[13] = 0x2c; // one image descriptor
    gif[23] = 0x00; // no local colour table
    gif[24] = 0x02; // LZW minimum code size
    gif[25] = 0x00; // end of sub-blocks
    gif[26] = 0x3b; // trailer
    expect(isAnimated(gif, 'gif')).toBe(false);
  });

  it('never reports animation for formats that cannot have it', () => {
    expect(isAnimated(makeJpeg(10, 10), 'jpeg')).toBe(false);
  });
});

/* -------------------------------------------------------------------- probe */

describe('header probing', () => {
  it('reads PNG dimensions and alpha from IHDR', () => {
    expect(probeImage(makePng(1280, 720, 6), 'png')).toEqual({
      width: 1280,
      height: 720,
      mayHaveAlpha: true,
    });
    expect(probeImage(makePng(640, 480, 2), 'png')?.mayHaveAlpha).toBe(false);
  });

  it('treats a palette PNG as transparent only when tRNS is present', () => {
    expect(probeImage(makePng(10, 10, 3), 'png')?.mayHaveAlpha).toBe(false);
    expect(probeImage(makePng(10, 10, 3, 'tRNS'), 'png')?.mayHaveAlpha).toBe(true);
  });

  it('reads JPEG dimensions from the start-of-frame marker', () => {
    expect(probeImage(makeJpeg(1600, 900), 'jpeg')).toEqual({
      width: 1600,
      height: 900,
      mayHaveAlpha: false,
    });
  });

  it('returns null rather than guessing when the header is unreadable', () => {
    expect(probeImage(bytes(0xff, 0xd8, 0xff, 0xe0), 'jpeg')).toBeNull();
  });
});

/* ------------------------------------------------------------ output format */

describe('resolveOutputFormat', () => {
  it('honours an explicit choice', () => {
    expect(resolveOutputFormat('png', 'webp', true).format).toBe('webp');
  });

  it('keeps a format that can be written back out', () => {
    for (const format of ['jpeg', 'png', 'webp', 'avif'] as const) {
      const resolved = resolveOutputFormat(format, 'keep', false);
      expect(resolved.format).toBe(format);
      expect(resolved.note).toBeUndefined();
    }
  });

  it('explains itself when the input format cannot be written', () => {
    const gif = resolveOutputFormat('gif', 'keep', true);
    expect(gif.format).toBe('png');
    expect(gif.note).toMatch(/GIF/);

    expect(resolveOutputFormat('bmp', 'keep', false).format).toBe('jpeg');
    expect(resolveOutputFormat('bmp', 'keep', true).format).toBe('png');
  });
});

/* ------------------------------------------------------------------ presets */

describe('presets', () => {
  it('gives each codec its own quality, because the scales differ', () => {
    const balanced = getPreset('balanced');
    expect(balanced.quality.jpeg).toBe(75);
    expect(balanced.quality.avif).toBeLessThan(balanced.quality.jpeg);
  });

  it('keeps PNG lossless under Best Quality', () => {
    expect(getPreset('best').pngColors).toBeNull();
    expect(getPreset('balanced').pngColors).toBe(128);
  });

  it('warns about the preset that visibly costs quality', () => {
    expect(getPreset('smallest').caution).toBeTruthy();
    expect(getPreset('best').caution).toBeUndefined();
  });

  it('reports no quality number for PNG, which has none', () => {
    expect(qualityFor({ ...DEFAULT_SETTINGS, preset: 'balanced' }, 'png')).toBe(100);
    expect(qualityFor({ ...DEFAULT_SETTINGS, preset: 'balanced' }, 'jpeg')).toBe(75);
  });

  it('uses the custom value only when the preset is custom', () => {
    const custom = { ...DEFAULT_SETTINGS, preset: 'custom' as const, quality: 42 };
    expect(qualityFor(custom, 'jpeg')).toBe(42);
  });

  it('applies a preset without disturbing unrelated settings', () => {
    const start = { ...DEFAULT_SETTINGS, resizeEnabled: true, maxWidth: 800 };
    const next = applyPreset(start, 'smallest', 'webp');
    expect(next.quality).toBe(58);
    expect(next.preset).toBe('smallest');
    expect(next.resizeEnabled).toBe(true);
    expect(next.maxWidth).toBe(800);
  });
});

/* -------------------------------------------------------------- target size */

describe('target-size search', () => {
  /** Smaller quality gives a smaller file; smaller scale gives a smaller file. */
  const curve = (base: number) => async (quality: number, scale: number) => ({
    byteLength: Math.round(base * (quality / 100) ** 2 * scale ** 2),
    quality,
    scale,
  });

  const options = {
    minQuality: 20,
    maxQuality: 95,
    maxAttempts: 12,
    allowResize: true,
    minScale: 0.25,
  };

  it('finds the highest quality that fits under the target', async () => {
    const outcome = await searchForTargetSize(curve(400_000), { ...options, targetBytes: 100_000 });
    expect(outcome.reached).toBe(true);
    expect(outcome.result.byteLength).toBeLessThanOrEqual(100_000);
    // 400000 * (q/100)^2 <= 100000 means q <= 50.
    expect(outcome.quality).toBe(50);
    expect(outcome.scale).toBe(1);
  });

  it('resizes when quality alone cannot reach the target', async () => {
    const outcome = await searchForTargetSize(curve(10_000_000), { ...options, targetBytes: 50_000 });
    expect(outcome.reached).toBe(true);
    expect(outcome.scale).toBeLessThan(1);
    expect(outcome.result.byteLength).toBeLessThanOrEqual(50_000);
  });

  it('reports failure honestly instead of pretending', async () => {
    const outcome = await searchForTargetSize(
      async () => ({ byteLength: 900_000 }), // nothing moves the size
      { ...options, targetBytes: 10_000, allowResize: false },
    );
    expect(outcome.reached).toBe(false);
    expect(outcome.result.byteLength).toBe(900_000);
  });

  it('never exceeds its attempt budget', async () => {
    let calls = 0;
    const outcome = await searchForTargetSize(
      async () => {
        calls += 1;
        return { byteLength: 5_000_000 };
      },
      { ...options, targetBytes: 1000, maxAttempts: 7 },
    );
    expect(calls).toBeLessThanOrEqual(7);
    expect(outcome.attempts).toBeLessThanOrEqual(7);
  });

  it('does not binary search a scale whose quality floor already overshoots', async () => {
    // Each wasted search is a full encode, so discovering "this size cannot
    // work" must cost one attempt, not seven.
    const sizes: { quality: number; scale: number }[] = [];
    await searchForTargetSize(
      async (quality, scale) => {
        sizes.push({ quality, scale });
        return { byteLength: 10_000_000 * (quality / 100) ** 2 * scale ** 2 };
      },
      { ...options, targetBytes: 50_000 },
    );
    const atFullScale = sizes.filter((entry) => entry.scale === 1);
    expect(atFullScale).toHaveLength(1);
    expect(atFullScale[0]!.quality).toBe(options.minQuality);
  });

  it('leaves the image alone when it already fits', async () => {
    const outcome = await searchForTargetSize(curve(1000), { ...options, targetBytes: 500_000 });
    expect(outcome.reached).toBe(true);
    expect(outcome.quality).toBe(95);
    expect(outcome.scale).toBe(1);
  });
});

/* --------------------------------------------------------------- quantising */

describe('colour quantisation', () => {
  function gradient(width: number, height: number, alpha = false) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = (y * width + x) * 4;
        data[p] = (x * 255) / width;
        data[p + 1] = (y * 255) / height;
        data[p + 2] = ((x + y) * 255) / (width + height);
        data[p + 3] = alpha && x < width / 2 ? 0 : 255;
      }
    }
    return { data, width, height };
  }

  it('reduces an image to at most the requested number of colours', () => {
    const source = gradient(64, 64);
    const result = quantize(source, { colors: 16, dither: 0 });
    expect(result.paletteSize).toBeLessThanOrEqual(16);
    expect(countDistinctColors(result.data, 300)).toBeLessThanOrEqual(16);
    expect(result.data.length).toBe(source.data.length);
  });

  it('keeps the dimensions intact', () => {
    const result = quantize(gradient(40, 25), { colors: 8, dither: 0.5 });
    expect(result.width).toBe(40);
    expect(result.height).toBe(25);
  });

  it('preserves transparency instead of rounding it away', () => {
    const source = gradient(32, 32, true);
    expect(hasTransparency(source.data)).toBe(true);
    const result = quantize(source, { colors: 32, dither: 0 });
    expect(hasTransparency(result.data)).toBe(true);
  });

  it('dithers without changing the output size or escaping the palette', () => {
    const source = gradient(48, 48);
    const dithered = quantize(source, { colors: 12, dither: 1 });
    expect(dithered.data.length).toBe(source.data.length);
    expect(countDistinctColors(dithered.data, 300)).toBeLessThanOrEqual(12);
  });

  it('clamps the palette to the range PNG can actually store', () => {
    const source = gradient(16, 16);
    expect(quantize(source, { colors: 1000, dither: 0 }).paletteSize).toBeLessThanOrEqual(256);
    expect(quantize(source, { colors: 0, dither: 0 }).paletteSize).toBeGreaterThanOrEqual(1);
  });

  it('handles an empty image without throwing', () => {
    const result = quantize({ data: new Uint8ClampedArray(0), width: 0, height: 0 }, { colors: 8, dither: 0 });
    expect(result.paletteSize).toBe(0);
  });
});

/* --------------------------------------------------------------------- EXIF */

describe('EXIF carry-over', () => {
  it('finds the Exif segment in a JPEG', () => {
    const segment = extractExifSegment(makeJpegWithExif(6));
    expect(segment).not.toBeNull();
    expect(segment![0]).toBe(0xff);
    expect(segment![1]).toBe(0xe1);
  });

  it('returns null when there is no Exif block', () => {
    expect(extractExifSegment(makeJpeg(10, 10))).toBeNull();
    expect(extractExifSegment(makePng(10, 10, 6))).toBeNull();
  });

  it('resets the orientation tag, so already-rotated pixels are not rotated twice', () => {
    for (const endian of [false, true]) {
      const segment = extractExifSegment(makeJpegWithExif(6, endian))!;
      expect(normaliseOrientation(segment)).toBe(true);
      const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
      // 10 (header) + 8 (TIFF) + 2 (count) + 8 (into the entry) = value offset.
      expect(view.getUint16(28, endian)).toBe(1);
    }
  });

  it('splices a segment into a JPEG directly after the SOI marker', () => {
    const source = makeJpegWithExif(3);
    const segment = prepareExifForReuse(source)!;
    const target = makeJpeg(10, 10);
    const merged = injectExifSegment(target, segment);

    expect(merged[0]).toBe(0xff);
    expect(merged[1]).toBe(0xd8);
    expect(merged[2]).toBe(0xff);
    expect(merged[3]).toBe(0xe1);
    expect(merged.length).toBe(target.length + segment.length);
    expect(extractExifSegment(merged)).not.toBeNull();
  });

  it('never leaves two Exif blocks in one file', () => {
    const segment = prepareExifForReuse(makeJpegWithExif(1))!;
    const once = injectExifSegment(makeJpeg(10, 10), segment);
    const twice = injectExifSegment(once, segment);
    expect(twice.length).toBe(once.length);
  });

  it('leaves a non-JPEG alone', () => {
    const png = makePng(10, 10, 6);
    const segment = prepareExifForReuse(makeJpegWithExif(1))!;
    expect(injectExifSegment(png, segment)).toBe(png);
  });
});

/* ---------------------------------------------------------------- filenames */

describe('filenames', () => {
  it('strips path separators so a ZIP entry cannot escape the archive', () => {
    expect(sanitiseFileName('../../etc/passwd.png')).not.toContain('/');
    expect(sanitiseFileName('..\\..\\windows\\system32.png')).not.toContain('\\');
    expect(sanitiseFileName('../../evil.png')).toBe('evil.png');
  });

  it('keeps ordinary names, digits included', () => {
    expect(sanitiseFileName('IMG_2024-07-15 (1).jpg')).toBe('IMG_2024-07-15 (1).jpg');
    expect(sanitiseFileName('photo 123.png')).toBe('photo 123.png');
  });

  it('removes characters a file system will reject', () => {
    expect(sanitiseFileName('a<b>c:d"e|f?g*h.png')).toBe('abcdefgh.png');
  });

  it('never returns an empty or reserved name', () => {
    expect(sanitiseFileName('')).toBe('image');
    expect(sanitiseFileName('...')).toBe('image');
    expect(sanitiseFileName('CON.png')).toBe('_CON.png');
  });

  it('keeps names within a sane length', () => {
    const long = `${'x'.repeat(400)}.png`;
    const safe = sanitiseFileName(long);
    expect(safe.length).toBeLessThanOrEqual(120);
    expect(safe.endsWith('.png')).toBe(true);
  });

  it('names output after the format actually written', () => {
    expect(outputFileName('holiday.png', 'webp')).toBe('holiday.webp');
    expect(outputFileName('holiday.jpeg', 'jpeg')).toBe('holiday.jpg');
    expect(outputFileName('no-extension', 'png')).toBe('no-extension.png');
  });

  it('resolves collisions so a ZIP opens cleanly', () => {
    expect(deduplicateNames(['a.webp', 'a.webp', 'a.webp'])).toEqual([
      'a.webp',
      'a-2.webp',
      'a-3.webp',
    ]);
    expect(deduplicateNames(['logo.png', 'LOGO.PNG'])).toEqual(['logo.png', 'LOGO-2.PNG']);
    expect(deduplicateNames(['a.webp', 'b.webp'])).toEqual(['a.webp', 'b.webp']);
  });

  it('names an archive after its contents and the date', () => {
    const name = archiveName(12, new Date(2026, 9, 20));
    expect(name).toBe('pixelpress-12-images-2026-10-20.zip');
    expect(archiveName(1, new Date(2026, 9, 20))).toContain('1-image-');
  });

  it('numbers the parts when a batch is split across archives', () => {
    expect(archiveName(40, new Date(2026, 9, 20), 0, 3)).toBe(
      'pixelpress-40-images-2026-10-20-part-1-of-3.zip',
    );
    expect(archiveName(40, new Date(2026, 9, 20), 2, 3)).toContain('part-3-of-3');
  });
});


/* ------------------------------------------------------- load handling */

describe('memory budgeting', () => {
  const MB = 1024 * 1024;

  it('prices a job from its pixel count, not its file size', () => {
    // A 12 MP image is 48 MB decoded; the pipeline peaks around three copies.
    const twelveMp = estimateJobBytes(4000, 3000);
    expect(twelveMp).toBeGreaterThan(140 * MB);
    expect(twelveMp).toBeLessThan(240 * MB);
    // Twice the pixels, near enough twice the cost.
    const twentyFourMp = estimateJobBytes(6000, 4000);
    expect(twentyFourMp / twelveMp).toBeGreaterThan(1.7);
  });

  it('still charges for the worker when the image is tiny', () => {
    expect(estimateJobBytes(1, 1)).toBeGreaterThan(8 * MB);
    expect(estimateJobBytes(0, 0)).toBeGreaterThan(0);
  });

  it('scales the budget with device memory, within sane bounds', () => {
    expect(memoryBudgetBytes(1)).toBe(256 * MB); // floor
    expect(memoryBudgetBytes(64)).toBe(1536 * MB); // ceiling
    expect(memoryBudgetBytes(8)).toBeGreaterThan(memoryBudgetBytes(4));
  });

  it('assumes a middling device when the browser will not say', () => {
    expect(memoryBudgetBytes(undefined)).toBe(memoryBudgetBytes(4));
  });

  it('marks a job exclusive once it would take half the budget', () => {
    const budget = memoryBudgetBytes(4);
    expect(isExclusive(budget * 0.2, budget)).toBe(false);
    expect(isExclusive(budget * 0.8, budget)).toBe(true);
  });

  it('caps megapixels to something the device can actually decode', () => {
    const lowEnd = maxPixelsForDevice(1);
    const highEnd = maxPixelsForDevice(16);
    expect(lowEnd).toBeGreaterThanOrEqual(12_000_000);
    expect(highEnd).toBeLessThanOrEqual(80_000_000);
    expect(highEnd).toBeGreaterThan(lowEnd);
    // The limit must leave room for the peak it implies.
    expect(estimateJobBytes(Math.sqrt(lowEnd), Math.sqrt(lowEnd))).toBeLessThan(
      memoryBudgetBytes(1) * 1.2,
    );
  });

  it('runs one worker at a time on a small device', () => {
    expect(concurrencyForDevice(8, 2)).toBe(1);
    expect(concurrencyForDevice(8, 6)).toBe(2);
    expect(concurrencyForDevice(8, 16)).toBe(4);
    expect(concurrencyForDevice(2, 16)).toBe(1);
  });

  it('never returns a concurrency below one', () => {
    expect(concurrencyForDevice(1, 16)).toBeGreaterThanOrEqual(1);
    expect(concurrencyForDevice(undefined, undefined)).toBeGreaterThanOrEqual(1);
  });
});

describe('archive planning', () => {
  const entry = (size: number) => ({ name: `f${size}.webp`, blob: { size } });

  it('keeps a small batch in one archive', () => {
    const parts = planArchives([entry(10), entry(20), entry(30)], 1000);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toHaveLength(3);
  });

  it('splits once the cap is reached, so the peak stays bounded', () => {
    const parts = planArchives([entry(600), entry(600), entry(600)], 1000);
    expect(parts).toHaveLength(3);
  });

  it('packs as many as fit before starting a new part', () => {
    const parts = planArchives([entry(400), entry(400), entry(400), entry(400)], 1000);
    expect(parts.map((p) => p.length)).toEqual([2, 2]);
  });

  it('gives an oversized single entry its own archive rather than dropping it', () => {
    const parts = planArchives([entry(50), entry(5000), entry(50)], 1000);
    expect(parts).toHaveLength(3);
    expect(parts[1]![0]!.blob.size).toBe(5000);
    expect(parts.flat()).toHaveLength(3);
  });

  it('handles an empty batch', () => {
    expect(planArchives([], 1000)).toEqual([]);
  });

  it('never loses or reorders an entry', () => {
    const entries = Array.from({ length: 25 }, (_, i) => entry((i % 5) * 300 + 100));
    const flat = planArchives(entries, 1000).flat();
    expect(flat).toHaveLength(25);
    expect(flat).toEqual(entries);
  });
});

/* ----------------------------------------------------------- recommendation */

describe('recommendation', () => {
  it('measures density as bytes per pixel', () => {
    expect(bytesPerPixel(1_000_000, 1000, 1000)).toBe(1);
    expect(bytesPerPixel(100, 0, 0)).toBe(0);
  });

  it('sends a photographic PNG to JPEG and says why', () => {
    const result = recommend({
      format: 'png',
      width: 2000,
      height: 1500,
      bytes: 9_000_000,
      mayHaveAlpha: false,
    });
    expect(result.outputFormat).toBe('jpeg');
    expect(result.reasons.join(' ')).toMatch(/photograph/i);
  });

  it('sends a detailed transparent PNG to WebP rather than JPEG', () => {
    const result = recommend({
      format: 'png',
      width: 2000,
      height: 1500,
      bytes: 9_000_000,
      mayHaveAlpha: true,
    });
    expect(result.outputFormat).toBe('webp');
  });

  it('admits when there is little left to gain', () => {
    const result = recommend({
      format: 'jpeg',
      width: 2000,
      height: 1500,
      bytes: 200_000, // ~0.07 bytes per pixel
      mayHaveAlpha: false,
    });
    expect(result.preset).toBe('best');
    expect(result.modestGains).toBe(true);
  });

  it('suggests resizing anything far wider than a screen', () => {
    const result = recommend({
      format: 'jpeg',
      width: 6000,
      height: 4000,
      bytes: 12_000_000,
      mayHaveAlpha: false,
    });
    expect(result.resizeTo).toBe(1920);
  });

  it('does not suggest resizing an image that is already web-sized', () => {
    const result = recommend({
      format: 'jpeg',
      width: 1600,
      height: 900,
      bytes: 800_000,
      mayHaveAlpha: false,
    });
    expect(result.resizeTo).toBeNull();
  });

  it('always explains itself', () => {
    for (const format of ['jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'] as const) {
      const result = recommend({ format, width: 1200, height: 800, bytes: 500_000, mayHaveAlpha: false });
      expect(result.headline.length).toBeGreaterThan(10);
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });
});
