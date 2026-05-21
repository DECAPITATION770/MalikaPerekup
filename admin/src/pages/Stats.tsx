import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getPlatformStats } from '../api';
import { CardSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtUZSCompact, fmtTime } from '../lib/fmt';
import { RefreshCw, ChevronRight, Store, Shield, CreditCard } from 'lucide-react';

interface StatRowProps {
  label: string;
  value: string | number;
  kind?: 'default' | 'green' | 'red' | 'yellow';
}

function StatRow({ label, value, kind = 'default' }: StatRowProps) {
  const color = { default: 'text-text', green: 'text-success', red: 'text-danger', yellow: 'text-warning' }[kind];
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-text-dim">{label}</span>
      <span className={`text-[17px] font-bold tracking-tight tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

interface SegmentInfo { color: string; label: string; count: number }

function SegmentBar({ segments }: { segments: SegmentInfo[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="h-2 rounded-full overflow-hidden flex bg-bg2 mb-3">
        {segments.map(s => s.count > 0 && (
          <div
            key={s.label}
            style={{ flex: s.count }}
            className={s.color}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.color} shrink-0`} />
            <span className="text-text-dim">{s.label}</span>
            <span className="font-bold tabular-nums text-text">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Stats() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['stats'],
    queryFn: getPlatformStats,
    refetchInterval: 60_000,
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 fia">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('stats.title')}</h1>
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-text-muted mt-1">
              {t('stats.updated_at', { time: fmtTime(new Date(dataUpdatedAt).toISOString()) })}
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover disabled:opacity-50 font-semibold transition-colors cursor-pointer h-9 px-3 rounded-lg border border-border hover:border-accent"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : isError ? (
        <div className="bg-bg3 rounded-2xl border border-border">
          <QueryError onRetry={() => refetch()} error={error} />
        </div>
      ) : !data ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-bg3 rounded-2xl border border-border p-5 fia fia-1 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Store size={14} className="text-text-dim" />
                <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">{t('stats.section_shops')}</span>
              </div>
              <Link to="/shops" className="text-xs text-accent hover:text-accent-hover transition-colors font-semibold">
                {t('stats.open_link')} →
              </Link>
            </div>
            <div className="text-4xl font-bold tracking-tight tabular-nums mb-4">{data.shops_total}</div>
            <SegmentBar
              segments={[
                { color: 'bg-success', label: t('stats.shops_paid'), count: data.shops_paid },
                { color: 'bg-warning', label: t('stats.shops_trial'), count: data.shops_trial },
                { color: 'bg-text-muted', label: t('stats.shops_frozen'), count: data.shops_frozen },
              ]}
            />
          </div>

          <div className="bg-bg3 rounded-2xl border border-border px-5 py-4 fia fia-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-text-dim" />
                <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">{t('stats.section_nasiya')}</span>
              </div>
              <Link to="/debts" className="text-xs text-accent hover:text-accent-hover transition-colors font-semibold">
                {t('stats.open_link')} →
              </Link>
            </div>
            <StatRow label={t('stats.nasiya_active')} value={data.nasiya_active_count} kind="green" />
            <StatRow label={t('stats.nasiya_overdue')} value={data.nasiya_overdue_count} kind={data.nasiya_overdue_count > 0 ? 'red' : 'default'} />
            <StatRow label={t('stats.nasiya_debt')} value={fmtUZSCompact(data.nasiya_total_debt_uzs)} kind="yellow" />
          </div>

          <Link to="/log" className="group bg-bg3 rounded-2xl border border-border px-5 py-4 fia fia-3 hover:bg-bg2 transition-colors flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-text-dim" />
                <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">{t('stats.section_security')}</span>
              </div>
              <ChevronRight size={14} className="text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
            </div>
            <StatRow
              label={t('stats.failed_today')}
              value={data.failed_attempts_today}
              kind={data.failed_attempts_today > 10 ? 'red' : data.failed_attempts_today > 0 ? 'yellow' : 'green'}
            />
          </Link>
        </div>
      )}
    </div>
  );
}
