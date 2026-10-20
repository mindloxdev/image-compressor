/** Byte-size formatting and savings maths. Pure, unit-tested. */

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * Human-readable size using binary multiples (1 KB = 1024 B), the same
 * convention Windows, macOS and every other image tool reports.
 */
export function formatBytes(bytes: number, fractionDigits?: number): string {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 0) return `-${formatBytes(-bytes, fractionDigits)}`;
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // 1 decimal below 10 (9.4 MB), none above (124 MB) — keeps columns tidy.
  const digits = fractionDigits ?? (value < 10 ? 1 : 0);
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

/** Bytes removed. Negative when the output grew. */
export function bytesSaved(originalBytes: number, outputBytes: number): number {
  return originalBytes - outputBytes;
}

/**
 * Percentage of the original removed, rounded to one decimal.
 * Negative when the output grew; 0 for an empty original.
 */
export function savingsPercent(originalBytes: number, outputBytes: number): number {
  if (originalBytes <= 0) return 0;
  const pct = ((originalBytes - outputBytes) / originalBytes) * 100;
  return Math.round(pct * 10) / 10;
}

/** Signed percentage for display, e.g. "−72.4%" or "+3.1%". */
export function formatSavings(originalBytes: number, outputBytes: number): string {
  const pct = savingsPercent(originalBytes, outputBytes);
  if (pct === 0) return 'No change';
  return pct > 0 ? `${pct}% smaller` : `${Math.abs(pct)}% larger`;
}

export function kbToBytes(kb: number): number {
  return Math.round(kb * 1024);
}
