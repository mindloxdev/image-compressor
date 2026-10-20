# Pixelpress

An online image compressor that runs entirely in the browser. No image is ever
uploaded: the encoders are WebAssembly builds of MozJPEG, libwebp, libavif and
oxipng that execute in Web Workers on the visitor's own device.

```bash
npm install
npm run dev      # http://localhost:5173
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload. |
| `npm run build` | Client build, SSR build, then prerenders every route to static HTML with a sitemap and robots file. |
| `npm run serve` | Serves `dist/` the way a static host does — resolving `/compress-jpg` to `dist/compress-jpg/index.html`. Use this to check a build, **not** `npm run preview`. |
| `npm run preview` | Vite's own preview server. It falls back to `dist/index.html` for every unknown path, so prerendered pages are served as the home page and hydration mismatches. Kept only because it ships with Vite. |
| `npm run test` | Unit tests (Vitest, Node — no WebAssembly). |
| `npm run typecheck` | `tsc --noEmit`. |

## Configuration

Set the site origin before a production build, or canonical URLs, Open Graph
URLs and `sitemap.xml` are skipped rather than emitted with a wrong hostname:

```bash
SITE_URL=https://your-domain.example npm run build
```

Or fill in `origin` in `site.config.json`. The build prints a warning when the
origin is unset.

## How compression works

```
File → identify from magic bytes → decode (createImageBitmap)
     → resize (Lanczos3, optional) → flatten alpha (JPEG only)
     → encode (MozJPEG / libwebp / libavif / oxipng) → measure → report
