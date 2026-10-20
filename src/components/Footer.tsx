import { Link } from 'react-router-dom';

import { Logo, Wordmark } from './Logo';

const COLUMNS: { heading: string; links: { to: string; label: string }[] }[] = [
  {
    heading: 'Compress',
    links: [
      { to: '/image-compressor', label: 'Image compressor' },
      { to: '/compress-jpg', label: 'Compress JPG' },
      { to: '/compress-png', label: 'Compress PNG' },
      { to: '/compress-webp', label: 'Compress WebP' },
    ],
  },
  {
    heading: 'By size',
    links: [
      { to: '/compress-images-to-100kb', label: 'Compress to 100 KB' },
      { to: '/compress-images-to-200kb', label: 'Compress to 200 KB' },
      { to: '/compress-images-for-websites', label: 'For websites' },
      { to: '/compress-product-images', label: 'Product images' },
    ],
  },
  {
    heading: 'Guides',
    links: [
      { to: '/guides', label: 'All guides' },
      { to: '/guides/image-quality-and-file-size', label: 'Quality and file size' },
      { to: '/guides/webp-explained', label: 'WebP explained' },
      { to: '/guides/png-transparency', label: 'PNG transparency' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2 text-ink no-underline">
              <Logo size={26} />
              <Wordmark className="text-base" />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted">
              An image compressor that runs entirely in your browser. Your pictures are never
              uploaded anywhere.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
                {column.heading}
              </h2>
              <ul className="space-y-0.5">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      /* inline-block + padding keeps the hit area at the 24px
                         WCAG 2.2 minimum without changing how the list looks. */
                      className="inline-block py-1 text-sm text-muted no-underline transition-colors duration-150 hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>Pixelpress — free, in-browser image compression.</p>
          <p>
            Built with the MozJPEG, libwebp, libavif and oxipng codecs compiled to WebAssembly.
          </p>
        </div>
      </div>
    </footer>
  );
}
