/**
 * FilterChip — the single pill-button for filter bars (Shops plans/frozen,
 * AuthLog source/result, …). Before this each page hand-rolled its own
 * `chipBase` and they drifted: Shops used h-9/text-label, AuthLog h-8/text-hint,
 * so the same filter bar looked different per page. One height, one text size,
 * optional leading icon (gap is always reserved), and a `danger` active tone
 * for destructive filters like «only frozen».
 */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface Props {
  active?: boolean;
  /** Active state paints red instead of brass (e.g. «only frozen» / «failed»). */
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
