import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../store/auth';
import {
  LayoutDashboard, Package, ShoppingCart, BadgeDollarSign, CalendarClock,
  BarChart3, Users as UsersIcon, Settings as SettingsIcon, LogOut, Globe,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';

// Primary actions every day — Today / Stock / Installments / Reports / Settings.
const NAV_PRIMARY = [
  { to: '/',               icon: LayoutDashboard,  key: 'nav.today' },
  { to: '/stock',          icon: Package,          key: 'nav.stock' },
  { to: '/installments',   icon: CalendarClock,    key: 'nav.installments' },
  { to: '/reports',        icon: BarChart3,        key: 'nav.reports' },
  { to: '/settings',       icon: SettingsIcon,     key: 'nav.settings' },
];

// History/archive — used occasionally, kept under a separator with muted style.
const NAV_ARCHIVE = [
  { to: '/purchases',      icon: ShoppingCart,     key: 'nav.purchases' },
  { to: '/sales',          icon: BadgeDollarSign,  key: 'nav.sales' },
  { to: '/counterparties', icon: UsersIcon,        key: 'nav.counterparties' },
];

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'uz' : 'ru';
    i18n.changeLanguage(next).then(() => toast.info(t('common.language_switched')));
    localStorage.setItem('tenant_lang', next);
  };

  const initials = user?.full_name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'M';

  return (
    <>
      <aside className="hidden md:flex w-[244px] shrink-0 h-screen sticky top-0 flex-col bg-bg2 border-r border-border">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold shrink-0">M</div>
            <div>
              <div className="text-body-lg font-bold tracking-tight leading-none">Malika</div>
              <div className="text-caption text-text-muted mt-1">Perekup</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
          {NAV_PRIMARY.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-body font-semibold tracking-tight transition-all
                 ${isActive
                   ? 'bg-accent-faded text-accent'
                   : 'text-text-dim hover:text-text hover:bg-bg3'
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{t(key)}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />}
                </>
              )}
            </NavLink>
          ))}

          {/* Archive group — visually quieter (smaller text, muted by default) */}
          <div className="text-micro text-text-muted uppercase tracking-wider font-semibold px-3 pt-5 pb-1">
            {t('nav.archive')}
          </div>
          {NAV_ARCHIVE.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-label font-medium tracking-tight transition-all
                 ${isActive
                   ? 'bg-accent-faded text-accent'
                   : 'text-text-muted hover:text-text hover:bg-bg3'
                 }`
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
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs shrink-0">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-label font-semibold text-text truncate">{user?.full_name ?? '—'}</div>
              <div className="text-caption text-text-muted truncate">
                {user?.tg_username ? `@${user.tg_username}` : user?.phone ?? '—'}
              </div>
            </div>
          </div>

          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-label font-semibold text-text-muted hover:text-danger hover:bg-danger-faded/40 transition-all w-full cursor-pointer"
          >
            <LogOut size={15} strokeWidth={1.8} />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('logout.title')}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" full icon={<LogOut size={15} />} onClick={() => { setConfirmOpen(false); logout(); }}>
              {t('common.logout')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-dim leading-relaxed">{t('logout.body')}</p>
      </Modal>
    </>
  );
}
