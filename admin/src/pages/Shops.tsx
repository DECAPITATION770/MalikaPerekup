/**
 * Shops directory — searchable, filterable list of every shop on the
 * platform. Layout: title + count → sticky filter bar (search + plan
 * chips + frozen toggle) → divided table → pagination.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus, Search, Store as StoreIcon, X } from 'lucide-react';

import { getShops } from '../api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterChip } from '../components/ui/FilterChip';
import { PlanExpiryBadge } from '../components/PlanExpiryBadge';
import Pagination from '../components/ui/Pagination';
import QueryError from '../components/ui/QueryError';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { fmtRelative, planLabel } from '../lib/fmt';
import { useDebounced } from '../lib/useDebounced';
import { useNow } from '../lib/useNow';
import { cn } from '@/lib/utils';

const LIMIT = 20;

export default function Shops() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [frozen, setFrozen] = useState<boolean | undefined>();
  const [offset, setOffset] = useState(0);
  const debouncedQ = useDebounced(q, 300);
  useNow();

  const { data, isLoading, isError, isFetching, refetch, error } = useQuery({
    queryKey: ['shops', { q: debouncedQ, plan, frozen, limit: LIMIT, offset }],
    queryFn: () =>
      getShops({
        q: debouncedQ || undefined,
        plan: plan || undefined,
        frozen,
        limit: LIMIT,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const hasFilters = !!q || !!plan || frozen !== undefined;
  const resetFilters = () => {
    setQ('');
    setPlan('');
    setFrozen(undefined);
    setOffset(0);
  };

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      {/* Header */}
      <header className="fia flex items-center justify-between">
        <div>
          <h1 className="text-title font-bold tracking-tight">{t('shops.title')}</h1>
          {data && (
            <p className="mt-0.5 text-hint text-text-dim">
              {hasFilters
                ? `${t('shops.filter_found')}: ${data.total}`
                : `${t('shops.filter_total')}: ${data.total}`}
            </p>
          )}
        </div>
        <Button onClick={() => navigate('/create')}>
          <Plus size={16} aria-hidden /> {t('shops.btn_create')}
        </Button>
      </header>

      {/* Filter bar */}
      <div className="fia fia-1 flex flex-wrap items-center gap-2">
        <div className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-border bg-bg2 px-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Search size={16} className="shrink-0 text-text-muted" aria-hidden />
          <input
            type="search"
            className="flex-1 bg-transparent text-label font-medium text-text outline-none placeholder:text-text-muted"
            placeholder={t('shops.search_placeholder')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setOffset(0);
              }}
              aria-label={t('common.close')}
              className="shrink-0 cursor-pointer text-text-muted hover:text-text"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>

        {/* Plan chips */}
        {(['', 'trial', 'basic', 'business'] as const).map((p) => (
          <FilterChip
            key={p}
            active={plan === p}
            onClick={() => {
              setPlan(p);
              setOffset(0);
            }}
          >
            {p ? planLabel(p) : t('shops.filter_all_plans')}
          </FilterChip>
        ))}

        {/* Frozen toggle */}
        <FilterChip
          active={frozen === true}
          danger
          onClick={() => {
            setFrozen(frozen === true ? undefined : true);
            setOffset(0);
          }}
        >
          {t('shops.filter_only_frozen')}
        </FilterChip>

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto flex cursor-pointer items-center gap-1 text-hint font-semibold text-text-muted transition-colors hover:text-danger"
          >
            <X size={14} aria-hidden /> {t('shops.filter_reset')}
          </button>
        )}
      </div>

      {/* Table */}
      <section className="card fia fia-2 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRowSkeleton key={i} cols={4} />
            ))}
          </div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} error={error} />
        ) : !data?.items.length ? (
          <EmptyState
            icon={StoreIcon}
            label={t('shops.empty')}
            action={
              hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  {t('shops.filter_reset')}
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_160px_36px] gap-3 border-b border-border bg-bg3/50 px-5 py-2.5 text-caption font-semibold tracking-tight text-text-muted">
              <span>{t('shops.col_name')}</span>
              <span>{t('shops.col_owner')}</span>
              <span>{t('shops.col_status')}</span>
              <span />
            </div>
            <div
              className={cn(
                'divide-y divide-border',
                isFetching && !isLoading && 'opacity-60 transition-opacity',
              )}
            >
              {data.items.map((shop) => (
                <Link
                  key={shop.id}
                  to={`/shops/${shop.id}`}
                  className="group grid grid-cols-[1fr_1fr_160px_36px] items-center gap-3 px-5 py-3 transition-colors hover:bg-bg3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-faded text-label font-bold text-accent">
                      {shop.name[0]?.toUpperCase() ?? '·'}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-label font-semibold text-text">
                        {shop.name}
                      </div>
                      <div className="truncate text-caption text-text-muted">
                        {shop.owner.last_login_at
                          ? t('shops.last_login_ago', {
                              time: fmtRelative(shop.owner.last_login_at),
                            })
                          : t('shops.never_logged_in')}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-label font-medium text-text">
                      {shop.owner.full_name}
                    </div>
                    <div className="truncate text-caption text-text-muted">
                      {shop.owner.tg_username
                        ? `@${shop.owner.tg_username}`
                        : shop.owner.phone ?? '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant="accent" size="sm">
                      {planLabel(shop.plan)}
                    </Badge>
                    <Badge variant={shop.is_frozen ? 'danger' : 'success'} size="sm" dot>
                      {shop.is_frozen ? t('shops.frozen') : t('shops.active')}
                    </Badge>
                    {/* Only surfaces shops that are expiring/expired — healthy
                        plans stay quiet so the list highlights what needs action. */}
                    <PlanExpiryBadge planUntil={shop.plan_until} alertsOnly />
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {data && data.total > LIMIT && (
        <div className="flex justify-end">
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </div>
      )}
    </div>
  );
}
