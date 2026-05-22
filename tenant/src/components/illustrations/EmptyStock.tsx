import { cn } from '@/lib/utils';

/**
 * Empty-stock illustration: outlined shelf grid with one phantom phone
 * silhouette. Amber stroke is the focal point; everything else inherits
 * `text-dim` via currentColor.
 */
export function EmptyStockIllustration({ className }: { className?: string }) {
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
      {/* Soft amber halo behind */}
      <ellipse cx="100" cy="135" rx="62" ry="6" fill="rgb(var(--c-accent))" opacity="0.08" />

      {/* Shelf rack */}
      <rect x="38" y="40" width="124" height="86" rx="6" stroke="currentColor" strokeWidth="1.6" />
      <line x1="38" y1="68" x2="162" y2="68" stroke="currentColor" strokeWidth="1.4" />
      <line x1="38" y1="97" x2="162" y2="97" stroke="currentColor" strokeWidth="1.4" />
      <line x1="80" y1="40" x2="80" y2="126" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />
      <line x1="120" y1="40" x2="120" y2="126" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />

      {/* Single phantom phone in top-left cell — the only amber stroke */}
      <rect
        x="50"
        y="48"
        width="22"
        height="14"
        rx="3"
        stroke="rgb(var(--c-accent))"
        strokeWidth="1.8"
      />
      <line x1="58" y1="60" x2="64" y2="60" stroke="rgb(var(--c-accent))" strokeWidth="1.8" />

      {/* Floor shadow */}
      <line x1="30" y1="126" x2="170" y2="126" stroke="currentColor" strokeWidth="1.6" />

      {/* Speech-bubble «нет товара» — three dots above the shelf */}
      <circle cx="92" cy="22" r="2.4" fill="currentColor" opacity="0.55" />
      <circle cx="100" cy="22" r="2.4" fill="currentColor" opacity="0.7" />
      <circle cx="108" cy="22" r="2.4" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
