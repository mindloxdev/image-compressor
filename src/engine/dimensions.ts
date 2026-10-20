/** Resize arithmetic. Pure, unit-tested — every pixel dimension flows through here. */

export interface Size {
  width: number;
  height: number;
}

export interface FitOptions {
  maxWidth: number | null;
  maxHeight: number | null;
  preserveAspectRatio: boolean;
}

/**
 * Fit `size` inside the given bounds. Never upscales: a 400px-wide image asked
 * to fit 1920px stays 400px, because inventing pixels cannot reduce file size.
 */
export function fitWithin(size: Size, options: FitOptions): Size {
  const { maxWidth, maxHeight, preserveAspectRatio } = options;
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));

  const boundW = maxWidth && maxWidth > 0 ? Math.floor(maxWidth) : null;
  const boundH = maxHeight && maxHeight > 0 ? Math.floor(maxHeight) : null;
  if (!boundW && !boundH) return { width, height };

  if (!preserveAspectRatio) {
    return {
      width: boundW ? Math.min(width, boundW) : width,
      height: boundH ? Math.min(height, boundH) : height,
    };
  }

  const scaleW = boundW ? boundW / width : Infinity;
  const scaleH = boundH ? boundH / height : Infinity;
  const scale = Math.min(scaleW, scaleH, 1); // clamp at 1 — downscale only
  if (scale === 1) return { width, height };

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Scale a size by a factor, keeping both axes at least 1px. */
export function scaleSize(size: Size, scale: number): Size {
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

export function sameSize(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height;
}

export function megapixels(size: Size): number {
  return (size.width * size.height) / 1_000_000;
}

export function formatDimensions(size: Size | null): string {
  if (!size) return '—';
  return `${size.width} × ${size.height}`;
}

/** Aspect ratio as a reduced "16:9"-style string, for the resize helper text. */
export function aspectRatioLabel(size: Size): string {
  const divisor = greatestCommonDivisor(size.width, size.height);
  if (divisor === 0) return '—';
  const w = size.width / divisor;
  const h = size.height / divisor;
  // Only show tidy ratios; 1853:1047 tells the user nothing.
  if (w <= 32 && h <= 32) return `${w}:${h}`;
  return (size.width / size.height).toFixed(2).replace(/\.0+$/, '') + ':1';
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}
