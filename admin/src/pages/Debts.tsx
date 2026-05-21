import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getNasiyaOverdue, getNasiyaActive } from '../api';
import Badge from '../components/ui/Badge';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtUZS, fmtDate, dueDateStatus } from '../lib/fmt';
import { useTranslation as useT } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Phone, Calendar } from 'lucide-react';

function CallButton({ phone }: { phone: string | null }) {
  const { t } = useT();
  if (!phone) return null;
  return (
    <a
      href={`tel:${phone.replace(/\s/g, '')}`}
      onClick={e => e.stopPropagation()}
      aria-label={t('debts.call_aria', { phone })}
      className="w-8 h-8 rounded-full bg-[#0F3F2A] hover:bg-[#155838] text-success flex items-center justify-center shrink-0 transition-colors cursor-pointer"
    >
      <Phone size={14} />
    </a>
  );
}

function DueDateChip({ iso }: { iso: string | null | undefined }) {
  const { t } = useT();
  const status = dueDateStatus(iso);
  if (!iso || !status) return <span className="text-xs text-text-dim">—</span>;
  const cfg = {
    today:    { kind: 'red' as const,    label: t('debts.due_today') },
    tomorrow: { kind: 'yellow' as const, label: t('debts.due_tomorrow') },
    overdue:  { kind: 'red' as const,    label: t('debts.due_overdue') },
    soon:     { kind: 'yellow' as const, label: fmtDate(iso) },
    normal:   null,
  }[status];
  if (!cfg) {
    return <span className="text-xs text-text-dim flex items-center gap-1.5"><Calendar size={12} />{fmtDate(iso)}</span>;
  }
  return <Badge kind={cfg.kind} size="sm" dot>{cfg.label}</Badge>;
}

export default function Debts() {
  const { t } = useTranslation();
  const overdue = useQuery({ queryKey: ['nasiya-overdue'], queryFn: getNasiyaOverdue });
  const active  = useQuery({ queryKey: ['nasiya-active'],  queryFn: getNasiyaActive });

  const totalOverdue = overdue.data?.reduce((s, r) => s + Number(r.amount_due), 0) ?? 0;
  const totalActive = active.data?.reduce((s, r) => s + Number(r.remaining), 0) ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 fia">
        <h1 className="text-2xl font-bold tracking-tight">{t('debts.title')}</h1>
      </div>

      {/* Two summary banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 fia fia-1">
        <div className="bg-[#3D1414] border border-[#7A2828] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#5A1E1E] flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-danger/80">{t('debts.tab_overdue')}</div>
            <div className="text-xl font-bold text-danger tabular-nums mt-1 truncate">{fmtUZS(totalOverdue)}</div>
            <div className="text-xs text-[#F26E5E]/60 mt-0.5">{t('debts.payments_count', { n: overdue.data?.length ?? 0 })}</div>
          </div>
        </div>

        <div className="bg-bg3 border border-border rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-faded flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">{t('debts.tab_active')}</div>
            <div className="text-xl font-bold tabular-nums mt-1 truncate">{fmtUZS(totalActive)}</div>
            <div className="text-xs text-text-dim mt-0.5">{t('debts.plans_count', { n: active.data?.length ?? 0 })}</div>
          </div>
        </div>
      </div>

      {/* Overdue table */}
      <section className="mb-8 fia fia-2">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-danger" />
          <h2 className="text-[13px] font-bold uppercase tracking-[0.6px] text-text-dim">
            {t('debts.tab_overdue')} {overdue.data && `· ${overdue.data.length}`}
          </h2>
        </div>
        <div className="bg-bg3 rounded-2xl border border-border overflow-hidden">
          {overdue.isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
            </div>
          ) : overdue.isError ? (
            <QueryError onRetry={() => overdue.refetch()} error={overdue.error} />
          ) : !overdue.data?.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-success">
              <CheckCircle2 size={28} className="opacity-50" />
              <span className="text-sm">{t('debts.overdue_empty')}</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1fr_120px_120px_140px_44px] gap-3 px-5 py-3 border-b border-border text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">
                <span>{t('debts.col_shop')}</span>
                <span>{t('debts.col_buyer')}</span>
                <span>{t('debts.col_device')}</span>
                <span>{t('debts.col_due_date')}</span>
                <span>{t('debts.col_days_overdue')}</span>
                <span>{t('debts.col_amount_due')}</span>
                <span/>
              </div>
              <div className="divide-y divide-border">
                {overdue.data.map(row => (
                  <div key={row.payment_id} className="grid grid-cols-[1fr_1fr_1fr_120px_120px_140px_44px] gap-3 px-5 py-3.5 items-center">
                    <Link to={`/shops/${row.shop_id}`} className="text-sm font-semibold text-accent hover:underline truncate">
                      {row.shop_name}
                    </Link>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{row.buyer_name}</div>
                      {row.buyer_phone && <div className="text-xs text-text-muted font-mono truncate">{row.buyer_phone}</div>}
                    </div>
                    <span className="text-sm text-text truncate">{row.device}</span>
                    <span className="text-xs text-text-dim font-mono">{fmtDate(row.due_date)}</span>
                    <Badge kind={row.days_overdue > 30 ? 'red' : 'yellow'} dot>
                      {row.days_overdue} {t('debts.days')}
                    </Badge>
                    <div className="text-sm font-bold text-danger tabular-nums truncate">{fmtUZS(row.amount_due)}</div>
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
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={16} className="text-accent" />
          <h2 className="text-[13px] font-bold uppercase tracking-[0.6px] text-text-dim">
            {t('debts.tab_active')} {active.data && `· ${active.data.length}`}
          </h2>
        </div>
        <div className="bg-bg3 rounded-2xl border border-border overflow-hidden">
          {active.isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
            </div>
          ) : active.isError ? (
            <QueryError onRetry={() => active.refetch()} error={active.error} />
          ) : !active.data?.length ? (
            <div className="text-center text-text-dim py-12 text-sm">{t('debts.empty')}</div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1fr_140px_150px_44px] gap-3 px-5 py-3 border-b border-border text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">
                <span>{t('debts.col_shop')}</span>
                <span>{t('debts.col_buyer')}</span>
                <span>{t('debts.col_device')}</span>
                <span>{t('debts.col_next_due')}</span>
                <span>{t('debts.col_remaining')}</span>
                <span/>
              </div>
              <div className="divide-y divide-border">
                {active.data.map(row => (
                  <div key={row.plan_id} className="grid grid-cols-[1fr_1fr_1fr_140px_150px_44px] gap-3 px-5 py-3.5 items-center">
                    <Link to={`/shops/${row.shop_id}`} className="text-sm font-semibold text-accent hover:underline truncate">
                      {row.shop_name}
                    </Link>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{row.buyer_name}</div>
                      {row.buyer_phone && <div className="text-xs text-text-muted font-mono truncate">{row.buyer_phone}</div>}
                    </div>
                    <span className="text-sm text-text truncate">{row.device}</span>
                    <DueDateChip iso={row.next_due_date} />
                    <span className="text-sm font-bold text-warning tabular-nums truncate">{fmtUZS(row.remaining)}</span>
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
