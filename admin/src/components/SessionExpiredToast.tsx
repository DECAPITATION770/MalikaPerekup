import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ui/Toast';

/**
 * Bridges the `admin:session-expired` window event (dispatched from auth store
 * on 401) into the toast system. Mounted inside ToastProvider.
 */
export default function SessionExpiredToast() {
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = () => toast.error(t('common.session_expired'));
    window.addEventListener('admin:session-expired', handler);
    return () => window.removeEventListener('admin:session-expired', handler);
  }, [toast, t]);

  return null;
}
