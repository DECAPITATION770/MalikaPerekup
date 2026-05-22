/**
 * Counterparties — directory of sellers/buyers with debounced search and
 * type filter. Phase 3 port: shadcn Input + Tabs + Badge + EmptyState +
 * Avatar fallback.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Phone, Search as SearchIcon, ShoppingCart, User } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  listCounterparties,
  type CounterpartyOut,
  type CounterpartyType,
} from '@/api/counterparties';
import { useDebounced } from '@/lib/useDebounced';

type Filter = CounterpartyType | 'all';

const TYPE_VARIANT: Record<CounterpartyType, 'accent' | 'success' | 'neutral'> = {
  seller: 'accent',
  buyer: 'success',
  both: 'neutral',
};

function initials(name: string) {
  return (
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function CounterpartyCard({ cp }: { cp: CounterpartyOut }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/counterparties/${cp.id}`}
      className="card px-4 py-3.5 flex items-start gap-3 hover:border-border-strong transition-all"
    >
      <Avatar className="size-9 mt-0.5">
        <AvatarFallback className="bg-bg3 text-text-dim text-caption">
          {initials(cp.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-body-lg font-bold tracking-tight truncate">{cp.full_name}</span>
          <Badge variant={TYPE_VARIANT[cp.type]} size="sm">
            {t(`counterparties.type_${cp.type}`)}
          </Badge>
        </div>
        {cp.phone && (
          <div className="flex items-center gap-1.5 mt-1 text-hint text-text-dim">
            <Phone size={11} />
            <span className="font-mono">{cp.phone}</span>
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
    queryFn: () =>
      listCounterparties({
        q: debouncedQ || undefined,
        type: filter === 'all' ? undefined : filter,
        limit: 50,
      }),
  });

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div>
        <h1 className="text-title font-bold tracking-tight">{t('counterparties.title')}</h1>
        {(data?.total ?? 0) > 0 && (
          <p className="text-sm text-text-dim mt-0.5">
            {t('counterparties.total', { count: data!.total })}
          </p>
        )}
      </div>

      <div className="relative">
        <SearchIcon
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('counterparties.search')}
          className="pl-10"
        />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">{t('counterparties.all')}</TabsTrigger>
          <TabsTrigger value="seller">{t('counterparties.sellers')}</TabsTrigger>
          <TabsTrigger value="buyer">{t('counterparties.buyers')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-4 text-sm text-danger">{t('common.error_load')}</div>
      ) : items.length === 0 ? (
        <EmptyState
          illustration={
            <div className="w-14 h-14 rounded-2xl bg-bg3 flex items-center justify-center text-text-muted">
              <User size={24} />
            </div>
          }
          title={t('counterparties.empty_title')}
          description={t('counterparties.empty_body')}
          action={
            !debouncedQ &&
            filter === 'all' && (
              <Link to="/purchase/new">
                <Button>
                  <ShoppingCart className="size-4" />
                  {t('today.action_purchase')}
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((cp) => (
            <CounterpartyCard key={cp.id} cp={cp} />
          ))}
        </div>
      )}
    </div>
  );
}
