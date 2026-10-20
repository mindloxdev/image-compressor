/**
 * Read dimensions and alpha straight out of the file header.
 *
 * This runs the moment a file is dropped, on the main thread, so the list shows
 * real dimensions immediately — no decode, no worker round trip, no memory
 * spike from a hundred images at once.
 */

import type { DetectedFormat } from './formats';

export interface Probe {
  width: number;
  height: number;
  /** True when the format can carry transparency and the header says it does. */
  mayHaveAlpha: boolean;
}

function u16BE(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
}
function u16LE(b: Uint8Array, o: number): number {
  return ((b[o + 1] ?? 0) << 8) | (b[o] ?? 0);
}
function u32BE(b: Uint8Array, o: number): number {
  return (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;
}
function u32LE(b: Uint8Array, o: number): number {
  return (((b[o + 3] ?? 0) << 24) | ((b[o + 2] ?? 0) << 16) | ((b[o + 1] ?? 0) << 8) | (b[o] ?? 0)) >>> 0;
}
function fourCC(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o] ?? 0, b[o + 1] ?? 0, b[o + 2] ?? 0, b[o + 3] ?? 0);
}

/** Returns null when the header does not carry the size in a readable place. */
export function probeImage(bytes: Uint8Array, format: DetectedFormat): Probe | null {
  switch (format) {
    case 'png':
      return probePng(bytes);
    case 'jpeg':
      return probeJpeg(bytes);
    case 'webp':
      return probeWebp(bytes);
    case 'gif':
      return probeGif(bytes);
    case 'bmp':
      return probeBmp(bytes);
    case 'avif':
      return probeAvif(bytes);
    default:
      return null;
  }
}

function probePng(bytes: Uint8Array): Probe | null {
  // IHDR is required to be the first chunk: length, 'IHDR', w, h, depth, type…
  if (fourCC(bytes, 12) !== 'IHDR') return null;
  const width = u32BE(bytes, 16);
  const height = u32BE(bytes, 20);
  const colourType = bytes[25] ?? 0;
  // 4 = grey+alpha, 6 = RGBA, 3 = palette (transparent only with a tRNS chunk).
  const mayHaveAlpha =
    colourType === 4 || colourType === 6 || (colourType === 3 && hasChunk(bytes, 'tRNS'));
  if (!width || !height) return null;
  return { width, height, mayHaveAlpha };
}

function hasChunk(bytes: Uint8Array, type: string): boolean {
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = u32BE(bytes, offset);
    const chunkType = fourCC(bytes, offset + 4);
    if (chunkType === type) return true;
    if (chunkType === 'IDAT' || chunkType === 'IEND') return false;
    const next = offset + 12 + length;
    if (next <= offset) return false;
    offset = next;
  }
  return false;
}

function probeJpeg(bytes: Uint8Array): Probe | null {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1; // resynchronise over padding
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end, or scan started
    const length = u16BE(bytes, offset + 2);
    // SOF0/1/2/3/5/6/7/9/10/11/13/14/15 all carry the frame size.
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      const height = u16BE(bytes, offset + 5);
      const width = u16BE(bytes, offset + 7);
      if (!width || !height) return null;
      return { width, height, mayHaveAlpha: false };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function probeWebp(bytes: Uint8Array): Probe | null {
  const chunk = fourCC(bytes, 12);
  if (chunk === 'VP8X') {
    const flags = bytes[20] ?? 0;
    // 24-bit little-endian "canvas size minus one".
    const width = 1 + (((bytes[24] ?? 0) | ((bytes[25] ?? 0) << 8) | ((bytes[26] ?? 0) << 16)) & 0xffffff);
    const height = 1 + (((bytes[27] ?? 0) | ((bytes[28] ?? 0) << 8) | ((bytes[29] ?? 0) << 16)) & 0xffffff);
    return { width, height, mayHaveAlpha: (flags & 0x10) !== 0 };
  }
  if (chunk === 'VP8 ') {
    // Lossy keyframe: 3-byte tag, 3-byte sync code, then 14-bit dimensions.
    const width = u16LE(bytes, 26) & 0x3fff;
    const height = u16LE(bytes, 28) & 0x3fff;
    if (!width || !height) return null;
    return { width, height, mayHaveAlpha: false };
  }
  if (chunk === 'VP8L') {
    const bits = u32LE(bytes, 21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    const mayHaveAlpha = ((bits >>> 28) & 0x1) !== 0;
    return { width, height, mayHaveAlpha };
  }
  return null;
}

function probeGif(bytes: Uint8Array): Probe | null {
  const width = u16LE(bytes, 6);
  const height = u16LE(bytes, 8);
  if (!width || !height) return null;
  // A GIF is only transparent if a frame declares a transparent index, which
  // means walking the blocks. Assume it might be — it only drives a warning.
  return { width, height, mayHaveAlpha: true };
}

function probeBmp(bytes: Uint8Array): Probe | null {
  const headerSize = u32LE(bytes, 14);
  if (headerSize < 12) return null;
  if (headerSize === 12) {
    return { width: u16LE(bytes, 18), height: u16LE(bytes, 20), mayHaveAlpha: false };
  }
  const width = u32LE(bytes, 18) | 0;
  const height = u32LE(bytes, 22) | 0;
  const bitDepth = u16LE(bytes, 28);
  if (!width || !height) return null;
  return { width: Math.abs(width), height: Math.abs(height), mayHaveAlpha: bitDepth === 32 };
}

/**
 * AVIF keeps the size in an `ispe` box nested several levels deep. Rather than
 * walk the whole box tree we scan the metadata region for the fourCC, which is
 * reliable because `ispe` precedes the compressed image data.
 */
function probeAvif(bytes: Uint8Array): Probe | null {
  const limit = Math.min(bytes.length - 16, 65_536);
  for (let offset = 0; offset < limit; offset += 1) {
    if (fourCC(bytes, offset) !== 'ispe') continue;
    const width = u32BE(bytes, offset + 8); // skip 4 bytes of version + flags
    const height = u32BE(bytes, offset + 12);
    if (width > 0 && height > 0 && width < 100_000 && height < 100_000) {
      return { width, height, mayHaveAlpha: hasAvifAlphaChannel(bytes, limit) };
    }
  }
  return null;
}

/** An alpha plane shows up as an `auxC` box naming the alpha URN. */
function hasAvifAlphaChannel(bytes: Uint8Array, limit: number): boolean {
  const needle = 'urn:mpeg:mpegB:cicp:systems:auxiliary:alpha';
  let text = '';
  for (let i = 0; i < limit; i += 1) {
    text += String.fromCharCode(bytes[i] ?? 0);
  }
  return text.includes(needle);
}
