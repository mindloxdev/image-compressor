/**
 * The landing pages.
 *
 * Each entry is a real, differently configured compressor — a different default
 * preset, different accepted inputs, different advice — not one page with the
 * nouns swapped. Where a format has a genuine limitation, it is written down on
 * the page for that format rather than buried.
 */

import type { DetectedFormat } from '@/engine/formats';
import type { CompressionSettings } from '@/engine/types';
import type { FaqEntry } from '@/components/Faq';

export interface LandingPage {
  slug: string;
  /** Browser and search-result title. Under ~60 characters where possible. */
  metaTitle: string;
  metaDescription: string;
  h1: string;
  /** Lead paragraph under the H1. */
  intro: string;
  /** Two or three short paragraphs of genuinely page-specific guidance. */
  body: { heading: string; paragraphs: string[] }[];
  limitations: string[];
  settings: Partial<CompressionSettings>;
  accept?: readonly DetectedFormat[];
  acceptAttribute?: string;
  formatChips?: readonly string[];
  faqs: readonly FaqEntry[];
  related: { to: string; label: string; blurb: string }[];
}

const PRIVACY_FAQ: FaqEntry = {
  question: 'Are my images uploaded anywhere?',
  answer:
    'No. Pixelpress is a static site with no image API. The encoders are WebAssembly builds of MozJPEG, libwebp, libavif and oxipng that run inside this browser tab, so the bytes never leave your device. You can check this yourself: open your browser developer tools, watch the network panel, and compress a file — no request carries the image.',
};

const FREE_FAQ: FaqEntry = {
  question: 'Is there a limit, or an account?',
  answer:
    'No account, no email, no watermark. The limits are practical rather than commercial: 100 images at a time and 60 MB per file, because beyond that a browser tab runs out of memory. Compress a batch, clear the list, and carry on.',
};

