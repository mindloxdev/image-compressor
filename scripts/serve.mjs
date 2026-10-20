/**
 * Static preview server for the prerendered build.
 *
 * `vite preview` serves a single-page app: it falls back to `dist/index.html`
 * for any path it does not recognise, which hands the home page to a request
 * for /compress-jpg and makes React hydrate the wrong markup. Real static
 * hosts resolve a directory to its index file instead, so this mirrors that
 * and lets the prerendered output be checked as it will actually be served.
 *
 * Usage: node scripts/serve.mjs [port]
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.argv[2]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

async function findFile(pathname) {
  // Reject anything that climbs out of dist.
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const target = join(dist, clean);
  if (!target.startsWith(dist + sep) && target !== dist) return null;

  const candidates = [target];
  if (!extname(target)) candidates.push(join(target, 'index.html'));

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', `http://localhost:${port}`);
  let file = await findFile(pathname === '/' ? '/index.html' : pathname);
  let status = 200;

  if (!file) {
    file = await findFile('/404.html');
    status = 404;
  }
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
    return;
  }

  response.writeHead(status, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`\n  Serving dist/ as a static host would, at http://localhost:${port}\n`);
});
