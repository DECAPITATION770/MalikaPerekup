import { ButtonHTMLAttributes, ReactNode } from 'react';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

const V: Record<Variant, string> = {
  primary:   'bg-accent hover:bg-accent-hover text-white shadow-glow-accent',
  secondary: 'bg-bg3 hover:bg-border text-text border border-border hover:border-border-strong',
  ghost:     'bg-transparent hover:bg-bg3 text-text-dim hover:text-text',
  danger:    'bg-danger hover:bg-danger/90 text-white',
  success:   'bg-success hover:bg-success/90 text-bg shadow-glow-success',
};

const S: Record<Size, string> = {
  sm: 'h-9 px-3 text-label',
  md: 'h-11 px-5 text-body',
  lg: 'h-12 px-6 text-body-lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`
        ${V[variant]} ${S[size]} ${full ? 'w-full' : ''}
        rounded-xl font-semibold tracking-tight
        flex items-center justify-center gap-2
        transition-all active:scale-[0.97]
        disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
        focus-ring cursor-pointer
        ${className}
      `}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  );
}
