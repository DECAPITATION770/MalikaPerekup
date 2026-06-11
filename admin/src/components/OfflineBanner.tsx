import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ui/Toast';
import { WifiOff } from 'lucide-react';

/**
 * Top-of-app banner when navigator.onLine is false. Toast on reconnect.
 * Mounted once inside the auth-protected AppLayout.
 */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const toast = useToast();
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const onOffline = () => { setOffline(true); setWasOffline(true); };
    const onOnline = () => {
      setOffline(false);
      if (wasOffline) toast.success(t('common.online_again'));
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [wasOffline, toast, t]);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fia flex items-center justify-center gap-2 border-b border-warning/30 bg-warning-faded px-4 py-2 text-label font-semibold text-warning"
    >
      <WifiOff size={14} aria-hidden />
      {t('common.offline_banner')}
    </div>
  );
}
