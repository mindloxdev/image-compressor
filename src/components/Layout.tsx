import { Link } from 'react-router-dom';

import { Footer } from './Footer';
import { Nav } from './Nav';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* First tab stop on every page, for keyboard and screen-reader users. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6">
        {children}
      </main>
      <Footer />
    </>
  );
}

/** Shared page header for the landing and guide pages. */
export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  return (
    <header className="pt-10 pb-6 sm:pt-14">
      {eyebrow ? (
        <p className="mb-3 text-sm font-medium tracking-wide text-brand uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="max-w-3xl text-3xl text-ink sm:text-4xl">{title}</h1>
      {intro ? <p className="mt-4 max-w-2xl text-lg text-muted">{intro}</p> : null}
    </header>
  );
}

export function RelatedLinks({
  links,
  heading = 'Related tools',
}: {
  links: readonly { to: string; label: string; blurb?: string }[];
  heading?: string;
}) {
  if (links.length === 0) return null;
  return (
    <nav className="py-14" aria-labelledby="related-heading">
      <h2 id="related-heading" className="text-xl text-ink sm:text-2xl">
        {heading}
      </h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="card block h-full p-4 no-underline transition-colors duration-150 hover:border-brand hover:bg-brand-soft"
            >
              <span className="block text-sm font-semibold text-ink">{link.label}</span>
              {link.blurb ? (
                <span className="mt-1 block text-xs text-muted">{link.blurb}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
