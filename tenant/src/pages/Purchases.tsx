import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Calendar, Package as PackageIcon } from 'lucide-react';
import { listPurchases, type PurchaseOut } from '../api/purchases';
import { fmtDate, fmtUzs } from '../lib/fmt';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import Skeleton from '../components/ui/Skeleton';

const PAGE_SIZE = 20;

export default function Purchases() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const offset = Number(searchParams.get('offset') ?? '0');

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      value ? next.set(key, value) : next.delete(key);
      if (key !== 'offset') next.delete('offset');
      return next;
    }, { replace: true });
  };

  const query = useQuery({
    queryKey: ['purchases', from, to, offset],
    queryFn: () => listPurchases({
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
          <h1 className="text-title-lg md:text-display font-bold tracking-tight">{t('purchases.title')}</h1>
          {data && (
            <div className="text-sm text-text-dim mt-1 tabular-nums">
              {t('purchases.total', { n: data.total })}
            </div>
          )}
        </div>
        <Link to="/purchase/new">
          <Button icon={<ShoppingCart size={16} />} size="md">{t('today.action_purchase')}</Button>
        </Link>
      </header>

      <section className="card p-4 flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-hint text-text-dim font-medium">{t('purchases.filter_from')}</label>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setParam('from', e.target.value)}
            className="bg-bg2 rounded-xl border border-border px-3 h-11 text-body text-text outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-hint text-text-dim font-medium">{t('purchases.filter_to')}</label>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setParam('to', e.target.value)}
            className="bg-bg2 rounded-xl border border-border px-3 h-11 text-body text-text outline-none focus:border-accent transition-colors"
          />
        </div>
      </section>

      {query.isLoading && !data && <ListSkeleton />}
      {query.isError && (
        <QueryError
          status={(query.error as { response?: { status?: number } })?.response?.status}
          onRetry={() => query.refetch()}
        />
      )}
      {data && data.items.length === 0 && (
        <div className="card p-10 flex flex-col items-center text-center animate-fade-up">
          <div className="w-14 h-14 rounded-2xl bg-bg3 ring-1 ring-border text-text-muted flex items-center justify-center mb-4">
            <PackageIcon size={24} strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold mb-1">{t('purchases.empty_title')}</h3>
          <p className="text-sm text-text-dim max-w-xs mb-4 leading-relaxed">{t('purchases.empty_body')}</p>
          {!isFiltered && (
            <Link to="/purchase/new">
              <Button icon={<ShoppingCart size={16} />} size="md">{t('today.action_purchase')}</Button>
            </Link>
          )}
        </div>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((p, i) => <PurchaseRow key={p.id} p={p} delay={i * 30} />)}
          </ul>
          <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onChange={(o) => setParam('offset', String(o))} />
        </>
      )}
    </div>
  );
}

function PurchaseRow({ p, delay }: { p: PurchaseOut; delay: number }) {
  return (
    <li className="card hover:border-border-strong transition-all animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <Link to={`/stock/${p.device_id}`} className="p-3 md:p-4 flex items-center gap-4 block rounded-2xl">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-bg3 ring-1 ring-border text-text-muted flex items-center justify-center">
          <ShoppingCart size={18} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-bold tracking-tight truncate">
              {p.device_brand || p.device_model
                ? `${p.device_brand ?? ''} ${p.device_model ?? ''}`.trim()
                : p.seller_name}
            </span>
            <span className="text-caption text-text-muted flex items-center gap-1 shrink-0">
              <Calendar size={11} />{fmtDate(p.purchase_date)}
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
          <Skeleton w={44} h={44} rounded="xl" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton w="55%" h={14} />
            <Skeleton w="35%" h={11} />
          </div>
          <Skeleton w={88} h={20} />
        </li>
      ))}
    </ul>
  );
}
