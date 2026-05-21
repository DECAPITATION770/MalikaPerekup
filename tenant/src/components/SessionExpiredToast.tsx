import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/auth';
import { useToast } from './ui/Toast';

export default function SessionExpiredToast() {
  const { t } = useTranslation();
  const { expired, clearExpired } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (expired) {
      toast.error(t('common.session_expired'));
      clearExpired();
    }
  }, [expired, clearExpired, toast, t]);

  return null;
}
