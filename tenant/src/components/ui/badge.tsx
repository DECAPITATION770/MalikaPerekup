import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Badge base — sentence-case pill. Caps + `tracking-wider` previously gave
// every status row a 2003-admin-theme feel; with `font-semibold` and tight
// tracking the chip carries weight without screaming. `rounded-full` unifies
// with BrandBadge + the handmade chips so list rows stop mixing three radii.
// `whitespace-nowrap` is preserved — multi-line status labels still double row
// height in tight lists.
const badgeVariants = cva(
  'inline-flex items-center gap-1 font-semibold tracking-tight whitespace-nowrap rounded-full ring-1',
  {
    variants: {
      variant: {
        success: 'bg-success-faded text-success ring-success/30',
        warning: 'bg-warning-faded text-warning ring-warning/30',
        danger: 'bg-danger-faded text-danger ring-danger/30',
        accent: 'bg-accent-faded text-accent ring-accent/30',
        neutral: 'bg-bg3 text-text-dim ring-border',
        muted: 'bg-bg3/60 text-text-muted ring-border',
        outline: 'bg-transparent text-text-dim ring-border-strong',
      },
      size: {
        // Pill needs a touch more horizontal padding than the old `rounded-md`
        // shape to keep the text optically centred between the arcs.
        sm: 'px-2 py-0.5 text-micro',
        md: 'px-2.5 py-0.5 text-caption',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...rest }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...rest} />;
}

export { Badge, badgeVariants };
