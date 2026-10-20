import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

export interface CollapsibleProps {
  title: string;
  /** Shown to the right of the title — a count, a current value, a warning. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * A disclosure built from a real button so it is keyboard operable and
 * announces its expanded state. Advanced controls live inside these rather
 * than crowding the workspace.
 */
export function Collapsible({
  title,
  summary,
  defaultOpen = false,
  children,
  icon,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="overflow-hidden rounded-control border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-sunken"
      >
        {icon ? <span className="shrink-0 text-faint">{icon}</span> : null}
        <span className="text-sm font-medium text-ink">{title}</span>
        {summary ? <span className="ml-auto text-xs text-faint">{summary}</span> : null}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`${summary ? '' : 'ml-auto'} shrink-0 text-faint transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div id={panelId} hidden={!open} className="border-t border-line px-4 py-4">
        {children}
      </div>
    </div>
  );
}
