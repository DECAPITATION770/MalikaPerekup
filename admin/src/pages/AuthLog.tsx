import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAccessLog } from '../api';
import Pagination from '../components/ui/Pagination';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import { fmtDateTime } from '../lib/fmt';
import { useToast } from '../components/ui/Toast';
import { copyToClipboard } from '../lib/clipboard';
import { useNow } from '../lib/useNow';
import { CheckCircle2, XCircle, Send, Lock, Bot, Shield, Copy } from 'lucide-react';

const LIMIT = 30;

const chipBase = 'px-3 h-8 rounded-full text-[13px] font-semibold transition-colors cursor-pointer border whitespace-nowrap inline-flex items-center gap-1.5';
const chipActive = 'bg-accent text-white border-accent';
const chipActiveDanger = 'bg-danger text-white border-danger';
const chipIdle = 'bg-bg2 text-text-dim border-border hover:text-text';

const SOURCE_ICONS: Record<string, { Icon: typeof Send; color: string; label: string }> = {
  telegram:  { Icon: Send,   color: 'text-accent',   label: 'Telegram' },
  password:  { Icon: Lock,   color: 'text-text-dim', label: 'Логин' },
  bot_start: { Icon: Bot,    color: 'text-warning',  label: 'Бот /start' },
  admin:     { Icon: Shield, color: 'text-success',  label: 'Админ' },
};

export default function AuthLog() {
  const { t } = useTranslation();
  const toast = useToast();
  const [source, setSource] = useState('');
  const [success, setSuccess] = useState<boolean | undefined>();
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, isFetching, refetch, error } = useQuery({
    queryKey: ['log', { source, success, offset }],
    queryFn: () => getAccessLog({ source: source || undefined, success, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  });

  useNow();

  const copyIP = async (ip: string) => {
    const ok = await copyToClipboard(ip);
    if (ok) toast.success(t('auth_log.toast_ip_copied', { ip }));
    else toast.error(t('auth_log.toast_copy_failed'));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 fia">
        <h1 className="text-2xl font-bold tracking-tight">{t('auth_log.title')}</h1>
        {data && (
          <p className="text-sm text-text-dim mt-0.5">
            {t('auth_log.total_records', { n: data.total })}
            {data.items.filter(i => !i.success).length > 0 && ` · ${t('auth_log.failed_on_page', { n: data.items.filter(i => !i.success).length })}`}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 fia fia-1">
        {(['', 'telegram', 'password'] as const).map(s => {
          const cfg = s ? SOURCE_ICONS[s] : null;
          const Icon = cfg?.Icon;
          return (
            <button
              key={s}
              onClick={() => { setSource(s); setOffset(0); }}
              className={`${chipBase} ${source === s ? chipActive : chipIdle}`}
            >
              {Icon && <Icon size={12} />}
              {s || t('auth_log.filter_all_sources')}
            </button>
          );
        })}

        <div className="w-px bg-border self-stretch mx-1" />

        {([
          { v: undefined, l: t('auth_log.filter_all_results'), active: chipActive, Icon: null as typeof Send | null },
          { v: true,      l: t('auth_log.filter_success_only'), active: chipActive, Icon: CheckCircle2 },
          { v: false,     l: t('auth_log.filter_failed_only'), active: chipActiveDanger, Icon: XCircle },
        ] as const).map(({ v, l, active, Icon }) => (
          <button
            key={String(v)}
            onClick={() => { setSuccess(v); setOffset(0); }}
            className={`${chipBase} ${success === v ? active : chipIdle}`}
          >
            {Icon && <Icon size={12} />}
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-bg3 rounded-2xl border border-border overflow-hidden fia fia-2">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
          </div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} error={error} />
        ) : !data?.items.length ? (
          <div className="text-center text-text-dim py-12 text-sm">{t('auth_log.empty')}</div>
        ) : (
          <>
            <div className="grid grid-cols-[28px_140px_28px_1fr_140px_80px_1fr] gap-3 px-5 py-3 border-b border-border text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">
              <span/>
              <span>{t('auth_log.col_time')}</span>
              <span/>
              <span>{t('auth_log.col_identifier')}</span>
              <span>{t('auth_log.col_ip')}</span>
              <span>{t('auth_log.col_result')}</span>
              <span>{t('auth_log.col_reason')}</span>
            </div>
            <div className={`divide-y divide-border ${isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}`}>
              {data.items.map(log => {
                const sourceCfg = SOURCE_ICONS[log.source] || { Icon: Shield, color: 'text-text-dim', label: log.source };
                return (
                  <div
                    key={log.id}
                    className={`grid grid-cols-[28px_140px_28px_1fr_140px_80px_1fr] gap-3 px-5 py-3 items-center ${!log.success ? 'bg-[#3D1414]/20' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${log.success ? 'bg-[#0F3F2A] text-success' : 'bg-[#3D1414] text-danger'}`}>
                      {log.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    </div>
                    <span className="text-xs text-text-dim font-mono whitespace-nowrap">{fmtDateTime(log.attempted_at)}</span>
                    <span title={sourceCfg.label} className={`flex items-center justify-center ${sourceCfg.color}`}>
                      <sourceCfg.Icon size={14} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text truncate font-mono">{log.identifier}</div>
                      {log.tg_username && <div className="text-xs text-accent truncate">@{log.tg_username}</div>}
                    </div>
                    {log.ip_address ? (
                      <button
                        onClick={() => copyIP(log.ip_address!)}
                        className="text-xs text-text-dim font-mono hover:text-accent transition-colors text-left flex items-center gap-1.5 group cursor-pointer"
                        aria-label={t('auth_log.copy_ip_aria', { ip: log.ip_address })}
                      >
                        <span className="truncate">{log.ip_address}</span>
                        <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${log.success ? 'text-success' : 'text-danger'}`}>
                      {log.success ? t('auth_log.success') : t('auth_log.failed')}
                    </span>
                    <span className="text-xs text-text-muted truncate" title={log.reason ?? undefined}>{log.reason ?? '—'}</span>
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
