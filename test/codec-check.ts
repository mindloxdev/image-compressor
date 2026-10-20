/**
 * Browser verification for the compression engine.
 *
 * Runs the real worker pool over generated source images and checks that every
 * output is a valid file of the format it claims to be, that it decodes back to
 * the expected dimensions, and that the reported byte counts match the bytes
 * produced. Open /codec-check.html with `npm run dev`.
 *
 * Results are also written to `window.__codecCheck` so it can be driven
 * headlessly.
 */

import { detectFormat } from '../src/engine/formats';
import { getPool } from '../src/engine/pool';
import { DEFAULT_SETTINGS, type CompressionSettings } from '../src/engine/types';

interface Row {
  name: string;
  detail: string;
  ok: boolean;
}

const rows: Row[] = [];

function record(name: string, ok: boolean, detail: string): void {
  rows.push({ name, detail, ok });
  render();
}

function render(): void {
  const out = document.getElementById('out');
  if (!out) return;
  const body = rows
    .map(
      (row) =>
        `<tr><td>${row.name}</td><td class="${row.ok ? 'pass' : 'fail'}">${
          row.ok ? 'PASS' : 'FAIL'
        }</td><td>${row.detail}</td></tr>`,
    )
    .join('');
  out.innerHTML = `<table><thead><tr><th>Case</th><th/><th>Detail</th></tr></thead><tbody>${body}</tbody></table>`;
}

/** A photo-like test image: gradients, a hard edge, text and fine noise. */
function makeSource(width: number, height: number, alpha: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0d9488');
  gradient.addColorStop(0.5, '#f59e0b');
  gradient.addColorStop(1, '#1e293b');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#ffffff';
  context.fillRect(width * 0.1, height * 0.1, width * 0.3, height * 0.3);
  context.fillStyle = '#111111';
  context.font = `${Math.round(height / 10)}px sans-serif`;
  context.fillText('Pixelpress', width * 0.12, height * 0.6);

  // Fine noise defeats trivial compression, so sizes are realistic.
  const noise = context.getImageData(0, 0, width, height);
  for (let p = 0; p < noise.data.length; p += 4) {
    const jitter = (Math.random() - 0.5) * 26;
    noise.data[p] = Math.max(0, Math.min(255, noise.data[p]! + jitter));
    noise.data[p + 1] = Math.max(0, Math.min(255, noise.data[p + 1]! + jitter));
    noise.data[p + 2] = Math.max(0, Math.min(255, noise.data[p + 2]! + jitter));
    if (alpha) {
      const x = (p / 4) % width;
      noise.data[p + 3] = x < width * 0.2 ? 0 : 255; // a transparent stripe
    }
  }
  context.putImageData(noise, 0, 0);
  return canvas;
}

function toBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`canvas.toBlob returned nothing for ${type}`));
          return;
        }
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      type,
      quality,
    );
  });
}

async function dimensionsOf(bytes: Uint8Array, mimeType: string): Promise<[number, number]> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  const size: [number, number] = [bitmap.width, bitmap.height];
  bitmap.close();
  return size;
}

const MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

