/**
 * EXIF carry-over for JPEG → JPEG.
 *
 * Re-encoding throws away every metadata block, which is usually what people
 * want (smaller files, no GPS coordinates). Photographers want the opposite:
 * camera, lens, copyright and date. So when "keep metadata" is on we lift the
 * APP1/Exif segment off the source and splice it into the new JPEG.
 *
 * One trap this has to handle: the decoder already applied the EXIF rotation to
 * the pixels. Copying an Orientation of "rotate 90°" onto already-rotated
 * pixels would rotate the image twice, so the tag is reset to 1 on the way in.
 */

const SOI = 0xffd8;
const APP1 = 0xffe1;
const SOS = 0xffda;
const ORIENTATION_TAG = 0x0112;

function readU16BE(bytes: Uint8Array, offset: number): number {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  if (a === undefined || b === undefined) return 0;
  return (a << 8) | b;
}

/**
 * Find the Exif APP1 segment in a JPEG and return a copy of it, marker and
 * length bytes included. Returns null when there is none.
 */
export function extractExifSegment(jpeg: Uint8Array): Uint8Array | null {
  if (readU16BE(jpeg, 0) !== SOI) return null;

  let offset = 2;
  while (offset + 4 <= jpeg.length) {
    const marker = readU16BE(jpeg, offset);
    // Standalone markers (RSTn, TEM) carry no length payload.
    if (marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd7)) {
      offset += 2;
      continue;
    }
    if ((marker & 0xff00) !== 0xff00) return null; // not a marker — malformed
    if (marker === SOS) return null; // image data starts; no Exif found

    const length = readU16BE(jpeg, offset + 2);
    if (length < 2) return null;
    const segmentEnd = offset + 2 + length;
    if (segmentEnd > jpeg.length) return null;

    if (marker === APP1 && isExifHeader(jpeg, offset + 4)) {
      return jpeg.slice(offset, segmentEnd);
    }
    offset = segmentEnd;
  }
  return null;
}

function isExifHeader(bytes: Uint8Array, offset: number): boolean {
  return (
    bytes[offset] === 0x45 && // E
    bytes[offset + 1] === 0x78 && // x
    bytes[offset + 2] === 0x69 && // i
    bytes[offset + 3] === 0x66 && // f
    bytes[offset + 4] === 0x00 &&
    bytes[offset + 5] === 0x00
  );
}

/**
 * Force the IFD0 Orientation tag to 1 ("as stored"), in place.
 * Returns true when a tag was found and rewritten.
 */
export function normaliseOrientation(segment: Uint8Array): boolean {
  const tiff = 10; // FFE1 + length + "Exif\0\0"
  if (segment.length < tiff + 8) return false;

  const byteOrder = readU16BE(segment, tiff);
  let littleEndian: boolean;
  if (byteOrder === 0x4949) littleEndian = true;
  else if (byteOrder === 0x4d4d) littleEndian = false;
  else return false;

  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  if (view.getUint16(tiff + 2, littleEndian) !== 0x002a) return false;

  const ifd0 = tiff + view.getUint32(tiff + 4, littleEndian);
  if (ifd0 + 2 > segment.length) return false;

  const entryCount = view.getUint16(ifd0, littleEndian);
  for (let i = 0; i < entryCount; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > segment.length) return false;
    if (view.getUint16(entry, littleEndian) === ORIENTATION_TAG) {
      const type = view.getUint16(entry + 2, littleEndian);
      if (type !== 3) return false; // SHORT is the only legal type here
      view.setUint16(entry + 8, 1, littleEndian); // value is inline
      return true;
    }
  }
  return false;
}

/**
 * Insert an APP1 segment directly after the SOI marker of `jpeg`.
 * Any APP1 already present in the new file is dropped first so the output
 * never carries two Exif blocks.
 */
export function injectExifSegment(jpeg: Uint8Array, segment: Uint8Array): Uint8Array {
  if (readU16BE(jpeg, 0) !== SOI) return jpeg;

  const stripped = removeExifSegment(jpeg);
  const out = new Uint8Array(stripped.length + segment.length);
  out.set(stripped.subarray(0, 2), 0); // SOI
  out.set(segment, 2);
  out.set(stripped.subarray(2), 2 + segment.length);
  return out;
}

/** Remove an existing Exif APP1 segment, if any. */
function removeExifSegment(jpeg: Uint8Array): Uint8Array {
  let offset = 2;
  while (offset + 4 <= jpeg.length) {
    const marker = readU16BE(jpeg, offset);
    if (marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd7)) {
      offset += 2;
      continue;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === SOS) break;

    const length = readU16BE(jpeg, offset + 2);
    if (length < 2) break;
    const segmentEnd = offset + 2 + length;
    if (segmentEnd > jpeg.length) break;

    if (marker === APP1 && isExifHeader(jpeg, offset + 4)) {
      const out = new Uint8Array(jpeg.length - (segmentEnd - offset));
      out.set(jpeg.subarray(0, offset), 0);
      out.set(jpeg.subarray(segmentEnd), offset);
      return out;
    }
    offset = segmentEnd;
  }
  return jpeg;
}

/**
 * Pull the source Exif block out and make it safe to attach to re-encoded
 * pixels. Returns null when the source has no Exif or it is unusably large
 * (an APP1 segment maxes out at 65535 bytes by definition).
 */
export function prepareExifForReuse(source: Uint8Array): Uint8Array | null {
  const segment = extractExifSegment(source);
  if (!segment || segment.length > 65_537) return null;
  normaliseOrientation(segment);
  return segment;
}
