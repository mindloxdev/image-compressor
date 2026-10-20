/**
 * Page metadata, shared by the browser and the build-time prerenderer.
 *
 * On the server a collector gathers whatever the rendered page declared, and
 * the prerender script writes it into the static `<head>` — so a crawler gets
 * the real title, description, canonical and structured data without running
 * any JavaScript. In the browser the same component writes those tags
 * imperatively, which keeps client-side navigation correct too.
 */

import { createContext, useContext, useEffect } from 'react';

export interface SeoMeta {
  title: string;
  description: string;
  /** Path only, e.g. `/compress-jpg`. The origin is added at build time. */
  path: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  /** JSON-LD objects, emitted one script tag each. */
  structuredData?: unknown[];
}

export interface SeoCollector {
  meta: SeoMeta | null;
}

const SeoContext = createContext<SeoCollector | null>(null);

export function SeoProvider({
  collector,
  children,
}: {
  collector: SeoCollector;
  children: React.ReactNode;
}) {
  return <SeoContext.Provider value={collector}>{children}</SeoContext.Provider>;
}

const MANAGED = 'data-pp-seo';

/** Declare the metadata for the current page. Render one per route. */
export function Seo(meta: SeoMeta) {
  const collector = useContext(SeoContext);
  // During server rendering this is the only chance to record the metadata;
  // effects never run there.
  if (collector) collector.meta = meta;

  useEffect(() => {
    document.title = meta.title;

    for (const node of Array.from(document.querySelectorAll(`[${MANAGED}]`))) {
      node.remove();
    }

    const head = document.head;
    const add = (tag: string, attributes: Record<string, string>) => {
      const element = document.createElement(tag);
      element.setAttribute(MANAGED, '');
      for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
      }
      head.append(element);
    };

    const canonical = `${window.location.origin}${meta.path}`;
    add('meta', { name: 'description', content: meta.description });
    add('link', { rel: 'canonical', href: canonical });
    add('meta', { property: 'og:title', content: meta.title });
    add('meta', { property: 'og:description', content: meta.description });
    add('meta', { property: 'og:type', content: meta.ogType ?? 'website' });
    add('meta', { property: 'og:url', content: canonical });
    add('meta', { name: 'twitter:card', content: 'summary_large_image' });
    if (meta.noindex) add('meta', { name: 'robots', content: 'noindex,follow' });

    for (const data of meta.structuredData ?? []) {
      const script = document.createElement('script');
      script.setAttribute(MANAGED, '');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      head.append(script);
    }
  }, [meta]);

  return null;
}

/* ---------- Structured data helpers ---------- */

export const SITE_NAME = 'Pixelpress';

export function webApplicationSchema(name: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: path,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any browser',
    browserRequirements: 'Requires JavaScript and WebAssembly',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

export function faqSchema(entries: readonly { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

export function breadcrumbSchema(trail: readonly { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: step.path,
    })),
  };
}

export function articleSchema(options: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: options.headline,
    description: options.description,
    url: options.path,
    datePublished: options.datePublished,
    dateModified: options.datePublished,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };
}
