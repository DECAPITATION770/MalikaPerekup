import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-md ring-1',
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
        sm: 'px-1.5 py-0.5 text-micro',
        md: 'px-2 py-0.5 text-caption',
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
