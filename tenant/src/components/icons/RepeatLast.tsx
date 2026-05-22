import { cn } from '@/lib/utils';

/**
 * «RepeatLast» — circular arrow with a small «+» glyph, signalling
 * «повторить предыдущую закупку» (one-tap restock from template).
 */
export function RepeatLastIcon({
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
      <path d="M20 11.5a8 8 0 1 0-2.3 5.6" />
      <path d="M20 5v6.5h-6" />
      <path d="M12 8v4M10 10h4" />
    </svg>
  );
}
