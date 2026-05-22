import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  BadgeDollarSign,
  BarChart3,
  Globe,
  MoreHorizontal,
  Search,
  Settings as SettingsIcon,
  ShoppingCart,
  Users,
} from 'lucide-react';

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { MalikaWordmark } from '@/components/brand/MalikaWordmark';
import { useTgHaptic } from '@/lib/telegram';

/** Items that don't earn a bottom-nav slot but must stay reachable. */
const MENU = [
  { to: '/counterparties', icon: Users, key: 'nav.counterparties' },
  { to: '/reports', icon: BarChart3, key: 'nav.reports' },
  { to: '/purchases', icon: ShoppingCart, key: 'nav.purchases' },
  { to: '/sales', icon: BadgeDollarSign, key: 'nav.sales' },
  { to: '/settings', icon: SettingsIcon, key: 'nav.settings' },
] as const;

/** Slim mobile top bar: brand + global search + overflow menu. Frees the
 *  bottom nav for the two money actions (Buy/Sell) and makes search and the
 *  low-frequency destinations discoverable. Hidden on desktop (Sidebar owns
 *  navigation there). */
export function AppHeader() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const haptic = useTgHaptic();
  const [open, setOpen] = useState(false);

  const go = (path: string) => {
    setOpen(false);
    haptic.select();
    navigate(path);
  };

  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'uz' : 'ru';
    void i18n.changeLanguage(next).then(() => toast.success(t('common.language_switched')));
    localStorage.setItem('tenant_lang', next);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg2/95 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => go('/')}
            aria-label="Malika"
            className="cursor-pointer"
          >
            <MalikaWordmark size="sm" className="text-text" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                haptic.tap('light');
                navigate('/search');
              }}
              aria-label={t('nav.search')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-text-dim transition-colors hover:text-text active:bg-bg3"
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              onClick={() => {
                haptic.tap('light');
                setOpen(true);
              }}
              aria-label={t('common.menu')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-text-dim transition-colors hover:text-text active:bg-bg3"
            >
              <MoreHorizontal size={22} />
            </button>
          </div>
        </div>
      </header>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="md:hidden">
          <DrawerHeader>
            <DrawerTitle>{t('common.menu')}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-0.5 px-3 pb-6">
            {MENU.map(({ to, icon: Icon, key }) => (
              <button
                key={to}
                type="button"
                onClick={() => go(to)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-body font-semibold text-text-dim transition-colors hover:bg-bg3 hover:text-text active:bg-bg3"
              >
                <Icon size={18} strokeWidth={1.8} />
                {t(key)}
              </button>
            ))}
            <div className="mx-3 my-1.5 h-px bg-border" />
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-body font-semibold text-text-dim transition-colors hover:bg-bg3 hover:text-text active:bg-bg3"
            >
              <Globe size={18} strokeWidth={1.8} />
              {i18n.language === 'ru' ? t('settings.lang_uz') : t('settings.lang_ru')}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
