import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  CircleDollarSign,
  CalendarClock,
  LayoutDashboard,
  Package,
  ShoppingCart,
} from 'lucide-react';

import { listInstallments } from '@/api/installments';
import { cn } from '@/lib/utils';

interface TabSpec {
  to: string;
  icon: React.ElementType;
  key: string;
  end?: boolean;
  badge?: 'overdue';
  /** Money actions get a coloured chip so they read as the primary verbs. */
  tone?: 'accent' | 'success';
}

const TABS: readonly TabSpec[] = [
  { to: '/', icon: LayoutDashboard, key: 'nav.today', end: true },
  { to: '/stock', icon: Package, key: 'nav.stock' },
  { to: '/purchase/new', icon: ShoppingCart, key: 'nav.buy', tone: 'accent' },
  { to: '/sale/new', icon: CircleDollarSign, key: 'nav.sell', tone: 'success' },
  { to: '/installments', icon: CalendarClock, key: 'nav.installments', badge: 'overdue' },
];

export function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { data: overdue } = useQuery({
    queryKey: ['installments', 'overdue-count'],
    queryFn: () => listInstallments({ status: 'overdue', limit: 1, offset: 0 }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const overdueCount = overdue?.total ?? 0;

  // Hide on focus-flow routes (wizards) so the global nav can't pull a user
  // mid-deal — and so the wizard's own action bar isn't stacked under it.
  // Early-return MUST come after all hooks (rules-of-hooks).
  if (pathname.startsWith('/purchase/new') || pathname.startsWith('/sale/new')) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg2/95 backdrop-blur-md md:hidden">
      <div className="grid h-[68px] grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ to, icon: Icon, key, end, badge, tone }) => (
          <TabItem
            key={to}
            to={to}
            end={!!end}
            Icon={Icon}
            label={t(key)}
            tone={tone}
            badge={badge === 'overdue' ? overdueCount : 0}
          />
        ))}
      </div>
    </nav>
  );
}

function TabItem({
  to,
  end,
  Icon,
  label,
  badge,
  tone,
}: {
  to: string;
  end: boolean;
  Icon: React.ElementType;
  label: string;
  badge?: number;
  tone?: 'accent' | 'success';
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex flex-col items-center justify-center gap-1 transition-colors',
          tone === 'accent'
            ? 'text-accent'
            : tone === 'success'
              ? 'text-success'
              : isActive
                ? 'text-accent'
                : 'text-text-muted',
        )
      }
    >
      {({ isActive }) => {
        // Both money tabs and active nav tabs now wear a 9×9 chip. The chip
        // makes "where am I" read at a glance — previously inactive nav-tab
        // and active nav-tab differed by colour only, which lost against the
        // money tabs' permanently-coloured icons. Money keeps a solid brand
        // fill when active; non-money active gets the same shape with the
        // faded accent so it's clearly «here» without competing with the
        // money CTAs in saturation.
        const showChip = Boolean(tone) || isActive;
        return (
          <>
            <div
              className={cn(
                'relative flex items-center justify-center transition-[background-color,color] duration-150',
                showChip && 'h-9 w-9 rounded-xl',
                tone === 'accent' && isActive && 'bg-accent text-[rgb(var(--c-on-accent))]',
                tone === 'success' && isActive && 'bg-success text-bg',
                !tone && isActive && 'bg-accent-faded',
              )}
            >
              {/* One icon size for every tab — the chip is a 36px backdrop, not
                  a reason to shrink the glyph. Previously chip tabs (money +
                  active) rendered at 18 while naked tabs rendered at 20, so the
                  cart/$ read visibly smaller than the grid/calendar beside them. */}
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.9} />
              {!!badge && badge > 0 && (
                <span className="absolute -right-2 -top-1.5 h-[16px] min-w-[16px] rounded-full bg-danger px-1 text-center text-[10px] font-bold tabular-nums leading-[16px] text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span className="text-micro font-semibold tracking-tight">{label}</span>
          </>
        );
      }}
    </NavLink>
  );
}