async function runCase(
  name: string,
  source: Uint8Array,
  sourceMime: string,
  settings: Partial<CompressionSettings>,
  expect: {
    format: string;
    width?: number;
    height?: number;
    smallerThanSource?: boolean;
    maxBytes?: number;
  },
): Promise<void> {
  const pool = getPool();
  const merged: CompressionSettings = { ...DEFAULT_SETTINGS, ...settings };
  const started = performance.now();

  try {
    const result = await pool.compress(
      `${name}-${Math.random().toString(36).slice(2)}`,
      async () => source.slice().buffer as ArrayBuffer,
      sourceMime,
      merged,
    );
    const elapsed = Math.round(performance.now() - started);
    const problems: string[] = [];

    const detected = detectFormat(result.bytes);
    if (detected !== expect.format) {
      problems.push(`output magic bytes say ${detected}, expected ${expect.format}`);
    }
    if (result.outcome.outputFormat !== expect.format) {
      problems.push(`reported format ${result.outcome.outputFormat}`);
    }
    if (result.outcome.outputBytes !== result.bytes.byteLength) {
      problems.push(
        `reported ${result.outcome.outputBytes} B but produced ${result.bytes.byteLength} B`,
      );
    }

    const [width, height] = await dimensionsOf(result.bytes, MIME[expect.format] ?? 'image/png');
    if (expect.width !== undefined && width !== expect.width) {
      problems.push(`width ${width}, expected ${expect.width}`);
    }
    if (expect.height !== undefined && height !== expect.height) {
      problems.push(`height ${height}, expected ${expect.height}`);
    }
    if (width !== result.outcome.outputWidth || height !== result.outcome.outputHeight) {
      problems.push(
        `reported ${result.outcome.outputWidth}x${result.outcome.outputHeight}, decoded ${width}x${height}`,
      );
    }
    if (expect.smallerThanSource && result.bytes.byteLength >= source.byteLength) {
      problems.push(`not smaller: ${result.bytes.byteLength} >= ${source.byteLength}`);
    }
    if (expect.maxBytes !== undefined && result.bytes.byteLength > expect.maxBytes) {
      problems.push(`${result.bytes.byteLength} B over the ${expect.maxBytes} B target`);
    }

    const saving = (
      ((source.byteLength - result.bytes.byteLength) / source.byteLength) *
      100
    ).toFixed(1);
    record(
      name,
      problems.length === 0,
      problems.length
        ? problems.join('; ')
        : `${source.byteLength} B → ${result.bytes.byteLength} B (${saving}% smaller), ${width}x${height}, q=${result.outcome.qualityUsed}, ${elapsed} ms`,
    );
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

async function runErrorCase(
  name: string,
  source: Uint8Array,
  mime: string,
  expectFragment: string,
): Promise<void> {
  const pool = getPool();
  try {
    await pool.compress(
      `${name}-${Math.random().toString(36).slice(2)}`,
      async () => source.slice().buffer as ArrayBuffer,
      mime,
      DEFAULT_SETTINGS,
    );
    record(name, false, 'expected a rejection but the job succeeded');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record(
      name,
      message.toLowerCase().includes(expectFragment.toLowerCase()),
      `rejected with: ${message}`,
    );
  }
}

async function main(): Promise<void> {
  const status = document.getElementById('status')!;

  const photo = makeSource(1200, 800, false);
  const transparent = makeSource(600, 400, true);

  const pngSource = await toBytes(photo, 'image/png');
  const jpegSource = await toBytes(photo, 'image/jpeg', 0.95);
  const alphaPngSource = await toBytes(transparent, 'image/png');

  record('source: canvas PNG', detectFormat(pngSource) === 'png', `${pngSource.byteLength} B`);
  record('source: canvas JPEG', detectFormat(jpegSource) === 'jpeg', `${jpegSource.byteLength} B`);

  // Each codec, at the balanced preset.
  await runCase('JPEG → JPEG (MozJPEG q75)', jpegSource, 'image/jpeg', { outputFormat: 'jpeg' }, {
    format: 'jpeg', width: 1200, height: 800, smallerThanSource: true,
  });
  await runCase('JPEG → WebP (q78)', jpegSource, 'image/jpeg', { outputFormat: 'webp' }, {
    format: 'webp', width: 1200, height: 800, smallerThanSource: true,
  });
  await runCase('JPEG → AVIF (q50)', jpegSource, 'image/jpeg', { outputFormat: 'avif' }, {
    format: 'avif', width: 1200, height: 800, smallerThanSource: true,
  });
  await runCase('PNG → PNG lossy (128 colours + oxipng)', pngSource, 'image/png',
    { outputFormat: 'png', pngLossy: true, pngColors: 128, pngDither: 0.5 },
    { format: 'png', width: 1200, height: 800, smallerThanSource: true },
  );
  await runCase('PNG → PNG lossless (oxipng pass-through)', pngSource, 'image/png',
    { outputFormat: 'png', pngLossy: false, preset: 'best' },
    { format: 'png', width: 1200, height: 800 },
  );

  // Transparency must survive to a format that supports it, and be flattened
  // (not blackened) when it cannot.
  await runCase('alpha PNG → WebP keeps transparency', alphaPngSource, 'image/png',
    { outputFormat: 'webp' },
    { format: 'webp', width: 600, height: 400 },
  );
  await runCase('alpha PNG → JPEG flattens to white', alphaPngSource, 'image/png',
    { outputFormat: 'jpeg' },
    { format: 'jpeg', width: 600, height: 400 },
  );

  // Resize and aspect ratio.
  await runCase('resize to max width 600', jpegSource, 'image/jpeg',
    { outputFormat: 'jpeg', resizeEnabled: true, maxWidth: 600, maxHeight: null },
    { format: 'jpeg', width: 600, height: 400, smallerThanSource: true },
  );
  await runCase('resize never upscales', jpegSource, 'image/jpeg',
    { outputFormat: 'jpeg', resizeEnabled: true, maxWidth: 4000, maxHeight: null },
    { format: 'jpeg', width: 1200, height: 800 },
  );

  // Target size.
  await runCase('target 60 KB', jpegSource, 'image/jpeg',
    { outputFormat: 'jpeg', targetSizeEnabled: true, targetSizeKb: 60 },
    { format: 'jpeg', maxBytes: 60 * 1024 },
  );
  await runCase('target 15 KB with resize allowed', jpegSource, 'image/jpeg',
    { outputFormat: 'jpeg', targetSizeEnabled: true, targetSizeKb: 15, allowResizeForTarget: true },
    { format: 'jpeg', maxBytes: 15 * 1024 },
  );

  // Failure paths.
  await runErrorCase(
    'corrupt file is rejected',
    new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    'image/jpeg',
    'could not be read',
  );
  await runErrorCase(
    'SVG is rejected with an explanation',
    new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
    'image/svg+xml',
    'vector',
  );
  await runErrorCase(
    'text file is rejected',
    new TextEncoder().encode('this is definitely not an image at all, not even close'),
    'text/plain',
    'not an image',
  );

  // The quality comparison grid.
  try {
    const pool = getPool();
    const sampled = await pool.sample(
      'samples',
      async () => jpegSource.slice().buffer as ArrayBuffer,
      'image/jpeg',
      'jpeg',
      [90, 75, 60],
      DEFAULT_SETTINGS,
    );
    const sizes = sampled.samples.map((sample) => sample.bytes.byteLength);
    const descending = sizes.every((size, i) => i === 0 || size <= sizes[i - 1]!);
    const allValid = sampled.samples.every((sample) => detectFormat(sample.bytes) === 'jpeg');
    record(
      'comparison grid q90/75/60',
      descending && allValid && sizes.length === 3,
      `${sizes.map((size) => `${(size / 1024).toFixed(1)} KB`).join(' > ')} at ${sampled.width}x${sampled.height}`,
    );
  } catch (error) {
    record('comparison grid q90/75/60', false, error instanceof Error ? error.message : String(error));
  }

  const failures = rows.filter((row) => !row.ok);
  status.textContent = failures.length
    ? `${failures.length} of ${rows.length} checks FAILED`
    : `All ${rows.length} checks passed`;
  status.className = failures.length ? 'fail' : 'pass';

  (window as unknown as Record<string, unknown>).__codecCheck = {
    done: true,
    total: rows.length,
    failed: failures.length,
    rows,
  };
  console.log('[codec-check]', JSON.stringify({ total: rows.length, failed: failures.length, rows }));
}

void main();
