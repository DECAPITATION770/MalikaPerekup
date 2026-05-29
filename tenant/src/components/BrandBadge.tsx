import { cn } from '@/lib/utils';
import { brandColor, brandTextColor, brandTint } from '@/lib/brand';
import { useTheme } from '@/lib/theme';

interface Props {
  brand: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Coloured pill: letter avatar + brand name, tinted by the brand's colour. */
export default function BrandBadge({ brand, size = 'sm', className }: Props) {
  const { resolved } = useTheme();
  // Avatar tile keeps the vivid hex (sits on a coloured square — contrast is
  // guaranteed by the dark `#0b0f19` glyph). The chip body text needs the
  // theme-aware variant so light mode clears WCAG AA on the tinted bg.
  const avatarColor = brandColor(brand);
  const textColor = brandTextColor(brand, resolved);
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
        color: textColor,
        backgroundColor: brandTint(brand, 0.12),
        borderColor: brandTint(brand, 0.32),
      }}
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full font-extrabold',
          sm ? 'h-4 w-4 text-[10px]' : 'h-5 w-5 text-[11px]',
        )}
        // Ink colour tokenised — was a hardcoded `#0b0f19` near-black so a
        // palette change in `lib/brand.ts` had to be matched here in a second
        // place. `--c-on-brand` lives in `index.css` (one value per theme).
        style={{ backgroundColor: avatarColor, color: 'rgb(var(--c-on-brand))' }}
        aria-hidden
      >
        {letter}
      </span>
      {brand}
    </span>
  );
}
