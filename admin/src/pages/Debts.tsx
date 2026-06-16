/**
 * Installment debts — two sections:
 *   • Overdue — past-due payments, sorted by days_overdue
 *   • Active — running plans with their next due date
 *
 * Each row links to the owning shop and exposes a one-tap `tel:` CTA on
 * the buyer's phone number.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Calendar, CheckCircle2, Phone } from 'lucide-react';

import { getNasiyaActive, getNasiyaOverdue } from '../api';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { dueDateStatus, fmtDate, fmtUZS } from '../lib/fmt';

function CallButton({ phone }: { phone: string | null }) {
  const { t } = useTranslation();
  if (!phone) return null;
  return (
    <a
      href={`tel:${phone.replace(/\s/g, '')}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={t('debts.call_aria', { phone })}
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-success-faded text-success transition-colors hover:bg-success-faded/70"
    >
      <Phone size={14} aria-hidden />
    </a>
  );
}

function DueDateChip({ iso }: { iso: string | null | undefined }) {
  const { t } = useTranslation();
  const status = dueDateStatus(iso);
  if (!iso || !status) return <span className="text-caption text-text-dim">—</span>;
  const cfg = {
    today: { variant: 'danger' as const, label: t('debts.due_today') },
    tomorrow: { variant: 'warning' as const, label: t('debts.due_tomorrow') },
    overdue: { variant: 'danger' as const, label: t('debts.due_overdue') },
    soon: { variant: 'warning' as const, label: fmtDate(iso) },
    normal: null,
  }[status];
  if (!cfg) {
    return (
      <span className="flex items-center gap-1.5 text-caption text-text-dim">
        <Calendar size={12} aria-hidden />
        {fmtDate(iso)}
      </span>
    );
  }
  return (
    <Badge variant={cfg.variant} size="sm" dot>
      {cfg.label}
    </Badge>
  );
}

function SectionHeader({
  icon: Icon,
  tone,
  label,
  count,
}: {
  icon: typeof AlertTriangle;
  tone: 'danger' | 'success';
  label: string;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon
        size={16}
        className={tone === 'danger' ? 'text-danger' : 'text-success'}
        aria-hidden
      />
      <h2 className="text-hint font-semibold tracking-tight text-text-dim">
        {label}
        {typeof count === 'number' && ` · ${count}`}
      </h2>
    </div>
  );
}

export default function Debts() {
  const { t } = useTranslation();
  const overdue = useQuery({ queryKey: ['nasiya-overdue'], queryFn: getNasiyaOverdue });
  const active = useQuery({ queryKey: ['nasiya-active'], queryFn: getNasiyaActive });

  const totalOverdue = overdue.data?.reduce((s, r) => s + Number(r.amount_due), 0) ?? 0;
  const totalActive = active.data?.reduce((s, r) => s + Number(r.remaining), 0) ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <header className="fia">
        <h1 className="text-title font-bold tracking-tight">{t('debts.title')}</h1>
      </header>

      {/* Summary banners */}
      <div className="fia fia-1 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex items-center gap-4 rounded-card border border-danger/30 bg-danger-faded px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/15">
            <AlertTriangle size={18} className="text-danger" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-hint font-semibold tracking-tight text-danger/80">
              {t('debts.tab_overdue')}
            </div>
            <div className="mt-1 truncate text-title-sm font-bold tabular-nums text-danger">
              {fmtUZS(totalOverdue)}
            </div>
            <div className="mt-0.5 text-caption text-danger/60">
              {t('debts.payments_count', { n: overdue.data?.length ?? 0 })}
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-4 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-faded">
            <CheckCircle2 size={18} className="text-accent" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-hint font-semibold tracking-tight text-text-muted">
              {t('debts.tab_active')}
            </div>
            <div className="mt-1 truncate text-title-sm font-bold tabular-nums">
              {fmtUZS(totalActive)}
            </div>
            <div className="mt-0.5 text-caption text-text-dim">
              {t('debts.plans_count', { n: active.data?.length ?? 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* Overdue table */}
      <section className="fia fia-2">
        <SectionHeader
          icon={AlertTriangle}
          tone="danger"
          label={t('debts.tab_overdue')}
          count={overdue.data?.length}
        />
        <div className="card overflow-hidden">
          {overdue.isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={6} />
              ))}
            </div>
          ) : overdue.isError ? (
            <QueryError onRetry={() => overdue.refetch()} error={overdue.error} />
          ) : !overdue.data?.length ? (
            <EmptyState icon={CheckCircle2} tone="success" label={t('debts.overdue_empty')} />
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1fr_120px_120px_140px_44px] gap-3 border-b border-border bg-bg3/50 px-5 py-2.5 text-caption font-semibold tracking-tight text-text-muted">
                <span>{t('debts.col_shop')}</span>
                <span>{t('debts.col_buyer')}</span>
                <span>{t('debts.col_device')}</span>
                <span>{t('debts.col_due_date')}</span>
                <span>{t('debts.col_days_overdue')}</span>
                <span>{t('debts.col_amount_due')}</span>
                <span />
              </div>
              <div className="divide-y divide-border">
                {overdue.data.map((row) => (
                  <div
                    key={row.payment_id}
                    className="grid grid-cols-[1fr_1fr_1fr_120px_120px_140px_44px] items-center gap-3 px-5 py-3"
                  >
                    <Link
                      to={`/shops/${row.shop_id}`}
                      className="truncate text-label font-semibold text-accent hover:underline"
                    >
                      {row.shop_name}
                    </Link>
                    <div className="min-w-0">
                      <div className="truncate text-label font-medium">{row.buyer_name}</div>
                      {row.buyer_phone && (
                        <div className="truncate font-mono text-caption text-text-muted">
                          {row.buyer_phone}
                        </div>
                      )}
                    </div>
                    <span className="truncate text-label text-text">{row.device}</span>
                    <span className="font-mono text-caption text-text-dim">
                      {fmtDate(row.due_date)}
                    </span>
                    <Badge variant={row.days_overdue > 30 ? 'danger' : 'warning'} dot>
                      {row.days_overdue} {t('debts.days')}
                    </Badge>
                    <div className="truncate text-label font-bold tabular-nums text-danger">
                      {fmtUZS(row.amount_due)}
                    </div>
                    <CallButton phone={row.buyer_phone} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Active plans */}
      <section className="fia fia-3">
        <SectionHeader
          icon={CheckCircle2}
          tone="success"
          label={t('debts.tab_active')}
          count={active.data?.length}
        />
        <div className="card overflow-hidden">
          {active.isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={5} />
              ))}
            </div>
          ) : active.isError ? (
            <QueryError onRetry={() => active.refetch()} error={active.error} />
          ) : !active.data?.length ? (
            <EmptyState label={t('debts.empty')} />
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1fr_140px_150px_44px] gap-3 border-b border-border bg-bg3/50 px-5 py-2.5 text-caption font-semibold tracking-tight text-text-muted">
                <span>{t('debts.col_shop')}</span>
                <span>{t('debts.col_buyer')}</span>
                <span>{t('debts.col_device')}</span>
                <span>{t('debts.col_next_due')}</span>
                <span>{t('debts.col_remaining')}</span>
                <span />
              </div>
              <div className="divide-y divide-border">
                {active.data.map((row) => (
                  <div
                    key={row.plan_id}
                    className="grid grid-cols-[1fr_1fr_1fr_140px_150px_44px] items-center gap-3 px-5 py-3"
                  >
                    <Link
                      to={`/shops/${row.shop_id}`}
                      className="truncate text-label font-semibold text-accent hover:underline"
                    >
                      {row.shop_name}
                    </Link>
                    <div className="min-w-0">
                      <div className="truncate text-label font-medium">{row.buyer_name}</div>
                      {row.buyer_phone && (
                        <div className="truncate font-mono text-caption text-text-muted">
                          {row.buyer_phone}
                        </div>
                      )}
                    </div>
                    <span className="truncate text-label text-text">{row.device}</span>
                    <DueDateChip iso={row.next_due_date} />
                    <span className="truncate text-label font-bold tabular-nums text-warning">
                      {fmtUZS(row.remaining)}
                    </span>
                    <CallButton phone={row.buyer_phone} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
