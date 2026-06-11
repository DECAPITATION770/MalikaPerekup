import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * Bridges the `admin:session-expired` window event (dispatched from auth store
 * on 401) into the toast system.
 */
export default function SessionExpiredToast() {
  const { t } = useTranslation();

  useEffect(() => {
    const handler = () => toast.error(t('common.session_expired'));
    window.addEventListener('admin:session-expired', handler);
    return () => window.removeEventListener('admin:session-expired', handler);
  }, [t]);

  return null;
}
