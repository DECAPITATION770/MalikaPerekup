import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function QueryError({
  onRetry,
  status,
}: { onRetry?: () => void; status?: number }) {
  const { t } = useTranslation();
  const message =
    status === 403 ? t('common.error_forbidden')
    : status && status >= 500 ? t('common.error_server', { status })
    : t('common.error_load');

  return (
    <div className="card p-6 flex flex-col items-center text-center animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-danger-faded text-danger flex items-center justify-center mb-3 ring-1 ring-danger/20">
        <AlertCircle size={22} />
      </div>
      <p className="text-sm text-text-dim mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="h-10 px-5 rounded-xl bg-bg3 hover:bg-border text-text font-semibold text-label transition-all active:scale-[0.97] flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw size={14} />
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
