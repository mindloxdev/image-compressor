/**
 * Target file size search.
 *
 * There is no formula that turns "make this 100 KB" into a quality number —
 * it depends entirely on the picture. So we encode, measure, and narrow in:
 * a binary search over quality, and if the codec cannot get there even at its
 * floor, a dimension reduction and another pass.
 *
 * The encoder is injected, which keeps this file free of WebAssembly and lets
 * the tests drive it with a synthetic size curve.
 */

export interface TargetAttemptResult {
  byteLength: number;
}

export interface TargetSearchOptions {
  /** Ceiling in bytes. */
  targetBytes: number;
  minQuality: number;
  maxQuality: number;
  /** Total encode calls allowed across every pass. */
  maxAttempts: number;
  /** Permit shrinking the image when quality alone is not enough. */
  allowResize: boolean;
  /** Never scale below this fraction of the original dimensions. */
  minScale: number;
}

export interface TargetSearchOutcome<T> {
  result: T;
  quality: number;
  scale: number;
  attempts: number;
  reached: boolean;
}

export const DEFAULT_TARGET_OPTIONS: Omit<TargetSearchOptions, 'targetBytes'> = {
  minQuality: 20,
  maxQuality: 95,
  maxAttempts: 12,
  allowResize: true,
  minScale: 0.25,
};

export async function searchForTargetSize<T extends TargetAttemptResult>(
  encodeAt: (quality: number, scale: number) => Promise<T>,
  options: TargetSearchOptions,
): Promise<TargetSearchOutcome<T>> {
  const { targetBytes, minQuality, maxQuality, maxAttempts, allowResize, minScale } = options;

  let attempts = 0;
  // Best = largest file that still fits under the target (highest quality).
  let fitting: { result: T; quality: number; scale: number } | null = null;
  // Fallback = the smallest file produced, used when the target is unreachable.
  let smallest: { result: T; quality: number; scale: number } | null = null;

  const run = async (quality: number, scale: number) => {
    attempts += 1;
    const result = await encodeAt(quality, scale);
    const candidate = { result, quality, scale };
    if (result.byteLength <= targetBytes) {
      if (!fitting || quality > fitting.quality || scale > fitting.scale) fitting = candidate;
    }
    if (!smallest || result.byteLength < smallest.result.byteLength) smallest = candidate;
    return result;
  };

  let scale = 1;
  let guard = 0;

  while (guard < 6) {
    guard += 1;

    // Probe the quality floor first. If even the worst-looking encode at this
    // size overshoots, no quality between here and the ceiling will fit, and a
    // binary search would burn six encodes to discover that. One encode tells
    // us to go straight to resizing instead.
    const floor = await run(minQuality, scale);
    let fitsHere = floor.byteLength <= targetBytes;

    if (fitsHere) {
      // Spend the remaining budget finding the best-looking quality that fits.
      let lo = minQuality + 1;
      let hi = maxQuality;
      while (lo <= hi && attempts < maxAttempts) {
        const mid = (lo + hi) >> 1;
        const result = await run(mid, scale);
        if (result.byteLength <= targetBytes) lo = mid + 1;
        else hi = mid - 1;
      }
    }

    if (fitsHere || attempts >= maxAttempts) break;
    if (!allowResize) break;

    // Even the quality floor overshoots. Shrink by the square root of the size
    // ratio — file size tracks pixel count, which is area, not edge length.
    const reference = smallest as { result: T } | null;
    const smallestBytes = reference ? reference.result.byteLength : targetBytes * 2;
    const ratio = Math.sqrt(targetBytes / Math.max(1, smallestBytes));
    const nextScale = scale * Math.min(0.9, Math.max(0.5, ratio * 0.95));
    if (nextScale < minScale) break;
    scale = nextScale;
  }

  const chosen = (fitting ?? smallest) as { result: T; quality: number; scale: number } | null;
  if (!chosen) {
    throw new Error('The target-size search produced no output.');
  }

  return {
    result: chosen.result,
    quality: chosen.quality,
    scale: chosen.scale,
    attempts,
    reached: chosen.result.byteLength <= targetBytes,
  };
}
