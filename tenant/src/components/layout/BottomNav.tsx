import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeDollarSign,
  CalendarClock,
  LayoutDashboard,
  Package,
  Plus,
  Settings as SettingsIcon,
  ShoppingCart,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { listInstallments } from '@/api/installments';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

interface TabSpec {
  to: string;
  icon: React.ElementType;
  key: string;
  end?: boolean;
  badge?: 'overdue';
}

const TABS: readonly TabSpec[] = [
  { to: '/', icon: LayoutDashboard, key: 'nav.today', end: true },
  { to: '/stock', icon: Package, key: 'nav.stock' },
  { to: '/installments', icon: CalendarClock, key: 'nav.installments', badge: 'overdue' },
  { to: '/settings', icon: SettingsIcon, key: 'nav.settings' },
];

export function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useTgHaptic();
  const [open, setOpen] = useState(false);

  const { data: overdue } = useQuery({
    queryKey: ['installments', 'overdue-count'],
    queryFn: () => listInstallments({ status: 'overdue', limit: 1, offset: 0 }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const overdueCount = overdue?.total ?? 0;

  const go = (path: string) => {
    setOpen(false);
    haptic.select();
    navigate(path);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg2/95 backdrop-blur-md border-t border-border">
        <div className="grid grid-cols-5 h-16 pb-[env(safe-area-inset-bottom)]">
          {TABS.slice(0, 2).map(({ to, icon: Icon, key, end, badge }) => (
            <TabItem
              key={to}
              to={to}
              end={!!end}
              Icon={Icon}
              label={t(key)}
              badge={badge === 'overdue' ? overdueCount : 0}
            />
          ))}

          {/* Center FAB */}
          <button
            type="button"
            onClick={() => {
              haptic.tap('light');
              setOpen((v) => !v);
            }}
            aria-label={t('common.menu')}
            aria-expanded={open}
            className="flex items-center justify-center"
          >
            <motion.span
              animate={open ? { rotate: 45, scale: 0.95 } : { rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className={cn(
                'w-12 h-12 -mt-4 rounded-2xl flex items-center justify-center ring-4 ring-bg',
                open
                  ? 'bg-bg3 border border-border'
                  : 'bg-accent',
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={open ? 'x' : 'plus'}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.12 }}
                >
                  {open ? (
                    <X size={22} strokeWidth={2} className="text-text" />
                  ) : (
                    <Plus
                      size={22}
                      strokeWidth={2.5}
                      className="text-[rgb(var(--c-on-accent))]"
                    />
                  )}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          </button>

          {TABS.slice(2).map(({ to, icon: Icon, key, end, badge }) => (
            <TabItem
              key={to}
              to={to}
              end={!!end}
              Icon={Icon}
              label={t(key)}
              badge={badge === 'overdue' ? overdueCount : 0}
            />
          ))}
        </div>
      </nav>

      {/* Speed-dial drawer — vaul bottom-sheet replaces the legacy ad-hoc backdrop */}
      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="md:hidden">
          <DrawerHeader>
            <DrawerTitle>{t('common.menu')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 pb-6 flex flex-col gap-2.5">
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
        </DrawerContent>
      </Drawer>
    </>
  );
}

function TabItem({
  to,
  end,
  Icon,
  label,
  badge,
}: {
  to: string;
  end: boolean;
  Icon: React.ElementType;
  label: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex flex-col items-center justify-center gap-0.5 transition-colors',
          isActive ? 'text-accent' : 'text-text-muted',
        )
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
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'accent' | 'success';
  onClick: () => void;
}) {
  const cls =
    tone === 'accent'
      ? 'bg-accent text-[rgb(var(--c-on-accent))]'
      : 'bg-success text-bg';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-2xl px-5 py-3 font-semibold text-body transition-all active:scale-95',
        cls,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
