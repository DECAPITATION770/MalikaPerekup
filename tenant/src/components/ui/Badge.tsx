import { ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'muted';

const TONE: Record<Tone, string> = {
  success: 'bg-success-faded text-success ring-success/30',
  warning: 'bg-warning-faded text-warning ring-warning/30',
  danger:  'bg-danger-faded text-danger ring-danger/30',
  accent:  'bg-accent-faded text-accent ring-accent/30',
  neutral: 'bg-bg3 text-text-dim ring-border',
  muted:   'bg-bg3/60 text-text-muted ring-border',
};

export default function Badge({
  tone = 'neutral',
  children,
  size = 'md',
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-micro' : 'px-2 py-0.5 text-caption';
  return (
    <span className={`inline-flex items-center gap-1 ${px} font-bold uppercase tracking-wider rounded-md ring-1 ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}
