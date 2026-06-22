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
