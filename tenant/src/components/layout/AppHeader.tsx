import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  BadgeDollarSign,
  BarChart3,
  BookMarked,
  Globe,
  LogOut,
  MoreHorizontal,
  Search,
  Settings as SettingsIcon,
  ShoppingCart,
  Users,
} from 'lucide-react';

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeIconButton } from '@/components/ThemeToggle';
import { MalikaWordmark } from '@/components/brand/MalikaWordmark';
import { useTgHaptic } from '@/lib/telegram';
import { useAuth } from '@/store/auth';

/** Items that don't earn a bottom-nav slot but must stay reachable. Grouped
 *  the same way as the desktop sidebar: live destinations, then «Архив». */
const MENU_PRIMARY = [
  { to: '/catalog', icon: BookMarked, key: 'nav.catalog' },
  { to: '/counterparties', icon: Users, key: 'nav.counterparties' },
  { to: '/reports', icon: BarChart3, key: 'nav.reports' },
  { to: '/settings', icon: SettingsIcon, key: 'nav.settings' },
] as const;

const MENU_ARCHIVE = [
  { to: '/purchases', icon: ShoppingCart, key: 'nav.purchases' },
  { to: '/sales', icon: BadgeDollarSign, key: 'nav.sales' },
] as const;

/** Top bar — slim on mobile (brand + lang/theme/search/menu drawer), and on
 *  desktop a compact strip with just lang/theme/avatar-dropdown that lives
 *  next to the sidebar (sidebar already owns the brand + navigation). */
interface AppHeaderProps {
  /** Open the Cmd+K palette. Wired in AppLayout so a single instance of
   *  the palette lives at the shell level. Optional so the component
   *  still renders if mounted outside the shell (e.g. in Storybook). */
  onOpenSearch?: () => void;
}

export function AppHeader({ onOpenSearch }: AppHeaderProps = {}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const haptic = useTgHaptic();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = () => {
    localStorage.setItem('tenant_manual_logout', '1');
    logout();
  };

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

  const initials =
    user?.full_name
      ?.split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'M';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg2/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-2 px-4 md:justify-end md:px-6">
          {/* Brand — mobile only; sidebar owns it on desktop. */}
          <button
            type="button"
            onClick={() => go('/')}
            aria-label="Malika"
            className="cursor-pointer md:hidden"
          >
            <MalikaWordmark size="sm" className="text-text" decorative />
          </button>
          <div className="flex items-center gap-1">
            {/* Lang toggle mirrors ThemeToggle's convention: the chip shows
                the *applied* language so the visible state matches the
                actually-rendered text, and the `aria-label` is verb-led so
                screen-readers announce the action that will happen on tap. */}
            <button
              type="button"
              onClick={toggleLang}
              aria-label={t(
                i18n.language === 'ru' ? 'settings.lang_switch_to_uz' : 'settings.lang_switch_to_ru',
              )}
              className="flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-caption font-bold tracking-wide text-text-dim transition-colors hover:text-text active:bg-bg3"
            >
              {/* Identifier tokens — auto-translate must not turn "RU" into
                  "ru" or worse. */}
              <span translate="no">{i18n.language === 'ru' ? 'RU' : 'UZ'}</span>
            </button>
            <ThemeIconButton />
            {/* Desktop search trigger was here — removed because Sidebar
                already carries one. On desktop the Sidebar is always
                visible, so two adjacent «Поиск» buttons just confused
                the eye. Mobile keeps its icon-only button below since
                there's no sidebar on small screens. */}
            <button
              type="button"
              onClick={() => {
                haptic.tap('light');
                if (onOpenSearch) onOpenSearch();
                else navigate('/search');
              }}
              aria-label={t('nav.search')}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-text-dim transition-colors hover:text-text active:bg-bg3 md:hidden"
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
              className="flex h-10 w-10 items-center justify-center rounded-xl text-text-dim transition-colors hover:text-text active:bg-bg3 md:hidden"
            >
              <MoreHorizontal size={20} />
            </button>
            {/* Account dropdown — desktop only. Avatar + name/contact in the
                header, then Settings link and Logout. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={user?.full_name ?? t('common.menu')}
                  className="ml-1 hidden h-10 items-center gap-2 rounded-xl px-1.5 text-text-dim transition-colors hover:text-text active:bg-bg3 md:flex"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-accent text-hint text-[rgb(var(--c-on-accent))]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="truncate text-label font-semibold text-text">
                    {user?.full_name ?? '—'}
                  </span>
                  {(user?.tg_username || user?.phone) && (
                    <span className="truncate text-caption font-normal text-text-muted">
                      {user.tg_username ? `@${user.tg_username}` : user.phone}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/settings')}>
                  <SettingsIcon size={15} className="mr-2" />
                  {t('nav.settings')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleLang}>
                  <Globe size={15} className="mr-2" />
                  {i18n.language === 'ru' ? 'O‘zbekcha' : 'Русский'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setConfirmLogout(true)}
                  className="text-danger focus:text-danger"
                >
                  <LogOut size={15} className="mr-2" />
                  {t('common.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="md:hidden">
          <DrawerHeader>
            <DrawerTitle>{t('common.menu')}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-0.5 px-3 pb-6">
            {MENU_PRIMARY.map(({ to, icon: Icon, key }) => (
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

            <div className="px-3 pb-1 pt-4 text-micro font-semibold tracking-tight text-text-muted">
              {t('nav.archive')}
            </div>
            {MENU_ARCHIVE.map(({ to, icon: Icon, key }) => (
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
              onClick={() => {
                setOpen(false);
                setConfirmLogout(true);
              }}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-body font-semibold text-text-muted transition-colors hover:bg-danger-faded/40 hover:text-danger active:bg-bg3"
            >
              <LogOut size={18} strokeWidth={1.8} />
              {t('common.logout')}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logout.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('logout.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-danger text-white hover:bg-danger/90"
            >
              <LogOut className="size-4" /> {t('common.logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
