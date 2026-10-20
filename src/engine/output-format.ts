import type { CompressionSettings } from './types';
import type { DetectedFormat, EncodableFormat } from './formats';

/** Decide what format to write when the user asked to keep the original. */
export function resolveOutputFormat(
  source: DetectedFormat,
  choice: CompressionSettings['outputFormat'],
  mayHaveAlpha: boolean,
): { format: EncodableFormat; note?: string } {
  if (choice !== 'keep') return { format: choice };

  switch (source) {
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'avif':
      return { format: source };
    case 'gif':
      return {
        format: 'png',
        note: 'GIF cannot be written back out, so this was saved as PNG.',
      };
    case 'bmp':
    case 'tiff':
      return mayHaveAlpha
        ? { format: 'png', note: `${source.toUpperCase()} was saved as PNG.` }
        : { format: 'jpeg', note: `${source.toUpperCase()} was saved as JPEG.` };
    default:
      return { format: 'png', note: 'Unrecognised input was saved as PNG.' };
  }
}
