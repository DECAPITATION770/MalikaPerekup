import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(navigator.onLine);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const onUp = () => {
      setOnline(true);
      setShowBack(true);
      setTimeout(() => setShowBack(false), 2400);
    };
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  if (!online) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-warning-faded border-b border-warning/40 text-warning text-label font-semibold tracking-tight flex items-center justify-center gap-2 py-2 animate-fade-in">
        <WifiOff size={14} /> {t('common.offline_banner')}
      </div>
    );
  }
  if (showBack) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-success-faded border-b border-success/40 text-success text-label font-semibold tracking-tight flex items-center justify-center gap-2 py-2 animate-fade-in">
        <Wifi size={14} /> {t('common.online_again')}
      </div>
    );
  }
  return null;
}
