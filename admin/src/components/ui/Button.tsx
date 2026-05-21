import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
  full?: boolean;
}

const variants = {
  primary:   'bg-accent hover:bg-accent-hover text-white',
  secondary: 'bg-bg2 hover:bg-bg3 text-text border border-border',
  ghost:     'bg-transparent hover:bg-bg2 text-accent',
  danger:    'bg-[#3D1414] hover:bg-[#4D1C1C] text-[#F26E5E] border border-[#7A2828]',
};
const sizes = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-12 px-4 text-[15px]',
  lg: 'h-14 px-5 text-base',
};

export default function Button({
  variant = 'primary', size = 'md', loading, children, full, disabled, className = '', ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-semibold
        transition-all active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-accent
        disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
        tracking-tight
        ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}
      `}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
      )}
      {children}
    </button>
  );
}
