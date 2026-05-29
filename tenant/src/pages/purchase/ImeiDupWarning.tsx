import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { checkImei } from '@/api/devices';
import { useDebounced } from '@/lib/useDebounced';
import { fmtDate } from '@/lib/fmt';

// ─── Duplicate-IMEI soft warning (non-blocking) ─────────────────────────

export function ImeiDupWarning({ imei }: { imei: string }) {
  const { t } = useTranslation();
  const digits = (imei || '').replace(/\D/g, '');
  const debounced = useDebounced(digits, 400);
  const enabled = debounced.length >= 14;

  const q = useQuery({
    queryKey: ['imei-check', debounced],
    queryFn: () => checkImei(debounced),
    enabled,
    staleTime: 30_000,
  });

  if (!enabled || !q.data?.found) return null;
  const d = q.data;

  const parts = [
    [d.brand, d.model].filter(Boolean).join(' '),
    d.status ? t(`status.${d.status}`) : null,
    d.purchase_date ? fmtDate(d.purchase_date) : null,
    d.seller_name,
  ].filter(Boolean);

  return (
    <div className="mt-1.5 flex items-start gap-2 px-3 py-2 rounded-lg bg-warning-faded border border-warning/30 text-warning animate-fade-in">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <div className="text-hint leading-relaxed">
        <span className="font-semibold">{t('purchase.imei_dup_warning')}</span>
        {parts.length > 0 && (
          <span className="text-warning/80"> · {parts.join(' · ')}</span>
        )}
      </div>
    </div>
  );
}
