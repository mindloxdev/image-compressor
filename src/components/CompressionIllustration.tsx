/**
 * The hero illustration: one image becoming a smaller one.
 *
 * Inline SVG, theme-aware through the same colour tokens as the rest of the
 * page, and marked decorative — the headline beside it already says what it
 * means, so a screen reader announcing it twice would only add noise.
 *
 * The figures shown are illustrative of a typical photograph, and the caption
 * in the hero says so rather than presenting them as a measured result.
 */
export function CompressionIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 240"
      className={className}
      role="img"
      aria-label="A large photograph being compressed into a much smaller file of the same picture"
    >
      <defs>
        <linearGradient id="pp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c-accent-3)" stopOpacity="0.3" />
          <stop offset="55%" stopColor="var(--c-brand-vivid)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--c-accent-2)" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="pp-hill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--c-brand-vivid)" />
          <stop offset="55%" stopColor="var(--c-accent-2)" />
          <stop offset="100%" stopColor="var(--c-accent-3)" />
        </linearGradient>
        <clipPath id="pp-clip-big">
          <rect x="16" y="40" width="152" height="112" rx="10" />
        </clipPath>
        <clipPath id="pp-clip-small">
          <rect x="276" y="70" width="112" height="82" rx="8" />
        </clipPath>
      </defs>

      {/* Before */}
      <g>
        <rect
          x="16"
          y="40"
          width="152"
          height="112"
          rx="10"
          fill="var(--c-surface)"
          stroke="var(--c-line)"
        />
        <g clipPath="url(#pp-clip-big)">
          <rect x="16" y="40" width="152" height="112" fill="url(#pp-sky)" />
          <circle cx="130" cy="68" r="12" fill="var(--c-accent-2)" opacity="0.85" />
          <path d="M16 134 68 92l34 26 24-18 42 32v20H16z" fill="url(#pp-hill)" opacity="0.9" />
          <path d="M16 152 54 118l30 22 26-14 42 26v8H16z" fill="var(--c-accent-3)" opacity="0.5" />
        </g>
        <text
          x="22"
          y="170"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fill="var(--c-muted)"
        >
          beach.jpg
        </text>
        <text
          x="22"
          y="186"
          fontSize="13"
          fontWeight="600"
          fontFamily="var(--font-mono)"
          fill="var(--c-ink)"
        >
          4.2 MB
        </text>
      </g>

      {/* The squeeze */}
      <g stroke="var(--c-line-strong)" strokeWidth="1.5" strokeDasharray="4 4" fill="none">
        <path d="M180 96h58" />
      </g>
      <path
        d="M238 96l-7-4.5v9z"
        fill="var(--c-brand)"
        stroke="none"
      />
      <g transform="translate(192 112)">
        <rect
          x="0"
          y="0"
          width="56"
          height="22"
          rx="11"
          fill="var(--c-brand-soft)"
          stroke="var(--c-brand)"
          strokeWidth="1"
        />
        <text
          x="28"
          y="15"
          fontSize="11"
          fontWeight="600"
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fill="var(--c-brand)"
        >
          press
        </text>
      </g>

      {/* After */}
      <g>
        <rect
          x="276"
          y="70"
          width="112"
          height="82"
          rx="8"
          fill="var(--c-surface)"
          stroke="var(--c-brand)"
          strokeWidth="1.5"
        />
        <g clipPath="url(#pp-clip-small)">
          <rect x="276" y="70" width="112" height="82" fill="url(#pp-sky)" />
          <circle cx="360" cy="90" r="9" fill="var(--c-accent-2)" opacity="0.85" />
          <path d="M276 139l38-31 25 19 18-13 31 23v15h-112z" fill="url(#pp-hill)" opacity="0.9" />
          <path d="M276 152l28-25 22 16 19-10 31 19v6h-100z" fill="var(--c-accent-3)" opacity="0.5" />
        </g>
        <text
          x="282"
          y="170"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fill="var(--c-muted)"
        >
          beach.jpg
        </text>
        <text
          x="282"
          y="186"
          fontSize="13"
          fontWeight="600"
          fontFamily="var(--font-mono)"
          fill="var(--c-ink)"
        >
          540 KB
        </text>
        <g transform="translate(282 196)">
          <rect x="0" y="0" width="86" height="20" rx="10" fill="var(--c-save-soft)" />
          <text
            x="43"
            y="14"
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fill="var(--c-save)"
          >
            87% smaller
          </text>
        </g>
      </g>

      {/* Same picture, both sides — the point of the drawing. */}
      <text
        x="210"
        y="26"
        fontSize="11"
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fill="var(--c-faint)"
      >
        same picture, same dimensions
      </text>
    </svg>
  );
}
