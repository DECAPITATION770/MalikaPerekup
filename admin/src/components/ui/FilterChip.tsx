import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface Props {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function FilterChip({ active, danger, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-label font-semibold tracking-tight transition-colors',
        active
          ? danger
            ? 'border-danger bg-danger text-white'
            : 'border-accent bg-accent text-accent-fg'
          : 'border-border bg-bg2 text-text-dim hover:border-border-strong hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

export default FilterChip;
