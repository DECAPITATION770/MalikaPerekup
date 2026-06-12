/**
 * Users directory — searchable list of every user across all shops.
 * Search debounces 300 ms; each row shows full name, login, contact,
 * Telegram handle, and the source of the last login.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Ban,
  Bot,
  HelpCircle,
  Lock,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Users as UsersIcon,
  X,
} from 'lucide-react';

import { getUsers, blockUser, unblockUser } from '../api';
import Pagination from '../components/ui/Pagination';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtRelative } from '../lib/fmt';
import { useDebounced } from '../lib/useDebounced';
import { useNow } from '../lib/useNow';
import { cn } from '@/lib/utils';

const LIMIT = 30;

const SOURCE_ICONS: Record<string, { Icon: typeof Send; color: string }> = {
  telegram: { Icon: Send, color: 'text-accent' },
  password: { Icon: Lock, color: 'text-text-dim' },
  bot_start: { Icon: Bot, color: 'text-warning' },
  admin: { Icon: Shield, color: 'text-success' },
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

  const qc = useQueryClient();
  const blockMut = useMutation({
    mutationFn: (id: number) => blockUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('users.blocked'));
    },
    onError: () => toast.error(t('users.block_error')),
  });
  const unblockMut = useMutation({
    mutationFn: (id: number) => unblockUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('users.unblocked'));
    },
    onError: () => toast.error(t('users.block_error')),
  });

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <header className="fia">
        <h1 className="text-title font-bold tracking-tight">{t('users.title')}</h1>
        {data && <p className="mt-0.5 text-hint text-text-dim">{data.total}</p>}
      </header>

      {/* Search */}
      <div className="fia fia-1 flex h-11 items-center gap-2 rounded-lg border border-border bg-bg2 px-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
        <Search size={16} className="shrink-0 text-text-muted" aria-hidden />
        <input
          type="search"
          className="flex-1 bg-transparent text-label font-medium text-text outline-none placeholder:text-text-muted"
          placeholder={t('users.search_placeholder')}
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
          <div className="flex flex-col items-center gap-3 py-16 text-text-dim">
            <UsersIcon size={28} className="opacity-40" aria-hidden />
            <span className="text-label">{t('users.empty')}</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_1fr_140px_120px] gap-3 border-b border-border bg-bg3/50 px-5 py-2.5 text-caption font-semibold tracking-tight text-text-muted">
              <span>{t('users.col_user')}</span>
              <span>{t('users.col_contact')}</span>
              <span>Telegram</span>
              <span>{t('users.col_last_login')}</span>
              <span className="text-right">{t('users.col_status')}</span>
            </div>
            <div
              className={cn(
                'divide-y divide-border',
                isFetching && !isLoading && 'opacity-60 transition-opacity',
              )}
            >
              {data.items.map((u) => {
                const cfg = u.last_login_source ? SOURCE_ICONS[u.last_login_source] : null;
                return (
                  <div
                    key={u.id}
                    className="grid grid-cols-[1fr_1fr_1fr_140px_120px] items-center gap-3 px-5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-faded text-caption font-bold uppercase text-accent">
                        {u.full_name
                          .split(' ')
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-label font-semibold">
                          {u.full_name}
                        </div>
                        <div className="truncate font-mono text-caption text-text-muted">
                          {u.login || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="truncate font-mono text-label text-text-dim">
                      {u.phone ?? '—'}
                    </div>
                    <div className="min-w-0 text-label">
                      {u.tg_username ? (
                        <span className="block truncate text-accent">@{u.tg_username}</span>
                      ) : u.tg_id ? (
                        <span className="font-mono text-text-dim">{u.tg_id}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-caption text-text-dim">
                      {cfg ? (
                        <cfg.Icon size={12} className={cfg.color} aria-hidden />
                      ) : u.last_login_source ? (
                        <HelpCircle size={12} className="text-text-muted" aria-hidden />
                      ) : null}
                      <span className="truncate">{fmtRelative(u.last_login_at)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {u.is_blocked && (
                        <span className="rounded bg-danger-faded px-1.5 py-0.5 text-micro font-semibold text-danger">
                          {t('users.blocked_badge')}
                        </span>
                      )}
                      {u.is_blocked ? (
                        <button
                          type="button"
                          title={t('users.unblock')}
                          aria-label={t('users.unblock')}
                          className="shrink-0 cursor-pointer text-text-dim hover:text-success disabled:opacity-40"
                          disabled={unblockMut.isPending}
                          onClick={() => unblockMut.mutate(u.id)}
                        >
                          <ShieldCheck size={16} aria-hidden />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title={t('users.block')}
                          aria-label={t('users.block')}
                          className="shrink-0 cursor-pointer text-text-dim hover:text-danger disabled:opacity-40"
                          disabled={blockMut.isPending}
                          onClick={() => {
                            if (window.confirm(t('users.block_confirm'))) {
                              blockMut.mutate(u.id);
                            }
                          }}
                        >
                          <Ban size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
