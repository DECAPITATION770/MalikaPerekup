import { useState, useMemo, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, X, ShoppingCart, Smartphone, Tablet, Laptop, Watch, Headphones,
  Package as PackageIcon, ChevronRight, SlidersHorizontal, type LucideIcon,
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import {
  listDevices, DeviceCategory, DeviceStatus, type DeviceWithPurchaseOut,
} from '../api/devices';
import { useDebounced } from '../lib/useDebounced';
import { fmtUzs } from '../lib/fmt';
import { specsSummary } from '../lib/specsFmt';
import Skeleton from '../components/ui/Skeleton';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import Button from '../components/ui/Button';

const STATUSES: DeviceStatus[] = ['in_stock', 'reserved', 'sold', 'returned', 'written_off'];
const CATEGORIES: DeviceCategory[] = ['phone', 'tablet', 'laptop', 'smartwatch', 'accessory', 'other'];

const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone, tablet: Tablet, laptop: Laptop, smartwatch: Watch,
  accessory: Headphones, other: PackageIcon,
};

const STATUS_TONE: Record<DeviceStatus, 'success' | 'warning' | 'muted' | 'danger' | 'neutral'> = {
  in_stock: 'success', reserved: 'warning', sold: 'muted', returned: 'danger', written_off: 'neutral',
};

const CONDITION_TONE: Record<DeviceWithPurchaseOut['condition'], 'success' | 'accent' | 'warning' | 'danger'> = {
  new: 'success', good: 'accent', normal: 'warning', broken: 'danger',
};

const PAGE_SIZE = 20;

