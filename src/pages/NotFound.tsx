import { RelatedLinks } from '@/components/Layout';
import { Seo } from '@/lib/seo';

export function NotFound() {
  return (
    <>
      <Seo
        title="Page not found — Pixelpress"
        description="That page does not exist. The image compressor and the format-specific pages are linked below."
        path="/404"
        noindex
      />

      <section className="py-24 text-center">
        <p className="tabular text-sm font-medium text-brand">404</p>
        <h1 className="mt-2 text-3xl text-ink sm:text-4xl">That page does not exist</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          The link may be old or mistyped. Everything the site does is one of the pages below.
        </p>
        <a href="/image-compressor" className="btn btn-primary mt-7">
          Go to the compressor
        </a>
      </section>

      <RelatedLinks
        heading="Pages that do exist"
        links={[
          { to: '/image-compressor', label: 'Image compressor', blurb: 'All formats.' },
          { to: '/compress-jpg', label: 'Compress JPG', blurb: 'Photographs.' },
          { to: '/compress-png', label: 'Compress PNG', blurb: 'Graphics.' },
          { to: '/guides', label: 'Guides', blurb: 'How compression works.' },
        ]}
      />
    </>
  );
}
