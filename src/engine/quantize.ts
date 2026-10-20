/**
 * Colour quantisation for lossy PNG.
 *
 * PNG itself is always lossless, so the only way to make one dramatically
 * smaller is to reduce how many distinct colours it contains — then let oxipng
 * store those colours in a palette. This is a median-cut quantiser in RGBA
 * space with optional Floyd–Steinberg dithering, which is the same approach
 * pngquant takes.
 *
 * Pure function of its inputs: no DOM, no codecs, so it is directly testable.
 */

export interface QuantizeOptions {
  /** Palette size, clamped to 2–256. */
  colors: number;
  /** 0 = flat bands, 1 = full error diffusion. */
  dither: number;
  /** Cap on pixels inspected while choosing the palette. */
  sampleLimit?: number;
}

export interface QuantizeResult {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Number of palette entries actually used. */
  paletteSize: number;
}

interface Box {
  lo: number;
  hi: number;
  rMin: number; rMax: number;
  gMin: number; gMax: number;
  bMin: number; bMax: number;
  aMin: number; aMax: number;
}

const CACHE_BITS = 5; // 32 levels per channel
const CACHE_SIDE = 1 << CACHE_BITS;

export function quantize(
  source: { data: Uint8ClampedArray; width: number; height: number },
  options: QuantizeOptions,
): QuantizeResult {
  const { width, height } = source;
  const colors = Math.max(2, Math.min(256, Math.floor(options.colors)));
  const dither = Math.max(0, Math.min(1, options.dither));
  const sampleLimit = options.sampleLimit ?? 250_000;

  const pixelCount = width * height;
  if (pixelCount === 0) {
    return { data: new Uint8ClampedArray(0), width, height, paletteSize: 0 };
  }

  const samples = collectSamples(source.data, pixelCount, sampleLimit);
  const palette = medianCut(samples, colors);

  const out = dither > 0
    ? mapWithDithering(source.data, width, height, palette, dither)
    : mapNearest(source.data, pixelCount, palette);

  return { data: out, width, height, paletteSize: palette.length / 4 };
}

/** Evenly spaced sample of the image, as flat RGBA quadruples. */
function collectSamples(
  data: Uint8ClampedArray,
  pixelCount: number,
  limit: number,
): Uint8Array {
  const step = Math.max(1, Math.ceil(pixelCount / limit));
  const count = Math.ceil(pixelCount / step);
  const samples = new Uint8Array(count * 4);
  let out = 0;
  for (let i = 0; i < pixelCount; i += step) {
    const p = i * 4;
    samples[out] = data[p]!;
    samples[out + 1] = data[p + 1]!;
    samples[out + 2] = data[p + 2]!;
    samples[out + 3] = data[p + 3]!;
    out += 4;
  }
  return samples.subarray(0, out) as Uint8Array;
}

/**
 * Median cut: start with one box holding every sample, then repeatedly split
 * the box that contributes most error along its widest channel.
 * Returns a flat RGBA palette.
 */
function medianCut(samples: Uint8Array, maxColors: number): Uint8Array {
  const count = samples.length / 4;
  if (count === 0) return new Uint8Array([0, 0, 0, 0]);

  // `order` indexes into `samples`; boxes own contiguous slices of it.
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) order[i] = i;

  const boxes: Box[] = [makeBox(samples, order, 0, count)];

  while (boxes.length < maxColors) {
    let bestIndex = -1;
    let bestPriority = 0;
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i]!;
      if (box.hi - box.lo < 2) continue;
      const priority = boxVolume(box) * (box.hi - box.lo);
      if (priority > bestPriority) {
        bestPriority = priority;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break; // every box is a single colour

    const box = boxes[bestIndex]!;
    const axis = widestAxis(box);
    sortRangeByChannel(samples, order, box.lo, box.hi, axis);
    const mid = box.lo + ((box.hi - box.lo) >> 1);
    boxes[bestIndex] = makeBox(samples, order, box.lo, mid);
    boxes.push(makeBox(samples, order, mid, box.hi));
  }

  const palette = new Uint8Array(boxes.length * 4);
  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i]!;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    const n = box.hi - box.lo;
    for (let j = box.lo; j < box.hi; j += 1) {
      const p = order[j]! * 4;
      r += samples[p]!;
      g += samples[p + 1]!;
      b += samples[p + 2]!;
      a += samples[p + 3]!;
    }
    const o = i * 4;
    palette[o] = Math.round(r / n);
    palette[o + 1] = Math.round(g / n);
    palette[o + 2] = Math.round(b / n);
    palette[o + 3] = Math.round(a / n);
  }
  return palette;
}

