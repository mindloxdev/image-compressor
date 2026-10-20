/**
 * Original guides.
 *
 * Written to answer the question in the title and then stop. Nothing is copied
 * from another site, no competitor is named misleadingly, and every claim here
 * is either a property of the format or something the tool on this site
 * actually does.
 */

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'note'; text: string };

export interface Guide {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  /** ISO date, used for the Article structured data. */
  published: string;
  readingMinutes: number;
  blocks: Block[];
  related: { to: string; label: string }[];
}

export const GUIDES: readonly Guide[] = [
  {
    slug: 'image-quality-and-file-size',
    title: 'Image quality and file size: what the quality number really does',
    metaTitle: 'Image Quality and File Size Explained',
    metaDescription:
      'What a JPEG or WebP quality setting actually changes, why 80 in one format is not 80 in another, and how to choose a number by measuring rather than guessing.',
    summary:
      'Quality is not a percentage. Here is what the slider changes, why the same number means different things per format, and how to pick one.',
    published: '2026-10-20',
    readingMinutes: 6,
    blocks: [
      {
        type: 'p',
        text: 'Almost every image tool gives you a quality slider from 1 to 100 and almost none of them explain it. The number is not a percentage of the original, it is not comparable between formats, and moving it from 90 to 80 does not remove 10% of anything. Knowing what it does change makes the difference between guessing and choosing.',
      },
      { type: 'h2', text: 'What a lossy encoder actually throws away' },
      {
        type: 'p',
        text: 'A JPEG encoder does not store pixels. It splits the image into 8×8 blocks, converts each one into a set of frequency coefficients — how much fine detail, how much broad tone — and then divides those coefficients by a table of numbers, rounding the results. Most of the fine-detail coefficients round to zero, and long runs of zeros compress to almost nothing. That rounding is the loss, and it is permanent.',
      },
      {
        type: 'p',
        text: 'The quality setting picks the table. A high quality means small divisors, so less is rounded away; a low quality means large divisors and far more zeros. This is why compression artefacts look the way they do: blocky 8×8 edges in flat areas, and a mottled ringing around hard edges like text, where the high-frequency detail that described the edge has been discarded.',
      },
      {
        type: 'p',
        text: 'WebP and AVIF work on the same principle with better maths — larger and variable block sizes, smarter prediction from neighbouring blocks, better entropy coding. The result is that they need fewer bits to reach the same visual quality, which is the entire reason to prefer them.',
      },
      { type: 'h2', text: 'Why 80 is not 80' },
      {
        type: 'p',
        text: 'Each format maps its quality number onto its own internal parameters. A JPEG at 80 and a WebP at 80 are not making the same trade, and an AVIF at 80 is far more conservative than either — AVIF quality numbers run perhaps 20 to 25 points lower for the same perceived result, which is why a sensible AVIF default is around 50 while a sensible JPEG default is around 75.',
      },
      {
        type: 'p',
        text: 'Two encoders for the same format can differ too. MozJPEG at quality 75 produces a smaller file than a basic JPEG encoder at quality 75, because it spends more effort choosing how to encode what survives the rounding. Same number, same format, different bytes.',
      },
      { type: 'h2', text: 'Rough starting points' },
      {
        type: 'ul',
        items: [
          '90 and above — for images you will edit again, or that will be re-compressed by someone else later. Large files, almost no visible loss.',
          '75 to 85 — the normal range for web photography. Most people cannot tell 85 from the original at normal viewing size.',
          '60 to 75 — fine for thumbnails, backgrounds and anything the eye will not rest on.',
          'Below 50 — visible. Skies band, skin goes blotchy, text inside the image falls apart.',
        ],
      },
      {
        type: 'note',
        text: 'These are starting points, not answers. The right number depends on the picture: a flat graphic survives quality 40, a portrait with a smooth background shows artefacts at 70.',
      },
      { type: 'h2', text: 'Measure instead of guessing' },
      {
        type: 'p',
        text: 'The only reliable way to choose is to encode the actual image and look at it. On any file in the compressor, "Try settings" encodes that photograph at quality 90, 75 and 60 at full resolution and shows the three real file sizes side by side. Pick from the measurements.',
      },
      {
        type: 'p',
        text: 'When you inspect the result, zoom in on the four places compression fails first: large flat areas such as a clear sky, out-of-focus backgrounds, skin tones, and any text baked into the image. If those four hold up, the rest will.',
      },
      { type: 'h2', text: 'The setting that beats quality' },
      {
        type: 'p',
        text: 'File size is roughly proportional to pixel count. Halving the width and height of an image removes three quarters of its pixels — a far bigger saving than any quality adjustment, and one that costs nothing if the image was larger than the space it is displayed in. Check the dimensions before you touch the slider.',
      },
      {
        type: 'p',
        text: 'A useful figure for judging this is bytes per pixel: divide the file size by width times height. Above about 0.5 bytes per pixel, a JPEG has a lot of room left. Below about 0.12, it has already been compressed hard and pushing further will cost visible quality for very little gain. The per-image recommendation in the compressor uses exactly this number.',
      },
    ],
    related: [
      { to: '/compress-jpg', label: 'Compress JPG' },
      { to: '/guides/target-file-sizes', label: 'Hitting a specific file size' },
      { to: '/guides/webp-explained', label: 'WebP explained' },
    ],
  },

  {
    slug: 'webp-explained',
    title: 'WebP explained: when to use it, and when not to',
    metaTitle: 'WebP Explained — When to Use WebP Instead of JPEG or PNG',
    metaDescription:
      'What WebP does better than JPEG and PNG, how much smaller it really is, where support still falls short, and how to convert without stacking up quality loss.',
    summary:
      'WebP replaces both JPEG and PNG for most web work. What it gains, what it costs, and the one mistake to avoid when converting.',
    published: '2026-10-20',
    readingMinutes: 5,
    blocks: [
      {
        type: 'p',
        text: 'WebP is the format most websites should be serving and many still are not. It does the job of JPEG and the job of transparent PNG, in one format, at a smaller size than either. The case against it has largely expired.',
      },
      { type: 'h2', text: 'What you gain' },
      {
        type: 'ul',
        items: [
          'Against JPEG: typically 25 to 35% smaller for the same perceived quality, because the encoder predicts blocks from their neighbours rather than coding each one independently.',
          'Against PNG: dramatically smaller for anything photographic, while still supporting an alpha channel — often an order of magnitude for a photo that was wrongly saved as PNG.',
          'Alpha is stored losslessly even when the colour channels are lossy, so a cut-out logo keeps clean edges instead of developing a halo.',
          'One format covers both jobs, so you maintain one file per image rather than a JPEG and a PNG.',
        ],
      },
      { type: 'h2', text: 'What it costs' },
      {
        type: 'p',
        text: 'Encoding is slower than JPEG, though not dramatically — a fraction of a second for a typical web image. The real cost is outside the browser: some older email clients, CMS uploaders, desktop applications and social platform tools still will not open a WebP. Browsers are no longer the problem; the software around them sometimes is.',
      },
      {
        type: 'p',
        text: 'If a file has to be opened by something you do not control — an email attachment, a printer, a client who will drop it into an old application — send a JPEG.',
      },
      { type: 'h2', text: 'Support, in practice' },
      {
        type: 'p',
        text: 'Every browser in current use reads WebP: Chrome, Edge, Firefox, Safari, and the mobile versions of all of them. For a normal website audience, serving WebP with no fallback is a reasonable decision. If you need certainty for your own traffic, your analytics will tell you more than any compatibility table.',
      },
      { type: 'h2', text: 'The conversion mistake worth avoiding' },
      {
        type: 'p',
        text: 'Always convert from the highest-quality original you have — the camera file, the export from your editor — not from a JPEG you already compressed. Lossy compression applied twice does not average out; each pass discards information permanently, and the second pass is working on artefacts the first one introduced. A WebP made from a quality-70 JPEG looks worse than a WebP made from the original at the same file size.',
      },
      {
        type: 'note',
        text: 'The same applies in reverse: converting a WebP back to JPEG adds a second lossy pass. If you need both formats, make both from the original.',
      },
      { type: 'h2', text: 'Lossy or lossless WebP' },
      {
        type: 'p',
        text: 'WebP has a lossless mode as well as a lossy one. Lossless WebP is usually smaller than the equivalent PNG, which makes it interesting for graphics, but it is beaten comfortably by lossy WebP for anything photographic. The compressor on this site encodes lossy WebP, with alpha stored losslessly — if you need pixel-identical output, use the lossless PNG mode instead.',
      },
      { type: 'h2', text: 'What about AVIF' },
      {
        type: 'p',
        text: 'AVIF is smaller again, often by another 20% or more at the same quality, and it has good browser support now. The catch is encoding time: it is slow enough that compressing a hundred images becomes a chore. A sensible policy is AVIF for the handful of images that dominate a page, WebP for everything else.',
      },
    ],
    related: [
      { to: '/compress-webp', label: 'Compress or convert to WebP' },
      { to: '/compress-png', label: 'Compress PNG' },
      { to: '/guides/website-image-performance', label: 'Images and page speed' },
    ],
  },

  {
    slug: 'png-transparency',
    title: 'PNG transparency: alpha, haloes and why your edges look wrong',
    metaTitle: 'PNG Transparency Explained — Alpha, Matting and Edge Haloes',
    metaDescription:
      'How PNG transparency works, why a cut-out logo gets a white or dark halo, what happens when you convert to JPEG, and how to shrink a transparent PNG.',
    summary:
      'Why transparent images develop grey fringes, what converting to JPEG really does, and how to make a transparent PNG smaller.',
    published: '2026-10-20',
    readingMinutes: 5,
    blocks: [
      {
        type: 'p',
        text: 'Transparency causes more confusion than any other part of image work. A logo looks perfect in the design tool and has a grey fringe on the website; a PNG converted to JPEG comes back with a white box around it. Both have the same cause, and it is worth understanding once.',
      },
      { type: 'h2', text: 'What the alpha channel stores' },
      {
        type: 'p',
        text: 'A full-colour PNG stores four numbers per pixel: red, green, blue, and alpha. Alpha is opacity — 255 means solid, 0 means invisible, and everything between is partial. Those in-between values are what make a curved edge look smooth instead of jagged: the pixels along the edge of a circle are partially transparent, blending the shape into whatever is behind it.',
      },
      {
        type: 'p',
        text: 'This is also why transparency cannot simply be removed. Those edge pixels need something to blend into. Pick the wrong thing and the edge goes wrong.',
      },
      { type: 'h2', text: 'Where haloes come from' },
      {
        type: 'p',
        text: 'A halo appears when an image was flattened against one background and is then displayed on another. If a dark logo with soft edges is flattened onto white, its edge pixels become pale. Put that image on a dark page and the pale ring shows as a glow. The image is not broken — it is composited for a background it is no longer on.',
      },
      {
        type: 'p',
        text: 'The fix is to keep the alpha channel all the way through. Use PNG or WebP, not JPEG, and avoid any step that flattens the image against a colour you are not going to display it on.',
      },
      { type: 'h2', text: 'What happens when you convert to JPEG' },
      {
        type: 'p',
        text: 'JPEG has no alpha channel at all. Something must be put behind the transparent pixels, and this compressor fills them with white — the right choice for most pages, and a visible rectangle if your page is dark. The result says explicitly when transparency has been filled, because it is not recoverable afterwards.',
      },
      {
        type: 'note',
        text: 'If you need transparency and a small file, the answer is WebP. It keeps the alpha channel, stores it losslessly, and is far smaller than PNG.',
      },
      { type: 'h2', text: 'Making a transparent PNG smaller' },
      {
        type: 'p',
        text: 'PNG is lossless, so there are only two levers. The first is to rewrite the file more efficiently — oxipng tries every row filter and compression strategy and strips the slack most exporters leave behind, which commonly saves 10 to 40% without changing a pixel.',
      },
      {
        type: 'p',
        text: 'The second is to reduce how many distinct colours the image contains, so it can be stored as a palette rather than four bytes per pixel. That is lossy, and it is where reductions of 60 to 80% come from. The quantiser used here works in RGBA space, so partial transparency is approximated along with colour instead of being rounded to fully on or fully off — which is what keeps soft edges soft.',
      },
      { type: 'h2', text: 'Palette transparency and its one limitation' },
      {
        type: 'p',
        text: 'A palette PNG can hold partially transparent entries, so a reduced-palette image can still have soft edges. The limitation is the budget: every distinct combination of colour and opacity costs a palette slot. An image with a long soft gradient fading to nothing will show stepping at low colour counts, because there are not enough slots to describe the fade smoothly. Raise the colour count or keep that one image lossless.',
      },
      { type: 'h2', text: 'A quick checklist' },
      {
        type: 'ul',
        items: [
          'Keep transparency in PNG or WebP. Never route it through JPEG.',
          'Never flatten against a background you are not going to display on.',
          'For a transparent photograph, convert to WebP rather than optimising the PNG.',
          'For a transparent logo or icon, reduce the palette and check the soft edges at 4× zoom.',
          'Keep the original. Palette reduction cannot be undone.',
        ],
      },
    ],
    related: [
      { to: '/compress-png', label: 'Compress PNG' },
      { to: '/compress-webp', label: 'Convert to WebP' },
      { to: '/compress-product-images', label: 'Product images' },
    ],
  },

  {
    slug: 'website-image-performance',
    title: 'Images and page speed: what actually makes a page slow',
    metaTitle: 'Images and Page Speed — How to Make Pages Load Faster',
    metaDescription:
      'Why images dominate page weight, which image actually delays your Largest Contentful Paint, and the order to fix things in for the biggest gain.',
    summary:
      'Images are usually the largest thing on a page. Here is which image matters most, and the order worth fixing them in.',
    published: '2026-10-20',
    readingMinutes: 6,
    blocks: [
      {
        type: 'p',
        text: 'On most content pages, images are the largest thing being downloaded by a wide margin — usually more than the HTML, CSS, fonts and scripts combined. That makes them the highest-leverage thing to fix, and it also makes it easy to fix the wrong part.',
      },
      { type: 'h2', text: 'Two numbers, not one' },
      {
        type: 'p',
        text: 'Total page weight determines how much data a visitor spends and how a page behaves on a slow connection. But the metric browsers and search tools report as Largest Contentful Paint is about a single element: usually the biggest image above the fold. A page can be 4 MB in total and still feel fast if the hero image is small and everything else loads later — and a 600 KB page can feel slow if that one hero image is the 600 KB.',
      },
      {
        type: 'p',
        text: 'So treat them separately. Make the above-the-fold image genuinely small and load it early. Make everything else small in aggregate and load it lazily.',
      },
      { type: 'h2', text: 'The order worth fixing things in' },
      { type: 'h3', text: '1. Resize to the displayed size' },
      {
        type: 'p',
        text: 'This is almost always the biggest win and the one most often skipped. A 4000-pixel phone photograph in a 1200-pixel column is sending about eleven times more pixel data than the browser can use. No quality setting recovers that. Resize to the slot: roughly 1920 pixels for a full-width hero, 1200 for an in-article image, 600 for a card.',
      },
      { type: 'h3', text: '2. Choose a modern format' },
      {
        type: 'p',
        text: 'Converting JPEG to WebP takes another 25 to 35% off at the same visual quality, for one encode and no markup changes. AVIF takes more again if you can accept slower encoding. This is free performance.',
      },
      { type: 'h3', text: '3. Then adjust quality' },
      {
        type: 'p',
        text: 'Once the dimensions and format are right, quality is a fine adjustment. Around 75 for JPEG and WebP is where most people stop seeing a difference. Verify on your own worst-case image rather than trusting a number.',
      },
      { type: 'h3', text: '4. Lazy-load everything below the fold' },
      {
        type: 'p',
        text: 'Add loading="lazy" to images that are not visible when the page opens, and leave it off the hero — lazy-loading the one image that LCP is waiting for makes the metric worse. Always set width and height attributes so the browser reserves the space; without them the page shifts as images arrive, which is its own penalty.',
      },
      { type: 'h2', text: 'What not to bother with' },
      {
        type: 'ul',
        items: [
          'Squeezing an already-optimised image. Below roughly 0.12 bytes per pixel, a JPEG has little left to give and you are trading visible quality for a rounding error.',
          'Re-compressing images that came out larger. If the output grew, the original was better — keep it.',
          'Micro-optimising a 12 KB icon while a 3 MB hero sits above it. Fix things in size order.',
        ],
      },
      { type: 'h2', text: 'How to check your own page' },
      {
        type: 'p',
        text: 'Open your browser developer tools, go to the network panel, filter by images, and sort by size. The top three rows are your work list. Note each one down with the width it is actually displayed at, compress to that width, and measure again — the batch total in the compressor tells you what the set cost before and after.',
      },
    ],
    related: [
      { to: '/compress-images-for-websites', label: 'Compress images for websites' },
      { to: '/guides/webp-explained', label: 'WebP explained' },
      { to: '/compress-images-to-200kb', label: 'Compress to 200 KB' },
    ],
  },

  {
    slug: 'target-file-sizes',
    title: 'Hitting a specific file size, and why it is harder than it sounds',
    metaTitle: 'How to Compress an Image to an Exact File Size',
    metaDescription:
      'Why no encoder accepts a file size as input, how a target-size search actually works, and what to do when 100 KB is simply not achievable.',
    summary:
      'Upload forms demand exact limits. Encoders do not accept them. Here is how the gap is bridged, and what to do when it cannot be.',
    published: '2026-10-20',
    readingMinutes: 4,
    blocks: [
      {
        type: 'p',
        text: 'Plenty of forms insist on an image under 100 KB, or 200 KB, or some other round number. No image encoder accepts a file size as an input. Understanding why explains what any tool promising an exact size is really doing.',
      },
      { type: 'h2', text: 'Why a size cannot be requested directly' },
      {
        type: 'p',
        text: 'An encoder takes pixels and a quality setting and produces a file. How large that file turns out depends entirely on the content: a photograph of foliage at quality 75 might be ten times the size of a flat graphic at the same setting and the same dimensions, because there is ten times more detail to describe. There is no formula from "100 KB" back to a quality number.',
      },
      { type: 'h2', text: 'So you encode, measure, and adjust' },
      {
        type: 'p',
        text: 'The only reliable approach is a search. Encode at a middle quality, measure the bytes, and move up or down depending on whether it fits. A binary search over the quality range finds the highest setting that stays under the limit in six or seven attempts, which is why target-size mode takes noticeably longer than a single compress — it is doing six or seven compresses.',
      },
      {
        type: 'p',
        text: 'If the quality floor still overshoots, the only remaining lever is pixels. Scaling the image reduces size roughly in proportion to area, so the scale factor comes from the square root of the size ratio — asking for half the bytes means roughly 70% of the width and height, not half. Then the quality search runs again at the new size.',
      },
      { type: 'h2', text: 'When the target is not reachable' },
      {
        type: 'p',
        text: 'Sometimes it simply is not. A 24-megapixel photograph will not become a good 100 KB JPEG at full resolution, and a tool that claims otherwise is either resizing without telling you or reporting a number it did not measure. The honest behaviour is to report the smallest size actually reached and say that it fell short — which is what happens here.',
      },
      { type: 'h2', text: 'Three things that make a hard target easier' },
      {
        type: 'ul',
        items: [
          'Allow resizing. For a large photograph this costs far less visible quality than driving quality into the forties.',
          'Switch to WebP. At a fixed file size it carries visibly more detail than JPEG, so the same 100 KB buys a better image.',
          'Crop before compressing. Removing content you do not need is the one lossless way to reduce the amount of information that has to be encoded.',
        ],
      },
      {
        type: 'note',
        text: 'A target is a ceiling, not a goal. If an image compresses well it may land comfortably under the limit, and that is a better outcome than padding it back up.',
      },
    ],
    related: [
      { to: '/compress-images-to-100kb', label: 'Compress to 100 KB' },
      { to: '/compress-images-to-200kb', label: 'Compress to 200 KB' },
      { to: '/guides/image-quality-and-file-size', label: 'Quality and file size' },
    ],
  },
];

export function findGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