```

Decoding uses the browser's own image pipeline, which reads everything the
browser can display and applies EXIF rotation. Encoding uses the Squoosh
codecs, because a canvas `toBlob` JPEG is substantially larger than the same
image through MozJPEG, and canvas cannot write a palette PNG at all.

Work runs in a pool of Web Workers — `min(hardwareConcurrency - 1, 4)` — so the
interface never blocks and a large batch cannot exhaust memory. Cancelling a job
terminates its worker, because a running WebAssembly encode cannot be
interrupted any other way.

### Formats

| Format | Read | Written | Notes |
| --- | --- | --- | --- |
| JPEG | yes | yes | MozJPEG, progressive, optimised Huffman tables. |
| PNG | yes | yes | oxipng; optional median-cut palette reduction for lossy PNG. |
| WebP | yes | yes | libwebp, lossy colour with losslessly stored alpha. |
| AVIF | yes | yes | libavif. Smallest output, by far the slowest to encode. |
| GIF | yes | no | Still frames are written as PNG. Animated GIFs are refused. |
| BMP, TIFF | yes | no | Written as PNG (with alpha) or JPEG (without). |
| SVG | no | no | Vector — refused with an explanation. |

### Limits

* 100 images per batch, 60 MB per file, 100 megapixels per image.
* All three are browser-memory limits, not licensing ones. They live in
  `src/hooks/useCompressionQueue.ts` and `src/engine/codecs.ts`.

### What the presets do

| Preset | JPEG | WebP | AVIF | PNG |
| --- | --- | --- | --- | --- |
| Best Quality | q88 | q90 | q65 | lossless |
| Balanced | q75 | q78 | q50 | 128 colours |
| Smallest File | q55 | q58 | q35 | 64 colours |

Quality numbers are per codec on purpose: the same number means different
things to each encoder, and AVIF in particular runs 20–25 points lower for the
same perceived quality.

### Target file size

There is no formula from "100 KB" to a quality number, so the engine encodes,
measures and narrows in. It probes the quality floor first — if even that
overshoots, no quality will fit and it moves straight to reducing dimensions,
rather than spending six encodes proving it. Scale is derived from the square
root of the size ratio, because file size tracks pixel area.

If the target cannot be reached, the result says so and reports the smallest
size actually produced. It is never claimed as reached without measuring.

## Honesty rules this codebase follows

Every number shown to a user is measured from bytes that were actually
produced. Specifically:

* Savings come from the output file's length, never an estimate.
* A result larger than its input is reported as such, with advice to keep the
  original — it is still counted truthfully in the batch total.
* "Lossless" is claimed only on the PNG path with palette reduction off.
* Animated images are detected and skipped, not silently flattened to frame one.
* Metadata is carried across only for JPEG → JPEG, where the EXIF block is
  copied with its orientation tag normalised; every other combination reports
  that it has none.
* No fabricated statistics, testimonials or performance claims appear anywhere
  on the site. The hero illustration is labelled as illustrative.

## Behaviour under load

Everything runs in the browser, so the resource that runs out is the tab's own
memory — and a browser that exceeds its heap does not throw an error, it
discards the page. The whole design of the queue is built around not reaching
that point.

**Nothing is held that does not need to be.** A queued file is a `File` handle,
not bytes: the worker reads it only when its turn comes. A finished result is a
`Blob`, which the browser owns and can page out to disk, never a `Uint8Array`
pinned in the JavaScript heap. The practical effect is that the main thread
stays flat no matter how large the batch.

**Jobs are admitted against a memory budget, not a worker count.** Each job is
priced from its pixel count (RGBA at roughly three concurrent copies, plus the
worker and its codec heaps). The pool starts a job only if the estimate fits
the remaining budget, which is derived from `navigator.deviceMemory` and
clamped to 256 MB–1.5 GB. One job is always allowed to run however large, so a
single enormous image cannot deadlock the queue, and a job that would alone
take half the budget runs with the pool to itself.

**The limits scale to the device.** The megapixel ceiling is computed from the
same budget rather than fixed, so a phone refuses an image a workstation
accepts — and it refuses it from the file header, before any decode. Worker
count drops to one below 4 GB of RAM and two below 8 GB.

**Failures narrow the pool instead of repeating.** An out-of-memory error or a
worker dying drops concurrency to one for the rest of the session and tells the
user why. Retrying at the same concurrency is how a tab dies on the second
attempt rather than the first.

**Nothing waits forever.** A job that reports no progress for five minutes is
terminated and reported. Workers are shut down after 30 seconds idle, releasing
their WebAssembly heaps between batches.

**ZIP building is the one main-thread spike, and it is capped.** JSZip
assembles an archive in memory at roughly twice the finished size, so batches
are split into parts sized from the same device budget (32–150 MB each). Peak
cost is therefore bounded by the cap, not by how much was compressed.

### Measured

On a 16 GB, 12-core machine (Chrome, 4 GB heap limit), from the production
build:

| Scenario | Result |
| --- | --- |
| 42 images at 12 MP, 196 MB of source | 42 s, 0 failures, 70.2% saved, **peak main-thread heap 18 MB** |
| 30 images at 12 MP, cancelled mid-batch and resumed | finished work kept, 6 stopped cleanly, all 30 completed on resume |
| 26 results totalling 156 MB, downloaded as ZIP | split into 2 parts automatically, peak heap 350 MB |
| 20000 x 20000 PNG header (400 MP) | refused from the header with the device limit quoted, nothing decoded |

The page stayed interactive throughout every run.

### Where the limits live

| Limit | Value | File |
| --- | --- | --- |
| Files per batch | 100 | `src/hooks/useCompressionQueue.ts` |
| Bytes per file | 60 MB | `src/hooks/useCompressionQueue.ts` |
| Megapixels per image | device-derived, 12–80 MP | `src/engine/memory.ts` |
| Concurrent jobs | device-derived, 1–4 | `src/engine/memory.ts` |
| Memory budget | device-derived, 256 MB–1.5 GB | `src/engine/memory.ts` |
| Archive part size | device-derived, 32–150 MB | `src/lib/download.ts` |
| Stall timeout | 5 minutes | `src/engine/pool.ts` |

### Server load

There is none to speak of. The site is static files and the compression happens
on each visitor's device, so traffic costs bandwidth and nothing else — the
same page serves ten people or ten thousand with no additional work. The
deployment notes below cover the only server-side requirements.

## Colours

The palette is the mindlox.ai one, taken from the MindLox AI design tokens:
the `bg`/`bg-2`/`bg-3` backgrounds, the `fg` ink ramp, the electric-blue accent
with its cyan and violet gradient partners, and the positive/warning/negative
status colours. Everything is defined once as semantic tokens in
`src/index.css`; no component names a shade.

Three roles are set one or two stops darker than mindlox.ai uses them. MindLox
puts those colours on large display type and on fills; this product puts them
on 12-13px UI text, which has to clear 4.5:1. In each case the replacement is a
darker shade of the same MindLox hue -- the accent steps to electric-600 and
electric-700, both already in their palette:

| Role | mindlox.ai | Here | Why |
| --- | --- | --- | --- |
| faint text | `#8a93ab` | `#5a6480` | 2.89:1 was unreadable at 12px |
| accent text and fills | `#2b6bff` | `#1f55e0` | 4.25:1 on the canvas; `#2b6bff` is kept as `brand-vivid` for fills, the focus ring and the illustration |
| savings / warning / error | `#10b981` / `#f59e0b` / `#f0466a` | `#0a7352` / `#8a5800` / `#c01a3e` | all three fail badly as small text on a light background |

