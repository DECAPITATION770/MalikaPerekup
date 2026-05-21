import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getShops } from '../api';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtRelative, planLabel } from '../lib/fmt';
import { useDebounced } from '../lib/useDebounced';
import { useNow } from '../lib/useNow';
import { Search, Plus, ChevronRight, Store, X } from 'lucide-react';
import Button from '../components/ui/Button';

const LIMIT = 20;

const chipBase = 'px-3 h-8 rounded-full text-[13px] font-semibold transition-colors cursor-pointer border whitespace-nowrap inline-flex items-center';
const chipActive = 'bg-accent text-white border-accent';
const chipIdle = 'bg-bg2 text-text-dim border-border hover:text-text';

export default function Shops() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [frozen, setFrozen] = useState<boolean | undefined>();
  const [offset, setOffset] = useState(0);
  const debouncedQ = useDebounced(q, 300);
  useNow(); // re-render relative timestamps every minute

  const { data, isLoading, isError, isFetching, refetch, error } = useQuery({
    queryKey: ['shops', { q: debouncedQ, plan, frozen, limit: LIMIT, offset }],
    queryFn: () => getShops({ q: debouncedQ || undefined, plan: plan || undefined, frozen, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  });

  const hasFilters = q || plan || frozen !== undefined;
  const resetFilters = () => { setQ(''); setPlan(''); setFrozen(undefined); setOffset(0); };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 fia">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('shops.title')}</h1>
          {data && (
            <p className="text-sm text-text-dim mt-0.5">
              {hasFilters ? `${t('shops.filter_found')}: ${data.total}` : `${t('shops.filter_total')}: ${data.total}`}
            </p>
          )}
        </div>
        <Button size="md" onClick={() => navigate('/create')}>
          <Plus size={16} /> {t('shops.btn_create')}
        </Button>
      </div>

      {/* Filter bar — single row */}
      <div className="flex flex-wrap items-center gap-2 mb-4 fia fia-1">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-bg3 border border-border rounded-xl px-3.5 h-11 focus-within:border-accent transition-colors">
          <Search size={16} className="text-text-dim shrink-0" />
          <input
            className="flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-muted font-medium"
            placeholder={t('shops.search_placeholder')}
            value={q}
            onChange={e => { setQ(e.target.value); setOffset(0); }}
          />
          {q && (
            <button onClick={() => { setQ(''); setOffset(0); }} aria-label={t('common.close')} className="text-text-muted hover:text-text shrink-0 cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Plan chips */}
        {(['', 'trial', 'basic', 'business'] as const).map(p => (
          <button
            key={p}
            onClick={() => { setPlan(p); setOffset(0); }}
            className={`${chipBase} ${plan === p ? chipActive : chipIdle}`}
          >
            {p ? planLabel(p) : t('shops.filter_all_plans')}
          </button>
        ))}

        {/* Frozen toggle */}
        <button
          onClick={() => { setFrozen(frozen === true ? undefined : true); setOffset(0); }}
          className={`${chipBase} ${frozen === true ? 'bg-danger text-white border-danger' : chipIdle}`}
        >
          {t('shops.filter_only_frozen')}
        </button>

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="text-[13px] text-text-muted hover:text-danger transition-colors font-semibold ml-auto cursor-pointer flex items-center gap-1"
          >
            <X size={14} /> {t('shops.filter_reset')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-bg3 rounded-2xl border border-border overflow-hidden fia fia-2">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)}
          </div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} error={error} />
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-text-dim">
            <Store size={32} className="opacity-30" />
            <span className="text-sm">{t('shops.empty')}</span>
            {hasFilters && (
              <button onClick={resetFilters} className="text-xs text-accent font-semibold cursor-pointer">
                {t('shops.filter_reset')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_120px_36px] gap-3 px-5 py-3 border-b border-border text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">
              <span>{t('shops.col_name')}</span>
              <span>{t('shops.col_owner')}</span>
              <span>{t('shops.col_status')}</span>
              <span/>
            </div>
            <div className={`divide-y divide-border ${isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}`}>
              {data.items.map(shop => (
                <Link
                  key={shop.id}
                  to={`/shops/${shop.id}`}
                  className="group grid grid-cols-[1fr_1fr_120px_36px] gap-3 px-5 py-3.5 items-center hover:bg-bg2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-accent-faded flex items-center justify-center text-accent font-bold text-sm shrink-0">
                      {shop.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text truncate">{shop.name}</div>
                      <div className="text-xs text-text-muted truncate">
                        {shop.owner.last_login_at
                          ? t('shops.last_login_ago', { time: fmtRelative(shop.owner.last_login_at) })
                          : t('shops.never_logged_in')}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text truncate">{shop.owner.full_name}</div>
                    <div className="text-xs text-text-muted truncate">
                      {shop.owner.tg_username ? `@${shop.owner.tg_username}` : shop.owner.phone ?? '—'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge kind="blue" size="sm">{planLabel(shop.plan)}</Badge>
                    <Badge kind={shop.is_frozen ? 'red' : 'green'} size="sm" dot>
                      {shop.is_frozen ? t('shops.frozen') : t('shops.active')}
                    </Badge>
                  </div>
                  <ChevronRight size={16} className="text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {data && data.total > LIMIT && (
        <div className="flex justify-end mt-4">
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </div>
      )}
    </div>
  );
}
