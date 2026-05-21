import type { InputHTMLAttributes, ReactNode } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  left?: ReactNode;
  right?: ReactNode;
  required?: boolean;
}

export default function Input({ label, error, hint, left, right, required, className = '', ...rest }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] text-text-dim font-medium tracking-tight flex items-center gap-1">
          {label}
          {required && <span className="text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <div className={`flex items-center gap-2 bg-bg2 rounded-xl border px-3.5 h-12 ${error ? 'border-danger' : 'border-border'} focus-within:border-accent transition-colors`}>
        {left && <span className="text-text-dim shrink-0">{left}</span>}
        <input
          aria-invalid={!!error}
          aria-required={required}
          className={`flex-1 bg-transparent text-text text-[15px] font-medium outline-none placeholder:text-text-muted ${className}`}
          {...rest}
        />
        {right && <span className="text-text-dim shrink-0">{right}</span>}
      </div>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
      {hint && !error && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}