MindLox AI ships no dark scheme, so the dark values are built from the navy and
ink ramps in the same token file (`midnight`, `navy-950/900/800`,
`ink-100/300`, `electric-400/300`, `mint-400`, `amber-400`) rather than
invented. Both themes are verified at 4.5:1 across the populated workspace.

## Testing

```bash
npm run test     # 82 unit tests, Node
```

Unit tests cover the pure logic: format sniffing from magic bytes, animation
detection, header probing, resize arithmetic, the target-size search, colour
quantisation, EXIF extraction and splicing, filename sanitising and ZIP name
deduplication, presets, the recommendation rules, the memory budget and the
archive packing.

The codecs themselves cannot be meaningfully tested in Node, so they are
verified in a real browser:

```bash
npm run dev
# open http://localhost:5173/codec-check.html
```

That page generates test images and runs them through the real worker pool,
asserting that every output is a valid file of the format it claims to be, that
it decodes back to the expected dimensions, that reported byte counts match the
bytes produced, that transparency survives where it should, that resizing never
upscales, that target sizes are met, and that corrupt files, SVG and non-images
are each rejected with a useful message. Results are also written to
`window.__codecCheck` so the page can be driven headlessly.

The file is excluded from the production build: Vite's build input is
`index.html` only.

## Deployment

The build produces a static `dist/`. Any static host will serve it, with three
requirements:

1. **Directory indexes.** `/compress-jpg` must serve
   `dist/compress-jpg/index.html`. Without it, a fallback to the home page will
   hand React the wrong markup and hydration will fail.
2. **`.wasm` served as `application/wasm`.** Streaming compilation is skipped
   otherwise, and some hosts refuse the file entirely.
3. **`404.html` for unknown paths.**

Do **not** set `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`.
With cross-origin isolation enabled, oxipng switches to its multi-threaded
build, which needs `SharedArrayBuffer` and a different worker layout. Without
those headers it uses the single-threaded path, which is what this build is
tested against.

<details>
<summary>nginx</summary>

```nginx
root /var/www/pixelpress/dist;
types { application/wasm wasm; }

location / {
  try_files $uri $uri/index.html /404.html;
}

location /assets/ {
  # Hashed filenames, safe to cache forever.
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```
</details>

<details>
<summary>Netlify / Vercel</summary>

Both resolve directory indexes and serve `404.html` by default. Point the build
command at `npm run build`, the publish directory at `dist`, and set `SITE_URL`
as an environment variable. Do not add an SPA catch-all rewrite to
`/index.html` — it would defeat the prerendering.
</details>

## Project structure

```
src/
  engine/          compression, free of React
    formats.ts     magic-byte identification, animation detection
    probe.ts       dimensions and alpha from file headers, no decode
    codecs.ts      the WebAssembly layer (worker side only)
    quantize.ts    median-cut RGBA quantiser with Floyd-Steinberg dithering
    exif.ts        EXIF extraction, orientation normalising, splicing
    target.ts      target-size search, with the encoder injected
    pipeline.ts    decode → resize → flatten → encode → report
    worker.ts      the worker entry point
    pool.ts        main-thread worker pool, queueing and cancellation
  components/      UI, with the workspace under components/workspace/
  content/         landing page and guide copy
  pages/           one component per route
  lib/             seo, download, filenames, recommendations, size presets
scripts/
  prerender.mjs    renders every route to static HTML + sitemap + robots
  serve.mjs        static server that behaves like a real host
test/
  engine.test.ts   unit tests
  codec-check.ts   in-browser codec verification
```

## Known limitations

* Animated GIF, animated WebP and APNG are refused rather than compressed.
* SVG is not supported; it has no pixels to compress.
* 16-bit-per-channel PNGs are processed as 8-bit, which reduces colour depth.
* ICC colour profiles are not carried through — decoding goes via the browser's
  canvas, which converts to sRGB.
* Metadata preservation is JPEG → JPEG only.
* AVIF encoding is slow enough that large batches are impractical.
* Responsive image sets are not generated; compress once per size you serve.
```
