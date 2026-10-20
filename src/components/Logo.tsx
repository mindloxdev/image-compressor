/**
 * The Pixelpress mark: a frame with two arrows pressing inward on it.
 * Drawn as inline SVG so it inherits colour and needs no network request.
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="8"
        fill="var(--c-brand-soft)"
        stroke="var(--c-brand)"
        strokeWidth="1.5"
      />
      {/* The frame being squeezed. */}
      <rect
        x="11"
        y="11"
        width="10"
        height="10"
        rx="2"
        fill="var(--c-brand)"
        opacity="0.9"
      />
      {/* Arrows pressing in from the left and right. */}
      <path
        d="M7 16h3M24.5 16h-3"
        stroke="var(--c-brand)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8.6 13.6 10.8 16l-2.2 2.4M22.9 13.6 20.7 16l2.2 2.4"
        stroke="var(--c-brand)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold tracking-tight">Pixel</span>
      <span className="font-semibold tracking-tight text-brand">press</span>
    </span>
  );
}
