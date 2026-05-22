/**
 * CounterpartyDetail — hero card + buy/sell totals + merged chronological
 * deal timeline. Phase 3 port: shadcn Badge + Avatar + Skeleton, haptic
 * on contact taps.
 */
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BadgeDollarSign,
  Calendar,
  ChevronRight,
  Phone,
  Send,
  ShoppingCart,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getCounterpartyDeals } from '@/api/counterparties';
import type { PurchaseOut } from '@/api/purchases';
import type { SaleOut } from '@/api/sales';
import { fmtDate, fmtUzs } from '@/lib/fmt';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

type DealEvent =
  | { kind: 'purchase'; date: string; ref: PurchaseOut }
  | { kind: 'sale'; date: string; ref: SaleOut };

const TYPE_VARIANT = {
  seller: 'accent',
  buyer: 'success',
  both: 'neutral',
} as const;

export default function CounterpartyDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const haptic = useTgHaptic();

  const q = useQuery({
    queryKey: ['counterparty-deals', Number(id)],
    queryFn: () => getCounterpartyDeals(Number(id!)),
    enabled: Boolean(id),
    retry: false,
  });

  const BackLink = (
    <Link
      to="/counterparties"
      className="flex items-center gap-1.5 text-text-dim hover:text-text transition-colors text-label font-semibold w-fit"
    >
      <ArrowLeft size={16} /> {t('counterparties.back')}
    </Link>
  );

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-5 animate-fade-up max-w-2xl">
        {BackLink}
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="flex flex-col gap-5 animate-fade-up max-w-2xl">
        {BackLink}
        <EmptyState
          title={t('common.error_load')}
          action={
            <Button variant="secondary" onClick={() => q.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const { counterparty: cp, purchases, sales } = q.data;

  const events: DealEvent[] = [
    ...purchases.map((p) => ({ kind: 'purchase' as const, date: p.purchase_date, ref: p })),
    ...sales.map((s) => ({ kind: 'sale' as const, date: s.sale_date, ref: s })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const initials =
    cp.full_name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="flex flex-col gap-5 animate-fade-up max-w-2xl">
      {BackLink}

      {/* Hero */}
      <div className="card p-5 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="size-12 rounded-2xl">
            <AvatarFallback className="bg-bg3 text-text-dim rounded-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-title font-bold tracking-tight">{cp.full_name}</h1>
              <Badge variant={TYPE_VARIANT[cp.type]} size="sm">
                {t(`counterparties.type_${cp.type}`)}
              </Badge>
            </div>
            {cp.phone && (
              <div className="flex items-center gap-1.5 mt-1 text-label text-text-dim">
                <Phone size={13} />
                <span className="font-mono">{cp.phone}</span>
              </div>
            )}
            {cp.doc_type && cp.doc_number && (
              <div className="text-caption text-text-muted mt-1">
                {t(`purchase.doc_type.${cp.doc_type}`, { defaultValue: cp.doc_type })}:{' '}
                <span className="font-mono">{cp.doc_number}</span>
              </div>
            )}
            {cp.comment && (
              <p className="text-caption text-text-dim mt-2 leading-relaxed">{cp.comment}</p>
            )}
          </div>
        </div>

        {(cp.phone || cp.tg_username) && (
          <div className="flex gap-2">
            {cp.phone && (
              <a
                href={`tel:${cp.phone}`}
                onClick={() => haptic.tap('light')}
                className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-bg3 border border-border text-label font-bold hover:border-border-strong active:scale-[0.98] transition-all focus-ring"
              >
                <Phone size={16} className="text-success" />
                {t('installments.call')}
              </a>
            )}
            {cp.tg_username && (
              <a
                href={`https://t.me/${cp.tg_username.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => haptic.tap('light')}
                className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-accent-faded border border-accent/40 text-accent text-label font-bold hover:bg-accent/20 active:scale-[0.98] transition-all focus-ring"
              >
                <Send size={15} />
                {t('installments.write_tg')}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<ShoppingCart size={14} />}
          label={t('purchases.title')}
          n={purchases.length}
          sum={purchases.reduce((acc, p) => acc + Number(p.price_uzs || 0), 0)}
        />
        <StatTile
          icon={<BadgeDollarSign size={14} />}
          label={t('sales.title')}
          n={sales.length}
          sum={sales.reduce((acc, s) => acc + Number(s.sale_price_uzs || 0), 0)}
        />
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-dim">{t('counterparties.no_deals')}</p>
        </div>
      ) : (
        <div className="card p-5 flex flex-col gap-3">
          <h2 className="text-body-lg font-bold tracking-tight">
            {t('counterparties.deals_history')}
          </h2>
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <DealRow key={`${e.kind}-${e.ref.id}`} e={e} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  n,
  sum,
}: {
  icon: React.ReactNode;
  label: string;
  n: number;
  sum: number;
}) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-text-dim">
        {icon}
        <span className="text-caption font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-title-sm font-bold tabular-nums">{n}</div>
      <div className="text-caption text-text-muted tabular-nums">{fmtUzs(sum)} UZS</div>
    </div>
  );
}

function DealRow({ e }: { e: DealEvent }) {
  const deviceLabel = [e.ref.device_brand, e.ref.device_model].filter(Boolean).join(' ').trim();
  const partyName = e.kind === 'purchase' ? e.ref.seller_name : e.ref.buyer_name;
  const amount = e.kind === 'purchase' ? e.ref.price_uzs : e.ref.sale_price_uzs;
  const Icon = e.kind === 'purchase' ? ShoppingCart : BadgeDollarSign;
  return (
    <li>
      <Link
        to={`/stock/${e.ref.device_id}`}
        className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-bg3 transition-colors"
      >
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center ring-1 shrink-0',
            e.kind === 'purchase'
              ? 'text-accent bg-accent-faded ring-accent/30'
              : 'text-success bg-success-faded ring-success/30',
          )}
        >
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-label font-semibold tracking-tight truncate">
            {deviceLabel || partyName}
          </div>
          <div className="text-caption text-text-muted flex items-center gap-1">
            <Calendar size={11} />
            {fmtDate(e.date)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-label font-bold tabular-nums">{fmtUzs(amount)}</div>
          <div className="text-micro text-text-muted">UZS</div>
        </div>
        <ChevronRight size={14} className="text-text-muted shrink-0" />
      </Link>
    </li>
  );
}
