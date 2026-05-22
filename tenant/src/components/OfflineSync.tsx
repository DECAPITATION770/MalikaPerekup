import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { makePayment } from '@/api/installments';
import { flushQueue, queueSize } from '@/lib/offlineQueue';

/**
 * Replays the offline payment queue whenever the connection returns (and
 * once on mount, in case the app reopened online with a non-empty queue).
 * Shows a sonner toast summarising how many payments synced.
 */
export function OfflineSync() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine) return;
      if ((await queueSize()) === 0) return;
      const flushed = await flushQueue((planId, amount) => makePayment(planId, amount));
      if (flushed > 0) {
        toast.success(t('installments.synced_n', { count: flushed }));
        qc.invalidateQueries({ queryKey: ['installments'] });
      }
    };

    void sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [qc, t]);

  return null;
}
