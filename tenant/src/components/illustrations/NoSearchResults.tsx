import { cn } from '@/lib/utils';

/**
 * «Ничего не нашли» — magnifying glass over an empty card. Amber accent
 * on the lens ring.
 */
export function NoSearchResultsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      width={200}
      height={160}
      role="img"
      aria-hidden="true"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-text-dim', className)}
    >
      {/* Card behind */}
      <rect x="32" y="42" width="100" height="76" rx="8" stroke="currentColor" strokeWidth="1.6" />
      <line x1="46" y1="60" x2="116" y2="60" stroke="currentColor" strokeWidth="1.4" />
      <line x1="46" y1="74" x2="100" y2="74" stroke="currentColor" strokeWidth="1.4" />
      <line x1="46" y1="88" x2="110" y2="88" stroke="currentColor" strokeWidth="1.4" />
      <line x1="46" y1="102" x2="90" y2="102" stroke="currentColor" strokeWidth="1.4" />

      {/* Magnifier */}
      <circle cx="138" cy="92" r="22" stroke="rgb(var(--c-accent))" strokeWidth="2.2" />
      <line
        x1="154"
        y1="108"
        x2="170"
        y2="124"
        stroke="rgb(var(--c-accent))"
        strokeWidth="3"
      />
      <path
        d="M128 88a10 10 0 0 1 10-6"
        stroke="rgb(var(--c-accent))"
        strokeWidth="1.6"
        opacity="0.6"
      />

      {/* Floor shadow */}
      <ellipse cx="100" cy="138" rx="56" ry="4" fill="currentColor" opacity="0.12" />
    </svg>
  );
}
