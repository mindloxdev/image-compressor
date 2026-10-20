import { ArrowLeft, Clock, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHeader, RelatedLinks } from '@/components/Layout';
import { GUIDES, type Block, type Guide } from '@/content/guides';
import { Seo, articleSchema, breadcrumbSchema } from '@/lib/seo';

export function GuidesIndex() {
  return (
    <>
      <Seo
        title="Image Compression Guides — Pixelpress"
        description="Plain-language guides to image quality, file size, WebP, PNG transparency, page speed and hitting an exact file size."
        path="/guides"
        structuredData={[
          breadcrumbSchema([
            { name: 'Pixelpress', path: '/' },
            { name: 'Guides', path: '/guides' },
          ]),
        ]}
      />

      <PageHeader
        eyebrow="Guides"
        title="How image compression actually works"
        intro="Short, practical explanations of the things that decide how large your images are — written to answer the question and then stop."
      />

      <div className="grid gap-4 pb-10 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <article key={guide.slug} className="card p-5">
            <h2 className="text-lg font-semibold text-ink">
              <Link to={`/guides/${guide.slug}`} className="no-underline hover:text-brand">
                {guide.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm text-muted">{guide.summary}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
              <Clock size={13} aria-hidden="true" />
              {guide.readingMinutes} min read
            </p>
          </article>
        ))}
      </div>

      <RelatedLinks
        heading="Start compressing"
        links={[
          { to: '/image-compressor', label: 'Image compressor', blurb: 'All formats, all controls.' },
          { to: '/compress-jpg', label: 'Compress JPG', blurb: 'Photographs.' },
          { to: '/compress-png', label: 'Compress PNG', blurb: 'Graphics and transparency.' },
          { to: '/compress-webp', label: 'Compress WebP', blurb: 'The modern default.' },
        ]}
      />
    </>
  );
}

function renderBlock(block: Block, index: number) {
  switch (block.type) {
    case 'h2':
      return <h2 key={index}>{block.text}</h2>;
    case 'h3':
      return <h3 key={index}>{block.text}</h3>;
    case 'p':
      return <p key={index}>{block.text}</p>;
    case 'ul':
      return (
        <ul key={index}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'note':
      return (
        <p
          key={index}
          className="flex items-start gap-2 rounded-control border border-line bg-sunken px-4 py-3 text-sm"
        >
          <Info size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <span>{block.text}</span>
        </p>
      );
    default:
      return null;
  }
}

export function GuidePage({ guide }: { guide: Guide }) {
  return (
    <>
      <Seo
        title={`${guide.metaTitle} — Pixelpress`}
        description={guide.metaDescription}
        path={`/guides/${guide.slug}`}
        ogType="article"
        structuredData={[
          articleSchema({
            headline: guide.title,
            description: guide.metaDescription,
            path: `/guides/${guide.slug}`,
            datePublished: guide.published,
          }),
          breadcrumbSchema([
            { name: 'Pixelpress', path: '/' },
            { name: 'Guides', path: '/guides' },
            { name: guide.title, path: `/guides/${guide.slug}` },
          ]),
        ]}
      />

      <article className="pt-10 sm:pt-14">
        <Link
          to="/guides"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted no-underline hover:text-brand"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          All guides
        </Link>

        <h1 className="max-w-3xl text-3xl text-ink sm:text-4xl">{guide.title}</h1>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-faint">
          <Clock size={14} aria-hidden="true" />
          {guide.readingMinutes} min read
        </p>

        <div className="prose-body mt-8 max-w-3xl">{guide.blocks.map(renderBlock)}</div>
      </article>

      <RelatedLinks heading="Next" links={guide.related} />
    </>
  );
}
