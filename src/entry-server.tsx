/**
 * Server entry for build-time prerendering.
 *
 * Renders a route to HTML and hands back the metadata the page declared, so
 * `scripts/prerender.mjs` can write a complete static document per URL. No
 * server runs this at request time — the output is plain files.
 */

import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
// React Router 7 merged the packages: StaticRouter comes from `react-router`,
// not the v6 `react-router-dom/server` subpath.
import { StaticRouter } from 'react-router';

import { App } from './App';
import { SeoProvider, type SeoMeta, type SeoCollector } from './lib/seo';

export { ROUTES } from './routes';

export interface RenderResult {
  html: string;
  meta: SeoMeta | null;
}

export function render(url: string): RenderResult {
  const collector: SeoCollector = { meta: null };

  const html = renderToString(
    <StrictMode>
      <SeoProvider collector={collector}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </SeoProvider>
    </StrictMode>,
  );

  return { html, meta: collector.meta };
}
