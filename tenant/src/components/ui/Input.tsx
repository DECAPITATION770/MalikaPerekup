import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, required, prefix, suffix, className = '', id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-label text-text-dim font-medium tracking-tight flex items-center gap-1">
          {label}
          {required && <span className="text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <div className={`
        flex items-center gap-2 bg-bg2 rounded-xl border h-12 px-3.5 transition-colors
        ${error ? 'border-danger' : 'border-border focus-within:border-accent'}
      `}>
        {prefix && <span className="text-text-dim shrink-0">{prefix}</span>}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          className={`flex-1 bg-transparent text-text text-body-lg font-medium outline-none placeholder:text-text-muted ${className}`}
        />
        {suffix && <span className="shrink-0">{suffix}</span>}
      </div>
      {error ? (
        <span role="alert" className="text-xs text-danger animate-fade-in">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-muted">{hint}</span>
      ) : null}
    </div>
  );
});

export default Input;
