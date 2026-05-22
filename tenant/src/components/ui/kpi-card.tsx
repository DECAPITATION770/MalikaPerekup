import * as React from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/lib/useCountUp';
import { Skeleton } from '@/components/ui/skeleton';

type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<Tone, { bg: string; text: string; ring: string }> = {
  accent: { bg: 'bg-accent-faded', text: 'text-accent', ring: 'ring-accent/20' },
  success: { bg: 'bg-success-faded', text: 'text-success', ring: 'ring-success/20' },
  warning: { bg: 'bg-warning-faded', text: 'text-warning', ring: 'ring-warning/20' },
  danger: { bg: 'bg-danger-faded', text: 'text-danger', ring: 'ring-danger/20' },
  neutral: { bg: 'bg-bg3', text: 'text-text-dim', ring: 'ring-border' },
};

export interface KpiDelta {
  dir: 'up' | 'down' | 'flat';
  pct?: number;
  label: string;
}

const DELTA_CLS = {
  up: 'text-success bg-success-faded',
  down: 'text-danger bg-danger-faded',
  flat: 'text-text-muted bg-bg3',
} as const;

interface Props {
  label: string;
  /** Numeric target — animated. Pair with `format` to render UZS, percent, etc. */
  value: number;
  /** Renderer for the (animating) `value`. Defaults to `n.toLocaleString('ru')`. */
  format?: (n: number) => string;
  unit?: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  /** Mount-time stagger, ms. */
  delay?: number;
  delta?: KpiDelta;
}

const defaultFmt = (n: number) =>
  Math.round(n).toLocaleString('ru', { useGrouping: true }).replace(/ /g, ' ');

export function KpiCard({
  label,
  value,
  format = defaultFmt,
  unit,
  hint,
  icon,
  tone = 'neutral',
  loading,
  delay = 0,
  delta,
}: Props) {
  const animated = useCountUp(loading ? 0 : value);
  const t = TONE[tone];
  const DeltaIcon = delta ? (delta.dir === 'up' ? ArrowUp : delta.dir === 'down' ? ArrowDown : Minus) : null;

  return (
    <div
      className="card p-5 md:p-6 transition-all hover:border-border-strong hover:bg-bg3 group animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="text-label font-semibold text-text-dim tracking-tight uppercase">{label}</div>
        {icon && (
          <div className={cn('relative shrink-0', t.text)}>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-current blur-xl opacity-25 scale-125 transition-opacity group-hover:opacity-40"
            />
            <div
              className={cn(
                'relative w-9 h-9 rounded-xl flex items-center justify-center ring-1 transition-transform group-hover:scale-110',
                t.bg,
                t.text,
                t.ring,
              )}
            >
              {icon}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-9 w-32" />
        ) : (
          <>
            <span className="text-title-lg md:text-[32px] font-bold tracking-tight tabular-nums leading-none">
              {format(animated)}
            </span>
            {unit && <span className="text-sm font-semibold text-text-muted">{unit}</span>}
          </>
        )}
      </div>

      {(delta || hint) && !loading && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {delta && DeltaIcon && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-bold tabular-nums px-1.5 py-0.5 rounded-md',
                DELTA_CLS[delta.dir],
              )}
            >
              <DeltaIcon size={11} strokeWidth={2.6} />
              {delta.pct !== undefined && `${delta.pct}%`}
            </span>
          )}
          {(delta?.label || hint) && (
            <span className="text-text-muted">{delta ? delta.label : hint}</span>
          )}
        </div>
      )}
    </div>
  );
}
