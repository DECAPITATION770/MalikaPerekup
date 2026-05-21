import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Package, Plus, X,
  Settings as SettingsIcon,
  ShoppingCart, BadgeDollarSign,
  CalendarClock,
} from 'lucide-react';
import { listInstallments } from '../../api/installments';

const TABS = [
  { to: '/',             icon: LayoutDashboard, key: 'nav.today' },
  { to: '/stock',        icon: Package,         key: 'nav.stock' },
  { to: '/installments', icon: CalendarClock,   key: 'nav.installments', badge: 'overdue' as const },
  { to: '/settings',     icon: SettingsIcon,    key: 'nav.settings' },
];

export default function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Лёгкий poll просрочек только чтобы показать бейдж — стандарт «1 минута».
  const { data: overdue } = useQuery({
    queryKey: ['installments', 'overdue-count'],
    queryFn: () => listInstallments({ status: 'overdue', limit: 1, offset: 0 }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const overdueCount = overdue?.total ?? 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40">
      {/* Speed-dial backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-bg/60 backdrop-blur-sm z-30 animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      <div ref={ref} className="relative z-40 bg-bg2/95 backdrop-blur-md border-t border-border">
        {/* Speed-dial: только два primary действия */}
        {open && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex flex-col items-stretch gap-2 animate-fade-up min-w-[220px]">
            <SpeedBtn
              icon={<ShoppingCart size={18} />}
              label={t('nav.purchase_new')}
              tone="accent"
              onClick={() => go('/purchase/new')}
            />
            <SpeedBtn
              icon={<BadgeDollarSign size={18} />}
              label={t('nav.sale_new')}
              tone="success"
              onClick={() => go('/sale/new')}
            />
          </div>
        )}

        <div className="grid grid-cols-5 h-16 pb-[env(safe-area-inset-bottom)]">
          {/* Left two tabs */}
          {TABS.slice(0, 2).map(({ to, icon: Icon, key, badge }) => (
            <TabItem
              key={to} to={to} Icon={Icon} label={t(key)}
              badge={badge === 'overdue' ? overdueCount : 0}
            />
          ))}

          {/* Center FAB */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={t('common.menu')}
            aria-expanded={open}
            className="flex items-center justify-center"
          >
            <span className={`w-12 h-12 -mt-4 rounded-2xl flex items-center justify-center transition-all duration-200 ring-4 ring-bg
              ${open ? 'bg-bg3 border border-border rotate-45 scale-95' : 'bg-accent scale-100'}`}>
              {open
                ? <X size={22} strokeWidth={2} className="text-text" />
                : <Plus size={22} strokeWidth={2.5} className="text-white" />
              }
            </span>
          </button>

          {/* Right two tabs */}
          {TABS.slice(2).map(({ to, icon: Icon, key, badge }) => (
            <TabItem
              key={to} to={to} Icon={Icon} label={t(key)}
              badge={badge === 'overdue' ? overdueCount : 0}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

function TabItem({
  to, Icon, label, badge,
}: {
  to: string; Icon: React.ElementType; label: string; badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 transition-colors
         ${isActive ? 'text-accent' : 'text-text-muted'}`
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            {!!badge && badge > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-danger text-white text-[10px] font-bold leading-[16px] text-center tabular-nums">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </div>
          <span className="text-micro font-semibold tracking-tight">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function SpeedBtn({
  icon, label, tone, onClick,
}: { icon: React.ReactNode; label: string; tone: 'accent' | 'success' | 'neutral'; onClick: () => void }) {
  const bg =
    tone === 'accent'  ? 'bg-accent'
    : tone === 'success' ? 'bg-success'
    : 'bg-bg3 border border-border';
  const text =
    tone === 'success' ? 'text-bg'
    : tone === 'neutral' ? 'text-text'
    : 'text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 ${bg} ${text} rounded-2xl px-5 py-3 font-semibold text-body transition-all active:scale-95`}
    >
      {icon}
      {label}
    </button>
  );
}