function makeBox(samples: Uint8Array, order: Uint32Array, lo: number, hi: number): Box {
  const box: Box = {
    lo, hi,
    rMin: 255, rMax: 0,
    gMin: 255, gMax: 0,
    bMin: 255, bMax: 0,
    aMin: 255, aMax: 0,
  };
  for (let i = lo; i < hi; i += 1) {
    const p = order[i]! * 4;
    const r = samples[p]!;
    const g = samples[p + 1]!;
    const b = samples[p + 2]!;
    const a = samples[p + 3]!;
    if (r < box.rMin) box.rMin = r;
    if (r > box.rMax) box.rMax = r;
    if (g < box.gMin) box.gMin = g;
    if (g > box.gMax) box.gMax = g;
    if (b < box.bMin) box.bMin = b;
    if (b > box.bMax) box.bMax = b;
    if (a < box.aMin) box.aMin = a;
    if (a > box.aMax) box.aMax = a;
  }
  return box;
}

function boxVolume(box: Box): number {
  // Alpha is weighted up: a wrong alpha is far more visible than a wrong hue.
  const dr = box.rMax - box.rMin;
  const dg = box.gMax - box.gMin;
  const db = box.bMax - box.bMin;
  const da = (box.aMax - box.aMin) * 2;
  return dr * dr + dg * dg + db * db + da * da;
}

function widestAxis(box: Box): 0 | 1 | 2 | 3 {
  const dr = box.rMax - box.rMin;
  const dg = box.gMax - box.gMin;
  const db = box.bMax - box.bMin;
  const da = (box.aMax - box.aMin) * 2;
  let axis: 0 | 1 | 2 | 3 = 0;
  let best = dr;
  if (dg > best) { best = dg; axis = 1; }
  if (db > best) { best = db; axis = 2; }
  if (da > best) { axis = 3; }
  return axis;
}

function sortRangeByChannel(
  samples: Uint8Array,
  order: Uint32Array,
  lo: number,
  hi: number,
  channel: number,
): void {
  // Counting sort: the key is one byte, so this beats a comparison sort and
  // avoids allocating a boxed array per split.
  const counts = new Uint32Array(256);
  for (let i = lo; i < hi; i += 1) {
    counts[samples[order[i]! * 4 + channel]!]! += 1;
  }
  let running = lo;
  const offsets = new Uint32Array(256);
  for (let v = 0; v < 256; v += 1) {
    offsets[v] = running;
    running += counts[v]!;
  }
  const sorted = new Uint32Array(hi - lo);
  for (let i = lo; i < hi; i += 1) {
    const index = order[i]!;
    const value = samples[index * 4 + channel]!;
    sorted[offsets[value]! - lo] = index;
    offsets[value]! += 1;
  }
  order.set(sorted, lo);
}

/** Squared RGBA distance, alpha weighted to match `boxVolume`. */
function distance(
  palette: Uint8Array, entry: number,
  r: number, g: number, b: number, a: number,
): number {
  const o = entry * 4;
  const dr = palette[o]! - r;
  const dg = palette[o + 1]! - g;
  const db = palette[o + 2]! - b;
  const da = (palette[o + 3]! - a) * 2;
  return dr * dr + dg * dg + db * db + da * da;
}

