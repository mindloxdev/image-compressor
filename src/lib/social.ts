/**
 * Resize presets for common placements.
 *
 * Every dimension here is written down rather than hidden, because platforms
 * change their specifications whenever they like. These are the sizes the
 * preset applies — they are a sensible, widely used starting point, not a
 * guarantee about what any platform will accept next year.
 */

export interface SizePreset {
  id: string;
  group: 'social' | 'web' | 'commerce';
  label: string;
  width: number;
  height: number | null;
  /** What the size is for, and anything the user should know about it. */
  note: string;
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  {
    id: 'instagram-square',
    group: 'social',
    label: 'Instagram post (square)',
    width: 1080,
    height: 1080,
    note: '1:1. Instagram re-compresses uploads, so there is no benefit to going larger.',
  },
  {
    id: 'instagram-portrait',
    group: 'social',
    label: 'Instagram post (portrait)',
    width: 1080,
    height: 1350,
    note: '4:5 — the tallest shape that is not cropped in the feed.',
  },
  {
    id: 'instagram-story',
    group: 'social',
    label: 'Instagram Story / Reels cover',
    width: 1080,
    height: 1920,
    note: '9:16 full screen. Keep text away from the top and bottom 250 px.',
  },
  {
    id: 'facebook-post',
    group: 'social',
    label: 'Facebook post',
    width: 1200,
    height: 630,
    note: '1.91:1, the same shape Facebook uses for shared link previews.',
  },
  {
    id: 'linkedin-post',
    group: 'social',
    label: 'LinkedIn post',
    width: 1200,
    height: 627,
    note: 'Roughly 1.91:1. LinkedIn crops taller images in the feed.',
  },
  {
    id: 'x-post',
    group: 'social',
    label: 'X post',
    width: 1600,
    height: 900,
    note: '16:9. X displays a 2:1 crop in the timeline and the full image when opened.',
  },
  {
    id: 'youtube-thumbnail',
    group: 'social',
    label: 'YouTube thumbnail',
    width: 1280,
    height: 720,
    note: '16:9. YouTube requires thumbnails under 2 MB.',
  },
  {
    id: 'pinterest-pin',
    group: 'social',
    label: 'Pinterest pin',
    width: 1000,
    height: 1500,
    note: '2:3, the shape Pinterest recommends for pins.',
  },
  {
    id: 'web-hero',
    group: 'web',
    label: 'Website hero',
    width: 1920,
    height: null,
    note: 'Full-width banner. Height is left to the image so nothing is cropped.',
  },
  {
    id: 'web-content',
    group: 'web',
    label: 'In-article image',
    width: 1200,
    height: null,
    note: 'Comfortably sharp inside a typical 700-800 px content column, including on retina screens.',
  },
  {
    id: 'web-thumbnail',
    group: 'web',
    label: 'Thumbnail / card',
    width: 600,
    height: null,
    note: 'For grids and related-post cards.',
  },
  {
    id: 'product-main',
    group: 'commerce',
    label: 'Product image (main)',
    width: 2000,
    height: 2000,
    note: 'Large enough for zoom on most store platforms, which generally want at least 1600 px.',
  },
  {
    id: 'product-listing',
    group: 'commerce',
    label: 'Product image (listing)',
    width: 1000,
    height: 1000,
    note: 'Square listing and category thumbnails.',
  },
];

export const PRESET_GROUP_LABELS: Record<SizePreset['group'], string> = {
  social: 'Social media',
  web: 'Website',
  commerce: 'Online store',
};

export function findSizePreset(id: string): SizePreset | undefined {
  return SIZE_PRESETS.find((preset) => preset.id === id);
}

export function sizePresetsByGroup(group: SizePreset['group']): SizePreset[] {
  return SIZE_PRESETS.filter((preset) => preset.group === group);
}
