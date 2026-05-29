import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Labeled input with hint/error/prefix/suffix. Preserves the legacy MVP
 * Input API (label, hint, error, required, prefix, suffix) so the ported
 * purchase wizard + sale form work unchanged — but styled with the new
 * token system. Default-exported as `Input` for drop-in compatibility.
 */
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const LabeledInput = forwardRef<HTMLInputElement, Props>(function LabeledInput(
  { label, hint, error, required, prefix, suffix, className = '', id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-label text-text-dim font-medium tracking-tight flex items-center gap-1"
        >
          {label}
          {required && (
            <span className="text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2 bg-bg2 rounded-xl border h-12 px-3.5 transition-colors',
          error ? 'border-danger' : 'border-border focus-within:border-accent',
        )}
      >
        {prefix && <span className="text-text-dim shrink-0">{prefix}</span>}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          className={cn(
            'flex-1 bg-transparent text-text text-body-lg font-medium outline-none placeholder:text-text-muted',
            className,
          )}
        />
        {suffix && <span className="shrink-0">{suffix}</span>}
      </div>
      {error ? (
        <span role="alert" className="text-hint text-danger animate-fade-in">
          {error}
        </span>
      ) : hint ? (
        <span className="text-hint text-text-muted">{hint}</span>
      ) : null}
    </div>
  );
});

export default LabeledInput;
