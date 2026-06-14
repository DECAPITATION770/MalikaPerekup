/**
 * ListRow — the single primitive for every "row in a list" surface
 * (counterparties, sales, purchases, catalog, …).
 *
 * It owns the *chrome* so density is identical everywhere: the card surface,
 * padding, gap, the ~44px leading tile slot, the elastic content area, the
 * trailing slot, the optional full-height left accent edge, and the
 * link/button/plain polymorphism. Screens supply only the *content*.
 *
 * Before this, every list page hand-rolled `card flex … p-3|p-4|px-4 py-2.5`
 * with slightly different paddings and tile sizes — which is exactly the
 * "no unified skeleton" inconsistency the partner flagged.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

type Accent = 'danger' | 'accent';

interface ListRowProps {
  /** Render the whole row as a router Link. */
  to?: string;
  /** Render as a button when there's no `to`. */
  onClick?: () => void;
  /** Full-height left edge accent (e.g. debtors). */
  accent?: Accent;
  /** ~44px leading tile (avatar / icon / photo). */
  leading?: ReactNode;
  /** Right-aligned slot: amount, action button, chevron, … */
  trailing?: ReactNode;
  /** Elastic content area (title + meta). */
  children: ReactNode;
  className?: string;
}

const ACCENT_BG: Record<Accent, string> = {
  danger: 'bg-danger',
  accent: 'bg-accent',
};

export function ListRow({ to, onClick, accent, leading, trailing, children, className }: ListRowProps) {
  // One density for every list in the app. `overflow-hidden` clips the accent
  // edge to the card's rounded corners so it reads as a painted edge.
  const base = cn(
    'card relative flex items-center gap-3 overflow-hidden px-4 py-3 text-left transition-all',
    (to || onClick) && 'hover:border-border-strong active:scale-[0.998]',
    className,
  );

  const inner = (
    <>
      {accent && (
        <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', ACCENT_BG[accent])} />
      )}
      {leading != null && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing != null && <div className="shrink-0">{trailing}</div>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={base}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, 'w-full cursor-pointer')}>
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}
