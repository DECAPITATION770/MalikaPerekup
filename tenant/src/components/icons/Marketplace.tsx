import { cn } from '@/lib/utils';

/**
 * «Marketplace» — stylised market canopy + stall. Stands in for
 * «рынок Малика» throughout the app (Today header, Empty Stock CTA).
 */
export function MarketplaceIcon({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Canopy with three scallops */}
      <path d="M3 9c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 2-2v0" />
      <path d="M3 9l1 11h16l1-11" />
      {/* Stall divisions */}
      <path d="M9 20v-6h6v6" />
      <path d="M4 14h16" />
    </svg>
  );
}
