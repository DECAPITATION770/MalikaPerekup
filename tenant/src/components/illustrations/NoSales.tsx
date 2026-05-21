import { cn } from '@/lib/utils';

/**
 * «Пока нет продаж» — open empty cash drawer with a wobble line.
 */
export function NoSalesIllustration({ className }: { className?: string }) {
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
      {/* Drawer */}
      <path
        d="M36 92 L36 132 L164 132 L164 92 Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {/* Bill compartments */}
      <line x1="68" y1="92" x2="68" y2="132" stroke="currentColor" strokeWidth="1.4" />
      <line x1="100" y1="92" x2="100" y2="132" stroke="currentColor" strokeWidth="1.4" />
      <line x1="132" y1="92" x2="132" y2="132" stroke="currentColor" strokeWidth="1.4" />

      {/* Drawer slide rail */}
      <line x1="30" y1="92" x2="170" y2="92" stroke="currentColor" strokeWidth="1.8" />

      {/* Empty wobble line above */}
      <path
        d="M70 70q10-8 20 0t20 0t20 0"
        stroke="rgb(var(--c-accent))"
        strokeWidth="2.2"
        fill="none"
      />

      {/* Dust speck above the wobble — the «nothing here» beat */}
      <circle cx="74" cy="56" r="1.6" fill="currentColor" opacity="0.4" />
      <circle cx="120" cy="50" r="1.6" fill="currentColor" opacity="0.4" />
      <circle cx="142" cy="58" r="1.6" fill="currentColor" opacity="0.4" />

      {/* Floor shadow */}
      <ellipse cx="100" cy="142" rx="68" ry="4" fill="currentColor" opacity="0.12" />
    </svg>
  );
}
