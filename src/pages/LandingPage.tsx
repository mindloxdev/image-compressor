import { AlertTriangle } from 'lucide-react';

import { Faq } from '@/components/Faq';
import { PageHeader, RelatedLinks } from '@/components/Layout';
import { Workspace } from '@/components/workspace/Workspace';
import type { LandingPage as LandingPageData } from '@/content/landing';
import { Seo, breadcrumbSchema, faqSchema, webApplicationSchema } from '@/lib/seo';

/**
 * One component behind every /compress-* route. The page differs by data —
 * copy, defaults, accepted formats, limitations — and each one mounts a real
 * working compressor configured for that job, which is the only reason these
 * routes deserve to exist separately.
 */
export function LandingPage({ page }: { page: LandingPageData }) {
  return (
    <>
      <Seo
        title={page.metaTitle}
        description={page.metaDescription}
        path={page.slug}
        structuredData={[
          webApplicationSchema(page.h1, page.metaDescription, page.slug),
          faqSchema(page.faqs),
          breadcrumbSchema([
            { name: 'Pixelpress', path: '/' },
            { name: page.h1, path: page.slug },
          ]),
        ]}
      />

      <PageHeader title={page.h1} intro={page.intro} />

      <Workspace
        initialSettings={page.settings}
        accept={page.accept}
        acceptAttribute={page.acceptAttribute}
        formatChips={page.formatChips}
      />

      <div className="prose-body max-w-3xl py-14">
        {page.body.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </section>
        ))}

        <section>
          <h2>What this page cannot do</h2>
          <p>
            Every tool has edges. These are the ones worth knowing about before you start, rather
            than after you have downloaded something unexpected.
          </p>
          <ul className="list-none! ml-0!">
            {page.limitations.map((limitation) => (
              <li key={limitation} className="flex items-start gap-2">
                <AlertTriangle
                  size={15}
                  className="mt-1 shrink-0 text-warn"
                  aria-hidden="true"
                />
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Faq entries={page.faqs} />

      <RelatedLinks links={page.related} />
    </>
  );
}
