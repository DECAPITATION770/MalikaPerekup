/**
 * Platform statistics — three sections (shops / installments / security),
 * each with a tiny KPI strip and a deep-link to the corresponding page.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  CreditCard,
  RefreshCw,
  Shield,
  Store as StoreIcon,
} from 'lucide-react';

import { getPlatformStats } from '../api';
import { Button } from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtTime, fmtUZSCompact } from '../lib/fmt';
import { cn } from '@/lib/utils';

interface StatRowProps {
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'danger' | 'warning';
}

function StatRow({ label, value, tone = 'default' }: StatRowProps) {
  const color = {
    default: 'text-text',
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
  }[tone];
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-label text-text-dim">{label}</span>
      <span className={cn('text-subhead font-bold tabular-nums tracking-tight', color)}>
        {value}
      </span>
    </div>
  );
}

interface SegmentInfo {
  color: string;
  label: string;
  count: number;
}

function SegmentBar({ segments }: { segments: SegmentInfo[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-bg3">
        {segments.map(
          (s) =>
            s.count > 0 && (
              <div
                key={s.label}
                style={{ flex: s.count }}
                className={s.color}
                title={`${s.label}: ${s.count}`}
              />
            ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-caption">
            <span className={cn('size-2.5 shrink-0 rounded-sm', s.color)} aria-hidden />
            <span className="text-text-dim">{s.label}</span>
            <span className="font-bold tabular-nums text-text">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  to,
  linkLabel,
}: {
  icon: typeof StoreIcon;
  title: string;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-text-dim" aria-hidden />
        <span className="text-hint font-semibold tracking-tight text-text-dim">{title}</span>
      </div>
      {to && linkLabel && (
        <Link
          to={to}
          className="text-hint font-semibold text-accent transition-colors hover:text-accent-hover"
        >
          {linkLabel} →
        </Link>
      )}
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
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <header className="fia flex items-center justify-between">
        <div>
          <h1 className="text-title font-bold tracking-tight">{t('stats.title')}</h1>
          {dataUpdatedAt > 0 && (
            <p className="mt-1 text-caption text-text-muted">
              {t('stats.updated_at', {
                time: fmtTime(new Date(dataUpdatedAt).toISOString()),
              })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw
            size={13}
            className={isFetching ? 'animate-spin' : ''}
            aria-hidden
          />
          {t('common.refresh')}
        </Button>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <div className="card">
          <QueryError onRetry={() => refetch()} error={error} />
        </div>
      ) : !data ? null : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Shops — spans both columns on md+ */}
          <section className="card fia fia-1 p-5 md:col-span-2">
            <SectionHeader
              icon={StoreIcon}
              title={t('stats.section_shops')}
              to="/shops"
              linkLabel={t('stats.open_link')}
            />
            <div className="mb-4 text-display font-bold tabular-nums tracking-tight">
              {data.shops_total}
            </div>
            <SegmentBar
              segments={[
                { color: 'bg-success', label: t('stats.shops_paid'), count: data.shops_paid },
                { color: 'bg-warning', label: t('stats.shops_trial'), count: data.shops_trial },
                {
                  color: 'bg-text-muted',
                  label: t('stats.shops_frozen'),
                  count: data.shops_frozen,
                },
              ]}
            />
          </section>

          {/* Installments */}
          <section className="card fia fia-2 px-5 py-4">
            <SectionHeader
              icon={CreditCard}
              title={t('stats.section_nasiya', 'Рассрочка')}
              to="/debts"
              linkLabel={t('stats.open_link')}
            />
            <StatRow
              label={t('stats.nasiya_active')}
              value={data.nasiya_active_count}
              tone="success"
            />
            <StatRow
              label={t('stats.nasiya_overdue')}
              value={data.nasiya_overdue_count}
              tone={data.nasiya_overdue_count > 0 ? 'danger' : 'default'}
            />
            <StatRow
              label={t('stats.nasiya_debt')}
              value={fmtUZSCompact(data.nasiya_total_debt_uzs)}
              tone="warning"
            />
          </section>

          {/* Security */}
          <Link
            to="/log"
            className="card fia fia-3 group flex flex-col px-5 py-4 transition-colors hover:bg-bg3"
          >
            <SectionHeader icon={Shield} title={t('stats.section_security')} />
            <StatRow
              label={t('stats.failed_today')}
              value={data.failed_attempts_today}
              tone={
                data.failed_attempts_today > 10
                  ? 'danger'
                  : data.failed_attempts_today > 0
                    ? 'warning'
                    : 'success'
              }
            />
            <div className="mt-3 flex justify-end">
              <ChevronRight
                size={14}
                className="text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text"
                aria-hidden
              />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
