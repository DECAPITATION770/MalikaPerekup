import { cn } from '@/lib/utils';

/**
 * «Restock» — box with refill-arrow loop. Used on quick-action card
 * «Закупить ещё» when an item is sold out.
 */
export function RestockIcon({
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
      {/* Box */}
      <path d="M4 9h16v11H4z" />
      <path d="M4 9l2-4h12l2 4" />
      <path d="M9 13h6" />
      {/* Loop arrow above */}
      <path d="M9 6a4 4 0 0 1 7 0" />
      <path d="m12 3 3 3-3 3" />
    </svg>
  );
}
