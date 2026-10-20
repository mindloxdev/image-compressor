import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme, type ThemeChoice } from '@/hooks/useTheme';

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'Match system', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/**
 * A three-way segmented control rather than a toggle, so "follow the system"
 * stays reachable instead of being lost the first time someone taps a switch.
 */
export function ThemeToggle() {
  const { choice, setChoice } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setChoice(value)}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 ${
              active
                ? 'bg-brand text-on-brand'
                : 'text-faint hover:bg-sunken hover:text-ink'
            }`}
          >
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