export default function Stock() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [inputQ, setInputQ] = useState(() => searchParams.get('q') ?? '');
  const debouncedQ = useDebounced(inputQ.trim(), 300);

  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      debouncedQ ? next.set('q', debouncedQ) : next.delete('q');
      next.delete('offset');
      return next;
    }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const rawStatus = searchParams.get('status');
  const status: DeviceStatus | undefined =
    rawStatus === 'all' ? undefined : ((rawStatus as DeviceStatus) ?? 'in_stock');

  const rawCategory = searchParams.get('category');
  const category: DeviceCategory | undefined = rawCategory ? (rawCategory as DeviceCategory) : undefined;
  const offset = Number(searchParams.get('offset') ?? '0');

  const setStatus = (val: DeviceStatus | undefined) =>
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('status', val === undefined ? 'all' : val);
      next.delete('offset');
      return next;
    }, { replace: true });

  const setCategory = (val: DeviceCategory | undefined) =>
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      val ? next.set('category', val) : next.delete('category');
      next.delete('offset');
      return next;
    }, { replace: true });

  const setOffset = (val: number) =>
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      val ? next.set('offset', String(val)) : next.delete('offset');
      return next;
    }, { replace: true });

  const clearQ = () => {
    setInputQ('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      next.delete('offset');
      return next;
    }, { replace: true });
  };

  const query = useQuery({
    queryKey: ['devices', { q: debouncedQ, status, category, offset }],
    queryFn: () => listDevices({
      q: debouncedQ || undefined,
      status, category,
      limit: PAGE_SIZE, offset,
    }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const isFiltered = useMemo(
    () => Boolean(debouncedQ) || status !== 'in_stock' || category !== undefined,
    [debouncedQ, status, category],
  );

  const reset = () => {
    setInputQ('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // Сколько активных нестандартных фильтров (для бэйджа на мобильной кнопке).
  // ``status === 'in_stock'`` — дефолт, его не считаем «активным».
  const activeFilterCount =
    (status !== undefined && status !== 'in_stock' ? 1 : 0) + (category !== undefined ? 1 : 0);

  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* Header */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-title-lg md:text-display font-bold tracking-tight">{t('stock.title')}</h1>
          {data && (
            <div className="text-sm text-text-dim mt-1 tabular-nums">
              {isFiltered
                ? t('stock.found', { n: data.total, total: data.total })
                : t('stock.total', { n: data.total })}
            </div>
          )}
        </div>
        <Link to="/purchase/new">
          <Button icon={<ShoppingCart size={16} />} size="md">{t('today.action_purchase')}</Button>
        </Link>
      </header>

      {/* Mobile: только поиск + кнопка «Фильтры» с бэйджем */}
      <div className="md:hidden flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-bg2 rounded-xl border border-border focus-within:border-accent transition-colors h-11 px-3.5">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            placeholder={t('stock.search_placeholder')}
            className="flex-1 bg-transparent outline-none text-body placeholder:text-text-muted"
            spellCheck={false}
          />
          {inputQ && (
            <button onClick={clearQ} className="text-text-muted hover:text-text p-0.5 cursor-pointer" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="relative h-11 w-11 shrink-0 rounded-xl bg-bg2 border border-border hover:border-border-strong flex items-center justify-center transition-colors cursor-pointer"
          aria-label={t('stock.open_filters')}
        >
          <SlidersHorizontal size={18} className="text-text-dim" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-white text-[10px] font-bold leading-[16px] text-center tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile: chips активных фильтров (только если что-то выбрано) */}
      {(status !== 'in_stock' || category) && (
        <div className="md:hidden flex flex-wrap items-center gap-1.5">
          {status !== 'in_stock' && (
            <ActiveFilterChip
              label={status === undefined ? t('stock.filter_all_status') : t(`status.${status}`)}
              onClear={() => setStatus('in_stock')}
            />
          )}
          {category && (
            <ActiveFilterChip
              label={t(`category.${category}`)}
              onClear={() => setCategory(undefined)}
            />
          )}
          {isFiltered && (
            <button
              onClick={reset}
              className="text-xs text-text-muted hover:text-text transition-colors flex items-center gap-1 cursor-pointer ml-auto"
            >
              <X size={12} /> {t('stock.filter_reset')}
            </button>
          )}
        </div>
      )}

      {/* Desktop: фильтры как были */}
      <section className="hidden md:flex card p-4 flex-col gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-2 bg-bg rounded-xl border border-border focus-within:border-accent transition-colors h-11 px-3.5">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            placeholder={t('stock.search_placeholder')}
            className="flex-1 bg-transparent outline-none text-body placeholder:text-text-muted"
            spellCheck={false}
          />
          {inputQ && (
            <button onClick={clearQ} className="text-text-muted hover:text-text transition-colors p-0.5 cursor-pointer" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={status === undefined} onClick={() => setStatus(undefined)}>
            {t('stock.filter_all_status')}
          </Chip>
          {STATUSES.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {t(`status.${s}`)}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={category === undefined} onClick={() => setCategory(undefined)}>
            {t('stock.filter_all_category')}
          </Chip>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            return (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                <Icon size={12} strokeWidth={2} />
                {t(`category.${c}`)}
              </Chip>
            );
          })}
          {isFiltered && (
            <button
              onClick={reset}
              className="ml-auto text-xs text-text-muted hover:text-text transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X size={12} /> {t('stock.filter_reset')}
            </button>
          )}
        </div>
      </section>

      {/* Mobile filter drawer */}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} size="md" title={t('stock.filters_title')}>
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-label text-text-dim font-medium tracking-tight mb-2">{t('stock.filter_status')}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip active={status === undefined} onClick={() => setStatus(undefined)}>{t('stock.filter_all_status')}</Chip>
              {STATUSES.map((s) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{t(`status.${s}`)}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="text-label text-text-dim font-medium tracking-tight mb-2">{t('stock.filter_category')}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip active={category === undefined} onClick={() => setCategory(undefined)}>{t('stock.filter_all_category')}</Chip>
              {CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c];
                return (
                  <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                    <Icon size={12} strokeWidth={2} />
                    {t(`category.${c}`)}
                  </Chip>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" full onClick={() => { reset(); setFiltersOpen(false); }}>
              {t('stock.filter_reset')}
            </Button>
            <Button full onClick={() => setFiltersOpen(false)}>{t('common.close')}</Button>
          </div>
        </div>
      </Modal>

      {/* Body */}
      {query.isLoading && !data && <DeviceTableSkeleton />}
      {query.isError && (
        <QueryError
          status={(query.error as { response?: { status?: number } })?.response?.status}
          onRetry={() => query.refetch()}
        />
      )}
      {data && data.items.length === 0 && (
        <EmptyState filtered={isFiltered} onReset={reset} />
      )}
      {data && data.items.length > 0 && (
        <>
          <DeviceTable items={data.items} />
          <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}

// ─── Responsive table: <table> on md+, stacked card-row on mobile ──────

function DeviceTable({ items }: { items: DeviceWithPurchaseOut[] }) {
  const { t } = useTranslation();
  return (
    <div className="card overflow-hidden">
      {/* Desktop: real <table> with sticky header */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-caption text-text-muted font-semibold tracking-wider uppercase border-b border-border bg-bg2/60 sticky top-0">
            <tr>
              <th className="px-4 py-3 w-2/5">{t('stock.col_device')}</th>
              <th className="px-3 py-3">{t('stock.col_specs')}</th>
              <th className="px-3 py-3">{t('stock.col_condition')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('stock.col_price')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('stock.col_days')}</th>
              <th className="px-3 py-3">{t('stock.col_status')}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((d, i) => (
              <DeviceRowDesktop key={d.id} d={d} delay={i * 20} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: each device a compact 2-row layout in a tappable list */}
      <ul className="md:hidden divide-y divide-border">
        {items.map((d, i) => (
          <DeviceRowMobile key={d.id} d={d} delay={i * 20} />
        ))}
      </ul>
    </div>
  );
}

function DeviceRowDesktop({ d }: { d: DeviceWithPurchaseOut; delay: number }) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICON[d.category];
  const photo = d.photos[0];
  const specs = specsSummary(d.category, d.specs);

  // No animate-fade-up here — translateY on <tr> breaks table layout.
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bg2 transition-colors">
      <td className="px-4 py-3">
        <Link to={`/stock/${d.id}`} className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-bg3 ring-1 ring-border flex items-center justify-center text-text-muted overflow-hidden">
            {photo
              ? <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <Icon size={20} strokeWidth={1.6} />}
          </div>
          <div className="min-w-0">
            <div className="text-body font-bold tracking-tight truncate">
              {d.brand} {d.model}
            </div>
            <div className="text-caption text-text-muted font-mono truncate">
              {d.imei ?? d.serial ?? '—'}
            </div>
          </div>
        </Link>
      </td>
      <td className="px-3 py-3 text-caption text-text-dim">
        {specs || <span className="text-text-muted">—</span>}
      </td>
      <td className="px-3 py-3">
        <Badge tone={CONDITION_TONE[d.condition]} size="sm">{t(`condition.${d.condition}`)}</Badge>
      </td>
      <td className="px-3 py-3 text-right tabular-nums font-bold text-text whitespace-nowrap">
        {d.purchase_price_uzs ? fmtUzs(d.purchase_price_uzs) : <span className="text-text-muted font-normal">—</span>}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-text-dim whitespace-nowrap">
        {d.days_in_stock != null ? t('stock.days_n', { n: d.days_in_stock }) : '—'}
      </td>
      <td className="px-3 py-3">
        <Badge tone={STATUS_TONE[d.status]} size="sm">{t(`status.${d.status}`)}</Badge>
      </td>
      <td className="px-3 py-3 text-right">
        <Link to={`/stock/${d.id}`} aria-label={t('stock.open')} className="text-text-muted hover:text-text transition-colors inline-flex">
          <ChevronRight size={16} />
        </Link>
      </td>
    </tr>
  );
}

function DeviceRowMobile({ d, delay }: { d: DeviceWithPurchaseOut; delay: number }) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICON[d.category];
  const photo = d.photos[0];
  const specs = specsSummary(d.category, d.specs);

  return (
    <li className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <Link to={`/stock/${d.id}`} className="p-3 flex items-center gap-3">
        <div className="w-12 h-12 shrink-0 rounded-xl bg-bg3 ring-1 ring-border flex items-center justify-center text-text-muted overflow-hidden">
          {photo
            ? <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
            : <Icon size={20} strokeWidth={1.6} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-body font-bold tracking-tight truncate">{d.brand} {d.model}</h3>
            <Badge tone={STATUS_TONE[d.status]} size="sm">{t(`status.${d.status}`)}</Badge>
          </div>
          <div className="text-caption text-text-muted font-mono truncate mt-0.5">
            {d.imei ?? d.serial ?? '—'}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-caption flex-wrap">
            {specs && <span className="text-text-dim">{specs}</span>}
            {d.purchase_price_uzs && (
              <span className="text-text font-bold tabular-nums">{fmtUzs(d.purchase_price_uzs)}</span>
            )}
            {d.days_in_stock != null && (
              <span className="text-text-muted tabular-nums">· {t('stock.days_n', { n: d.days_in_stock })}</span>
            )}
            <Badge tone={CONDITION_TONE[d.condition]} size="sm">{t(`condition.${d.condition}`)}</Badge>
          </div>
        </div>
        <ChevronRight size={16} className="text-text-muted shrink-0" />
      </Link>
    </li>
  );
}

function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full border border-accent/40 bg-accent-faded text-accent text-caption font-semibold tracking-tight">
      {label}
      <button onClick={onClear} className="text-accent/70 hover:text-accent p-0.5 cursor-pointer" aria-label="Remove filter">
        <X size={12} />
      </button>
    </span>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-full border text-hint font-semibold tracking-tight transition-all flex items-center gap-1.5 cursor-pointer
        ${active
          ? 'bg-accent-faded border-accent/40 text-accent'
          : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
    >
      {children}
    </button>
  );
}

function DeviceTableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="hidden md:block">
        <div className="px-4 py-3 border-b border-border bg-bg2/60">
          <Skeleton w="60%" h={12} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-border last:border-b-0 flex items-center gap-3">
            <Skeleton w={44} h={44} rounded="xl" />
            <Skeleton w="20%" h={14} />
            <Skeleton w="12%" h={14} />
            <Skeleton w={64} h={18} rounded="md" />
            <div className="ml-auto flex gap-3">
              <Skeleton w={80} h={14} />
              <Skeleton w={40} h={14} />
              <Skeleton w={64} h={18} rounded="md" />
            </div>
          </div>
        ))}
      </div>
      <ul className="md:hidden divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="p-3 flex items-center gap-3">
            <Skeleton w={48} h={48} rounded="xl" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton w="60%" h={14} />
              <Skeleton w="40%" h={11} />
              <div className="flex gap-1.5">
                <Skeleton w={80} h={14} />
                <Skeleton w={50} h={18} rounded="md" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="card p-10 flex flex-col items-center text-center animate-fade-up">
      <div className="w-14 h-14 rounded-2xl bg-bg3 ring-1 ring-border text-text-muted flex items-center justify-center mb-4">
        <PackageIcon size={24} strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold mb-1">
        {filtered ? t('stock.empty_filtered') : t('stock.empty')}
      </h3>
      {filtered ? (
        <button
          onClick={onReset}
          className="mt-3 text-sm text-accent hover:text-accent-hover font-semibold cursor-pointer"
        >
          {t('stock.filter_reset')}
        </button>
      ) : (
        <>
          <p className="text-sm text-text-dim max-w-xs mb-4 leading-relaxed">{t('stock.encourage')}</p>
          <Link to="/purchase/new">
            <Button icon={<ShoppingCart size={16} />} size="md">{t('today.action_purchase')}</Button>
          </Link>
        </>
      )}
    </div>
  );
}
