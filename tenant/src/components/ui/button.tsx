import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-xl font-semibold tracking-tight',
    'transition-all active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-60',
    'outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-accent hover:bg-accent-hover text-[rgb(var(--c-on-accent))] shadow-glow-accent',
        secondary:
          'bg-bg3 hover:bg-border text-text border border-border hover:border-border-strong',
        ghost: 'bg-transparent hover:bg-bg3 text-text-dim hover:text-text',
        // text-bg = page background colour → in dark theme that's dark text
        // on the bright coral, in light theme light text on the darker red.
        // Either way it clears WCAG AA, unlike fixed white-on-coral (~2.9:1).
        danger: 'bg-danger hover:bg-danger/90 text-bg',
        success: 'bg-success hover:bg-success/90 text-bg shadow-glow-success',
        outline:
          'bg-transparent border border-border-strong text-text hover:bg-bg3',
        link: 'bg-transparent text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-label',
        md: 'h-11 px-5 text-body',
        lg: 'h-12 px-6 text-body-lg',
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
  /** Convenience leading icon (rendered before children). Equivalent to
   *  putting an <svg> as the first child — kept for ergonomic call sites. */
  icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, asChild = false, loading = false, icon, disabled, children, ...rest }, ref) => {
    const Comp = asChild ? Slot : 'button';
    // With asChild, Radix Slot requires exactly one child element — don't
    // inject loader/icon siblings in that mode.
    if (asChild) {
      return (
        <Comp
          ref={ref}
          className={cn(buttonVariants({ variant, size, full }), className)}
          disabled={disabled || loading}
          {...rest}
        >
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, full }), className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <Loader2 className="animate-spin" /> : icon}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
