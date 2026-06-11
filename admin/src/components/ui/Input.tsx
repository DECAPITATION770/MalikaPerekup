import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Admin Input — wrapped variant with optional label/hint/error/left adornment.
 *
 * Kept as a composite component (not a bare shadcn Input + separate Label) so
 * existing pages can keep their `<Input label="..." error={...}>` API.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Helper text shown below the field when there is no error. */
  hint?: string;
  /** Validation error text (red). Overrides `hint` while present. */
  error?: string;
  /** Adornment rendered inside the input on the left (e.g. "@"). */
  left?: React.ReactNode;
  /** Mark the field with a red asterisk in the label. */
  required?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, left, required, id, type = 'text', ...rest }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const hasError = !!error;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="flex items-center gap-1 text-hint font-medium tracking-tight text-text-dim"
          >
            {label}
            {required && (
              <span className="text-danger" aria-hidden>
                *
              </span>
            )}
          </label>
        )}
        <div
          className={cn(
            'flex h-11 w-full items-center gap-2 rounded-lg border bg-bg2 px-3 transition-colors',
            'focus-within:ring-2 focus-within:ring-accent/30',
            hasError
              ? 'border-danger focus-within:border-danger'
              : 'border-border focus-within:border-accent',
          )}
        >
          {left && <span className="shrink-0 text-text-muted">{left}</span>}
          <input
            ref={ref}
            id={inputId}
            type={type}
            aria-invalid={hasError || undefined}
            aria-describedby={hint || error ? `${inputId}-help` : undefined}
            className={cn(
              'flex-1 bg-transparent text-label font-medium text-text outline-none placeholder:text-text-muted',
              'disabled:cursor-not-allowed disabled:opacity-60',
              className,
            )}
            {...rest}
          />
        </div>
        {(error || hint) && (
          <span
            id={`${inputId}-help`}
            role={hasError ? 'alert' : undefined}
            className={cn(
              'text-caption leading-tight',
              hasError ? 'text-danger' : 'text-text-muted',
            )}
          >
            {error || hint}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
export default Input;
