import { cn } from '@/lib/utils';

/**
 * «Нет активных рассрочек» — calendar with a check-mark inside an empty
 * cell. Amber check.
 */
export function NoInstallmentsIllustration({ className }: { className?: string }) {
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
      {/* Calendar body */}
      <rect x="44" y="38" width="112" height="100" rx="8" stroke="currentColor" strokeWidth="1.8" />
      <line x1="44" y1="60" x2="156" y2="60" stroke="currentColor" strokeWidth="1.8" />
      {/* Top binding */}
      <line x1="68" y1="32" x2="68" y2="48" stroke="currentColor" strokeWidth="2" />
      <line x1="100" y1="32" x2="100" y2="48" stroke="currentColor" strokeWidth="2" />
      <line x1="132" y1="32" x2="132" y2="48" stroke="currentColor" strokeWidth="2" />

      {/* Grid */}
      {[72, 86, 100, 114].map((y) => (
        <line key={y} x1="44" y1={y} x2="156" y2={y} stroke="currentColor" strokeWidth="1.1" opacity="0.45" />
      ))}
      {[68, 92, 116, 140].map((x) => (
        <line key={x} x1={x} y1="60" x2={x} y2="138" stroke="currentColor" strokeWidth="1.1" opacity="0.45" />
      ))}

      {/* Tick mark inside one cell — amber */}
      <path
        d="m94 92 5 6 12-12"
        stroke="rgb(var(--c-accent))"
        strokeWidth="2.6"
      />

      {/* Floor shadow */}
      <ellipse cx="100" cy="146" rx="60" ry="4" fill="currentColor" opacity="0.12" />
    </svg>
  );
}
