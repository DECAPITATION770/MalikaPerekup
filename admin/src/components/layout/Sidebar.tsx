import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../store/auth';
import {
  LayoutDashboard, Store, Users as UsersIcon, ShieldAlert,
  CreditCard, BarChart3, LogOut, Globe,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';

const NAV = [
  { to: '/',      icon: LayoutDashboard, key: 'nav.dashboard' },
  { to: '/shops', icon: Store,           key: 'nav.shops' },
  { to: '/users', icon: UsersIcon,       key: 'nav.users' },
  { to: '/log',   icon: ShieldAlert,     key: 'nav.auth_log' },
  { to: '/debts', icon: CreditCard,      key: 'nav.debts' },
  { to: '/stats', icon: BarChart3,       key: 'nav.stats' },
];

export default function Sidebar() {
  const { t, i18n } = useTranslation();
  const { admin, logout } = useAuth();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'uz' : 'ru';
    i18n.changeLanguage(next).then(() => {
      // After language change t() returns the NEW language's string
      toast.info(t('common.language_switched'));
    });
    localStorage.setItem('admin_lang', next);
  };

  const initials = admin?.full_name
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'A';

  return (
    <>
      <aside className="w-[232px] shrink-0 h-screen sticky top-0 flex flex-col bg-bg2 border-r border-border">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0">
              M
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight leading-none">Malika</div>
              <div className="text-[11px] text-text-muted mt-0.5">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold tracking-tight transition-all
                 ${isActive
                   ? 'bg-accent-faded text-accent'
                   : 'text-text-dim hover:text-text hover:bg-bg3'
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  {t(key)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 border-t border-border pt-3 flex flex-col gap-1">
          <button
            onClick={toggleLang}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold text-text-dim hover:text-text hover:bg-bg3 transition-all w-full cursor-pointer"
          >
            <Globe size={18} strokeWidth={1.8} />
            {i18n.language === 'ru' ? 'RU → UZ' : 'UZ → RU'}
          </button>

          {/* User row — no inline logout, separated below */}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-text truncate">{admin?.full_name}</div>
              <div className="text-[11px] text-text-muted truncate">@{admin?.tg_username ?? admin?.login ?? '—'}</div>
            </div>
          </div>

          {/* Destructive action — visually separated with margin + danger color */}
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-[13px] font-semibold text-text-muted hover:text-danger hover:bg-[#3D1414]/40 transition-all w-full cursor-pointer"
            title={t('common.logout')}
          >
            <LogOut size={16} strokeWidth={1.8} />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('common.logout_confirm_title')}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" full onClick={() => { setConfirmOpen(false); logout(); }}>
              <LogOut size={15} /> {t('common.logout')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-dim leading-relaxed">
          {t('common.logout_confirm_body')}
        </p>
      </Modal>
    </>
  );
}
