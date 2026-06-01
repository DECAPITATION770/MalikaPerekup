/**
 * Stock — витрина: responsive table (desktop) / list (mobile) with
 * debounced search, URL-sync'd filters (status × category), keepPrevious
 * pagination, vaul drawer for mobile filters.
 *
 * Phase 3 port: shadcn Table + shadcn Badge + shadcn Input + EmptyState
 * + EmptyStockIllustration. Mobile filter drawer is now `vaul` instead
 * of the old Modal hack.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
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
import { Pagination } from '@/components/ui/pagination';
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
  getDeviceSuggestions,
  type DeviceCategory,
  type DeviceCondition,
  type DeviceSort,
  type DeviceStatus,
  type DeviceWithPurchaseOut,
} from '@/api/devices';
import { useDebounced } from '@/lib/useDebounced';
import { fmtUzs } from '@/lib/fmt';
import { specsSummary } from '@/lib/specsFmt';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import BrandBadge from '@/components/BrandBadge';
import DevicePhoto from '@/components/DevicePhoto';
import { brandTextColor, brandTint } from '@/lib/brand';
import { useTheme } from '@/lib/theme';

const STATUSES: DeviceStatus[] = ['in_stock', 'reserved', 'sold', 'returned', 'written_off'];
const CATEGORIES: DeviceCategory[] = [
  'phone',
  'tablet',
  'laptop',
  'smartwatch',
  'accessory',
  'other',
];

const CONDITIONS: DeviceCondition[] = ['new', 'good', 'normal', 'broken'];
const SORTS: DeviceSort[] = ['recent', 'price_desc', 'price_asc', 'days'];

/** Fixed UZS price buckets — one tap beats typing min/max on a phone. */
const PRICE_RANGES: { key: string; min: string; max: string }[] = [
  { key: 'lt', min: '', max: '2000000' },
  { key: 'mid1', min: '2000000', max: '5000000' },
  { key: 'mid2', min: '5000000', max: '10000000' },
  { key: 'gt', min: '10000000', max: '' },
];

const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  accessory: Headphones,
  other: PackageIcon,
};

const STATUS_VARIANT: Record<DeviceStatus, 'success' | 'warning' | 'muted' | 'danger' | 'neutral'> =
  {
    in_stock: 'success',
    reserved: 'warning',
    sold: 'muted',
    returned: 'danger',
    written_off: 'neutral',
  };

