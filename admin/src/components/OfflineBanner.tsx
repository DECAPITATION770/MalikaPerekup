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
    <div role="status" className="bg-[#3F2F0A] border-b border-[#7A5C18] text-warning text-sm font-semibold px-4 py-2 flex items-center justify-center gap-2 fia">
      <WifiOff size={14} />
      {t('common.offline_banner')}
    </div>
  );
}
