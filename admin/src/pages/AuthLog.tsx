/**
 * Authentication log — every login attempt across the platform with
 * source (Telegram / password / bot / admin), success/failure result,
 * IP address (click to copy), and an optional failure reason.
 */
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  CheckCircle2,
  Copy,
  Lock,
  Send,
  Shield,
  XCircle,
} from 'lucide-react';

import { getAccessLog } from '../api';
import Pagination from '../components/ui/Pagination';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { useToast } from '../components/ui/Toast';
import { copyToClipboard } from '../lib/clipboard';
import { fmtDateTime } from '../lib/fmt';
import { useNow } from '../lib/useNow';
import { cn } from '@/lib/utils';

const LIMIT = 30;

const chipBase =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-hint font-semibold ' +
  'border transition-colors cursor-pointer whitespace-nowrap';
const chipIdle = 'border-border bg-bg2 text-text-dim hover:text-text';
const chipActive = 'border-accent bg-accent text-accent-fg';
const chipActiveDanger = 'border-danger bg-danger text-white';

const SOURCE_ICONS: Record<string, { Icon: typeof Send; color: string; label: string }> = {
  telegram: { Icon: Send, color: 'text-accent', label: 'Telegram' },
  password: { Icon: Lock, color: 'text-text-dim', label: 'Login' },
  bot_start: { Icon: Bot, color: 'text-warning', label: 'Bot /start' },
  admin: { Icon: Shield, color: 'text-success', label: 'Admin' },
};

export default function AuthLog() {
  const { t } = useTranslation();
  const toast = useToast();
  const [source, setSource] = useState('');
  const [success, setSuccess] = useState<boolean | undefined>();
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, isFetching, refetch, error } = useQuery({
    queryKey: ['log', { source, success, offset }],
    queryFn: () =>
      getAccessLog({ source: source || undefined, success, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  });

  useNow();

  const copyIP = async (ip: string) => {
    const ok = await copyToClipboard(ip);
    if (ok) toast.success(t('auth_log.toast_ip_copied', { ip }));
    else toast.error(t('auth_log.toast_copy_failed'));
  };

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <header className="fia">
        <h1 className="text-title font-bold tracking-tight">{t('auth_log.title')}</h1>
        {data && (
          <p className="mt-0.5 text-hint text-text-dim">
            {t('auth_log.total_records', { n: data.total })}
            {data.items.filter((i) => !i.success).length > 0 &&
              ` · ${t('auth_log.failed_on_page', { n: data.items.filter((i) => !i.success).length })}`}
          </p>
        )}
      </header>

      {/* Filters */}
      <div className="fia fia-1 flex flex-wrap gap-2">
        {(['', 'telegram', 'password'] as const).map((s) => {
          const cfg = s ? SOURCE_ICONS[s] : null;
          const Icon = cfg?.Icon;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSource(s);
                setOffset(0);
              }}
              className={cn(chipBase, source === s ? chipActive : chipIdle)}
            >
              {Icon && <Icon size={12} aria-hidden />}
              {s || t('auth_log.filter_all_sources')}
            </button>
          );
        })}

        <div className="mx-1 w-px self-stretch bg-border" aria-hidden />

        {(
          [
            { v: undefined, l: t('auth_log.filter_all_results'), active: chipActive, Icon: null as typeof Send | null },
            { v: true, l: t('auth_log.filter_success_only'), active: chipActive, Icon: CheckCircle2 },
            { v: false, l: t('auth_log.filter_failed_only'), active: chipActiveDanger, Icon: XCircle },
          ] as const
        ).map(({ v, l, active, Icon }) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => {
              setSuccess(v);
              setOffset(0);
            }}
            className={cn(chipBase, success === v ? active : chipIdle)}
          >
            {Icon && <Icon size={12} aria-hidden />}
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <section className="card fia fia-2 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRowSkeleton key={i} cols={6} />
            ))}
          </div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} error={error} />
        ) : !data?.items.length ? (
          <div className="py-12 text-center text-label text-text-dim">
            {t('auth_log.empty')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[28px_140px_28px_1fr_140px_80px_1fr] gap-3 border-b border-border bg-bg3/50 px-5 py-2.5 text-caption font-semibold tracking-tight text-text-muted">
              <span />
              <span>{t('auth_log.col_time')}</span>
              <span />
              <span>{t('auth_log.col_identifier')}</span>
              <span>{t('auth_log.col_ip')}</span>
              <span>{t('auth_log.col_result')}</span>
              <span>{t('auth_log.col_reason')}</span>
            </div>
            <div
              className={cn(
                'divide-y divide-border',
                isFetching && !isLoading && 'opacity-60 transition-opacity',
              )}
            >
              {data.items.map((log) => {
                const sourceCfg =
                  SOURCE_ICONS[log.source] || {
                    Icon: Shield,
                    color: 'text-text-dim',
                    label: log.source,
                  };
                return (
                  <div
                    key={log.id}
                    className={cn(
                      'grid grid-cols-[28px_140px_28px_1fr_140px_80px_1fr] items-center gap-3 px-5 py-3',
                      !log.success && 'bg-danger-faded/40',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        log.success
                          ? 'bg-success-faded text-success'
                          : 'bg-danger-faded text-danger',
                      )}
                    >
                      {log.success ? (
                        <CheckCircle2 size={13} aria-hidden />
                      ) : (
                        <XCircle size={13} aria-hidden />
                      )}
                    </div>
                    <span className="whitespace-nowrap font-mono text-caption text-text-dim">
                      {fmtDateTime(log.attempted_at)}
                    </span>
                    <span
                      title={sourceCfg.label}
                      className={cn('flex items-center justify-center', sourceCfg.color)}
                    >
                      <sourceCfg.Icon size={14} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-label font-medium text-text">
                        {log.identifier}
                      </div>
                      {log.tg_username && (
                        <div className="truncate text-caption text-accent">
                          @{log.tg_username}
                        </div>
                      )}
                    </div>
                    {log.ip_address ? (
                      <button
                        type="button"
                        onClick={() => copyIP(log.ip_address!)}
                        className="group flex cursor-pointer items-center gap-1.5 text-left font-mono text-caption text-text-dim transition-colors hover:text-accent"
                        aria-label={t('auth_log.copy_ip_aria', { ip: log.ip_address })}
                      >
                        <span className="truncate">{log.ip_address}</span>
                        <Copy
                          size={10}
                          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      </button>
                    ) : (
                      <span className="text-caption text-text-muted">—</span>
                    )}
                    <span
                      className={cn(
                        'text-caption font-semibold tracking-tight',
                        log.success ? 'text-success' : 'text-danger',
                      )}
                    >
                      {log.success ? t('auth_log.success') : t('auth_log.failed')}
                    </span>
                    <span
                      className="truncate text-caption text-text-muted"
                      title={log.reason ?? undefined}
                    >
                      {log.reason ?? '—'}
                    </span>
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
