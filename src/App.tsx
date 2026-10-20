import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { Layout } from '@/components/Layout';
import { GUIDES } from '@/content/guides';
import { LANDING_PAGES } from '@/content/landing';
import { GuidePage, GuidesIndex } from '@/pages/Guides';
import { Home } from '@/pages/Home';
import { LandingPage } from '@/pages/LandingPage';
import { NotFound } from '@/pages/NotFound';

/** Client-side navigation should start at the top, like a real page load. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return; // an in-page anchor handles itself
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        {LANDING_PAGES.map((page) => (
          <Route key={page.slug} path={page.slug} element={<LandingPage page={page} />} />
        ))}
        <Route path="/guides" element={<GuidesIndex />} />
        {GUIDES.map((guide) => (
          <Route
            key={guide.slug}
            path={`/guides/${guide.slug}`}
            element={<GuidePage guide={guide} />}
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
