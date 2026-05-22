import { cn } from '@/lib/utils';
import { brandColor, brandTint } from '@/lib/brand';

interface Props {
  brand: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Coloured pill: letter avatar + brand name, tinted by the brand's colour. */
export default function BrandBadge({ brand, size = 'sm', className }: Props) {
  const color = brandColor(brand);
  const letter = (brand.trim()[0] ?? '?').toUpperCase();
  const sm = size === 'sm';
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border font-bold tracking-tight',
        sm ? 'h-6 gap-1 pl-1 pr-2 text-caption' : 'h-7 gap-1.5 pl-1 pr-2.5 text-label',
        className,
      )}
      style={{
        color,
        backgroundColor: brandTint(brand, 0.12),
        borderColor: brandTint(brand, 0.32),
      }}
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full font-extrabold',
          sm ? 'h-4 w-4 text-[10px]' : 'h-5 w-5 text-[11px]',
        )}
        style={{ backgroundColor: color, color: '#0b0f19' }}
        aria-hidden
      >
        {letter}
      </span>
      {brand}
    </span>
  );
}
