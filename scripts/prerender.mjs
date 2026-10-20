/**
 * Build-time prerendering.
 *
 * Renders every route to static HTML with its own title, description,
 * canonical, Open Graph tags and JSON-LD, then writes a sitemap and robots
 * file. The result is a static site a crawler can read without executing any
 * JavaScript, which hydrates into the full application in the browser.
 *
 * Run by `npm run build`, after the client and SSR bundles are built.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = join(root, 'dist');
const ssrEntry = join(root, 'dist-ssr', 'entry-server.js');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** JSON-LD sits inside a script element, so only `<` needs neutralising. */
function escapeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, String.fromCharCode(92) + 'u003c');
}

async function readOrigin() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  try {
    const config = JSON.parse(await readFile(join(root, 'site.config.json'), 'utf8'));
    return typeof config.origin === 'string' ? config.origin.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

function buildHead(meta, origin) {
  const lines = [];
  const canonical = origin ? `${origin}${meta.path === '/' ? '/' : meta.path}` : null;

  lines.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);
  if (canonical) lines.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  lines.push(`<meta property="og:site_name" content="Pixelpress" />`);
  lines.push(`<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
  lines.push(`<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
  lines.push(`<meta property="og:type" content="${meta.ogType ?? 'website'}" />`);
  if (canonical) lines.push(`<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  lines.push(`<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`);
  lines.push(`<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`);
  if (meta.noindex) lines.push(`<meta name="robots" content="noindex,follow" />`);

  for (const data of meta.structuredData ?? []) {
    // Absolute URLs inside structured data, where we know the origin.
    const withOrigin = origin ? absolutise(data, origin) : data;
    lines.push(
      `<script type="application/ld+json">${escapeJsonLd(withOrigin)}</script>`,
    );
  }

  return lines.map((line) => `    ${line}`).join('\n');
}

/** Rewrite any root-relative `url`/`item` field to an absolute URL. */
function absolutise(value, origin) {
  if (Array.isArray(value)) return value.map((entry) => absolutise(entry, origin));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if ((key === 'url' || key === 'item') && typeof entry === 'string' && entry.startsWith('/')) {
        out[key] = `${origin}${entry}`;
      } else {
        out[key] = absolutise(entry, origin);
      }
    }
    return out;
  }
  return value;
}

/**
 * The Vite client build writes `dist/index.html`, and this script then
 * overwrites it with the rendered home page. Running the script a second time
 * without rebuilding would otherwise treat that rendered page as the template
 * and nest every page inside the home page. So the pristine shell is stashed
 * in `dist-ssr/` (a build directory that is never deployed) and reused.
 */
async function loadTemplate() {
  const stash = join(root, 'dist-ssr', 'client-template.html');
  const shell = await readFile(join(dist, 'index.html'), 'utf8');

  if (shell.includes('<div id="root"></div>')) {
    await writeFile(stash, shell, 'utf8');
    return shell;
  }

  try {
    const stashed = await readFile(stash, 'utf8');
    if (stashed.includes('<div id="root"></div>')) return stashed;
  } catch {
    // Fall through to the error below.
  }

  throw new Error(
    'dist/index.html has already been prerendered and no pristine template was found. ' +
      'Run `vite build` to regenerate it before prerendering.',
  );
}

async function main() {
  const origin = await readOrigin();
  if (!origin) {
    console.warn(
      '\n  [prerender] No site origin configured.\n' +
        '  Canonical URLs, Open Graph URLs and sitemap.xml will be skipped.\n' +
        '  Set SITE_URL=https://your-domain or fill in site.config.json, then rebuild.\n',
    );
  }

  const template = await loadTemplate();
  // The route list is re-exported by the app itself, so it cannot drift from
  // the router it feeds.
  const { render, ROUTES } = await import(pathToFileURL(ssrEntry).href);

  const rendered = [];

  for (const route of ROUTES) {
    const { html, meta } = render(route.path);
    if (!meta) {
      throw new Error(
        `${route.path} rendered without declaring page metadata. Every page needs a <Seo> element.`,
      );
    }

    let document = template;
    document = document.replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${escapeHtml(meta.title)}</title>`,
    );
    // Drop the shell's placeholder description; buildHead writes the real one.
    document = document.replace(/\s*<meta\s+name="description"[\s\S]*?\/>/, '');
    document = document.replace('</head>', `${buildHead(meta, origin)}\n  </head>`);
    document = document.replace(
      '<div id="root"></div>',
      `<div id="root">${html}</div>`,
    );

    const outputPath =
      route.path === '/' ? join(dist, 'index.html') : join(dist, route.path, 'index.html');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, document, 'utf8');
    rendered.push({ path: route.path, bytes: Buffer.byteLength(document), title: meta.title });
  }

  // A 404 document for hosts that serve one; it is marked noindex by the page.
  const notFound = render('/this-route-does-not-exist');
  if (notFound.meta) {
    let document = template;
    document = document.replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${escapeHtml(notFound.meta.title)}</title>`,
    );
    document = document.replace(/\s*<meta\s+name="description"[\s\S]*?\/>/, '');
    document = document.replace('</head>', `${buildHead(notFound.meta, origin)}\n  </head>`);
    document = document.replace('<div id="root"></div>', `<div id="root">${notFound.html}</div>`);
    await writeFile(join(dist, '404.html'), document, 'utf8');
  }

  if (origin) {
    const now = new Date().toISOString().slice(0, 10);
    const urls = ROUTES.map(
      (route) =>
        '  <url>\n' +
        `    <loc>${origin}${route.path}</loc>\n` +
        `    <lastmod>${now}</lastmod>\n` +
        `    <changefreq>${route.changefreq}</changefreq>\n` +
        `    <priority>${route.priority.toFixed(1)}</priority>\n` +
        '  </url>',
    ).join('\n');
    await writeFile(
      join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      'utf8',
    );
  }

  await writeFile(
    join(dist, 'robots.txt'),
    [
      'User-agent: *',
      'Allow: /',
      '',
      ...(origin ? [`Sitemap: ${origin}/sitemap.xml`, ''] : []),
    ].join('\n'),
    'utf8',
  );

  console.log(`\n  [prerender] ${rendered.length} pages written to dist/`);
  for (const page of rendered) {
    console.log(
      `    ${page.path.padEnd(34)} ${String(Math.round(page.bytes / 1024)).padStart(4)} kB  ${page.title.slice(0, 48)}`,
    );
  }
  console.log(
    `    404.html${' '.repeat(26)}        ${origin ? 'sitemap.xml + robots.txt' : 'robots.txt (no sitemap: origin unset)'}\n`,
  );
}

main().catch((error) => {
  console.error('[prerender] failed:', error);
  process.exitCode = 1;
});
