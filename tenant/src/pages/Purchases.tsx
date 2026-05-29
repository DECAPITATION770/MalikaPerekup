/**
 * Purchases — date-filtered history of buy deals. Phase 3 port: shadcn
 * Input[type=date] range, shared Pagination, EmptyState, Skeleton.
 */
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronRight, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyStockIllustration } from '@/components/illustrations';
import { listPurchases, type PurchaseOut } from '@/api/purchases';
import { fmtDate, fmtUzs } from '@/lib/fmt';
import { useTgHaptic } from '@/lib/telegram';

const PAGE_SIZE = 20;

export default function Purchases() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const haptic = useTgHaptic();

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const offset = Number(searchParams.get('offset') ?? '0');

  const setParam = (key: string, value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'offset') next.delete('offset');
        return next;
      },
      { replace: true },
    );

  const query = useQuery({
    queryKey: ['purchases', from, to, offset],
    queryFn: () =>
      listPurchases({
        from: from || undefined,
        to: to || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const isFiltered = Boolean(from || to);

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-title-lg md:text-display font-bold tracking-tight">
            {t('purchases.title')}
          </h1>
          {data && (
            <div className="text-body text-text-dim mt-1 tabular-nums">
              {t('purchases.total', { n: data.total })}
            </div>
          )}
        </div>
        <Link to="/purchase/new" onClick={() => haptic.select()}>
          <Button>
            <ShoppingCart className="size-4" />
            {t('today.action_purchase')}
          </Button>
        </Link>
      </header>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <Label htmlFor="from">{t('purchases.filter_from')}</Label>
            <Input
              id="from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setParam('from', e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <Label htmlFor="to">{t('purchases.filter_to')}</Label>
            <Input
              id="to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setParam('to', e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </Card>

      {query.isLoading && !data && <ListSkeleton />}
      {query.isError && (
        <EmptyState
          title={t('common.error_load')}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          illustration={<EmptyStockIllustration />}
          title={t('purchases.empty_title')}
          description={t('purchases.empty_body')}
          action={
            !isFiltered && (
              <Link to="/purchase/new">
                <Button>
                  <ShoppingCart className="size-4" />
                  {t('today.action_purchase')}
                </Button>
              </Link>
            )
          }
        />
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((p, i) => (
              <PurchaseRow key={p.id} p={p} delay={i * 30} />
            ))}
          </ul>
          <Pagination
            total={data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={(o) => setParam('offset', String(o))}
          />
        </>
      )}
    </div>
  );
}

function PurchaseRow({ p, delay }: { p: PurchaseOut; delay: number }) {
  const deviceLabel =
    p.device_brand || p.device_model
      ? `${p.device_brand ?? ''} ${p.device_model ?? ''}`.trim()
      : p.seller_name;
  return (
    <li
      className="card hover:border-border-strong transition-all animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Link
        to={`/stock/${p.device_id}`}
        className="p-3 md:p-4 flex items-center gap-4 rounded-card"
      >
        <div className="w-11 h-11 shrink-0 rounded-xl bg-bg3 ring-1 ring-border text-text-muted flex items-center justify-center">
          <ShoppingCart size={18} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-bold tracking-tight truncate">{deviceLabel}</span>
            <span className="text-caption text-text-muted flex items-center gap-1 shrink-0">
              <Calendar size={11} />
              {fmtDate(p.purchase_date)}
            </span>
          </div>
          <div className="text-caption text-text-muted truncate">
            <span className="text-text-dim">{p.seller_name}</span>
            {p.device_imei && <span className="font-mono"> · IMEI {p.device_imei}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-body-lg font-bold tabular-nums">{fmtUzs(p.price_uzs)}</div>
          <div className="text-micro text-text-muted">UZS</div>
        </div>
        <ChevronRight size={16} className="text-text-muted shrink-0" />
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="card p-3 md:p-4 flex items-center gap-4">
          <Skeleton className="size-11 rounded-xl" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-[55%]" />
            <Skeleton className="h-3 w-[35%]" />
          </div>
          <Skeleton className="h-5 w-[88px]" />
        </li>
      ))}
    </ul>
  );
}
