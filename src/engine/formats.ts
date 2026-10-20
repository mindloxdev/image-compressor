/**
 * Format identification from file *contents*, never from the extension or the
 * browser-supplied MIME type. Both can lie, and a wrong guess means we hand a
 * decoder bytes it cannot read.
 */

export type RasterFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff';
export type EncodableFormat = 'jpeg' | 'png' | 'webp' | 'avif';
export type DetectedFormat = RasterFormat | 'svg' | 'unknown';

export const ENCODABLE_FORMATS: readonly EncodableFormat[] = ['jpeg', 'png', 'webp', 'avif'];

export const MIME_BY_FORMAT: Record<EncodableFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

export const EXTENSION_BY_FORMAT: Record<EncodableFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
};

export const FORMAT_LABEL: Record<DetectedFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  gif: 'GIF',
  bmp: 'BMP',
  tiff: 'TIFF',
  svg: 'SVG',
  unknown: 'Unknown',
};

/** Formats that carry an alpha channel we must not throw away silently. */
export const FORMATS_WITH_ALPHA: ReadonlySet<DetectedFormat> = new Set<DetectedFormat>([
  'png',
  'webp',
  'avif',
  'gif',
]);

/** True when the chosen output format can store transparency. */
export function supportsTransparency(format: EncodableFormat): boolean {
  return format !== 'jpeg';
}

function matches(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const code = bytes[offset + i];
    if (code === undefined) return out;
    out += String.fromCharCode(code);
  }
  return out;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) return 0;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) return 0;
  return ((d << 24) | (c << 16) | (b << 8) | a) >>> 0;
}

/** Identify an image from its leading bytes. */
export function detectFormat(bytes: Uint8Array): DetectedFormat {
  if (bytes.length < 12) return 'unknown';

  if (matches(bytes, 0, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (matches(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (matches(bytes, 0, [0x42, 0x4d])) return 'bmp';
  if (matches(bytes, 0, [0x49, 0x49, 0x2a, 0x00])) return 'tiff';
  if (matches(bytes, 0, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff';

  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';

  // ISO-BMFF: [size:4]['ftyp'][brand:4]. AVIF brands are 'avif' (still image)
  // and 'avis' (sequence); either can also sit in the compatible-brand list.
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const majorBrand = ascii(bytes, 8, 4);
    if (majorBrand === 'avif' || majorBrand === 'avis') return 'avif';
    const boxSize = readUint32(bytes, 0);
    const limit = Math.min(bytes.length, boxSize > 0 ? boxSize : 64);
    for (let offset = 16; offset + 4 <= limit; offset += 4) {
      const brand = ascii(bytes, offset, 4);
      if (brand === 'avif' || brand === 'avis') return 'avif';
    }
  }

  // SVG is text; it may open with a BOM, an XML prolog, a comment or a doctype.
  const head = ascii(bytes, 0, Math.min(bytes.length, 400)).replace(/^﻿/, '').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<!DOCTYPE svg')) return 'svg';
  if (head.startsWith('<?xml') && head.includes('<svg')) return 'svg';

  return 'unknown';
}

/**
 * Detect multi-frame images. `createImageBitmap` keeps only the first frame, so
 * anything animated has to be reported rather than silently flattened.
 */
export function isAnimated(bytes: Uint8Array, format: DetectedFormat): boolean {
  switch (format) {
    case 'gif':
      return countGifFrames(bytes, 2) > 1;
    case 'png':
      return hasPngChunk(bytes, 'acTL');
    case 'webp':
      return hasRiffChunk(bytes, 'ANIM') || hasRiffChunk(bytes, 'ANMF');
    case 'avif':
      return ascii(bytes, 8, 4) === 'avis';
    default:
      return false;
  }
}

/** Walk PNG chunks looking for `type`, stopping at the first IDAT. */
function hasPngChunk(bytes: Uint8Array, type: string): boolean {
  let offset = 8; // skip the 8-byte signature
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const chunkType = ascii(bytes, offset + 4, 4);
    if (chunkType === type) return true;
    if (chunkType === 'IDAT' || chunkType === 'IEND') return false;
    const next = offset + 12 + length;
    if (next <= offset) return false; // malformed length, bail out
    offset = next;
  }
  return false;
}

/** Walk the RIFF chunks of a WebP file looking for `fourCC`. */
function hasRiffChunk(bytes: Uint8Array, fourCC: string): boolean {
  let offset = 12; // 'RIFF' + size + 'WEBP'
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, 4);
    if (chunkType === fourCC) return true;
    const size = readUint32LE(bytes, offset + 4);
    const next = offset + 8 + size + (size % 2); // chunks are even-padded
    if (next <= offset) return false;
    offset = next;
  }
  return false;
}

/**
 * Count GIF image descriptors, stopping once `limit` is reached — we only need
 * to know whether there is more than one frame.
 */
function countGifFrames(bytes: Uint8Array, limit: number): number {
  const flags = bytes[10];
  if (flags === undefined) return 0;
  let offset = 13;
  if ((flags & 0x80) !== 0) {
    offset += 3 * (1 << ((flags & 0x07) + 1)); // global colour table
  }

  let frames = 0;
  while (offset < bytes.length) {
    const block = bytes[offset];
    if (block === undefined || block === 0x3b) break; // trailer

    if (block === 0x21) {
      // Extension block: label, then sub-blocks ended by a zero-length block.
      offset = skipSubBlocks(bytes, offset + 2);
      continue;
    }

    if (block === 0x2c) {
      frames += 1;
      if (frames >= limit) return frames;
      const localFlags = bytes[offset + 9];
      if (localFlags === undefined) break;
      offset += 10;
      if ((localFlags & 0x80) !== 0) {
        offset += 3 * (1 << ((localFlags & 0x07) + 1)); // local colour table
      }
      offset += 1; // LZW minimum code size
      offset = skipSubBlocks(bytes, offset);
      continue;
    }

    break; // unexpected byte — stop rather than guess
  }
  return frames;
}

function skipSubBlocks(bytes: Uint8Array, start: number): number {
  let offset = start;
  while (offset < bytes.length) {
    const size = bytes[offset];
    if (size === undefined || size === 0) return offset + 1;
    offset += size + 1;
  }
  return offset;
}
