import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
} from 'lucide-react';
import { MalikaWordmark } from '@/components/brand/MalikaWordmark';
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

/**
 * Desktop sidebar — brand, the two money-action CTAs, and navigation. Nothing
 * else. Theme, language, account and logout live in the top-right header
 * dropdown so the chrome stays minimal and consistent across breakpoints.
 */
export function Sidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  // Focus-mode on wizard routes — mirror BottomNav.tsx:48 behaviour for
  // desktop. Without this a misclick in the sidebar mid-deal silently
  // drops the user out of the wizard with the draft autosaved but no
  // visible trace of the in-flight transaction. On mobile BottomNav
  // hides for the same reason; desktop deserves the same focus.
  if (pathname.startsWith('/purchase/new') || pathname.startsWith('/sale/new')) {
    return null;
  }

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

      {/* Nav — labelled because the desktop chrome carries three landmarks
          (aside, header, main) and SR users need to distinguish them. */}
      <nav
        aria-label={t('nav.primary_label')}
        className="scrollbar-thin flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4"
      >
        {NAV_PRIMARY.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            // Two-tone restraint (modernization move #4): active state used to
            // be a full amber chip (bg-accent-faded text-accent) on every nav
            // row, which painted half the sidebar orange. Now active is
            // text-text + a left rail accent + filled icon — three small
            // channels of state hand off the hierarchy without dominating the
            // page with brand colour. The primary amber budget is reserved
            // for the two real CTAs above the nav (Принять закупку / Продать).
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-body font-semibold tracking-tight transition-colors duration-150',
                isActive
                  ? 'bg-bg3 text-text'
                  : 'text-text-dim hover:bg-bg3 hover:text-text',
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* 2 px accent rail on active — the indicator that does the
                    "where am I" work. Sits inside the row's rounded shape so
                    it reads as part of the chip, not a sidebar border. */}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
                  />
                )}
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={cn(
                    isActive && 'fill-accent/15 text-accent',
                  )}
                />
                <span>{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}

        <div className="px-3 pb-1 pt-5 text-micro font-semibold tracking-tight text-text-muted">
          {t('nav.archive')}
        </div>
        {NAV_ARCHIVE.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            // Archive nav stays quieter than the primary group — only a colour
            // shift on active, no rail, since these aren't the rooms users
            // live in. Keeps visual hierarchy: brand → CTAs → primary nav →
            // archive.
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-label font-medium tracking-tight transition-colors duration-150',
                isActive
                  ? 'bg-bg3 text-text'
                  : 'text-text-muted hover:bg-bg3 hover:text-text',
              )
            }
          >
            <Icon size={16} strokeWidth={1.6} />
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
