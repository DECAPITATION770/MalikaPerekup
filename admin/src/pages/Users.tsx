import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getUsers } from '../api';
import Pagination from '../components/ui/Pagination';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtRelative } from '../lib/fmt';
import { useDebounced } from '../lib/useDebounced';
import { useNow } from '../lib/useNow';
import { Search, X, Users as UsersIcon, Send, Lock, Bot, Shield, HelpCircle } from 'lucide-react';

const LIMIT = 30;

const SOURCE_ICONS: Record<string, { Icon: typeof Send; color: string }> = {
  telegram:  { Icon: Send,   color: 'text-accent' },
  password:  { Icon: Lock,   color: 'text-text-dim' },
  bot_start: { Icon: Bot,    color: 'text-warning' },
  admin:     { Icon: Shield, color: 'text-success' },
};

export default function Users() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const debouncedQ = useDebounced(q, 300);
  useNow();

  const { data, isLoading, isError, isFetching, refetch, error } = useQuery({
    queryKey: ['users', { q: debouncedQ, offset }],
    queryFn: () => getUsers({ q: debouncedQ || undefined, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 fia">
        <h1 className="text-2xl font-bold tracking-tight">{t('users.title')}</h1>
        {data && <p className="text-sm text-text-dim mt-0.5">{data.total}</p>}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-bg3 border border-border rounded-xl px-3.5 h-12 mb-4 fia fia-1 focus-within:border-accent transition-colors">
        <Search size={16} className="text-text-dim shrink-0" />
        <input
          className="flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-muted font-medium"
          placeholder={t('users.search_placeholder')}
          value={q}
          onChange={e => { setQ(e.target.value); setOffset(0); }}
        />
        {q && (
          <button onClick={() => { setQ(''); setOffset(0); }} aria-label={t('common.close')} className="text-text-muted hover:text-text shrink-0 cursor-pointer">
            <X size={14} />
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
            <UsersIcon size={32} className="opacity-30" />
            <span className="text-sm">{t('users.empty')}</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_1fr_140px] gap-3 px-5 py-3 border-b border-border text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">
              <span>{t('users.col_user')}</span>
              <span>{t('users.col_contact')}</span>
              <span>Telegram</span>
              <span>{t('users.col_last_login')}</span>
            </div>
            <div className={`divide-y divide-border ${isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}`}>
              {data.items.map(u => {
                const cfg = u.last_login_source ? SOURCE_ICONS[u.last_login_source] : null;
                return (
                  <div key={u.id} className="grid grid-cols-[1fr_1fr_1fr_140px] gap-3 px-5 py-3.5 items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-accent-faded text-accent font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                        {u.full_name.split(' ').slice(0, 2).map(w => w[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{u.full_name}</div>
                        <div className="text-xs text-text-muted truncate font-mono">{u.login || '—'}</div>
                      </div>
                    </div>
                    <div className="text-sm text-text-dim font-mono truncate">{u.phone ?? '—'}</div>
                    <div className="text-sm min-w-0">
                      {u.tg_username ? (
                        <span className="text-accent truncate block">@{u.tg_username}</span>
                      ) : u.tg_id ? (
                        <span className="text-text-dim font-mono">{u.tg_id}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                    <div className="text-xs text-text-dim flex items-center gap-1.5">
                      {cfg ? <cfg.Icon size={12} className={cfg.color} />
                        : u.last_login_source ? <HelpCircle size={12} className="text-text-muted" />
                        : null}
                      <span className="truncate">{fmtRelative(u.last_login_at)}</span>
                    </div>
                  </div>
                );
              })}
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
