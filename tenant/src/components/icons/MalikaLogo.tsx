import { cn } from '@/lib/utils';

/**
 * Compact square brand mark — the «⇄» exchange glyph (купил ↔ продал), the
 * essence of перекуп. Brass strokes (currentColor) on a charcoal tile. Use for
 * favicon-scale spots: avatar fallback, splash, install banner, header.
 */
export function MalikaLogo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label="perekup"
      className={cn('inline-block', className)}
    >
      <rect width="32" height="32" rx="8" fill="rgb(var(--c-bg2))" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        fill="none"
        stroke="rgb(var(--c-border))"
      />
      <g
        stroke="currentColor"
        strokeWidth="2.1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* top arrow → (sell) */}
        <path d="M8.5 12.5 H21.5" />
        <path d="M18.5 9.5 L22.5 12.5 L18.5 15.5" />
        {/* bottom arrow ← (buy) */}
        <path d="M23.5 19.5 H10.5" />
        <path d="M13.5 16.5 L9.5 19.5 L13.5 22.5" />
      </g>
    </svg>
  );
}
