/**
 * Admin sidebar — fixed left rail with primary nav, language switch,
 * theme toggle, signed-in admin row and a destructive logout action.
 *
 * Layout pattern: brand block / nav (flex-1, scrollable) / footer
 * (lang + theme + user + logout). Sentence-case throughout; the active
 * route gets an accent rail + filled icon (two-tone restraint copied
 * from the tenant sidebar after the 3ef677b design pass).
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Store,
  Users as UsersIcon,
  ShieldAlert,
  CreditCard,
  BarChart3,
  DatabaseBackup,
  LogOut,
  Globe,
} from 'lucide-react';

import { useAuth } from '../../store/auth';
import { useTheme, THEME_ICON, THEME_ORDER, type ThemePref } from '@/lib/theme';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/Button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/',      icon: LayoutDashboard, key: 'nav.dashboard' },
  { to: '/shops', icon: Store,           key: 'nav.shops' },
  { to: '/users', icon: UsersIcon,       key: 'nav.users' },
  { to: '/log',   icon: ShieldAlert,     key: 'nav.auth_log' },
  { to: '/debts', icon: CreditCard,      key: 'nav.debts' },
  { to: '/stats', icon: BarChart3,       key: 'nav.stats' },
  { to: '/backup', icon: DatabaseBackup, key: 'nav.backup' },
] as const;

function nextLang(current: string): 'ru' | 'uz' {
  return current === 'ru' ? 'uz' : 'ru';
}

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const { admin, logout } = useAuth();
  const { pref, resolved, cycle } = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggleLang = () => {
    const next = nextLang(i18n.language);
    i18n.changeLanguage(next).then(() => {
      toast.success(t('common.language_switched'));
    });
    localStorage.setItem('admin_lang', next);
  };

  const initials =
    admin?.full_name
      ?.split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'A';

  const ThemeIcon = THEME_ICON[pref as ThemePref];
  const themeOrderIdx = THEME_ORDER.indexOf(pref as ThemePref);
  const nextThemeIdx = (themeOrderIdx + 1) % THEME_ORDER.length;

  return (
    <>
      <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-border bg-bg2">
        {/* Brand */}
        <div className="border-b border-border px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent text-label font-bold text-accent-fg">
              M
            </div>
            <div>
              <div className="text-label font-bold tracking-tight leading-none">
                Malika
              </div>
              <div className="mt-0.5 text-micro text-text-muted">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Primary nav */}
        <nav
          aria-label={t('nav.primary_label', 'Primary navigation')}
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4"
        >
          {NAV.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-label font-medium tracking-tight transition-colors',
                  isActive
                    ? 'border-l-2 border-l-accent bg-bg3 pl-[10px] text-text'
                    : 'border-l-2 border-l-transparent pl-[10px] text-text-dim hover:bg-bg3 hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.7}
                    className={isActive ? 'text-accent' : ''}
                    aria-hidden
                  />
                  {t(key)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer: lang, theme, user, logout */}
        <div className="flex flex-col gap-1 border-t border-border px-3 pb-4 pt-3">
          <button
            type="button"
            onClick={toggleLang}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-label font-medium tracking-tight text-text-dim transition-colors hover:bg-bg3 hover:text-text cursor-pointer"
          >
            <Globe size={18} strokeWidth={1.7} aria-hidden />
            <span className="flex-1 text-left">
              {i18n.language === 'ru' ? 'RU' : 'UZ'}
            </span>
            <span className="text-caption text-text-muted">
              → {nextLang(i18n.language).toUpperCase()}
            </span>
          </button>

          <button
            type="button"
            onClick={cycle}
            aria-label={t('common.theme_toggle', 'Toggle theme')}
            title={`${pref} (${resolved})`}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-label font-medium tracking-tight text-text-dim transition-colors hover:bg-bg3 hover:text-text cursor-pointer"
          >
            <ThemeIcon size={18} strokeWidth={1.7} aria-hidden />
            <span className="flex-1 text-left capitalize">{pref}</span>
            <span className="text-caption text-text-muted capitalize">
              → {THEME_ORDER[nextThemeIdx]}
            </span>
          </button>

          {/* User row */}
          <div className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-bold text-accent-fg">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-hint font-semibold text-text">
                {admin?.full_name}
              </div>
              <div className="truncate text-micro text-text-muted">
                @{admin?.tg_username ?? admin?.login ?? '—'}
              </div>
            </div>
          </div>

          {/* Destructive — visually separated */}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-hint font-medium tracking-tight text-text-muted transition-colors hover:bg-danger-faded hover:text-danger cursor-pointer"
            title={t('common.logout')}
          >
            <LogOut size={16} strokeWidth={1.7} aria-hidden />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('common.logout_confirm_title')}</DialogTitle>
          </DialogHeader>
          <p className="text-hint leading-relaxed text-text-dim">
            {t('common.logout_confirm_body')}
          </p>
          <DialogFooter>
            <Button variant="secondary" full onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              full
              onClick={() => {
                setConfirmOpen(false);
                logout();
              }}
            >
              <LogOut size={15} /> {t('common.logout')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
