import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BadgeDollarSign,
  CalendarClock,
  BarChart3,
  BookMarked,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Search,
  LogOut,
  Globe,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MalikaWordmark } from '@/components/brand/MalikaWordmark';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';
import { useTheme, THEME_ICON } from '@/lib/theme';

interface NavSpec {
  to: string;
  icon: React.ElementType;
  key: string;
  end?: boolean;
}

const NAV_PRIMARY: readonly NavSpec[] = [
  { to: '/', icon: LayoutDashboard, key: 'nav.today', end: true },
  { to: '/stock', icon: Package, key: 'nav.stock' },
  { to: '/catalog', icon: BookMarked, key: 'nav.catalog' },
  { to: '/search', icon: Search, key: 'nav.search' },
  { to: '/counterparties', icon: UsersIcon, key: 'nav.counterparties' },
  { to: '/installments', icon: CalendarClock, key: 'nav.installments' },
  { to: '/reports', icon: BarChart3, key: 'nav.reports' },
  { to: '/settings', icon: SettingsIcon, key: 'nav.settings' },
];

const NAV_ARCHIVE: readonly NavSpec[] = [
  { to: '/purchases', icon: ShoppingCart, key: 'nav.purchases' },
  { to: '/sales', icon: BadgeDollarSign, key: 'nav.sales' },
];

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { pref: themePref, cycle: cycleTheme } = useTheme();
  const ThemeIcon = THEME_ICON[themePref];
  const [confirmOpen, setConfirmOpen] = useState(false);

  const initials =
    user?.full_name
      ?.split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'M';

  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'uz' : 'ru';
    void i18n.changeLanguage(next).then(() => toast.success(t('common.language_switched')));
    localStorage.setItem('tenant_lang', next);
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col border-r border-border bg-bg2 md:flex">
      {/* Brand */}
      <div className="border-b border-border px-5 pb-5 pt-6">
        <MalikaWordmark size="md" className="text-text" />
      </div>

      {/* Money actions — the two verbs the shop runs all day */}
      <div className="flex flex-col gap-2 px-3 pt-4">
        <NavLink
          to="/purchase/new"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-label font-bold text-[rgb(var(--c-on-accent))] transition-colors hover:bg-accent-hover"
        >
          <ShoppingCart size={17} strokeWidth={2.2} />
          {t('nav.buy')}
        </NavLink>
        <NavLink
          to="/sale/new"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-success text-label font-bold text-bg transition-opacity hover:opacity-90"
        >
          <BadgeDollarSign size={17} strokeWidth={2.2} />
          {t('nav.sell')}
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="scrollbar-thin flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {NAV_PRIMARY.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-body font-semibold tracking-tight transition-all',
                isActive
                  ? 'bg-accent-faded text-accent'
                  : 'text-text-dim hover:bg-bg3 hover:text-text',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{t(key)}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className="px-3 pb-1 pt-5 text-micro font-semibold uppercase tracking-wider text-text-muted">
          {t('nav.archive')}
        </div>
        {NAV_ARCHIVE.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-label font-medium tracking-tight transition-all',
                isActive
                  ? 'bg-accent-faded text-accent'
                  : 'text-text-muted hover:bg-bg3 hover:text-text',
              )
            }
          >
            <Icon size={16} strokeWidth={1.6} />
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-1 border-t border-border px-3 pb-4 pt-3">
        <button
          onClick={cycleTheme}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-label font-semibold text-text-dim transition-all hover:bg-bg3 hover:text-text"
        >
          <ThemeIcon size={16} strokeWidth={1.8} />
          {t('settings.theme_label')}: {t(`settings.theme_${themePref}`)}
        </button>
        <button
          onClick={toggleLang}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-label font-semibold text-text-dim transition-all hover:bg-bg3 hover:text-text"
        >
          <Globe size={16} strokeWidth={1.8} />
          {i18n.language === 'ru' ? t('settings.lang_uz') : t('settings.lang_ru')}
        </button>

        <div className="mt-1 flex items-center gap-3 px-3 py-2.5">
          <Avatar className="size-9">
            <AvatarFallback className="bg-accent text-xs text-[rgb(var(--c-on-accent))]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-label font-semibold text-text">
              {user?.full_name ?? '—'}
            </div>
            <div className="truncate text-caption text-text-muted">
              {user?.tg_username ? `@${user.tg_username}` : (user?.phone ?? '—')}
            </div>
          </div>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <button className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-label font-semibold text-text-muted transition-all hover:bg-danger-faded/40 hover:text-danger">
              <LogOut size={15} strokeWidth={1.8} />
              {t('common.logout')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('logout.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('logout.body')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => logout()}
                className="bg-danger text-white hover:bg-danger/90"
              >
                <LogOut className="size-4" /> {t('common.logout')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </aside>
  );
}
