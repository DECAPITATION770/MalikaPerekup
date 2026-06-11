/**
 * Platform overview — at-a-glance health of the SaaS.
 *
 * Layout: 3 hero KPIs on top → split into a recent-shops table (2/3)
 * and a side column (1/3) with overdue alert + installments + login-
 * security cards. Full-width on desktop; collapses to a single column
 * on small screens.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight, Store as StoreIcon } from 'lucide-react';

import { getPlatformStats, getShops, getNasiyaOverdue } from '../api';
import { CardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { Badge } from '../components/ui/Badge';
import { fmtUZSCompact, planLabel } from '../lib/fmt';
import { cn } from '@/lib/utils';

function KpiTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const toneClass = {
    default: 'text-text',
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
  }[tone];
  return (
    <div className="card p-5 fia">
      <div className="text-hint font-medium tracking-tight text-text-muted">
        {label}
      </div>
      <div
        className={cn(
          'mt-2 text-display font-bold tabular-nums tracking-tight',
          toneClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();

  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: getPlatformStats,
    refetchInterval: 60_000,
  });
  const shops = useQuery({
    queryKey: ['shops', { limit: 6, offset: 0 }],
    queryFn: () => getShops({ limit: 6, offset: 0 }),
  });
  const overdue = useQuery({
    queryKey: ['nasiya-overdue'],
    queryFn: getNasiyaOverdue,
  });

  const s = stats.data;

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <header className="fia flex items-baseline justify-between">
        <h1 className="text-title font-bold tracking-tight">
          {t('dashboard.title')}
        </h1>
        {s && (
          <span className="text-hint text-text-muted">
            {t('dashboard.shops_active')}: {s.shops_active} / {s.shops_total}
          </span>
        )}
      </header>

      {/* Hero KPIs */}
      {stats.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : stats.isError ? (
        <div className="card">
          <QueryError onRetry={() => stats.refetch()} error={stats.error} inline />
        </div>
      ) : s ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiTile
            label={t('dashboard.shops_active')}
            value={`${s.shops_active} / ${s.shops_total}`}
            tone="success"
          />
          <KpiTile
            label={t('dashboard.shops_frozen')}
            value={s.shops_frozen}
            tone={s.shops_frozen > 0 ? 'danger' : 'default'}
          />
          <KpiTile
            label={t('dashboard.nasiya_overdue')}
            value={s.nasiya_overdue_count}
            tone={s.nasiya_overdue_count > 0 ? 'warning' : 'default'}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent shops — takes 2/3 on desktop */}
        <section className="card fia fia-2 lg:col-span-2">
          <header className="flex items-center justify-between border-b border-border px-5 pb-3 pt-4">
            <span className="text-hint font-semibold tracking-tight text-text-dim">
              {t('dashboard.recent_shops')}
            </span>
            <Link
              to="/shops"
              className="text-hint font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              {t('shops.title')} →
            </Link>
          </header>
          {shops.isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={3} />
              ))}
            </div>
          ) : shops.isError ? (
            <QueryError onRetry={() => shops.refetch()} error={shops.error} inline />
          ) : (
            <ul className="divide-y divide-border">
              {shops.data?.items.map((shop) => (
                <li key={shop.id}>
                  <Link
                    to={`/shops/${shop.id}`}
                    className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-faded text-label font-bold text-accent">
                      {shop.name[0]?.toUpperCase() ?? '·'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-label font-semibold text-text">
                        {shop.name}
                      </div>
                      <div className="truncate text-caption text-text-dim">
                        {shop.owner.full_name}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={shop.is_frozen ? 'danger' : 'success'} size="sm" dot>
                        {shop.is_frozen ? t('shops.frozen') : t('shops.active')}
                      </Badge>
                      <Badge variant="accent" size="sm">
                        {planLabel(shop.plan)}
                      </Badge>
                    </div>
                    <ChevronRight
                      size={14}
                      className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
              {shops.data?.items.length === 0 && (
                <li className="flex flex-col items-center gap-2 py-12 text-text-muted">
                  <StoreIcon size={20} className="opacity-50" aria-hidden />
                  <span className="text-hint">{t('shops.empty')}</span>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Right column */}
        <aside className="flex flex-col gap-4">
          {/* Overdue alert — only when there are overdue plans */}
          {(overdue.data?.length ?? 0) > 0 && (
            <Link
              to="/debts"
              className="card fia fia-3 group flex items-start gap-3 border-warning/30 bg-warning-faded p-4 transition-colors hover:bg-warning-faded/70"
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-hint font-bold text-warning">
                  {t('dashboard.overdue_alert_title')}
                </div>
                <div className="mt-0.5 text-caption text-warning/70">
                  {t('dashboard.overdue_alert_body', { count: overdue.data!.length })}
                </div>
              </div>
              <ChevronRight
                size={14}
                className="mt-1 shrink-0 text-warning transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          )}

          {/* Installments block */}
          {s && (
            <section className="card fia fia-4 p-5">
              <div className="mb-3 text-hint font-semibold tracking-tight text-text-dim">
                {t('dashboard.section_nasiya', 'Рассрочка')}
              </div>
              <div className="flex flex-col divide-y divide-border">
                {[
                  {
                    label: t('dashboard.active_plans'),
                    value: s.nasiya_active_count,
                    color: 'text-text',
                  },
                  {
                    label: t('dashboard.total_debt'),
                    value: fmtUZSCompact(s.nasiya_total_debt_uzs),
                    color: 'text-warning',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between py-2">
                    <span className="text-label text-text-dim">{label}</span>
                    <span className={cn('text-label font-bold tabular-nums', color)}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Security */}
          {s && (
            <Link
              to="/log"
              className="card fia fia-5 group flex items-center gap-3 p-5 transition-colors hover:bg-bg3"
            >
              <div className="flex-1">
                <div className="text-hint font-semibold tracking-tight text-text-dim">
                  {t('dashboard.security')}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={cn(
                      'text-title-sm font-bold tabular-nums tracking-tight',
                      s.failed_attempts_today > 0 ? 'text-danger' : 'text-success',
                    )}
                  >
                    {s.failed_attempts_today}
                  </span>
                  <span className="text-caption text-text-dim">
                    {t('dashboard.failed_logins_today')}
                  </span>
                </div>
              </div>
              <ChevronRight
                size={14}
                className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text"
                aria-hidden
              />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
