/**
 * Sales — date + type filtered history of sell deals. Phase 3 port:
 * shadcn date inputs, shadcn Tabs for cash/nasiya, Badge for sale-type +
 * status, EmptyState.
 */
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { BadgeDollarSign, Calendar, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoSalesIllustration } from '@/components/illustrations';
import { listSales, type SaleOut, type SaleType } from '@/api/sales';
import { fmtDate, fmtUzs } from '@/lib/fmt';
import { useTgHaptic } from '@/lib/telegram';

const PAGE_SIZE = 50;
const TYPE_KEYS: (SaleType | 'all')[] = ['all', 'cash', 'nasiya'];

const STATUS_VARIANT: Record<SaleOut['status'], 'success' | 'danger' | 'muted'> = {
  active: 'success',
  returned: 'danger',
  cancelled: 'muted',
};

export default function Sales() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const haptic = useTgHaptic();

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const rawType = searchParams.get('type');
  const filter: SaleType | 'all' = TYPE_KEYS.includes(rawType as SaleType | 'all')
    ? (rawType as SaleType | 'all')
    : 'all';

  const setParam = (key: string, value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const query = useQuery({
    queryKey: ['sales', from, to, filter],
    queryFn: () =>
      listSales({
        from: from || undefined,
        to: to || undefined,
        type: filter === 'all' ? undefined : filter,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const isFiltered = Boolean(from || to || filter !== 'all');

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* Header — mobile gets a compact inline title + count strip; desktop
          keeps the larger heading + side CTA. Matches the sticky-filter idiom
          rolled out across list pages (Stock first, Sales here). */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 md:hidden">
        <h1 className="font-display text-title font-semibold tracking-[-0.03em]">
          {t('sales.title')}
        </h1>
        {data && (
          <span className="text-body tabular-nums text-text-dim">
            · {t('sales.total', { n: data.total })}
          </span>
        )}
      </div>
      <header className="hidden items-end justify-between gap-3 flex-wrap md:flex">
        <div>
          <h1 className="font-display text-title-lg md:text-display font-semibold tracking-[-0.03em]">
            {t('sales.title')}
          </h1>
          {data && (
            <div className="text-body text-text-dim mt-1 tabular-nums">
              {t('sales.total', { n: data.total })}
            </div>
          )}
        </div>
        {/* Hide the header CTA when the list is empty — the EmptyState below
            renders the same green CTA in the empty card. Two identical
            «Оформить продажу» buttons on a blank page just doubled visual
            noise. Once there's at least one sale, the header CTA returns. */}
        {!(data && data.items.length === 0 && !isFiltered) && (
          <Link to="/sale/new" onClick={() => haptic.select()}>
            <Button variant="success">
              <BadgeDollarSign className="size-4" />
              {t('today.action_sale')}
            </Button>
          </Link>
        )}
      </header>

      <Card className="p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <Label htmlFor="from">{t('purchases.filter_from')}</Label>
            <Input
              id="from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setParam('from', e.target.value)}
              // Date filters aren't credentials — password managers offering
              // to autofill them is pure noise.
              autoComplete="off"
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
              autoComplete="off"
              className="h-11"
            />
          </div>
        </div>
        <Tabs value={filter} onValueChange={(v) => setParam('type', v === 'all' ? '' : v)}>
          <TabsList>
            <TabsTrigger value="all">{t('sales.filter_all')}</TabsTrigger>
            <TabsTrigger value="cash">{t('sale.cash')}</TabsTrigger>
            <TabsTrigger value="nasiya">{t('sale.nasiya')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {query.isLoading && !data && (
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
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          illustration={<NoSalesIllustration />}
          title={t('sales.empty_title')}
          description={t('sales.empty_body')}
          action={
            !isFiltered && (
              <Link to="/sale/new">
                <Button variant="success">
                  <BadgeDollarSign className="size-4" />
                  {t('today.action_sale')}
                </Button>
              </Link>
            )
          }
        />
      )}
      {data && data.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.items.map((s, i) => (
            <SaleRow key={s.id} s={s} delay={i * 30} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SaleRow({ s, delay }: { s: SaleOut; delay: number }) {
  const { t } = useTranslation();
  const deviceLabel =
    s.device_brand || s.device_model
      ? `${s.device_brand ?? ''} ${s.device_model ?? ''}`.trim()
      : s.buyer_name;
  return (
    <li
      className="card hover:border-border-strong transition-all animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Link to={`/stock/${s.device_id}`} className="p-3 md:p-4 flex items-center gap-4 rounded-card">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-bg3 ring-1 ring-border text-text-muted flex items-center justify-center">
          <BadgeDollarSign size={18} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-bold tracking-tight truncate">{deviceLabel}</span>
            <Badge variant={s.sale_type === 'nasiya' ? 'accent' : 'neutral'} size="sm">
              {t(`sale.${s.sale_type}`)}
            </Badge>
            {s.status !== 'active' && (
              <Badge variant={STATUS_VARIANT[s.status]} size="sm">
                {t(`sales.status_${s.status}`)}
              </Badge>
            )}
            <span className="text-caption text-text-muted flex items-center gap-1 shrink-0">
              {/* lucide icons read poorly below ~14px — bumped from 11. */}
              <Calendar size={14} aria-hidden />
              {fmtDate(s.sale_date)}
            </span>
          </div>
          <div className="text-caption text-text-muted truncate">
            <span className="text-text-dim">{s.buyer_name}</span>
            {s.device_imei && <span className="font-mono"> · IMEI {s.device_imei}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-body-lg font-bold tabular-nums">{fmtUzs(s.sale_price_uzs)}</div>
          <div className="text-micro text-text-muted">UZS</div>
        </div>
        <ChevronRight size={16} className="text-text-muted shrink-0" />
      </Link>
    </li>
  );
}