export const LANDING_PAGES: readonly LandingPage[] = [
  {
    slug: '/image-compressor',
    metaTitle: 'Image Compressor — Compress JPG, PNG, WebP & AVIF in Your Browser',
    metaDescription:
      'Free image compressor that runs on your device. Batch compress JPG, PNG, WebP and AVIF, resize, target a file size, and compare before and after. No uploads, no account.',
    h1: 'Image compressor',
    intro:
      'Compress one image or a hundred, with real control over the result. Choose a preset, fine-tune quality and dimensions, compare the before and after, then download — all without a single byte being uploaded.',
    body: [
      {
        heading: 'Start with Balanced, then adjust',
        paragraphs: [
          'The three presets are starting points chosen per codec, not one quality number applied to everything. Balanced puts a JPEG at quality 75 and a WebP at 78, because the same number means different things to each encoder. Best Quality keeps PNGs completely lossless and lifts the others into the range where differences stop being visible at normal viewing size. Smallest File pushes until size is all that matters.',
          'If a result is not right, change the setting and press Compress again. Nothing is destroyed along the way — your original file on disk is never touched, and every result is recomputed from it.',
        ],
      },
      {
        heading: 'The biggest saving is usually the dimensions',
        paragraphs: [
          'A 6000-pixel-wide photo displayed in a 900-pixel column carries roughly forty times more pixel data than the page can show. No quality setting recovers that: resizing does. Open the Resize panel, set a maximum width of 1920 for a hero image or 1200 for an in-article picture, and the quality slider becomes a fine adjustment rather than the only lever.',
          'Downscaling uses a Lanczos3 filter, which keeps edges crisp where a plain browser resize goes soft. Images already smaller than the limit are left exactly as they are — nothing is ever enlarged, because inventing pixels cannot make a file smaller.',
        ],
      },
      {
        heading: 'Check it before you keep it',
        paragraphs: [
          'Every finished image gets a before-and-after viewer: drag a wipe across the seam, switch to side by side, and zoom to 4× to inspect skin tones, text edges and flat skies — the three places compression shows first. The numbers beside it are read from the bytes that were produced, so what you see is what you download.',
        ],
      },
    ],
    limitations: [
      'Animated GIF, animated WebP and APNG are detected and skipped rather than being silently flattened to a single frame.',
      'SVG is a vector format with no pixels to compress, so it is refused with an explanation.',
      'Camera metadata can only be carried across for JPEG saved as JPEG. Every other combination comes out with no metadata at all.',
      'AVIF produces the smallest files of the four formats and is by far the slowest to encode — expect seconds per image, not milliseconds.',
    ],
    settings: {},
    faqs: [
      PRIVACY_FAQ,
      {
        question: 'Which format should I choose?',
        answer:
          'For photographs on a website, WebP is the best default — smaller than JPEG at the same quality, and supported by every current browser. Keep JPEG when something old has to read the file. Use PNG only for screenshots, logos and flat graphics, or when you need transparency and WebP is not an option. AVIF is smaller still if you can accept the encoding time.',
      },
      {
        question: 'Why did one of my images get bigger?',
        answer:
          'Because it was already compressed harder than the settings you chose. Re-encoding an image that has been through a compressor adds no information and can cost bytes. When that happens the result is labelled "No saving" and the advice is to keep the original — the honest answer rather than a fabricated percentage.',
      },
      {
        question: 'Is compression reversible?',
        answer:
          'Not for JPEG, WebP at normal quality, or AVIF: those discard information to get small, and it cannot be recovered. PNG is different — with the palette reduction turned off, a PNG is rewritten losslessly and every pixel is identical. Keep your originals somewhere regardless.',
      },
      FREE_FAQ,
    ],
    related: [
      { to: '/compress-jpg', label: 'Compress JPG', blurb: 'Photographs, with MozJPEG.' },
      { to: '/compress-png', label: 'Compress PNG', blurb: 'Screenshots, logos, transparency.' },
      { to: '/compress-webp', label: 'Compress WebP', blurb: 'The modern web default.' },
      {
        to: '/compress-images-to-100kb',
        label: 'Compress to 100 KB',
        blurb: 'When a form sets a hard limit.',
      },
    ],
  },

  {
    slug: '/compress-jpg',
    metaTitle: 'Compress JPG — Reduce JPEG File Size with MozJPEG',
    metaDescription:
      'Compress JPG and JPEG files in your browser with MozJPEG. Adjust quality, resize, keep or strip EXIF, and see the exact saving. Nothing is uploaded.',
    h1: 'Compress JPG',
    intro:
      'JPEG compression through MozJPEG, the encoder that squeezes more out of a photograph than the one built into your camera or your browser. Drop in your photos, pick a quality, and see exactly what each one saved.',
    body: [
      {
        heading: 'Why MozJPEG beats a re-save',
        paragraphs: [
          'Every JPEG encoder makes the same trade, but not equally well. MozJPEG spends extra effort on trellis quantisation and progressive scan ordering, and routinely produces a file 10–20% smaller than a standard encoder at a quality setting you cannot tell apart. The same photograph saved by a browser canvas at the same nominal quality is simply bigger.',
          'Output is written as a progressive JPEG, which starts rendering from a blurry full-size pass rather than filling in top to bottom. On a slow connection that feels considerably faster even though the byte count is the same or smaller.',
        ],
      },
      {
        heading: 'Quality numbers, honestly',
        paragraphs: [
          'JPEG quality is not a percentage of anything. It selects a quantisation table, and the relationship between that number and what you see depends on the picture. As a rough guide: 90 and above is for images that will be edited again, 75–85 covers almost all web photography, 60–75 is fine for thumbnails and backgrounds, and below 50 the blocking becomes visible in skies and skin.',
          'Rather than trusting a guide, press "Try settings" on any image. It encodes that exact photograph at quality 90, 75 and 60 at full resolution and shows the three real file sizes, so you can pick from measurements instead of advice.',
        ],
      },
      {
        heading: 'EXIF, GPS and what gets removed',
        paragraphs: [
          'By default every re-encoded JPEG comes out with no metadata, which usually means a smaller file and no GPS coordinates attached to a holiday photo you are about to publish. If you need the camera, lens, date and copyright fields kept, turn on "Keep camera metadata" and the original EXIF block is copied into the new file.',
          'One detail that matters there: the decoder has already applied the EXIF rotation to the pixels, so the orientation tag is reset to "as stored" on the way across. Without that, a portrait photo would be rotated twice and come out sideways.',
        ],
      },
    ],
    limitations: [
      'JPEG has no alpha channel. A transparent PNG converted to JPEG has its transparent areas filled with white, and the result says so.',
      'Compressing an already-compressed JPEG costs quality for very little size. The per-image recommendation flags this when the bytes-per-pixel figure is already low.',
      'JPEG cannot be made smaller losslessly here — if you need pixel-identical output, use PNG with palette reduction turned off.',
    ],
    settings: { outputFormat: 'jpeg', preset: 'balanced' },
    accept: ['jpeg'],
    acceptAttribute: 'image/jpeg',
    formatChips: ['JPG', 'JPEG'],
    faqs: [
      {
        question: 'What is the difference between JPG and JPEG?',
        answer:
          'Nothing. They are the same format with two spellings of the same extension — JPG exists because early Windows versions allowed only three characters. Both are accepted here and the output extension is .jpg.',
      },
      {
        question: 'How small can a JPG get?',
        answer:
          'It depends entirely on the picture and its dimensions. A lightly compressed 4000-pixel photograph commonly drops 80–90% at quality 75 with no visible change. A JPEG that has already been optimised might only give up a few percent. The figure shown for each of your images is measured from the file produced, never estimated.',
      },
      {
        question: 'Can I compress a JPG without losing any quality?',
        answer:
          'Not with this tool, and not meaningfully with any tool: JPEG is a lossy format and re-encoding it always discards a little more. What you can do is choose a quality high enough that the loss is invisible — 90 or above — or convert to WebP, which gives a smaller file at the same perceived quality.',
      },
      PRIVACY_FAQ,
    ],
    related: [
      { to: '/compress-png', label: 'Compress PNG', blurb: 'For graphics and transparency.' },
      { to: '/compress-webp', label: 'Convert to WebP', blurb: 'Smaller than JPEG, same look.' },
      {
        to: '/guides/image-quality-and-file-size',
        label: 'Quality and file size',
        blurb: 'What the quality number really does.',
      },
      {
        to: '/compress-images-to-200kb',
        label: 'Compress to 200 KB',
        blurb: 'Aim for a specific size.',
      },
    ],
  },

  {
    slug: '/compress-png',
    metaTitle: 'Compress PNG — Lossless and Palette PNG Compression',
    metaDescription:
      'Compress PNG files in your browser. Lossless oxipng optimisation, or palette reduction for much smaller files. Transparency is preserved. No uploads.',
    h1: 'Compress PNG',
    intro:
      'PNG is lossless by design, which makes it the honest choice for screenshots and logos and a poor one for photographs. There are two real ways to shrink one, and this page does both.',
    body: [
      {
        heading: 'Lossless: oxipng, nothing lost',
        paragraphs: [
          'With palette reduction turned off, your PNG is passed through oxipng, which rewrites the file without touching a single pixel. It tries every row filter and compression strategy, strips the slack a typical exporter leaves behind, and reduces the colour type where the image does not need the one it was saved with. Savings of 10–40% are common from design-tool exports, and the result is bit-for-bit identical when decoded.',
          'This is the only mode in Pixelpress where "no quality loss" is literally true, and it is what Best Quality selects for PNG input.',
        ],
      },
      {
        heading: 'Palette reduction: where the big savings are',
        paragraphs: [
          'A full-colour PNG stores four bytes per pixel. Reduce the image to 256 colours or fewer and it can be stored as a palette instead, which is where reductions of 60–80% come from — it is the same approach the well-known PNG compression services use.',
          'The quantiser here is a median cut in RGBA space, so transparency is quantised along with colour rather than being thrown away, followed by Floyd–Steinberg dithering to break up banding in gradients. Dial the colour count down and watch the preview: flat illustrations and UI screenshots often look untouched at 64 colours, while photographs start to band below about 128.',
        ],
      },
      {
        heading: 'When a PNG is the wrong format',
        paragraphs: [
          'If your PNG is a photograph — a camera shot pasted into a design tool and exported — no amount of PNG optimisation will compete with converting it. A photograph as JPEG or WebP is typically 80–90% smaller than the same picture as a PNG, with no visible difference at sensible quality. When the per-image check sees a high bytes-per-pixel figure and no transparency, that is exactly what it recommends, and it says why.',
          'If the image does have transparency, WebP is the answer rather than JPEG: it keeps the alpha channel and is still far smaller than PNG.',
        ],
      },
    ],
    limitations: [
      'Palette reduction is lossy. Colours are approximated, and gradients may band. Turn it off for pixel-identical output.',
      'APNG (animated PNG) is detected and skipped — compressing it would keep only the first frame.',
      'PNG has no quality slider because it has no quality setting. Its dial is the number of colours.',
      '16-bit-per-channel PNGs are processed as 8-bit, which is a real reduction in colour depth for high-bit-depth source files.',
    ],
    settings: { outputFormat: 'png', preset: 'balanced', pngLossy: true, pngColors: 128 },
    accept: ['png'],
    acceptAttribute: 'image/png',
    formatChips: ['PNG', 'APNG detected'],
    faqs: [
      {
        question: 'Does compressing a PNG lose transparency?',
        answer:
          'No. Transparency is preserved in both modes. In lossless mode the alpha channel is untouched; in palette mode it is quantised together with the colours, so a semi-transparent edge stays semi-transparent rather than turning into a hard edge. Converting to JPEG is the one case where transparency cannot survive, and the result tells you the transparent areas were filled with white.',
      },
      {
        question: 'Why is my PNG still large after compressing?',
        answer:
          'Almost always because it is a photograph. PNG records every pixel exactly, so a detailed photo has very little redundancy to remove. Convert it to WebP or JPEG and compare the two numbers — the difference is usually an order of magnitude.',
      },
      {
        question: 'What does "lossless" actually mean here?',
        answer:
          'That decoding the compressed file produces exactly the same pixels as decoding the original. The bytes on disk differ because the data is packed more efficiently; the image does not. That claim applies to the lossless PNG path only, and nowhere else in this tool.',
      },
      PRIVACY_FAQ,
    ],
    related: [
      { to: '/compress-webp', label: 'Convert to WebP', blurb: 'Transparency, far smaller.' },
      { to: '/compress-jpg', label: 'Compress JPG', blurb: 'For photographs.' },
      {
        to: '/guides/png-transparency',
        label: 'PNG transparency explained',
        blurb: 'Alpha, matting and halos.',
      },
      {
        to: '/compress-product-images',
        label: 'Product images',
        blurb: 'White backgrounds, kept clean.',
      },
    ],
  },

  {
    slug: '/compress-webp',
    metaTitle: 'Compress WebP — Compress and Convert to WebP',
    metaDescription:
      'Compress WebP files or convert JPG and PNG to WebP in your browser with libwebp. Keeps transparency, smaller than JPEG at the same quality. No uploads.',
    h1: 'Compress WebP',
    intro:
      'WebP is the format most websites should be serving: smaller than JPEG at the same perceived quality, able to hold transparency like a PNG, and supported by every browser in current use. Compress existing WebP files here, or convert JPG and PNG into it.',
    body: [
      {
        heading: 'Converting into WebP',
        paragraphs: [
          'The usual reason to be on this page is not compressing a WebP but making one. Drop in JPEGs or PNGs and the output format is already set to WebP. For photographs, expect roughly a 25–35% saving over a JPEG of the same visual quality. For PNG graphics with transparency, the saving is usually far larger, because you are leaving a lossless format for a lossy one that still understands alpha.',
          'Alpha is encoded losslessly even when the colour channels are compressed, so edges around a cut-out logo stay clean instead of developing a halo.',
        ],
      },
      {
        heading: 'Compressing a WebP that already exists',
        paragraphs: [
          'Re-compressing a WebP gives back much less than converting an older format would, because the hard work has already been done. The per-image recommendation says so rather than implying a dramatic saving is waiting. Where it does help is when the file was exported at quality 90 or higher, or when the dimensions are larger than the page needs — resizing remains the biggest lever.',
          'Above quality 85 the encoder switches on sharp YUV conversion, which costs a little time and keeps fine coloured detail — red text on a dark background is the usual beneficiary.',
        ],
      },
      {
        heading: 'Browser support, as of now',
        paragraphs: [
          'WebP works in current Chrome, Edge, Firefox, Safari and the mobile browsers. The practical exception is software rather than browsers: some older email clients, CMS uploaders and desktop applications still do not read it. If a file has to be opened by something you do not control, JPEG remains the safer choice.',
        ],
      },
    ],
    limitations: [
      'Animated WebP is detected and skipped. Only still images are compressed here.',
      'WebP lossless mode is not exposed — this page encodes lossy WebP, where alpha is still stored losslessly. For pixel-identical output use PNG.',
      'Converting a WebP back to JPEG loses transparency and adds a second round of lossy compression. Convert from the original where you can.',
    ],
    settings: { outputFormat: 'webp', preset: 'balanced' },
    acceptAttribute: 'image/webp,image/jpeg,image/png',
    formatChips: ['WebP', 'JPG → WebP', 'PNG → WebP'],
    faqs: [
      {
        question: 'Is WebP better than JPEG?',
        answer:
          'For the web, generally yes: a WebP is typically 25–35% smaller than a JPEG that looks the same, and it can store transparency. JPEG keeps one advantage, which is that absolutely everything can open it. Convert from your original file rather than from an existing JPEG where possible, so you only pay for one round of lossy compression.',
      },
      {
        question: 'Can I convert WebP to JPG or PNG here?',
        answer:
          'Yes — set the output format to JPEG or PNG in the Quality and format panel. Be aware of what each costs: JPEG discards transparency and compresses lossily a second time, while PNG will usually produce a much larger file than the WebP you started with.',
      },
      {
        question: 'Does WebP support transparency?',
        answer:
          'Yes, including partial transparency, and this encoder stores the alpha channel losslessly even in lossy mode. That makes it a direct replacement for a transparent PNG at a fraction of the size.',
      },
      PRIVACY_FAQ,
    ],
    related: [
      { to: '/guides/webp-explained', label: 'WebP explained', blurb: 'When to use it, and when not.' },
      { to: '/compress-jpg', label: 'Compress JPG', blurb: 'Stay with JPEG.' },
      { to: '/compress-png', label: 'Compress PNG', blurb: 'Lossless and palette modes.' },
      {
        to: '/compress-images-for-websites',
        label: 'Images for websites',
        blurb: 'Sizes and formats that load fast.',
      },
    ],
  },

  {
    slug: '/compress-images-to-100kb',
    metaTitle: 'Compress Image to 100 KB — Exact Target Size',
    metaDescription:
      'Compress images to under 100 KB in your browser. The encoder runs repeatedly to narrow in on the size, and the result is measured, not estimated.',
    h1: 'Compress images to 100 KB',
    intro:
      'Upload forms, job portals and government websites love a hard limit. This page has target-size mode switched on at 100 KB: each image is encoded repeatedly, measured, and narrowed in on until it fits.',
    body: [
      {
        heading: 'How the target is actually reached',
        paragraphs: [
          'There is no formula that converts "100 KB" into a quality number, because the answer depends on the picture. So the tool does the only reliable thing: it encodes, measures the bytes, and adjusts. A binary search over quality finds the highest setting that still fits under your limit, typically in six or seven attempts, which is why this mode takes longer than a straight compress.',
          'If the codec cannot get there even at its quality floor, and you have left "shrink the dimensions" enabled, the image is scaled down — by the square root of the size ratio, since file size follows pixel area rather than edge length — and the quality search runs again at the smaller size.',
        ],
      },
      {
        heading: 'When 100 KB is not achievable',
        paragraphs: [
          'A 24-megapixel photograph will not become a good-looking 100 KB JPEG at full resolution, and no tool can make it one. When the target cannot be met, Pixelpress reports the smallest size it did reach and says plainly that it fell short, rather than quietly handing you a 180 KB file labelled as success.',
          'Two things usually fix it. Allow resizing, which is on by default here and is almost always the right trade. Or switch the output format to WebP, which reaches a given file size at a visibly higher quality than JPEG.',
        ],
      },
    ],
    limitations: [
      'This mode runs several full encodes per image, so it is noticeably slower than a single pass — especially in AVIF.',
      'An exact size cannot be guaranteed. The guarantee is that the number reported is measured from the file you download.',
      'The limit is a ceiling, not a goal: a result may come out comfortably under 100 KB when the image compresses well.',
    ],
    settings: {
      targetSizeEnabled: true,
      targetSizeKb: 100,
      allowResizeForTarget: true,
      preset: 'balanced',
    },
    faqs: [
      {
        question: 'Will my image be exactly 100 KB?',
        answer:
          'No, and that is the honest answer — it will be under 100 KB, usually a little under. Encoders do not accept a byte count as an input; they accept a quality setting and produce whatever size that yields. This tool searches for the best quality that stays below your ceiling.',
      },
      {
        question: 'Why does this take longer than normal compression?',
        answer:
          'Because it encodes the same image six or seven times to find the right setting, instead of once. That is the cost of a measured result rather than a guess.',
      },
      {
        question: 'What if I need a different limit?',
        answer:
          'Change the target in the panel on the right — any value from 5 KB upwards, with one-tap choices for 50, 100, 200, 500 KB and 1 MB. There is a dedicated page for 200 KB linked below.',
      },
      PRIVACY_FAQ,
    ],
    related: [
      {
        to: '/compress-images-to-200kb',
        label: 'Compress to 200 KB',
        blurb: 'A more forgiving ceiling.',
      },
      {
        to: '/guides/target-file-sizes',
        label: 'Hitting a file size',
        blurb: 'Why exact sizes are hard.',
      },
      { to: '/compress-jpg', label: 'Compress JPG', blurb: 'Quality-first instead.' },
      { to: '/compress-webp', label: 'Convert to WebP', blurb: 'Reach a size at higher quality.' },
    ],
  },

  {
    slug: '/compress-images-to-200kb',
    metaTitle: 'Compress Image to 200 KB — Target Size Compression',
    metaDescription:
      'Compress images to under 200 KB in your browser. Real encodes, measured results, with resizing if quality alone cannot reach the limit.',
    h1: 'Compress images to 200 KB',
    intro:
      'A 200 KB ceiling is the comfortable one: large enough for a full-width photograph that still looks good, small enough to keep a page fast. Target-size mode is set to 200 KB here.',
    body: [
      {
        heading: 'Why 200 KB is a good number',
        paragraphs: [
          'For a hero image at 1920 pixels wide, around 200 KB is the range where a JPEG stops looking compressed and a WebP starts looking genuinely good. Below about 120 KB at that width you begin to see it in skies and skin; much above 300 KB and you are paying for detail nobody notices on a phone.',
          'If the number is a self-imposed performance budget rather than an upload limit, consider setting a maximum width instead and letting quality settle where it wants. Resizing to the size a page actually displays is a bigger and cheaper win than squeezing quality at full resolution.',
        ],
      },
      {
        heading: 'Getting more out of the same 200 KB',
        paragraphs: [
          'Switch the output format to WebP. At a fixed file size, WebP carries visibly more detail than JPEG, so the same 200 KB buys a better-looking image. AVIF is better still if you can wait for the encode.',
          'Leave "shrink the dimensions if quality is not enough" on. For a large photograph, a modest reduction in dimensions costs far less visible quality than driving the quality slider into the forties.',
        ],
      },
    ],
    limitations: [
      'Several encodes run per image, so this is slower than a single-pass compress.',
      'The result is a ceiling, not an exact figure, and is always measured from the bytes produced.',
      'Very large images may need resizing to reach 200 KB at a usable quality.',
    ],
    settings: {
      targetSizeEnabled: true,
      targetSizeKb: 200,
      allowResizeForTarget: true,
      preset: 'balanced',
    },
    faqs: [
      {
        question: 'Is 200 KB small enough for a web page?',
        answer:
          'For a single large photograph, yes. What matters more is the total: ten 200 KB images on one page is 2 MB, which is slow on a phone connection. Compress to the size each image is displayed at, and serve smaller files for smaller slots.',
      },
      {
        question: 'Can I compress several images to 200 KB at once?',
        answer:
          'Yes. The target applies to every image in the batch, and each one gets its own search, so a simple graphic may land at 40 KB while a detailed photo lands just under the ceiling. Per-image results are listed separately.',
      },
      PRIVACY_FAQ,
      FREE_FAQ,
    ],
    related: [
      {
        to: '/compress-images-to-100kb',
        label: 'Compress to 100 KB',
        blurb: 'When the limit is stricter.',
      },
      {
        to: '/compress-images-for-websites',
        label: 'Images for websites',
        blurb: 'Sizes per slot.',
      },
      { to: '/compress-webp', label: 'Convert to WebP', blurb: 'More quality per kilobyte.' },
      {
        to: '/guides/website-image-performance',
        label: 'Images and page speed',
        blurb: 'What actually makes pages slow.',
      },
    ],
  },

  {
    slug: '/compress-images-for-websites',
    metaTitle: 'Compress Images for Websites — Resize and Optimise for Web',
    metaDescription:
      'Compress and resize images for websites. Hero, in-article and thumbnail presets, WebP output, and measured savings. Runs in your browser with no uploads.',
    h1: 'Compress images for websites',
    intro:
      'Web images have two problems and most tools only fix one. Quality settings reduce the bytes; the dimensions are usually what made the file enormous in the first place. This page starts with both: resize to 1920 pixels wide and convert to WebP.',
    body: [
      {
        heading: 'Resize to the slot, not to the camera',
        paragraphs: [
          'A phone photograph arrives around 4000 pixels wide. A full-width hero on a laptop shows about 1920 of them, an in-article image about 1200, and a card thumbnail about 600. Serving the 4000-pixel original means sending four to forty times more data than the browser can display, and then making the device scale it down anyway.',
          'The size presets in the Resize panel cover those three slots directly. Pick the one matching where the image will appear, and the quality setting becomes a fine adjustment rather than a desperate measure.',
        ],
      },
      {
        heading: 'Pick WebP, and keep a fallback only if you need one',
        paragraphs: [
          'WebP is supported by every browser in current use and is typically 25–35% smaller than an equivalent JPEG, which is why it is the default output on this page. Unless you have measured traffic from genuinely ancient software, a single WebP per image is simpler than maintaining two formats.',
          'If you do need a fallback, compress the same original twice — once to WebP and once to JPEG — and serve both through a picture element. Compressing the JPEG and then converting that to WebP applies two rounds of lossy compression and looks worse at the same size.',
        ],
      },
      {
        heading: 'What to check before publishing',
        paragraphs: [
          'Open the before-and-after viewer and zoom to 2× on the areas compression ruins first: large flat skies, out-of-focus backgrounds, skin, and any text inside the image. If those hold up, the rest will.',
          'Then look at the batch total. The number that matters for a page is the sum of its images, not the best single saving.',
        ],
      },
    ],
    limitations: [
      'This page sets a 1920-pixel maximum width. Change or disable it in the Resize panel if you need the original dimensions.',
      'Resizing never enlarges: an image narrower than 1920 pixels keeps its own width.',
      'Responsive image sets are not generated — compress once per size you intend to serve.',
    ],
    settings: {
      outputFormat: 'webp',
      resizeEnabled: true,
      maxWidth: 1920,
      maxHeight: null,
      preset: 'balanced',
    },
    faqs: [
      {
        question: 'What size should images be on a website?',
        answer:
          'Match the slot, then double it only if you are serving high-density screens from a single file: around 1920 pixels wide for a full-width hero, 1200 for an in-article image, and 600 for a card or thumbnail. Height follows the aspect ratio. Anything larger is data the browser throws away.',
      },
      {
        question: 'Does compressing images improve page speed?',
        answer:
          'Usually more than anything else you can do to a content-heavy page, because images are typically the largest thing on it. Both the total bytes and the largest single image matter — the biggest image above the fold is often what Largest Contentful Paint is waiting for.',
      },
      {
        question: 'Should I use WebP or AVIF for a website?',
        answer:
          'WebP is the safe default: broad support, fast encoding, big savings over JPEG. AVIF produces smaller files again and is worth it for a handful of important images, but encoding is slow enough that batching hundreds becomes tedious.',
      },
      PRIVACY_FAQ,
    ],
    related: [
      {
        to: '/guides/website-image-performance',
        label: 'Images and page speed',
        blurb: 'Where the time actually goes.',
      },
      { to: '/compress-webp', label: 'Compress WebP', blurb: 'The format in detail.' },
      {
        to: '/compress-product-images',
        label: 'Product images',
        blurb: 'For online stores.',
      },
      {
        to: '/compress-images-to-200kb',
        label: 'Compress to 200 KB',
        blurb: 'Work to a budget.',
      },
    ],
  },

  {
    slug: '/compress-product-images',
    metaTitle: 'Compress Product Images — Optimise Ecommerce Photos',
    metaDescription:
      'Compress product images for online stores. Keeps detail and clean white or transparent backgrounds, resizes to 2000 px for zoom, and batches a whole catalogue.',
    h1: 'Compress product images',
    intro:
      'Product photography has a different balance from the rest of a website: the picture is the thing being sold, buyers zoom into it, and a soft or blotchy image costs orders. This page starts at a higher quality and a larger size than the general one, and keeps backgrounds clean.',
    body: [
      {
        heading: 'Why product shots get their own settings',
        paragraphs: [
          'Store platforms generally want a main image of at least 1600 pixels on its longest edge so their zoom feature has something to work with, and many recommend 2000. That is the default here, along with the Best Quality preset — because the artefacts that matter on a product are exactly the ones aggressive compression creates: mushy fabric texture, banding on a glossy surface, haloes around a cut-out edge.',
          'Start high, check a zoomed comparison on your most detailed product, and only then decide whether Balanced is good enough for the rest of the catalogue.',
        ],
      },
      {
        heading: 'Backgrounds: white, or genuinely transparent',
        paragraphs: [
          'A pure white background stays pure white — nothing here shifts the colour or crops the frame. If your images have a transparent background instead, keep them as PNG or WebP: both preserve the alpha channel. Converting to JPEG fills transparency with white, which looks right on a white page and wrong the moment the product is placed on a coloured block, so the result tells you when that has happened.',
          'Nothing is cropped and no background is removed. Those are editorial decisions, not compression, and this tool does not make them on your behalf.',
        ],
      },
      {
        heading: 'Working through a catalogue',
        paragraphs: [
          'Drop in up to 100 images at a time. They are processed a few at a time across background threads, each with its own progress and its own measured saving, and the batch total tells you what the whole set cost. Download them as a single ZIP with the original base names kept, so they match your existing SKU files.',
          'Run a second pass at a smaller size for listing thumbnails — the 1000-pixel product preset — rather than letting the store scale the 2000-pixel version down in the browser.',
        ],
      },
    ],
    limitations: [
      'Backgrounds are never removed and images are never cropped. This is a compressor, not an editor.',
      'The 2000-pixel default is a widely used figure, not a rule — check what your store platform actually requires.',
      'Converting a transparent product shot to JPEG fills the transparency with white and cannot be undone.',
    ],
    settings: {
      preset: 'best',
      resizeEnabled: true,
      maxWidth: 2000,
      maxHeight: 2000,
      outputFormat: 'keep',
    },
    faqs: [
      {
        question: 'What size should product images be?',
        answer:
          'Most store platforms want at least 1600 pixels on the longest edge for zoom to work, and 2000 is a common recommendation — which is the default here. Check your platform, because the requirement is theirs, not ours, and it changes.',
      },
      {
        question: 'Will compression hurt how my products look?',
        answer:
          'At the Best Quality preset the difference is very hard to see, which is why it is the default on this page. Verify it rather than trusting it: compress your most detailed item, open the comparison, and zoom to 4× on the texture. If that holds up, the catalogue will.',
      },
      {
        question: 'Can I compress transparent product images?',
        answer:
          'Yes. Keep the output format as PNG or WebP and the transparency is preserved — WebP will be dramatically smaller. Only JPEG cannot hold it, and the result says so explicitly when it fills transparency with white.',
      },
      PRIVACY_FAQ,
    ],
    related: [
      { to: '/compress-png', label: 'Compress PNG', blurb: 'Transparent product shots.' },
      { to: '/compress-webp', label: 'Convert to WebP', blurb: 'Transparency, much smaller.' },
      {
        to: '/compress-images-for-websites',
        label: 'Images for websites',
        blurb: 'The general web settings.',
      },
      {
        to: '/guides/png-transparency',
        label: 'PNG transparency',
        blurb: 'Avoiding edge haloes.',
      },
    ],
  },
];

export function findLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((page) => page.slug === slug);
}
