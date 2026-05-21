import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPlatformStats, getShops, getNasiyaOverdue } from '../api';
import Badge from '../components/ui/Badge';
import { CardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtUZSCompact, planLabel } from '../lib/fmt';
import { AlertTriangle, ChevronRight } from 'lucide-react';

function KpiCard({ label, value, kind = 'default', delay = 0 }: {
  label: string; value: string | number; kind?: 'green' | 'red' | 'yellow' | 'default'; delay?: number;
}) {
  const colors = { green: 'text-success', red: 'text-danger', yellow: 'text-warning', default: 'text-text' };
  return (
    <div className="bg-bg3 rounded-2xl border border-border p-5 kpi-in" style={{ animationDelay: `${delay * 40}ms` }}>
      <div className="text-[11px] text-text-muted font-bold uppercase tracking-[0.6px] mb-2">{label}</div>
      <div className={`text-3xl font-bold tracking-tight tabular-nums ${colors[kind]}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();

  const stats = useQuery({ queryKey: ['stats'], queryFn: getPlatformStats, refetchInterval: 60_000 });
  const shops = useQuery({ queryKey: ['shops', { limit: 6, offset: 0 }], queryFn: () => getShops({ limit: 6, offset: 0 }) });
  const overdue = useQuery({ queryKey: ['nasiya-overdue'], queryFn: getNasiyaOverdue });

  const s = stats.data;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 fia">
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
      </div>

      {/* KPI grid */}
      {stats.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : stats.isError ? (
        <div className="bg-bg3 rounded-2xl border border-border mb-6">
          <QueryError onRetry={() => stats.refetch()} error={stats.error} inline />
        </div>
      ) : s ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <KpiCard label={t('dashboard.shops_active')} value={`${s.shops_active} / ${s.shops_total}`} kind="green" delay={0} />
          <KpiCard label={t('dashboard.shops_frozen')} value={s.shops_frozen} kind={s.shops_frozen > 0 ? 'red' : 'default'} delay={1} />
          <KpiCard label={t('dashboard.nasiya_overdue')} value={s.nasiya_overdue_count} kind={s.nasiya_overdue_count > 0 ? 'yellow' : 'default'} delay={2} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent shops */}
        <div className="lg:col-span-2 bg-bg3 rounded-2xl border border-border fia fia-2">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
            <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">{t('dashboard.recent_shops')}</span>
            <Link to="/shops" className="text-xs text-accent hover:text-accent-hover transition-colors font-semibold">
              {t('shops.title')} →
            </Link>
          </div>
          {shops.isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={3} />)}
            </div>
          ) : shops.isError ? (
            <QueryError onRetry={() => shops.refetch()} error={shops.error} inline />
          ) : (
            <div className="divide-y divide-border">
              {shops.data?.items.map(shop => (
                <Link key={shop.id} to={`/shops/${shop.id}`} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-bg2 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-accent-faded flex items-center justify-center text-accent font-bold text-sm shrink-0">
                    {shop.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text truncate">{shop.name}</div>
                    <div className="text-xs text-text-dim truncate">{shop.owner.full_name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge kind={shop.is_frozen ? 'red' : 'green'} size="sm" dot>
                      {shop.is_frozen ? t('shops.frozen') : t('shops.active')}
                    </Badge>
                    <Badge kind="blue" size="sm">{planLabel(shop.plan)}</Badge>
                  </div>
                  <ChevronRight size={14} className="text-text-muted shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Overdue alert */}
          {(overdue.data?.length ?? 0) > 0 && (
            <Link to="/debts" className="group bg-[#3F2F0A] border border-[#7A5C18] rounded-2xl p-4 flex items-start gap-3 hover:bg-[#4A3810] transition-colors fia fia-3">
              <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-warning">{t('dashboard.overdue_alert_title')}</div>
                <div className="text-xs text-[#F2C552]/70 mt-0.5">
                  {t('dashboard.overdue_alert_body', { count: overdue.data!.length })}
                </div>
              </div>
              <ChevronRight size={14} className="text-warning shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          {/* Nasiya block */}
          {s && (
            <div className="bg-bg3 rounded-2xl border border-border p-5 fia fia-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-1">Nasiya</div>
              <div className="flex flex-col divide-y divide-border">
                {[
                  { label: t('dashboard.active_plans'), value: s.nasiya_active_count, color: 'text-text' },
                  { label: t('dashboard.total_debt'), value: fmtUZSCompact(s.nasiya_total_debt_uzs), color: 'text-warning' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center py-2.5">
                    <span className="text-sm text-text-dim">{label}</span>
                    <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security */}
          {s && (
            <Link to="/log" className="group bg-bg3 rounded-2xl border border-border p-5 fia fia-5 hover:bg-bg2 transition-colors flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-1">{t('dashboard.security')}</div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-2xl font-bold tabular-nums tracking-tight ${s.failed_attempts_today > 0 ? 'text-danger' : 'text-success'}`}>
                    {s.failed_attempts_today}
                  </span>
                  <span className="text-xs text-text-dim">{t('dashboard.failed_logins_today')}</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-text-muted shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
