import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { BadgeDollarSign, ChevronRight, Calendar, Package as PackageIcon } from 'lucide-react';
import { listSales, type SaleOut, type SaleType } from '../api/sales';
import { fmtDate, fmtUzs } from '../lib/fmt';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const PAGE_SIZE = 50;
const TYPE_KEYS: (SaleType | 'all')[] = ['all', 'cash', 'nasiya'];

const STATUS_TONE: Record<SaleOut['status'], 'success' | 'danger' | 'muted'> = {
  active: 'success', returned: 'danger', cancelled: 'muted',
};

export default function Sales() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const rawType = searchParams.get('type');
  const filter: SaleType | 'all' = TYPE_KEYS.includes(rawType as SaleType | 'all') ? (rawType as SaleType | 'all') : 'all';

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      value ? next.set(key, value) : next.delete(key);
      return next;
    }, { replace: true });
  };

  const query = useQuery({
    queryKey: ['sales', from, to, filter],
    queryFn: () => listSales({
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
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-title-lg md:text-display font-bold tracking-tight">{t('sales.title')}</h1>
          {data && (
            <div className="text-sm text-text-dim mt-1 tabular-nums">
              {t('sales.total', { n: data.total })}
            </div>
          )}
        </div>
        <Link to="/sale/new">
          <Button icon={<BadgeDollarSign size={16} />} size="md">{t('today.action_sale')}</Button>
        </Link>
      </header>

      <section className="card p-4 flex flex-col gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-hint text-text-dim font-medium">{t('purchases.filter_from')}</label>
            <input type="date" value={from} max={to || undefined}
              onChange={(e) => setParam('from', e.target.value)}
              className="bg-bg2 rounded-xl border border-border px-3 h-11 text-body text-text outline-none focus:border-accent transition-colors" />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-hint text-text-dim font-medium">{t('purchases.filter_to')}</label>
            <input type="date" value={to} min={from || undefined}
              onChange={(e) => setParam('to', e.target.value)}
              className="bg-bg2 rounded-xl border border-border px-3 h-11 text-body text-text outline-none focus:border-accent transition-colors" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {TYPE_KEYS.map((k) => (
            <button key={k} type="button" onClick={() => setParam('type', k === 'all' ? '' : k)}
              className={`h-9 px-4 rounded-lg border text-label font-semibold transition-all cursor-pointer
                ${filter === k ? 'bg-accent-faded border-accent/40 text-accent' : 'bg-bg2 border-border text-text-dim hover:border-border-strong'}`}>
              {k === 'all' ? t('sales.filter_all') : t(`sale.${k}`)}
            </button>
          ))}
        </div>
      </section>

      {query.isLoading && !data && <p className="text-text-dim text-center py-8">{t('common.loading')}</p>}
      {data && data.items.length === 0 && (
        <div className="card p-10 flex flex-col items-center text-center animate-fade-up">
          <div className="w-14 h-14 rounded-2xl bg-bg3 ring-1 ring-border text-text-muted flex items-center justify-center mb-4">
            <PackageIcon size={24} strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold mb-1">{t('sales.empty_title')}</h3>
          <p className="text-sm text-text-dim max-w-xs mb-4 leading-relaxed">{t('sales.empty_body')}</p>
          {!isFiltered && (
            <Link to="/sale/new">
              <Button icon={<BadgeDollarSign size={16} />} size="md">{t('today.action_sale')}</Button>
            </Link>
          )}
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.items.map((s, i) => <SaleRow key={s.id} s={s} delay={i * 30} />)}
        </ul>
      )}
    </div>
  );
}

function SaleRow({ s, delay }: { s: SaleOut; delay: number }) {
  const { t } = useTranslation();
  return (
    <li className="card hover:border-border-strong transition-all animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <Link to={`/stock/${s.device_id}`} className="p-3 md:p-4 flex items-center gap-4 block rounded-2xl">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-bg3 ring-1 ring-border text-text-muted flex items-center justify-center">
          <BadgeDollarSign size={18} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-bold tracking-tight truncate">
              {s.device_brand || s.device_model
                ? `${s.device_brand ?? ''} ${s.device_model ?? ''}`.trim()
                : s.buyer_name}
            </span>
            <Badge tone={s.sale_type === 'nasiya' ? 'accent' : 'neutral'} size="sm">
              {t(`sale.${s.sale_type}`)}
            </Badge>
            {s.status !== 'active' && (
              <Badge tone={STATUS_TONE[s.status]} size="sm">
                {t(`sales.status_${s.status}`)}
              </Badge>
            )}
            <span className="text-caption text-text-muted flex items-center gap-1 shrink-0">
              <Calendar size={11} />{fmtDate(s.sale_date)}
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
