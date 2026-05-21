import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, User, Phone, ShoppingCart } from 'lucide-react';
import { listCounterparties, type CounterpartyOut, type CounterpartyType } from '../api/counterparties';
import { useDebounced } from '../lib/useDebounced';
import Button from '../components/ui/Button';

type Filter = CounterpartyType | 'all';

function TypeBadge({ type }: { type: CounterpartyType }) {
  const { t } = useTranslation();
  // Tokens only (no off-palette blue); aligns with Search.tsx CP_TONE.
  const cls =
    type === 'seller' ? 'bg-accent-faded text-accent border-accent/20' :
    type === 'buyer'  ? 'bg-success-faded text-success border-success/20' :
                        'bg-bg3 text-text-dim border-border';
  return (
    <span className={`text-micro font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {t(`counterparties.type_${type}`)}
    </span>
  );
}

function CounterpartyCard({ cp }: { cp: CounterpartyOut }) {
  return (
    <Link to={`/counterparties/${cp.id}`} className="card px-4 py-3.5 flex items-start gap-3 hover:border-border-strong transition-all">
      <div className="w-9 h-9 rounded-xl bg-bg3 flex items-center justify-center shrink-0 mt-0.5">
        <User size={16} className="text-text-dim" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-body-lg font-bold tracking-tight truncate">{cp.full_name}</span>
          <TypeBadge type={cp.type} />
        </div>
        {cp.phone && (
          <div className="flex items-center gap-1.5 mt-1 text-hint text-text-dim">
            <Phone size={11} /><span className="font-mono">{cp.phone}</span>
          </div>
        )}
        {cp.comment && <p className="text-caption text-text-muted mt-1 line-clamp-1">{cp.comment}</p>}
      </div>
    </Link>
  );
}

export default function Counterparties() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const debouncedQ = useDebounced(q.trim(), 300);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['counterparties', debouncedQ, filter],
    queryFn: () => listCounterparties({
      q: debouncedQ || undefined,
      type: filter === 'all' ? undefined : filter,
      limit: 50,
    }),
  });

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',    label: t('counterparties.all') },
    { key: 'seller', label: t('counterparties.sellers') },
    { key: 'buyer',  label: t('counterparties.buyers') },
  ];

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div>
        <h1 className="text-title font-bold tracking-tight">{t('counterparties.title')}</h1>
        {(data?.total ?? 0) > 0 && (
          <p className="text-sm text-text-dim mt-0.5">{t('counterparties.total', { count: data!.total })}</p>
        )}
      </div>

      <div className="flex items-center gap-2 bg-bg2 rounded-xl border border-border focus-within:border-accent transition-colors h-12 px-3.5">
        <Search size={16} className="text-text-muted shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t('counterparties.search')}
          className="flex-1 bg-transparent outline-none text-body placeholder:text-text-muted" />
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`h-9 px-4 rounded-lg border text-label font-semibold transition-all cursor-pointer
              ${filter === f.key ? 'bg-accent-faded border-accent/40 text-accent' : 'bg-bg2 border-border text-text-dim hover:border-border-strong'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">{[1,2,3].map((i) => <div key={i} className="card h-16 animate-pulse bg-bg2" />)}</div>
      ) : isError ? (
        <div className="card p-4 text-sm text-danger">{t('common.error_load')}</div>
      ) : items.length === 0 ? (
        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-bg3 flex items-center justify-center">
            <User size={22} className="text-text-muted" />
          </div>
          <p className="font-bold">{t('counterparties.empty_title')}</p>
          <p className="text-sm text-text-dim max-w-xs leading-relaxed">{t('counterparties.empty_body')}</p>
          {!debouncedQ && filter === 'all' && (
            <Link to="/purchase/new" className="mt-2">
              <Button size="md" icon={<ShoppingCart size={16} />}>{t('today.action_purchase')}</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">{items.map((cp) => <CounterpartyCard key={cp.id} cp={cp} />)}</div>
      )}
    </div>
  );
}
