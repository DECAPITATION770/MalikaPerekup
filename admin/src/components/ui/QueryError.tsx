import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, WifiOff, ServerCrash } from 'lucide-react';
import Button from './Button';

interface Props {
  onRetry?: () => void;
  error?: unknown;
  inline?: boolean;
}

interface AxiosLikeError {
  response?: { status?: number };
  code?: string;
  message?: string;
}

function classify(err: unknown): { kind: 'offline' | 'server' | 'forbidden' | 'notfound' | 'generic'; status?: number } {
  const e = err as AxiosLikeError | undefined;
  const status = e?.response?.status;
  if (e?.code === 'ERR_NETWORK' || (!status && !navigator.onLine)) return { kind: 'offline' };
  if (status && status >= 500) return { kind: 'server', status };
  if (status === 403) return { kind: 'forbidden', status };
  if (status === 404) return { kind: 'notfound', status };
  return { kind: 'generic', status };
}

export default function QueryError({ onRetry, error, inline }: Props) {
  const { t } = useTranslation();
  const { kind, status } = classify(error);

  const Icon = kind === 'offline' ? WifiOff : kind === 'server' ? ServerCrash : AlertTriangle;
  const message = (() => {
    if (kind === 'offline') return t('common.error_offline');
    if (kind === 'server') return t('common.error_server', { status: status ?? 500 });
    if (kind === 'forbidden') return t('common.error_forbidden');
    if (kind === 'notfound') return t('common.error_notfound');
    return t('common.error_load');
  })();

  if (inline) {
    return (
      <div role="alert" className="flex items-center gap-3 px-5 py-6 text-sm">
        <Icon size={16} className="text-danger shrink-0" />
        <span className="text-text-dim flex-1">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-accent hover:text-accent-hover font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={12} /> {t('common.retry')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 fia">
      <div className="w-12 h-12 rounded-2xl bg-[#3D1414] border border-[#7A2828] flex items-center justify-center">
        <Icon size={20} className="text-danger" />
      </div>
      <div className="text-sm text-text-dim text-center max-w-xs">{message}</div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw size={14} /> {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