function findNearest(
  palette: Uint8Array,
  cache: Int16Array,
  r: number, g: number, b: number, a: number,
): number {
  const key =
    (((r >> 3) * CACHE_SIDE + (g >> 3)) * CACHE_SIDE + (b >> 3)) * CACHE_SIDE + (a >> 3);
  const cached = cache[key]!;
  if (cached !== 0) return cached - 1;

  const entries = palette.length / 4;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < entries; i += 1) {
    const d = distance(palette, i, r, g, b, a);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
      if (d === 0) break;
    }
  }
  cache[key] = best + 1;
  return best;
}

function newCache(): Int16Array {
  // 32^4 entries at 2 bytes each = 2 MB, freed as soon as the call returns.
  return new Int16Array(CACHE_SIDE * CACHE_SIDE * CACHE_SIDE * CACHE_SIDE);
}

function mapNearest(
  data: Uint8ClampedArray,
  pixelCount: number,
  palette: Uint8Array,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixelCount * 4);
  const cache = newCache();
  for (let i = 0; i < pixelCount; i += 1) {
    const p = i * 4;
    const entry = findNearest(palette, cache, data[p]!, data[p + 1]!, data[p + 2]!, data[p + 3]!);
    const o = entry * 4;
    out[p] = palette[o]!;
    out[p + 1] = palette[o + 1]!;
    out[p + 2] = palette[o + 2]!;
    out[p + 3] = palette[o + 3]!;
  }
  return out;
}

/**
 * Floyd–Steinberg error diffusion. Two running error rows keep memory flat
 * regardless of image height.
 */
function mapWithDithering(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Uint8Array,
  amount: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const cache = newCache();
  const rowLength = (width + 2) * 4; // one guard pixel each side
  let current = new Float32Array(rowLength);
  let next = new Float32Array(rowLength);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 4;
      const e = (x + 1) * 4;

      const r = clampByte(data[p]! + current[e]! * amount);
      const g = clampByte(data[p + 1]! + current[e + 1]! * amount);
      const b = clampByte(data[p + 2]! + current[e + 2]! * amount);
      const a = clampByte(data[p + 3]! + current[e + 3]! * amount);

      const entry = findNearest(palette, cache, r, g, b, a);
      const o = entry * 4;
      const pr = palette[o]!;
      const pg = palette[o + 1]!;
      const pb = palette[o + 2]!;
      const pa = palette[o + 3]!;

      out[p] = pr;
      out[p + 1] = pg;
      out[p + 2] = pb;
      out[p + 3] = pa;

      const er = r - pr;
      const eg = g - pg;
      const eb = b - pb;
      const ea = a - pa;

      // 7/16 right, 3/16 below-left, 5/16 below, 1/16 below-right.
      spread(current, e + 4, er, eg, eb, ea, 7 / 16);
      spread(next, e - 4, er, eg, eb, ea, 3 / 16);
      spread(next, e, er, eg, eb, ea, 5 / 16);
      spread(next, e + 4, er, eg, eb, ea, 1 / 16);
    }
    const spent = current;
    current = next;
    next = spent;
    next.fill(0);
  }
  return out;
}

function spread(
  row: Float32Array, offset: number,
  er: number, eg: number, eb: number, ea: number,
  factor: number,
): void {
  if (offset < 0 || offset + 3 >= row.length) return;
  row[offset]! += er * factor;
  row[offset + 1]! += eg * factor;
  row[offset + 2]! += eb * factor;
  row[offset + 3]! += ea * factor;
}

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

/** Distinct colour count, capped at `limit`. Used to skip pointless work. */
export function countDistinctColors(data: Uint8ClampedArray, limit: number): number {
  const seen = new Set<number>();
  for (let p = 0; p < data.length; p += 4) {
    const key = ((data[p]! << 24) | (data[p + 1]! << 16) | (data[p + 2]! << 8) | data[p + 3]!) >>> 0;
    seen.add(key);
    if (seen.size >= limit) return limit;
  }
  return seen.size;
}

/** True when any pixel is not fully opaque. */
export function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let p = 3; p < data.length; p += 4) {
    if (data[p]! < 255) return true;
  }
  return false;
}
