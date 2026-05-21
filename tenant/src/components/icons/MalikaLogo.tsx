import { cn } from '@/lib/utils';

/**
 * Compact square mark — «М» glyph carrying an amber dot above it. Use for
 * favicon-scale spots: avatar fallback, splash, install banner, header at
 * very narrow breakpoints.
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
      aria-label="Малика"
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
      <circle cx="16" cy="9" r="2.4" fill="rgb(var(--c-accent))" />
      <path
        d="M7 24 V14 L12 19 L16 14 L20 19 L25 14 V24"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
