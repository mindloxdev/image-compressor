import {
  Columns2,
  FileArchive,
  Gauge,
  Layers,
  Lock,
  Ruler,
  Scale,
  Wand2,
} from 'lucide-react';

const FEATURES = [
  {
    Icon: Lock,
    title: 'Nothing leaves your device',
    body: 'The codecs are compiled to WebAssembly and run in this browser tab. There is no upload step, no server copy, and no retention policy to read — because there is nothing to retain.',
  },
  {
    Icon: Gauge,
    title: 'Proper codecs, not canvas',
    body: 'MozJPEG, libwebp, libavif and oxipng — the same encoders desktop tools use. A JPEG through MozJPEG is meaningfully smaller than the same image saved by a browser canvas.',
  },
  {
    Icon: Columns2,
    title: 'See the difference first',
    body: 'Drag a wipe across the before and after, or put them side by side, and zoom to 4× to check the detail that matters before you download anything.',
  },
  {
    Icon: Layers,
    title: 'Batches that behave',
    body: 'Drop in a hundred images. They are processed a few at a time across background threads, so the page stays responsive and the browser does not run out of memory.',
  },
  {
    Icon: Scale,
    title: 'Hit a file size',
    body: 'Ask for 100 KB and each image is encoded repeatedly, narrowing in on the number. The result is measured from the actual bytes — and if it cannot be reached, it says so.',
  },
  {
    Icon: Wand2,
    title: 'A recommendation per image',
    body: 'Every file is checked against its format, dimensions and density, and gets a suggestion with the reasoning spelled out. Plain arithmetic, no guesswork dressed up as intelligence.',
  },
  {
    Icon: Ruler,
    title: 'Resize while you compress',
    body: 'Lanczos3 downscaling with ready-made sizes for social posts, hero images and product shots. Nothing is ever enlarged, and nothing is cropped without asking.',
  },
  {
    Icon: FileArchive,
    title: 'Download the lot',
    body: 'One file at a time, or everything in a single ZIP with duplicate names resolved so the archive opens cleanly.',
  },
];

export function Features() {
  return (
    <section className="py-16" aria-labelledby="features-heading">
      <h2 id="features-heading" className="text-2xl text-ink sm:text-3xl">
        Built for the images you actually have
      </h2>
      <p className="mt-3 max-w-2xl text-muted">
        Everything here is working functionality, not a feature list. If something cannot be done
        honestly — preserving animation, promising an exact file size, keeping metadata in a format
        that has none — the interface tells you instead of pretending.
      </p>

      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ Icon, title, body }) => (
          <div key={title} className="card p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft text-brand">
              <Icon size={18} aria-hidden="true" />
            </span>
            <h3 className="mt-3.5 text-[15px] font-semibold text-ink">{title}</h3>
            <p className="mt-1.5 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
