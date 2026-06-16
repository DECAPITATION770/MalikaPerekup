/**
 * EmptyState — the single "no rows" placeholder for list/table cards. Before
 * this every page rolled its own: Shops/Users had an icon + py-16, Debts and
 * AuthLog were plain text + py-12, so empty tables sat at different heights
 * with/without an icon. One layout: optional icon, label, optional action.
 * `tone="success"` is the celebratory variant (e.g. «no overdue debts»).
 */
import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface Props {
  icon?: ElementType;
  label: string;
  tone?: 'default' | 'success';
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, label, tone = 'default', action }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 py-16 text-center',
        tone === 'success' ? 'text-success' : 'text-text-dim',
      )}
    >
      {Icon && <Icon size={28} className="opacity-50" aria-hidden />}
      <span className="text-label">{label}</span>
      {action}
    </div>
  );
}

export default EmptyState;
