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
  /** Optional content rendered below the value (e.g. a sparkline). */
  footer?: React.ReactNode;
}

const defaultFmt = (n: number) =>
  Math.round(n)
    .toLocaleString('ru', { useGrouping: true })
    .replace(/\u00A0/g, ' ');

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
  footer,
}: Props) {
  const animated = useCountUp(loading ? 0 : value);
  const t = TONE[tone];
  const DeltaIcon = delta
    ? delta.dir === 'up'
      ? ArrowUp
      : delta.dir === 'down'
        ? ArrowDown
        : Minus
    : null;

  return (
    <div
      className="card group animate-fade-up p-5 transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong hover:bg-bg3 md:p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        {/* Sentence-case label — caps + tracking-wider read like a 2003 admin
            theme on a fintech surface. Tone colour already carries identity. */}
        <div className="text-label font-semibold tracking-tight text-text-dim">
          {label}
        </div>
        {icon && (
          <div className={cn('relative shrink-0', t.text)}>
            {/* Glow gated to dark theme — on a near-white surface
                `blur-xl bg-current opacity-25` painted as grey dust under
                the tile rather than as ambient light. We toggle off in
                light via `[.light_&]:hidden` because the project uses an
                explicit `.light` class on <html> (dark is the default,
                so Tailwind's `dark:` modifier doesn't fit the model). */}
            <span
              aria-hidden
              className="absolute inset-0 scale-125 rounded-full bg-current opacity-25 blur-xl transition-opacity group-hover:opacity-40 [.light_&]:hidden"
            />
            <div
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-110',
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
            {/* Tighter tracking + tabular-nums for stable money columns;
                the old `text-[32px]` magic is replaced by the existing
                `text-display` token (34 px) — visually indistinguishable
                but discoverable in the type scale. The display family
                (Geist Variable, loaded in index.css) carries the numerals
                — body text keeps the system font for crisp first paint. */}
            <span className="font-display text-title-lg font-semibold leading-none tracking-[-0.025em] tabular-nums md:text-display">
              {format(animated)}
            </span>
            {unit && <span className="text-body font-semibold text-text-muted">{unit}</span>}
          </>
        )}
      </div>

      {(delta || hint) && !loading && (
        <div className="mt-2.5 flex items-center gap-2 text-hint">
          {delta && DeltaIcon && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold tabular-nums',
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

      {footer && !loading && <div className="mt-3">{footer}</div>}
    </div>
  );
}
