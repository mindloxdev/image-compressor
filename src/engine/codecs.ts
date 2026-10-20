/**
 * The codec layer. Worker-side only — every import here pulls in WebAssembly.
 *
 * Decoding uses the browser's own image pipeline (`createImageBitmap`), which
 * reads everything Chrome, Safari and Firefox can display — JPEG, PNG, WebP,
 * AVIF, GIF, BMP — and applies EXIF rotation for us. Encoding uses the Squoosh
 * codecs, because a canvas `toBlob` JPEG is substantially larger than the same
 * image through MozJPEG, and canvas cannot write a palette PNG at all.
 */

import encodeJpegWasm from '@jsquash/jpeg/encode';
import encodePngWasm from '@jsquash/png/encode';
import encodeWebpWasm from '@jsquash/webp/encode';
import encodeAvifWasm from '@jsquash/avif/encode';
import optimisePngWasm from '@jsquash/oxipng/optimise';
import resizeWasm from '@jsquash/resize';

import type { EncodableFormat } from './formats';
import { MIME_BY_FORMAT } from './formats';
import { maxPixelsForDevice, readDeviceMemoryGb } from './memory';
import { quantize } from './quantize';

export interface EncodeParams {
  format: EncodableFormat;
  quality: number;
  /** oxipng search level, PNG only. */
  pngLevel: number;
  /** libwebp encode method. */
  webpMethod: number;
  /** libavif speed. */
  avifSpeed: number;
  /** Palette size for lossy PNG, or null for lossless. */
  pngColors: number | null;
  pngDither: number;
}

export interface DecodedImage {
  imageData: ImageData;
  width: number;
  height: number;
}

/**
 * Hard ceiling on decoded pixels, scaled to the device.
 *
 * RGBA is 4 bytes per pixel and the pipeline peaks at about three copies, so a
 * 100 MP image wants 1.2 GB. A phone does not have it, and exceeding the heap
 * kills the tab outright rather than throwing something catchable — so the
 * limit is read from the device and the image is refused with an explanation.
 */
export const MAX_PIXELS = maxPixelsForDevice(readDeviceMemoryGb());

export class ImageTooLargeError extends Error {
  constructor(pixels: number, limit = MAX_PIXELS) {
    super(
      `This image is ${(pixels / 1_000_000).toFixed(0)} megapixels. The limit on this ` +
        `device is ${Math.round(limit / 1_000_000)} MP — above that the browser runs out ` +
        `of memory and loses the page. Resize it first, or try on a machine with more memory.`,
    );
    this.name = 'ImageTooLargeError';
  }
}

export class DecodeError extends Error {
  constructor(message = 'This file could not be read as an image. It may be corrupt.') {
    super(message);
    this.name = 'DecodeError';
  }
}

/**
 * Decode bytes to RGBA pixels.
 *
 * `imageOrientation: 'from-image'` bakes EXIF rotation into the pixels, so a
 * portrait photo from a phone does not come out sideways. Older Safari ignores
 * the option object entirely, hence the retry.
 */
export async function decode(bytes: Uint8Array, mimeType: string): Promise<DecodedImage> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      throw new DecodeError();
    }
  }

  const { width, height } = bitmap;
  if (width * height > MAX_PIXELS) {
    bitmap.close();
    throw new ImageTooLargeError(width * height);
  }

  try {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new DecodeError('This browser could not open a drawing surface.');
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    return { imageData, width, height };
  } finally {
    bitmap.close();
  }
}

/** High-quality Lanczos3 downscale. */
export async function resizeImage(
  imageData: ImageData,
  width: number,
  height: number,
): Promise<ImageData> {
  return resizeWasm(imageData, {
    width,
    height,
    method: 'lanczos3',
    fitMethod: 'stretch',
    premultiply: true,
    linearRGB: true,
  });
}

/**
 * Composite onto an opaque background. JPEG has no alpha channel, so without
 * this every transparent pixel would come out black.
 */
export function flattenAlpha(imageData: ImageData, background = 0xffffff): ImageData {
  const bgR = (background >> 16) & 0xff;
  const bgG = (background >> 8) & 0xff;
  const bgB = background & 0xff;
  const source = imageData.data;
  const out = new Uint8ClampedArray(source.length);

  for (let p = 0; p < source.length; p += 4) {
    const alpha = source[p + 3]! / 255;
    if (alpha === 1) {
      out[p] = source[p]!;
      out[p + 1] = source[p + 1]!;
      out[p + 2] = source[p + 2]!;
    } else {
      const inverse = 1 - alpha;
      out[p] = source[p]! * alpha + bgR * inverse;
      out[p + 1] = source[p + 1]! * alpha + bgG * inverse;
      out[p + 2] = source[p + 2]! * alpha + bgB * inverse;
    }
    out[p + 3] = 255;
  }
  return new ImageData(out as Uint8ClampedArray<ArrayBuffer>, imageData.width, imageData.height);
}

export async function encode(imageData: ImageData, params: EncodeParams): Promise<Uint8Array> {
  switch (params.format) {
    case 'jpeg': {
      const buffer = await encodeJpegWasm(imageData, {
        quality: params.quality,
        progressive: true,
        optimize_coding: true,
      });
      return new Uint8Array(buffer);
    }
    case 'webp': {
      const buffer = await encodeWebpWasm(imageData, {
        quality: params.quality,
        method: params.webpMethod,
        // Alpha is stored losslessly; only the colour planes are quantised.
        alpha_quality: 100,
        use_sharp_yuv: params.quality >= 85 ? 1 : 0,
      });
      return new Uint8Array(buffer);
    }
    case 'avif': {
      const buffer = await encodeAvifWasm(imageData, {
        quality: params.quality,
        speed: params.avifSpeed,
        bitDepth: 8,
      });
      return new Uint8Array(buffer);
    }
    case 'png':
      return encodePngPipeline(imageData, params);
    default: {
      const exhaustive: never = params.format;
      throw new Error(`Unsupported output format: ${String(exhaustive)}`);
    }
  }
}

/**
 * PNG in two stages: optionally reduce the palette, then run oxipng. oxipng is
 * what turns a 256-colour RGBA buffer into an actual palette PNG, which is
 * where the large savings come from.
 */
async function encodePngPipeline(
  imageData: ImageData,
  params: EncodeParams,
): Promise<Uint8Array> {
  let pixels = imageData;

  if (params.pngColors !== null) {
    const quantised = quantize(imageData, {
      colors: params.pngColors,
      dither: params.pngDither,
    });
    pixels = new ImageData(
      quantised.data as Uint8ClampedArray<ArrayBuffer>,
      quantised.width,
      quantised.height,
    );
  }

  const raw = await encodePngWasm(pixels);
  const optimised = await optimisePngWasm(raw, {
    level: params.pngLevel,
    interlace: false,
    optimiseAlpha: true,
  });
  return new Uint8Array(optimised);
}

/** Run oxipng over an existing PNG file. Lossless: every pixel is preserved. */
export async function optimiseExistingPng(
  bytes: Uint8Array,
  level: number,
): Promise<Uint8Array> {
  const buffer = bytes.slice().buffer;
  const optimised = await optimisePngWasm(buffer, {
    level,
    interlace: false,
    optimiseAlpha: false, // changing alpha would not be lossless
  });
  return new Uint8Array(optimised);
}

export function mimeFor(format: EncodableFormat): string {
  return MIME_BY_FORMAT[format];
}
