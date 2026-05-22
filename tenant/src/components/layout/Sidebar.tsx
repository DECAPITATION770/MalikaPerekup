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
  Users as UsersIcon,
  Settings as SettingsIcon,
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

interface NavSpec {
  to: string;
  icon: React.ElementType;
  key: string;
  end?: boolean;
}

const NAV_PRIMARY: readonly NavSpec[] = [
  { to: '/', icon: LayoutDashboard, key: 'nav.today', end: true },
  { to: '/stock', icon: Package, key: 'nav.stock' },
  { to: '/installments', icon: CalendarClock, key: 'nav.installments' },
  { to: '/reports', icon: BarChart3, key: 'nav.reports' },
  { to: '/settings', icon: SettingsIcon, key: 'nav.settings' },
];

const NAV_ARCHIVE: readonly NavSpec[] = [
  { to: '/purchases', icon: ShoppingCart, key: 'nav.purchases' },
  { to: '/sales', icon: BadgeDollarSign, key: 'nav.sales' },
  { to: '/counterparties', icon: UsersIcon, key: 'nav.counterparties' },
];

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
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
    <aside className="hidden md:flex w-[244px] shrink-0 h-dvh sticky top-0 flex-col bg-bg2 border-r border-border">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <MalikaWordmark size="md" className="text-text" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
        {NAV_PRIMARY.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-body font-semibold tracking-tight transition-all',
                isActive
                  ? 'bg-accent-faded text-accent'
                  : 'text-text-dim hover:text-text hover:bg-bg3',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{t(key)}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className="text-micro text-text-muted uppercase tracking-wider font-semibold px-3 pt-5 pb-1">
          {t('nav.archive')}
        </div>
        {NAV_ARCHIVE.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-label font-medium tracking-tight transition-all',
                isActive
                  ? 'bg-accent-faded text-accent'
                  : 'text-text-muted hover:text-text hover:bg-bg3',
              )
            }
          >
            <Icon size={16} strokeWidth={1.6} />
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-border flex flex-col gap-1">
        <button
          onClick={toggleLang}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-label font-semibold text-text-dim hover:text-text hover:bg-bg3 transition-all w-full cursor-pointer"
        >
          <Globe size={16} strokeWidth={1.8} />
          {i18n.language === 'ru' ? 'RU → UZ' : 'UZ → RU'}
        </button>

        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <Avatar className="size-9">
            <AvatarFallback className="bg-accent text-[rgb(var(--c-on-accent))] text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-label font-semibold text-text truncate">
              {user?.full_name ?? '—'}
            </div>
            <div className="text-caption text-text-muted truncate">
              {user?.tg_username ? `@${user.tg_username}` : (user?.phone ?? '—')}
            </div>
          </div>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-label font-semibold text-text-muted hover:text-danger hover:bg-danger-faded/40 transition-all w-full cursor-pointer">
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
                className="bg-danger hover:bg-danger/90 text-white"
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
