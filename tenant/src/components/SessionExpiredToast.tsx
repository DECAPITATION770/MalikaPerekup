import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';

/**
 * Listens for the auth store's `expired` flag (raised when the API returns
 * 401 on a non-auth call) and surfaces a sonner toast. Cleared after the
 * toast is shown so it doesn't re-trigger on re-mount.
 */
export function SessionExpiredToast() {
  const { expired, clearExpired } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!expired) return;
    toast.error(t('common.session_expired'), { duration: 6000 });
    clearExpired();
  }, [expired, clearExpired, t]);

  return null;
}
