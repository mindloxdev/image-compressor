import { ChevronDown } from 'lucide-react';

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface FaqProps {
  entries: readonly FaqEntry[];
  heading?: string;
  id?: string;
}

/**
 * Native `details` elements: open by keyboard, searchable with the browser's
 * own find-in-page, and readable before any JavaScript runs — which also means
 * the prerendered HTML carries the full answers for crawlers.
 */
export function Faq({ entries, heading = 'Questions', id = 'faq' }: FaqProps) {
  return (
    <section id={id} className="py-16 scroll-mt-20" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-2xl text-ink sm:text-3xl">
        {heading}
      </h2>

      <div className="mt-8 max-w-3xl divide-y divide-[var(--c-line)] overflow-hidden rounded-card border border-line bg-surface">
        {entries.map((entry) => (
          <details key={entry.question} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-sunken">
              <span className="flex-1">{entry.question}</span>
              <ChevronDown
                size={17}
                aria-hidden="true"
                className="shrink-0 text-faint transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <div className="px-5 pb-4 text-sm leading-relaxed text-muted">{entry.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
