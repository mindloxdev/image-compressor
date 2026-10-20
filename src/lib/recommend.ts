/**
 * Compression recommendation.
 *
 * Plain arithmetic over what the file header tells us: format, pixel count,
 * byte count and whether an alpha channel is declared. There is no model here
 * and nothing is sent anywhere, so the product never claims otherwise — the
 * reasons shown to the user are the actual rules that fired.
 */

import type { DetectedFormat, EncodableFormat } from '@/engine/formats';
import type { PresetId } from '@/engine/types';

export interface RecommendationInput {
  format: DetectedFormat;
  width: number;
  height: number;
  bytes: number;
  mayHaveAlpha: boolean;
}

export interface Recommendation {
  preset: Exclude<PresetId, 'custom'>;
  /** `null` means "keep the current format". */
  outputFormat: EncodableFormat | null;
  resizeTo: number | null;
  /** One-line summary for the row. */
  headline: string;
  /** The rules that fired, in the order they were evaluated. */
  reasons: string[];
  /** Set when the honest answer is "there is not much to gain here". */
  modestGains: boolean;
}

/** Bytes per pixel — the single most useful signal for how compressed an image already is. */
export function bytesPerPixel(bytes: number, width: number, height: number): number {
  const pixels = width * height;
  if (pixels <= 0) return 0;
  return bytes / pixels;
}

/** Width above which an image is almost certainly larger than its display size. */
const OVERSIZED_WIDTH = 2600;
const WEB_WIDTH = 1920;

export function recommend(input: RecommendationInput): Recommendation {
  const { format, width, height, bytes, mayHaveAlpha } = input;
  const bpp = bytesPerPixel(bytes, width, height);
  const reasons: string[] = [];

  let preset: Exclude<PresetId, 'custom'> = 'balanced';
  let outputFormat: EncodableFormat | null = null;
  let resizeTo: number | null = null;
  let modestGains = false;
  let headline = 'Balanced is a good starting point for this image.';

  const megapixels = (width * height) / 1_000_000;

  if (width > OVERSIZED_WIDTH) {
    resizeTo = WEB_WIDTH;
    reasons.push(
      `At ${width} px wide this is larger than almost any screen displays it. Resizing to ${WEB_WIDTH} px saves far more than quality settings alone.`,
    );
  }

  switch (format) {
    case 'png': {
      if (mayHaveAlpha) {
        // Transparency has to survive, which rules JPEG out entirely.
        if (bpp > 1.2) {
          outputFormat = 'webp';
          preset = 'balanced';
          headline = 'Convert to WebP — it keeps the transparency and is much smaller.';
          reasons.push(
            'This is a detailed PNG with transparency. WebP stores the same transparency in a fraction of the space.',
          );
        } else {
          outputFormat = 'png';
          preset = 'balanced';
          headline = 'Keep it as a PNG and reduce the palette.';
          reasons.push(
            'Transparent PNG with a limited range of colour. Reducing the palette shrinks it without changing the format.',
          );
        }
      } else if (bpp > 1.2) {
        outputFormat = 'jpeg';
        preset = 'balanced';
        headline = 'This photo is in the wrong format — save it as JPEG.';
        reasons.push(
          'PNG stores every pixel exactly, which is wasteful for a photograph. JPEG is typically 80-90% smaller here.',
        );
        reasons.push('There is no transparency to lose.');
      } else {
        outputFormat = 'png';
        preset = 'balanced';
        headline = 'Reduce the palette to shrink this PNG.';
        reasons.push(
          'Flat colour and few gradients — a reduced palette usually cuts the size sharply with little visible change.',
        );
      }
      break;
    }

    case 'jpeg': {
      if (bpp < 0.12) {
        preset = 'best';
        modestGains = true;
        headline = 'Already heavily compressed — use Best Quality.';
        reasons.push(
          `At ${bpp.toFixed(2)} bytes per pixel this JPEG has already been through a compressor. Pushing it further mostly costs quality.`,
        );
      } else if (bpp > 0.5) {
        preset = 'balanced';
        headline = 'Lightly compressed — Balanced will save a lot here.';
        reasons.push(
          `${bpp.toFixed(2)} bytes per pixel is a high-quality export. There is a lot of room to compress before anything is visible.`,
        );
      } else {
        preset = 'balanced';
        headline = 'Balanced suits this JPEG.';
        reasons.push('Typical JPEG quality for the web, with room to compress further.');
      }
      break;
    }

    case 'webp':
    case 'avif': {
      preset = 'best';
      modestGains = true;
      headline = `Already in ${format === 'webp' ? 'WebP' : 'AVIF'} — expect smaller gains.`;
      reasons.push(
        `${format === 'webp' ? 'WebP' : 'AVIF'} is already a modern, efficient format. Re-compressing it gives much less back than converting an older format would.`,
      );
      break;
    }

    case 'gif': {
      outputFormat = 'png';
      preset = 'balanced';
      headline = 'Saved as PNG — GIF cannot be written back out.';
      reasons.push('Single-frame GIFs convert cleanly to PNG, which compresses better.');
      break;
    }

    case 'bmp':
    case 'tiff': {
      outputFormat = mayHaveAlpha ? 'png' : 'jpeg';
      preset = 'balanced';
      headline = `${format.toUpperCase()} is uncompressed — converting will save a great deal.`;
      reasons.push(
        'This format stores raw pixel data with little or no compression, so almost any output will be dramatically smaller.',
      );
      break;
    }

    default:
      break;
  }

  if (megapixels > 24) {
    reasons.push(
      `${megapixels.toFixed(0)} megapixels will take a few seconds to process, and AVIF considerably longer.`,
    );
  }

  return { preset, outputFormat, resizeTo, headline, reasons, modestGains };
}
