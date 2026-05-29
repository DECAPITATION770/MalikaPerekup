import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Standard empty-state card. Centralises spacing/copy patterns so every
 * list page reads consistently (Stock, Sales, Installments, Search,
 * Counterparties — all eat this same component).
 */
export function EmptyState({ illustration, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        'card flex flex-col items-center text-center px-6 py-10 gap-4 animate-fade-up',
        className,
      )}
    >
      {illustration}
      <div className="space-y-1">
        <h3 className="text-body-xl font-bold tracking-tight text-text">{title}</h3>
        {description && (
          <p className="text-body text-text-dim leading-relaxed max-w-sm mx-auto">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
