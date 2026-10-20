import { AlertTriangle, Check } from 'lucide-react';

import { PRESETS } from '@/engine/presets';
import type { PresetId } from '@/engine/types';

export interface PresetPickerProps {
  value: PresetId;
  onChange: (preset: Exclude<PresetId, 'custom'>) => void;
}

export function PresetPicker({ value, onChange }: PresetPickerProps) {
  const caution = PRESETS.find((preset) => preset.id === value)?.caution;

  return (
    <div>
      {/*
        A vertical list rather than three columns: the settings sidebar is
        340px, which left each column under 100px — enough to clip a word like
        "Balanced" and to wrap every tagline onto three lines.
      */}
      <div role="radiogroup" aria-label="Compression preset" className="grid gap-2">
        {PRESETS.map((preset) => {
          const active = value === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(preset.id)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2.5 text-left transition-all duration-200 ${
                active
                  ? 'border-brand bg-brand-soft ring-1 ring-brand'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-sunken'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  active ? 'border-brand bg-brand text-on-brand' : 'border-line-strong'
                }`}
                aria-hidden="true"
              >
                {active ? <Check size={11} strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${active ? 'text-brand' : 'text-ink'}`}
                >
                  {preset.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{preset.tagline}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-faint">
        {PRESETS.find((preset) => preset.id === value)?.description ??
          'Custom settings are in force. Pick a preset to go back to a standard setting.'}
      </p>

      {caution ? (
        <p className="mt-2 flex items-start gap-2 rounded-control bg-warn-soft px-3 py-2 text-xs text-warn">
          <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
          <span>{caution}</span>
        </p>
      ) : null}
    </div>
  );
}
