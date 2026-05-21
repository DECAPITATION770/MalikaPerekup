import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff, Wifi } from 'lucide-react';

/**
 * Top fixed banner that materialises when navigator goes offline and
 * stays visible until the connection returns. On reconnect it briefly
 * flips to a positive «вернулась связь» state, then auto-hides.
 *
 * Uses framer-motion AnimatePresence for the slide-in/out — replaces the
 * legacy CSS-animation pattern.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(navigator.onLine);
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    const goOffline = () => setOnline(false);
    const goOnline = () => {
      setOnline(true);
      setShowRecovered(true);
      window.setTimeout(() => setShowRecovered(false), 2400);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const visible = !online || showRecovered;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={online ? 'recovered' : 'offline'}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className={`fixed top-0 inset-x-0 z-50 pt-safe ${
            online ? 'bg-success-faded text-success' : 'bg-warning-faded text-warning'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="container py-2 flex items-center gap-2 text-sm font-semibold">
            {online ? <Wifi size={16} /> : <CloudOff size={16} />}
            <span>
              {online ? t('common.online_again') : t('common.offline_banner')}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
