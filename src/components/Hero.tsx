import { ArrowRight, Cpu, ShieldCheck, Zap } from 'lucide-react';

import { CompressionIllustration } from './CompressionIllustration';

export interface HeroProps {
  title: React.ReactNode;
  subtitle: string;
  /** Anchor the main button scrolls to. */
  ctaHref?: string;
  ctaLabel?: string;
  formats?: readonly string[];
  showIllustration?: boolean;
}

export function Hero({
  title,
  subtitle,
  ctaHref = '#workspace',
  ctaLabel = 'Compress Images',
  formats = ['JPG', 'PNG', 'WebP', 'AVIF', 'GIF', 'BMP'],
  showIllustration = true,
}: HeroProps) {
  return (
    <section className="pt-10 pb-8 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <p className="chip mb-5 border-brand/30 bg-brand-soft text-brand">
            <ShieldCheck size={13} aria-hidden="true" />
            Runs on your device — no uploads
          </p>

          <h1 className="text-4xl text-ink sm:text-5xl lg:text-[3.25rem]">{title}</h1>

          <p className="mt-5 max-w-xl text-lg text-muted">{subtitle}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href={ctaHref} className="btn btn-primary h-12 px-6 text-base">
              {ctaLabel}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <span className="text-sm text-faint">Free. No account needed.</span>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-1.5">
              <Zap size={15} className="text-brand" aria-hidden="true" />
              Batch up to 100 images
            </li>
            <li className="flex items-center gap-1.5">
              <Cpu size={15} className="text-brand" aria-hidden="true" />
              MozJPEG, WebP, AVIF, oxipng
            </li>
          </ul>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {formats.map((format) => (
              <span key={format} className="chip">
                {format}
              </span>
            ))}
          </div>
        </div>

        {showIllustration ? (
          <div className="hidden lg:block">
            <CompressionIllustration className="h-auto w-full" />
            <p className="mt-2 text-center text-xs text-faint">
              Illustrative of a typical photograph. Your own savings are measured from the file you
              get, and shown per image.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
