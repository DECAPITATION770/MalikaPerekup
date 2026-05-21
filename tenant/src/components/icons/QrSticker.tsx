import { cn } from '@/lib/utils';

/**
 * QR sticker icon — three corner markers + hashed scan field. Used on
 * StockDetail print-QR button and Search command palette.
 */
export function QrStickerIcon({
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
      {/* Three corner finder markers */}
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="15" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="3.5" y="15" width="5.5" height="5.5" rx="1" />
      <rect x="5.4" y="5.4" width="1.7" height="1.7" fill="currentColor" stroke="none" />
      <rect x="16.9" y="5.4" width="1.7" height="1.7" fill="currentColor" stroke="none" />
      <rect x="5.4" y="16.9" width="1.7" height="1.7" fill="currentColor" stroke="none" />
      {/* Data cells in the bottom-right */}
      <path d="M12 12h.01M15 12h.01M18 12h.01M12 15h.01M15 15h.01M18 15h.01M12 18h.01M15 18h.01M18 18h.01" />
    </svg>
  );
}
