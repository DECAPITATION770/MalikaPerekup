/**
 * Stock — витрина: responsive table (desktop) / list (mobile) with
 * debounced search, URL-sync'd filters (status × category), keepPrevious
 * pagination, vaul drawer for mobile filters.
 *
 * Phase 3 port: shadcn Table + shadcn Badge + shadcn Input + EmptyState
 * + EmptyStockIllustration. Mobile filter drawer is now `vaul` instead
 * of the old Modal hack.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Headphones,
  Laptop,
  Package as PackageIcon,
  Search as SearchIcon,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Tablet,
  Watch,
  X,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { EmptyStockIllustration } from '@/components/illustrations';

import {
  listDevices,
  type DeviceCategory,
  type DeviceCondition,
  type DeviceStatus,
  type DeviceWithPurchaseOut,
} from '@/api/devices';
import { useDebounced } from '@/lib/useDebounced';
import { fmtUzs } from '@/lib/fmt';
import { specsSummary } from '@/lib/specsFmt';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

const STATUSES: DeviceStatus[] = ['in_stock', 'reserved', 'sold', 'returned', 'written_off'];
const CATEGORIES: DeviceCategory[] = [
  'phone',
  'tablet',
  'laptop',
  'smartwatch',
  'accessory',
  'other',
];

const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  accessory: Headphones,
  other: PackageIcon,
};

const STATUS_VARIANT: Record<
  DeviceStatus,
  'success' | 'warning' | 'muted' | 'danger' | 'neutral'
> = {
  in_stock: 'success',
  reserved: 'warning',
  sold: 'muted',
  returned: 'danger',
  written_off: 'neutral',
};

const CONDITION_VARIANT: Record<
  DeviceCondition,
  'success' | 'accent' | 'warning' | 'danger'
> = {
  new: 'success',
  good: 'accent',
  normal: 'warning',
  broken: 'danger',
};

const PAGE_SIZE = 20;

export default function Stock() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const haptic = useTgHaptic();

  const [inputQ, setInputQ] = useState(() => searchParams.get('q') ?? '');
  const debouncedQ = useDebounced(inputQ.trim(), 300);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedQ) next.set('q', debouncedQ);
        else next.delete('q');
        next.delete('offset');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const rawStatus = searchParams.get('status');
  const status: DeviceStatus | undefined =
    rawStatus === 'all' ? undefined : ((rawStatus as DeviceStatus) ?? 'in_stock');

  const rawCategory = searchParams.get('category');
  const category: DeviceCategory | undefined = rawCategory
    ? (rawCategory as DeviceCategory)
    : undefined;
  const offset = Number(searchParams.get('offset') ?? '0');

  const setStatus = (val: DeviceStatus | undefined) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('status', val === undefined ? 'all' : val);
        next.delete('offset');
        return next;
      },
      { replace: true },
    );

  const setCategory = (val: DeviceCategory | undefined) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set('category', val);
        else next.delete('category');
        next.delete('offset');
        return next;
      },
      { replace: true },
    );

  const setOffset = (val: number) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set('offset', String(val));
        else next.delete('offset');
        return next;
      },
      { replace: true },
    );

  const clearQ = () => {
    setInputQ('');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('q');
        next.delete('offset');
        return next;
      },
      { replace: true },
    );
  };

  const query = useQuery({
    queryKey: ['devices', { q: debouncedQ, status, category, offset }],
    queryFn: () =>
      listDevices({
        q: debouncedQ || undefined,
        status,
        category,
        limit: PAGE_SIZE,
        offset,
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

  const activeFilterCount =
    (status !== undefined && status !== 'in_stock' ? 1 : 0) + (category !== undefined ? 1 : 0);

  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* Header */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-title-lg md:text-display font-bold tracking-tight">
            {t('stock.title')}
          </h1>
          {data && (
            <div className="text-sm text-text-dim mt-1 tabular-nums">
              {isFiltered
                ? t('stock.found', { n: data.total, total: data.total })
                : t('stock.total', { n: data.total })}
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

      {/* Mobile: search + filter button */}
      <div className="md:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <Input
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            placeholder={t('stock.search_placeholder')}
            spellCheck={false}
            className="pl-10 pr-10 h-11"
          />
          {inputQ && (
            <button
              onClick={clearQ}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.tap('light');
            setFiltersOpen(true);
          }}
          aria-label={t('stock.open_filters')}
          className="relative h-11 w-11 shrink-0 rounded-xl bg-bg2 border border-border hover:border-border-strong flex items-center justify-center transition-colors"
        >
          <SlidersHorizontal size={18} className="text-text-dim" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-[rgb(var(--c-on-accent))] text-[10px] font-bold leading-[16px] text-center tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile: active filter chips */}
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

      {/* Desktop: inline filter chips */}
      <section
        className="hidden md:flex card p-4 flex-col gap-3 animate-fade-up"
        style={{ animationDelay: '60ms' }}
      >
        <div className="relative">
          <SearchIcon
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <Input
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            placeholder={t('stock.search_placeholder')}
            spellCheck={false}
            className="pl-10 pr-10 h-11"
          />
          {inputQ && (
            <button
              onClick={clearQ}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text"
            >
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

      {/* Mobile filter drawer (vaul) */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent className="md:hidden">
          <DrawerHeader>
            <DrawerTitle>{t('stock.filters_title')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 pb-2 flex flex-col gap-5">
            <div>
              <div className="text-label text-text-dim font-medium tracking-tight mb-2">
                {t('stock.filter_status')}
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
            </div>
            <div>
              <div className="text-label text-text-dim font-medium tracking-tight mb-2">
                {t('stock.filter_category')}
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
              </div>
            </div>
          </div>
          <DrawerFooter>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                full
                onClick={() => {
                  reset();
                  setFiltersOpen(false);
                }}
              >
                {t('stock.filter_reset')}
              </Button>
              <Button full onClick={() => setFiltersOpen(false)}>
                {t('common.close')}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Body */}
      {query.isLoading && !data && <DeviceTableSkeleton />}
      {query.isError && (
        <EmptyState
          title={t('common.error_load')}
          description={(query.error as { message?: string })?.message}
          action={
            <Button onClick={() => query.refetch()} variant="secondary">
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          illustration={<EmptyStockIllustration />}
          title={isFiltered ? t('stock.empty_filtered') : t('stock.empty')}
          description={!isFiltered ? t('stock.encourage') : undefined}
          action={
            isFiltered ? (
              <Button variant="secondary" onClick={reset}>
                {t('stock.filter_reset')}
              </Button>
            ) : (
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
          <DeviceList items={data.items} />
          <SimplePagination
            total={data.total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
          />
        </>
      )}
    </div>
  );
}

// ── List: shadcn Table on desktop, stacked list on mobile ─────────────

function DeviceList({ items }: { items: DeviceWithPurchaseOut[] }) {
  const { t } = useTranslation();

  return (
    <div className="card overflow-hidden">
      {/* Desktop: real <table> with sticky header */}
      <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-bg2/60 sticky top-0">
            <TableRow>
              <TableHead className="w-2/5">{t('stock.col_device')}</TableHead>
              <TableHead>{t('stock.col_specs')}</TableHead>
              <TableHead>{t('stock.col_condition')}</TableHead>
              <TableHead className="text-right whitespace-nowrap">
                {t('stock.col_price')}
              </TableHead>
              <TableHead className="text-right whitespace-nowrap">
                {t('stock.col_days')}
              </TableHead>
              <TableHead>{t('stock.col_status')}</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((d) => (
              <DeviceRowDesktop key={d.id} d={d} />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: list */}
      <ul className="md:hidden divide-y divide-border">
        {items.map((d, i) => (
          <DeviceRowMobile key={d.id} d={d} delay={i * 20} />
        ))}
      </ul>
    </div>
  );
}

function DeviceRowDesktop({ d }: { d: DeviceWithPurchaseOut }) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICON[d.category];
  const photo = d.photos[0];
  const specs = specsSummary(d.category, d.specs);

  return (
    <TableRow>
      <TableCell>
        <Link to={`/stock/${d.id}`} className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-bg3 ring-1 ring-border flex items-center justify-center text-text-muted overflow-hidden">
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <Icon size={20} strokeWidth={1.6} />
            )}
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
      </TableCell>
      <TableCell className="text-caption text-text-dim">
        {specs || <span className="text-text-muted">—</span>}
      </TableCell>
      <TableCell>
        <Badge variant={CONDITION_VARIANT[d.condition]} size="sm">
          {t(`condition.${d.condition}`)}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums font-bold text-text whitespace-nowrap">
        {d.purchase_price_uzs ? (
          fmtUzs(d.purchase_price_uzs)
        ) : (
          <span className="text-text-muted font-normal">—</span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums text-text-dim whitespace-nowrap">
        {d.days_in_stock != null ? t('stock.days_n', { n: d.days_in_stock }) : '—'}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[d.status]} size="sm">
          {t(`status.${d.status}`)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Link
          to={`/stock/${d.id}`}
          aria-label={t('stock.open')}
          className="text-text-muted hover:text-text transition-colors inline-flex"
        >
          <ChevronRight size={16} />
        </Link>
      </TableCell>
    </TableRow>
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
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Icon size={20} strokeWidth={1.6} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-body font-bold tracking-tight truncate">
              {d.brand} {d.model}
            </h3>
            <Badge variant={STATUS_VARIANT[d.status]} size="sm">
              {t(`status.${d.status}`)}
            </Badge>
          </div>
          <div className="text-caption text-text-muted font-mono truncate mt-0.5">
            {d.imei ?? d.serial ?? '—'}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-caption flex-wrap">
            {specs && <span className="text-text-dim">{specs}</span>}
            {d.purchase_price_uzs && (
              <span className="text-text font-bold tabular-nums">
                {fmtUzs(d.purchase_price_uzs)}
              </span>
            )}
            {d.days_in_stock != null && (
              <span className="text-text-muted tabular-nums">
                · {t('stock.days_n', { n: d.days_in_stock })}
              </span>
            )}
            <Badge variant={CONDITION_VARIANT[d.condition]} size="sm">
              {t(`condition.${d.condition}`)}
            </Badge>
          </div>
        </div>
        <ChevronRight size={16} className="text-text-muted shrink-0" />
      </Link>
    </li>
  );
}

// ── Tiny chips + pagination ───────────────────────────────────────────

function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full border border-accent/40 bg-accent-faded text-accent text-caption font-semibold tracking-tight">
      {label}
      <button
        onClick={onClear}
        aria-label="Remove filter"
        className="text-accent/70 hover:text-accent p-0.5 cursor-pointer"
      >
        <X size={12} />
      </button>
    </span>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-8 px-3 rounded-full border text-hint font-semibold tracking-tight transition-all flex items-center gap-1.5 cursor-pointer',
        active
          ? 'bg-accent-faded border-accent/40 text-accent'
          : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

function SimplePagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-dim tabular-nums">
        {t('common.page_n_of_m', { current: currentPage, total: totalPages })}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          {t('common.prev')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}

function DeviceTableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="hidden md:block">
        <div className="px-4 py-3 border-b border-border bg-bg2/60">
          <Skeleton className="h-3 w-3/5" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-3 border-b border-border last:border-b-0 flex items-center gap-3"
          >
            <Skeleton className="size-11 rounded-xl" />
            <Skeleton className="h-3.5 w-1/5" />
            <Skeleton className="h-3.5 w-[12%]" />
            <Skeleton className="h-4 w-16 rounded-md" />
            <div className="ml-auto flex gap-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <ul className="md:hidden divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="p-3 flex items-center gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
              <div className="flex gap-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
