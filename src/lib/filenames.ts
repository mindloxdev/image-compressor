/** Filename handling for downloads and ZIP entries. Pure, unit-tested. */

import { EXTENSION_BY_FORMAT, type EncodableFormat } from '@/engine/formats';

/**
 * Characters a file name must not contain, by code point:
 * 0x00-0x1F and 0x7F (control characters), plus < > : " / backslash | ? *
 * which Windows, macOS or a ZIP reader will reject or misread.
 */
const ILLEGAL_CODES = new Set([0x3c, 0x3e, 0x3a, 0x22, 0x2f, 0x5c, 0x7c, 0x3f, 0x2a]);
const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

function stripUnsafe(name: string): string {
  let out = '';
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    if (ILLEGAL_CODES.has(code)) continue;
    out += char;
  }
  return out;
}

const SEPARATOR = String.fromCharCode(92); // backslash

/** Split a name on both path separators, without relying on escape syntax. */
function pathSegments(name: string): string[] {
  const segments: string[] = [];
  let current = '';
  for (const char of name) {
    if (char === '/' || char === SEPARATOR) {
      segments.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  segments.push(current);
  return segments;
}

/**
 * Make a user-supplied name safe to write to disk.
 * Browsers sanitise download names themselves, but ZIP entry names go straight
 * into the archive, so a name that walks out of the archive root must not
 * survive this function.
 */
export function sanitiseFileName(name: string): string {
  // Keep only the final path segment, discarding '.' and '..', so a name like
  // '../../evil.png' becomes 'evil.png' instead of keeping stray dots.
  const segments = pathSegments(name)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');

  let safe = stripUnsafe(segments.at(-1) ?? '')
    .split(/ +/)
    .filter(Boolean)
    .join(' ')
    .trim();
  safe = safe.replace(/^[.]+/, '').replace(/[.]+$/, '');
  if (!safe) safe = 'image';
  if (RESERVED_WINDOWS.test(stripExtension(safe))) safe = `_${safe}`;
  // 120 characters leaves room for a dedupe suffix inside the usual 255-byte limit.
  if (safe.length > 120) {
    const extension = extensionOf(safe);
    const base = stripExtension(safe).slice(0, 120 - extension.length - 1);
    safe = extension ? `${base}.${extension}` : base;
  }
  return safe;
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  if (index <= 0 || index === name.length - 1) return '';
  return name.slice(index + 1).toLowerCase();
}

export function stripExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index <= 0 ? name : name.slice(0, index);
}

/**
 * Name for a compressed output: the original base name with the extension of
 * the format we actually wrote. Keeping the base name means a file dropped into
 * a project replaces the original cleanly.
 */
export function outputFileName(originalName: string, format: EncodableFormat): string {
  const base = stripExtension(sanitiseFileName(originalName)) || 'image';
  return `${base}.${EXTENSION_BY_FORMAT[format]}`;
}

/**
 * Resolve collisions within one archive. Two files called `logo.png` and
 * `logo.jpg` both become `logo.webp`, and a ZIP with duplicate entries opens
 * unpredictably, so the second becomes `logo-2.webp`.
 */
export function deduplicateNames(names: readonly string[]): string[] {
  const used = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const seen = used.get(key);
    if (seen === undefined) {
      used.set(key, 1);
      return name;
    }
    const base = stripExtension(name);
    // Rebuild with the extension exactly as written: comparison is
    // case-insensitive, but LOGO.PNG must not come back as LOGO-2.png.
    const dot = name.lastIndexOf('.');
    const extension = dot > 0 ? name.slice(dot + 1) : '';
    let attempt = seen + 1;
    let candidate = extension ? `${base}-${attempt}.${extension}` : `${base}-${attempt}`;
    while (used.has(candidate.toLowerCase())) {
      attempt += 1;
      candidate = extension ? `${base}-${attempt}.${extension}` : `${base}-${attempt}`;
    }
    used.set(key, attempt);
    used.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}

/**
 * Timestamped archive name, e.g. `pixelpress-12-images-2026-10-20.zip`.
 * A batch too large for one archive is split, and each part says so.
 */
export function archiveName(
  count: number,
  date = new Date(),
  part = 0,
  partCount = 1,
): string {
  const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const suffix = partCount > 1 ? `-part-${part + 1}-of-${partCount}` : '';
  return `pixelpress-${count}-image${count === 1 ? '' : 's'}-${iso}${suffix}.zip`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
