/**
 * Every URL the site serves.
 *
 * The router, the sitemap and the prerenderer all read this list, so a page
 * cannot exist in one and be missing from another.
 */

import { GUIDES } from './content/guides';
import { LANDING_PAGES } from './content/landing';

export interface RouteEntry {
  path: string;
  /** Sitemap priority, 0-1. */
  priority: number;
  changefreq: 'weekly' | 'monthly';
}

export const ROUTES: readonly RouteEntry[] = [
  { path: '/', priority: 1, changefreq: 'weekly' },
  ...LANDING_PAGES.map((page) => ({
    path: page.slug,
    priority: page.slug === '/image-compressor' ? 0.9 : 0.8,
    changefreq: 'monthly' as const,
  })),
  { path: '/guides', priority: 0.6, changefreq: 'monthly' },
  ...GUIDES.map((guide) => ({
    path: `/guides/${guide.slug}`,
    priority: 0.5,
    changefreq: 'monthly' as const,
  })),
];

export const ROUTE_PATHS: readonly string[] = ROUTES.map((route) => route.path);
