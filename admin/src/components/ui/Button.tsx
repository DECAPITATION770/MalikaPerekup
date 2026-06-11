import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Admin button — shadcn-style cva primitive on top of admin design tokens.
 *
 * Variants:
 *   primary   filled accent (default CTA)
 *   secondary outlined surface (cancel, alt actions)
 *   ghost     transparent text-only
 *   danger    destructive
 *   outline   secondary with stronger border (used in QueryError, filters)
 *   link      anchor-style text accent
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight ' +
    'transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ' +
    'active:scale-[0.98] whitespace-nowrap select-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
        secondary:
          'border border-border bg-bg2 text-text hover:bg-bg3 hover:border-border-strong',
        ghost: 'bg-transparent text-text-dim hover:bg-bg3 hover:text-text',
        danger: 'bg-danger text-white hover:bg-danger/90',
        outline:
          'border border-border-strong bg-transparent text-text hover:bg-bg3',
        link:
          'bg-transparent text-accent underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3 text-label',
        md: 'h-11 px-4 text-label',
        lg: 'h-12 px-5 text-body',
        icon: 'h-10 w-10',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      full,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, full }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
