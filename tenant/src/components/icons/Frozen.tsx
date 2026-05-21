import { cn } from '@/lib/utils';

/**
 * «Frozen» — six-armed snowflake. Used on shop status badge when admin
 * has paused a tenant.
 */
export function FrozenIcon({
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
      <path d="M12 3v18" />
      <path d="m5.2 6.6 13.6 10.8" />
      <path d="m18.8 6.6-13.6 10.8" />
      <path d="m9 5 3 2 3-2" />
      <path d="m9 19 3-2 3 2" />
      <path d="m5 9 .8 3.4-2.6 2" />
      <path d="m19 9-.8 3.4 2.6 2" />
      <path d="m5 15 .8-3.4-2.6-2" />
      <path d="m19 15-.8-3.4 2.6-2" />
    </svg>
  );
}