const CONDITION_VARIANT: Record<DeviceCondition, 'success' | 'accent' | 'warning' | 'danger'> = {
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

  // ── Filter mutations ──
  // Every filter change also resets pagination — `patch` centralises that; the
  // 8 near-identical setters collapse into one generic `setParam`.
  const patch = (mut: (n: URLSearchParams) => void) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        mut(next);
        next.delete('offset');
        return next;
      },
      { replace: true },
    );

  // Set one filter param; an empty/undefined value removes it.
  const setParam = (key: string, val: string | undefined) =>
    patch((n) => {
      if (val) n.set(key, val);
      else n.delete(key);
    });

  // Pagination is the one mutation that must NOT reset the offset.
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

  const sort = (searchParams.get('sort') as DeviceSort) || 'recent';
  const condition = (searchParams.get('condition') as DeviceCondition) || undefined;
  const brand = searchParams.get('brand') || undefined;
  const priceMin = searchParams.get('pmin') ?? '';
  const priceMax = searchParams.get('pmax') ?? '';

  const clearQ = () => {
    setInputQ('');
    setParam('q', undefined);
  };
  // 'in_stock' is the implicit default, so we persist an 'all' sentinel to mean
  // "any status"; every other filter simply drops its param when cleared.
  const setStatus = (val: DeviceStatus | undefined) =>
    patch((n) => n.set('status', val ?? 'all'));
  const setCategory = (val: DeviceCategory | undefined) => setParam('category', val);
  const setSort = (v: DeviceSort) => setParam('sort', v === 'recent' ? undefined : v);
  const setCondition = (v: DeviceCondition | undefined) => setParam('condition', v);
  const setBrand = (v: string | undefined) => setParam('brand', v);
  const setPrice = (min: string, max: string) =>
    patch((n) => {
      if (min) n.set('pmin', min);
      else n.delete('pmin');
      if (max) n.set('pmax', max);
      else n.delete('pmax');
    });

  const brandQuery = useQuery({
    queryKey: ['brand-suggestions'],
    queryFn: () => getDeviceSuggestions({ field: 'brand', limit: 12 }),
    staleTime: 5 * 60_000,
  });
  const brandOptions = brandQuery.data ?? [];

  // Highlight a freshly-created device passed via navigation state.
  const location = useLocation();
  const highlightId = (location.state as { highlightId?: number } | null)?.highlightId ?? null;

  const query = useQuery({
    queryKey: [
      'devices',
      { q: debouncedQ, status, category, condition, brand, priceMin, priceMax, sort, offset },
    ],
    queryFn: () =>
      listDevices({
        q: debouncedQ || undefined,
        status,
        category,
        condition,
        brand,
        price_min: priceMin || undefined,
        price_max: priceMax || undefined,
        sort,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;

  // One source of truth for "is the list filtered". The chip filters feed both
  // the drawer badge and `isFiltered`; the search query only feeds `isFiltered`
  // (it has its own input + clear, so it stays out of the badge count).
  const activeFilterCount = [
    sort !== 'recent',
    status !== 'in_stock',
    category !== undefined,
    condition !== undefined,
    brand !== undefined,
    Boolean(priceMin || priceMax),
  ].filter(Boolean).length;
  const isFiltered = activeFilterCount > 0 || Boolean(debouncedQ);

  const reset = () => {
    setInputQ('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const [filtersOpen, setFiltersOpen] = useState(false);
  // Desktop filter panel is collapsed by default — search stays, the chip grid
  // hides behind a «Фильтры» toggle so the Stock view isn't cluttered on load.
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      {/* Header — split layouts by breakpoint so the list page doesn't repeat
          the same big-title hero as every other screen (DESIGN_AUDIT
          §Modernization moves #2). Mobile gets a compact inline title with
          the count appended; the action lives in the sticky strip below so
          it stays one-tap-away mid-scroll. Desktop keeps the larger header
          + side CTA because there's more horizontal room. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 md:hidden">
        <h1 className="font-display text-title font-semibold tracking-[-0.03em]">
          {t('stock.title')}
        </h1>
        {data && (
          <span className="text-body tabular-nums text-text-dim">
            · {isFiltered
              ? t('stock.found', { n: data.total, total: data.total })
              : t('stock.total', { n: data.total })}
          </span>
        )}
      </div>
      <header className="hidden flex-wrap items-end justify-between gap-3 md:flex">
        <div>
          <h1 className="font-display text-title-lg font-semibold tracking-[-0.03em] md:text-display">
            {t('stock.title')}
          </h1>
          {data && (
            <div className="mt-1 text-body tabular-nums text-text-dim">
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

      {/* Mobile: sticky search + filter + Buy CTA. The AppHeader is itself
          `sticky top-0` with `pt-[env(safe-area-inset-top)]`, so its rendered
          height on a notched device is `safe-area + h-14`. We stick at that
          exact offset so the strip lands flush below the header instead of
          ghosting behind it on iPhone Notch / Telegram chrome.
          `-mx-4` + `px-4` bleed the strip to the container edge while pinned. */}
      <div
        className="sticky z-30 -mx-4 flex items-center gap-2 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur md:hidden"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
      >
        <div className="relative flex-1">
          <SearchIcon
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={inputQ}
            onChange={(e) => setInputQ(e.target.value)}
            placeholder={t('stock.search_placeholder')}
            // `type="search"` paints the native clear "x" in some browsers,
            // sends an appropriate `inputmode` to the OS keyboard, and lets
            // assistive tech announce the field as a search box; `enterKeyHint`
            // labels the on-screen Return key so a touch-tap finishes the
            // search instead of dismissing the keyboard.
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            className="h-11 pl-10 pr-10"
          />
          {inputQ && (
            <button
              onClick={clearQ}
              aria-label={t('stock.clear_search')}
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
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-bg2 transition-colors hover:border-border-strong"
        >
          <SlidersHorizontal size={18} className="text-text-dim" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 h-[16px] min-w-[16px] rounded-full bg-accent px-1 text-center text-[10px] font-bold tabular-nums leading-[16px] text-[rgb(var(--c-on-accent))]">
              {activeFilterCount}
            </span>
          )}
        </button>
        {/* Buy CTA — icon-only on mobile because the sticky strip is the
            third hot row on screen (header + sticky + chips); the verb is
            already a permanent BottomNav slot, so the chip here just lets
            the user act on a list scroll without rebounding to the bar. */}
        <Link
          to="/purchase/new"
          onClick={() => haptic.select()}
          aria-label={t('today.action_purchase')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-[rgb(var(--c-on-accent))] transition-colors hover:bg-accent-hover"
        >
          <ShoppingCart size={18} aria-hidden />
        </Link>
      </div>

      {/* Mobile: active filter chips */}
      {isFiltered && (
        <div className="flex flex-wrap items-center gap-1.5 md:hidden">
          {sort !== 'recent' && (
            <ActiveFilterChip label={t(`stock.sort_${sort}`)} onClear={() => setSort('recent')} />
          )}
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
          {condition && (
            <ActiveFilterChip
              label={t(`condition.${condition}`)}
              onClear={() => setCondition(undefined)}
            />
          )}
          {brand && <ActiveFilterChip label={brand} onClear={() => setBrand(undefined)} />}
          {(priceMin || priceMax) && (
            <ActiveFilterChip
              label={priceRangeLabel(t, priceMin, priceMax)}
              onClear={() => setPrice('', '')}
            />
          )}
          <button
            onClick={reset}
            className="ml-auto flex cursor-pointer items-center gap-1 text-hint text-text-muted transition-colors hover:text-text"
          >
            <X size={12} /> {t('stock.filter_reset')}
          </button>
        </div>
      )}

      {/* Desktop: search + collapsible filter panel */}
      <section
        className="card hidden animate-fade-up flex-col gap-3 p-4 md:flex"
        style={{ animationDelay: '60ms' }}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <Input
              value={inputQ}
              onChange={(e) => setInputQ(e.target.value)}
              placeholder={t('stock.search_placeholder')}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              className="h-11 pl-10 pr-10"
            />
            {inputQ && (
              <button
                onClick={clearQ}
                aria-label={t('stock.clear_search')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDesktopFiltersOpen((o) => !o)}
            aria-expanded={desktopFiltersOpen}
            className="relative flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-bg2 px-4 text-label font-semibold text-text-dim transition-colors hover:border-border-strong hover:text-text"
          >
            <SlidersHorizontal size={16} />
            {t('stock.filters_title')}
            {activeFilterCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-[rgb(var(--c-on-accent))]">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={16}
              className={cn('transition-transform', desktopFiltersOpen && 'rotate-180')}
            />
          </button>
        </div>

        {/* Active filters stay visible when the panel is collapsed. */}
        {!desktopFiltersOpen && isFiltered && (
          <div className="flex flex-wrap items-center gap-1.5">
            {sort !== 'recent' && (
              <ActiveFilterChip label={t(`stock.sort_${sort}`)} onClear={() => setSort('recent')} />
            )}
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
            {condition && (
              <ActiveFilterChip
                label={t(`condition.${condition}`)}
                onClear={() => setCondition(undefined)}
              />
            )}
            {brand && <ActiveFilterChip label={brand} onClear={() => setBrand(undefined)} />}
            {(priceMin || priceMax) && (
              <ActiveFilterChip
                label={priceRangeLabel(t, priceMin, priceMax)}
                onClear={() => setPrice('', '')}
              />
            )}
          </div>
        )}

        {desktopFiltersOpen && (
          <>
            <FilterControls
              sort={sort}
              setSort={setSort}
              status={status}
              setStatus={setStatus}
              category={category}
              setCategory={setCategory}
              condition={condition}
              setCondition={setCondition}
              brand={brand}
              setBrand={setBrand}
              brandOptions={brandOptions}
              priceMin={priceMin}
              priceMax={priceMax}
              setPrice={setPrice}
            />
            {isFiltered && (
              <button
                onClick={reset}
                className="flex cursor-pointer items-center gap-1 self-start text-hint text-text-muted transition-colors hover:text-text"
              >
                <X size={12} /> {t('stock.filter_reset')}
              </button>
            )}
          </>
        )}
      </section>

      {/* Mobile filter drawer (vaul) */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent className="md:hidden">
          <DrawerHeader>
            <DrawerTitle>{t('stock.filters_title')}</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[58vh] overflow-y-auto px-5 pb-2">
            <FilterControls
              sort={sort}
              setSort={setSort}
              status={status}
              setStatus={setStatus}
              category={category}
              setCategory={setCategory}
              condition={condition}
              setCondition={setCondition}
              brand={brand}
              setBrand={setBrand}
              brandOptions={brandOptions}
              priceMin={priceMin}
              priceMax={priceMax}
              setPrice={setPrice}
            />
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
          <DeviceList items={data.items} highlightId={highlightId} />
          <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}

// ── List: shadcn Table on desktop, stacked list on mobile ─────────────

function DeviceList({
  items,
  highlightId,
}: {
  items: DeviceWithPurchaseOut[];
  highlightId: number | null;
}) {
  const { t } = useTranslation();
  // Pulse the freshly-created device for a few seconds, then settle.
  const [hl, setHl] = useState<number | null>(highlightId);
  useEffect(() => {
    if (highlightId == null) return;
    setHl(highlightId);
    const timer = setTimeout(() => setHl(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightId]);

  return (
    <div className="card overflow-hidden">
      {/* Desktop ≥1024: real <table>. Was ≥768, but with the sidebar (244px)
          eating into the content column the 6-column table overflowed at
          768–1023 and clipped «Цена / Дни / Статус». Fall back to the card
          list in that zone — it fits and already renders the same data. */}
      <div className="hidden lg:block">
        <Table>
          {/* Sticky header was `bg-bg2/60` — at 60% alpha the rows below
              ghosted through and broke column-edge alignment as the user
              scrolled. Bump to 95% + backdrop-blur so the header sits as a
              solid plate while content moves under it. */}
          <TableHeader className="sticky top-0 bg-bg2/95 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-2/5">{t('stock.col_device')}</TableHead>
              <TableHead>{t('stock.col_specs')}</TableHead>
              <TableHead>{t('stock.col_condition')}</TableHead>
              <TableHead className="whitespace-nowrap text-right">{t('stock.col_price')}</TableHead>
              <TableHead className="whitespace-nowrap text-right">{t('stock.col_days')}</TableHead>
              <TableHead>{t('stock.col_status')}</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((d) => (
              <DeviceRowDesktop key={d.id} d={d} highlight={d.id === hl} />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile + sidebar zone: card list */}
      <ul className="divide-y divide-border lg:hidden">
        {items.map((d, i) => (
          <DeviceRowMobile key={d.id} d={d} delay={i * 20} highlight={d.id === hl} />
        ))}
      </ul>
    </div>
  );
}

function DeviceRowDesktop({ d, highlight }: { d: DeviceWithPurchaseOut; highlight: boolean }) {
  const { t } = useTranslation();
  const { resolved } = useTheme();
  const Icon = CATEGORY_ICON[d.category];
  const specs = specsSummary(d.category, d.specs);
  const ref = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  return (
    <TableRow ref={ref} className={cn('transition-colors', highlight && 'bg-accent-faded')}>
      <TableCell>
        <Link to={`/stock/${d.id}`} className="flex min-w-0 items-center gap-3">
          {/* Brand-tinted bg sits behind both states; the photo fully covers it
              when it loads, and shows through as the icon backdrop on failure. */}
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
            style={{
              backgroundColor: brandTint(d.brand, 0.14),
              color: brandTextColor(d.brand, resolved),
            }}
          >
            <DevicePhoto
              src={d.photo_url}
              alt={`${d.brand} ${d.model}`}
              fallback={<Icon size={20} strokeWidth={1.8} />}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <BrandBadge brand={d.brand} size="sm" />
              <span className="truncate text-body font-bold tracking-tight">{d.model}</span>
            </div>
            <div className="mt-0.5 truncate font-mono text-caption text-text-muted">
              {d.imei ?? d.serial ?? '—'}
            </div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-caption text-text-dim">
        {specs || <span className="text-text-muted">—</span>}
      </TableCell>
      <TableCell>
        <Badge dot variant={CONDITION_VARIANT[d.condition]} size="sm">
          {t(`condition.${d.condition}`)}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right font-bold tabular-nums text-text">
        {d.purchase_price_uzs ? (
          fmtUzs(d.purchase_price_uzs)
        ) : (
          <span className="font-normal text-text-muted">—</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums text-text-dim">
        {d.days_in_stock != null ? t('stock.days_n', { n: d.days_in_stock }) : '—'}
      </TableCell>
      <TableCell>
        {/* Skip the «in_stock» pill — when the default filter is on, every row
            renders the same green chip and the column becomes wallpaper.
            Only non-default statuses earn the pill. */}
        {d.status !== 'in_stock' ? (
          <Badge dot variant={STATUS_VARIANT[d.status]} size="sm">
            {t(`status.${d.status}`)}
          </Badge>
        ) : (
          <span className="text-caption text-text-muted">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Link
          to={`/stock/${d.id}`}
          aria-label={t('stock.open')}
          className="inline-flex text-text-muted transition-colors hover:text-text"
        >
          <ChevronRight size={16} />
        </Link>
      </TableCell>
    </TableRow>
  );
}

function DeviceRowMobile({
  d,
  delay,
  highlight,
}: {
  d: DeviceWithPurchaseOut;
  delay: number;
  highlight: boolean;
}) {
  const { t } = useTranslation();
  const { resolved } = useTheme();
  const Icon = CATEGORY_ICON[d.category];
  const specs = specsSummary(d.category, d.specs);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  return (
    <li
      ref={ref}
      className={cn('animate-fade-up transition-colors', highlight && 'bg-accent-faded')}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Link to={`/stock/${d.id}`} className="flex items-center gap-3 p-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{
            backgroundColor: brandTint(d.brand, 0.14),
            color: brandTextColor(d.brand, resolved),
          }}
        >
          <DevicePhoto
            src={d.photo_url}
            alt={`${d.brand} ${d.model}`}
            fallback={<Icon size={20} strokeWidth={1.8} />}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <BrandBadge brand={d.brand} size="sm" />
              <h3 className="truncate text-body font-bold tracking-tight">{d.model}</h3>
            </div>
            {/* Status pill suppressed for the default in_stock filter — every
                row would carry an identical green chip and the right column
                turns into wallpaper. Non-default statuses still earn it. */}
            {d.status !== 'in_stock' && (
              <Badge dot variant={STATUS_VARIANT[d.status]} size="sm">
                {t(`status.${d.status}`)}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-caption">
            {specs && <span className="text-text-dim">{specs}</span>}
            <Badge dot variant={CONDITION_VARIANT[d.condition]} size="sm">
              {t(`condition.${d.condition}`)}
            </Badge>
            {d.days_in_stock != null && (
              <span className="tabular-nums text-text-muted">
                {t('stock.days_n', { n: d.days_in_stock })}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-caption text-text-muted">
              {d.imei ?? d.serial ?? '—'}
            </span>
            {d.purchase_price_uzs && (
              <span className="shrink-0 text-body font-bold tabular-nums text-text">
                {fmtUzs(d.purchase_price_uzs)}{' '}
                <span className="text-caption font-normal text-text-muted">UZS</span>
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="shrink-0 text-text-muted" />
      </Link>
    </li>
  );
}

// ── Tiny chips ────────────────────────────────────────────────────────

function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  // `t` lives outside this presentational fn; pull it from the parent scope
  // via the hook so the aria-label localises with the rest of the page.
  const { t } = useTranslation();
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent/40 bg-accent-faded pl-2.5 pr-1 text-caption font-semibold tracking-tight text-accent">
      {label}
      <button
        onClick={onClear}
        aria-label={t('stock.remove_filter')}
        className="cursor-pointer p-0.5 text-accent/70 hover:text-accent"
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
        'flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-hint font-semibold tracking-tight transition-all',
        active
          ? 'border-accent/40 bg-accent-faded text-accent'
          : 'border-border bg-bg2 text-text-dim hover:border-border-strong hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

// ── Filter controls (shared by desktop panel + mobile drawer) ─────────

function priceRangeLabel(t: (k: string) => string, min: string, max: string): string {
  const r = PRICE_RANGES.find((x) => x.min === min && x.max === max);
  if (r) return t(`stock.price_${r.key}`);
  if (min && max) return `${fmtUzs(min)}–${fmtUzs(max)}`;
  if (min) return `${fmtUzs(min)}+`;
  return `< ${fmtUzs(max)}`;
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-label font-medium tracking-tight text-text-dim">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function FilterControls({
  sort,
  setSort,
  status,
  setStatus,
  category,
  setCategory,
  condition,
  setCondition,
  brand,
  setBrand,
  brandOptions,
  priceMin,
  priceMax,
  setPrice,
}: {
  sort: DeviceSort;
  setSort: (v: DeviceSort) => void;
  status: DeviceStatus | undefined;
  setStatus: (v: DeviceStatus | undefined) => void;
  category: DeviceCategory | undefined;
  setCategory: (v: DeviceCategory | undefined) => void;
  condition: DeviceCondition | undefined;
  setCondition: (v: DeviceCondition | undefined) => void;
  brand: string | undefined;
  setBrand: (v: string | undefined) => void;
  brandOptions: string[];
  priceMin: string;
  priceMax: string;
  setPrice: (min: string, max: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <FilterSection label={t('stock.filter_sort')}>
        {SORTS.map((s) => (
          <Chip key={s} active={sort === s} onClick={() => setSort(s)}>
            {t(`stock.sort_${s}`)}
          </Chip>
        ))}
      </FilterSection>

      <FilterSection label={t('stock.filter_status')}>
        <Chip active={status === undefined} onClick={() => setStatus(undefined)}>
          {t('stock.filter_all_status')}
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {t(`status.${s}`)}
          </Chip>
        ))}
      </FilterSection>

      <FilterSection label={t('stock.filter_category')}>
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
      </FilterSection>

      <FilterSection label={t('stock.filter_condition')}>
        <Chip active={condition === undefined} onClick={() => setCondition(undefined)}>
          {t('stock.filter_all_condition')}
        </Chip>
        {CONDITIONS.map((c) => (
          <Chip key={c} active={condition === c} onClick={() => setCondition(c)}>
            {t(`condition.${c}`)}
          </Chip>
        ))}
      </FilterSection>

      <FilterSection label={t('stock.filter_price')}>
        {PRICE_RANGES.map((r) => {
          const active = priceMin === r.min && priceMax === r.max;
          return (
            <Chip
              key={r.key}
              active={active}
              onClick={() => (active ? setPrice('', '') : setPrice(r.min, r.max))}
            >
              {t(`stock.price_${r.key}`)}
            </Chip>
          );
        })}
      </FilterSection>

      {brandOptions.length > 0 && (
        <FilterSection label={t('stock.filter_brand')}>
          <Chip active={brand === undefined} onClick={() => setBrand(undefined)}>
            {t('stock.filter_all_brand')}
          </Chip>
          {brandOptions.map((b) => (
            <Chip key={b} active={brand === b} onClick={() => setBrand(b)}>
              {b}
            </Chip>
          ))}
        </FilterSection>
      )}
    </div>
  );
}

function DeviceTableSkeleton() {
  return (
    <div className="card overflow-hidden">
      {/* Skeleton breakpoints must mirror the real table — see lg:block above. */}
      <div className="hidden lg:block">
        {/* Skeleton mirrors the real sticky-header opacity (see TableHeader
            comment above) so the initial frame doesn't visibly shift when
            data arrives. */}
        <div className="border-b border-border bg-bg2/95 px-4 py-3">
          <Skeleton className="h-3 w-3/5" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
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
      <ul className="divide-y divide-border lg:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
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
