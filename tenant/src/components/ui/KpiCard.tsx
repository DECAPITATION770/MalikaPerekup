import { ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export interface KpiDelta {
  dir: 'up' | 'down' | 'flat';
  pct?: number;  // absolute %, omitted when there's no baseline (yesterday = 0)
  label: string; // e.g. "vs вчера"
}

interface Props {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  loading?: boolean;
  delay?: number; // animation stagger (ms)
  delta?: KpiDelta;
}

const TONE: Record<Tone, { bg: string; text: string; ring: string }> = {
  accent:  { bg: 'bg-accent-faded',  text: 'text-accent',  ring: 'ring-accent/20' },
  success: { bg: 'bg-success-faded', text: 'text-success', ring: 'ring-success/20' },
  warning: { bg: 'bg-warning-faded', text: 'text-warning', ring: 'ring-warning/20' },
  danger:  { bg: 'bg-danger-faded',  text: 'text-danger',  ring: 'ring-danger/20' },
  neutral: { bg: 'bg-bg3',           text: 'text-text-dim',ring: 'ring-border' },
};

const DELTA_CLS = {
  up:   'text-success bg-success-faded',
  down: 'text-danger bg-danger-faded',
  flat: 'text-text-muted bg-bg3',
} as const;

export default function KpiCard({ label, value, unit, hint, icon, tone = 'neutral', loading, delay = 0, delta }: Props) {
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
          <div className={`relative shrink-0 ${t.text}`}>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-current blur-xl opacity-25 scale-125 transition-opacity group-hover:opacity-40"
            />
            <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center ${t.bg} ${t.text} ring-1 ${t.ring} transition-transform group-hover:scale-110`}>
              {icon}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        {loading ? (
          <div className="skeleton h-9 w-32 rounded-lg" />
        ) : (
          <>
            <span className="text-title-lg md:text-[32px] font-bold tracking-tight tabular-nums leading-none animate-count-up">
              {value}
            </span>
            {unit && <span className="text-sm font-semibold text-text-muted">{unit}</span>}
          </>
        )}
      </div>

      {(delta || hint) && !loading && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {delta && DeltaIcon && (
            <span className={`inline-flex items-center gap-0.5 font-bold tabular-nums px-1.5 py-0.5 rounded-md ${DELTA_CLS[delta.dir]}`}>
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
