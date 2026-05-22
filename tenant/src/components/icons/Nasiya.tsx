import { cn } from '@/lib/utils';

/**
 * «Nasiya» (рассрочка) — coin with two opposing arrows around it,
 * suggesting recurring payments. Strokes are currentColor so the icon
 * inherits surrounding tone classes.
 */
export function NasiyaIcon({
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
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 10v4M10 12h4" />
      {/* Cycle arrows around the coin */}
      <path d="M19 6.2a8.5 8.5 0 0 0-14 4.6" />
      <path d="M5 17.8a8.5 8.5 0 0 0 14-4.6" />
      <path d="M19 6.2v3.6h-3.6" />
      <path d="M5 17.8v-3.6h3.6" />
    </svg>
  );
}
