import { Faq } from '@/components/Faq';
import { Features } from '@/components/Features';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { RelatedLinks } from '@/components/Layout';
import { Workspace } from '@/components/workspace/Workspace';
import { Seo, faqSchema, webApplicationSchema } from '@/lib/seo';

const FAQS = [
  {
    question: 'Is Pixelpress really free?',
    answer:
      'Yes. There is no account, no email, no watermark and no paid tier gating the compressor. The site is static and does no image processing on a server, so there is nothing for us to meter.',
  },
  {
    question: 'Are my images uploaded?',
    answer:
      'No. The encoders are WebAssembly builds of MozJPEG, libwebp, libavif and oxipng that run inside this browser tab. You can verify it: open your developer tools, watch the network panel, and compress an image — no request carries the file.',
  },
  {
    question: 'Which formats can I compress?',
    answer:
      'JPEG, PNG, WebP and AVIF are read and written. GIF, BMP and TIFF can be read and are saved as PNG or JPEG, since those three cannot be written back out. Animated images and SVG are detected and refused with an explanation rather than being quietly mangled.',
  },
  {
    question: 'How much smaller will my images get?',
    answer:
      'It depends entirely on the images. A lightly compressed photograph straight from a camera commonly drops 70-90%; a file that has already been through a compressor may give up only a few percent, and one that is already optimal may get larger. Every figure shown to you is measured from the bytes produced for your own file, which is why there are no headline statistics on this page.',
  },
  {
    question: 'Does compressing reduce image dimensions?',
    answer:
      'Not unless you ask it to. Compression and resizing are separate controls. Open the Resize panel to set a maximum width or height — which is usually the single biggest saving available, since most images are far larger than the space they are displayed in.',
  },
  {
    question: 'What happens to EXIF and GPS data?',
    answer:
      'It is removed by default, which makes files smaller and avoids publishing the coordinates of where a photo was taken. If you need camera and copyright fields kept, turn on "Keep camera metadata" — that works for JPEG saved as JPEG, and the result says so when it is not possible.',
  },
  {
    question: 'Will this work on my phone?',
    answer:
      'Yes, with one caveat: compression is real work, and a phone has less memory than a laptop. Large batches of very large photographs may be slow or run out of memory. Images are processed a few at a time to keep that under control, and any failure is reported per image rather than losing the batch.',
  },
];

export function Home() {
  return (
    <>
      <Seo
        title="Pixelpress — Compress Images Without Losing Quality"
        description="Free online image compressor that runs in your browser. Batch compress JPG, PNG, WebP and AVIF, resize, target a file size, and compare before and after. No uploads, no account."
        path="/"
        structuredData={[
          webApplicationSchema(
            'Pixelpress',
            'In-browser image compressor for JPG, PNG, WebP and AVIF with batch processing, resizing and target file sizes.',
            '/',
          ),
          faqSchema(FAQS),
        ]}
      />

      <Hero
        title={
          <>
            Compress images.
            <br />
            <span className="text-brand">Not quality.</span>
          </>
        }
        subtitle="Make your images smaller in seconds. Fine-tune quality, compare results, and optimise entire batches without complicated software."
      />

      <Workspace />

      <Features />
      <HowItWorks />

      <Faq entries={FAQS} heading="Common questions" />

      <RelatedLinks
        heading="Compress a specific format"
        links={[
          { to: '/compress-jpg', label: 'Compress JPG', blurb: 'Photographs, through MozJPEG.' },
          { to: '/compress-png', label: 'Compress PNG', blurb: 'Lossless or palette reduction.' },
          { to: '/compress-webp', label: 'Compress WebP', blurb: 'Convert and compress.' },
          {
            to: '/compress-images-to-100kb',
            label: 'Compress to 100 KB',
            blurb: 'When a form sets a limit.',
          },
        ]}
      />
    </>
  );
}
