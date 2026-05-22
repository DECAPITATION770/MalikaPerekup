/**
 * Today — three KPIs (profit / inventory / nasiya debt), quick actions,
 * and an overdue alert. Phase 3 port replaces the legacy custom KpiCard
 * stack with the new shadcn-styled KpiCard + real useCountUp animation,
 * framer-motion staggered entry, and Tg haptic on overdue alert tap.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  Package,
  Search,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { KpiCard, type KpiDelta } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FrozenIcon } from '@/components/icons';
import { EmptyStockIllustration } from '@/components/illustrations';
import { getShopMe, getToday } from '@/api/reports';
import { compactUnits, fmtUzs, fmtUzsCompact, greetingKey } from '@/lib/fmt';
import { useAuth } from '@/store/auth';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

const parseNum = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
};

export default function Today() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const haptic = useTgHaptic();

  const todayQ = useQuery({ queryKey: ['reports', 'today'], queryFn: getToday });
  const shopQ = useQuery({ queryKey: ['shops', 'me'], queryFn: getShopMe });

  const greeting = t(greetingKey());
  const firstName = user?.full_name?.split(' ')[0] ?? '';
  const COMPACT_UNITS = compactUnits(t);

  const profitDelta: KpiDelta | undefined = todayQ.data
    ? (() => {
        const today = parseNum(todayQ.data.profit_today);
        const yest = parseNum(todayQ.data.profit_yesterday);
        const label = t('today.kpi_vs_yesterday');
        if (yest === 0) return { dir: today > 0 ? 'up' : 'flat', label };
        const pct = Math.round(((today - yest) / yest) * 100);
        return {
          dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
          pct: Math.abs(pct),
          label,
        };
      })()
    : undefined;

  return (
    <div className="relative flex flex-col gap-6 md:gap-8">
      {/* Ambient mesh behind the hero — pure decoration */}
      <div
        aria-hidden
        className="hero-mesh pointer-events-none absolute inset-x-0 -top-6 -z-10 h-64 md:-top-10"
      />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-end justify-between gap-3"
      >
        <div>
          <div className="text-label font-semibold uppercase tracking-wider text-text-muted">
            {greeting}
            {firstName ? ',' : ''}
          </div>
          <h1 className="mt-1 text-title-lg font-bold tracking-tight md:text-display">
            {firstName || t('today.title')}
          </h1>
          {shopQ.data && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-dim">
              <span>{shopQ.data.name}</span>
              {shopQ.data.is_frozen && (
                <Badge variant="warning" size="sm">
                  <FrozenIcon size={11} /> {t('today.frozen_badge')}
                </Badge>
              )}
            </div>
          )}
        </div>
      </motion.header>

      {/* Overdue alert */}
      {todayQ.data && todayQ.data.overdue_payments_count > 0 && (
        <Link
          to="/installments?status=overdue"
          onClick={() => haptic.tap('medium')}
          className={cn(
            'card-elev flex items-center gap-4 p-4 md:p-5',
            'group animate-fade-up border-warning/40 transition-all hover:border-warning',
          )}
          style={{ animationDelay: '40ms' }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-faded text-warning">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-body font-bold text-text">
              {t('today.overdue_alert_title', { count: todayQ.data.overdue_payments_count })}
            </div>
            <div className="mt-0.5 text-hint text-text-dim">{t('today.overdue_alert_body')}</div>
          </div>
          <ArrowUpRight
            size={18}
            className="shrink-0 text-text-muted transition-colors group-hover:text-warning"
          />
        </Link>
      )}

      {/* 3 headline KPI */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <KpiCard
          label={t('today.kpi_profit_today')}
          value={parseNum(todayQ.data?.profit_today)}
          format={fmtUzs}
          unit={t('common.currency_uzs')}
          hint={t('today.kpi_profit_today_hint')}
          icon={<TrendingUp size={18} strokeWidth={2} />}
          tone="success"
          loading={todayQ.isLoading}
          delay={60}
          delta={profitDelta}
        />
        <KpiCard
          label={t('today.kpi_inventory_value')}
          value={parseNum(todayQ.data?.inventory_value_uzs)}
          format={(n) => fmtUzsCompact(n, COMPACT_UNITS)}
          unit={t('common.currency_uzs')}
          hint={t('today.kpi_inventory_value_hint')}
          icon={<Package size={18} strokeWidth={2} />}
          tone="warning"
          loading={todayQ.isLoading}
          delay={120}
        />
        <KpiCard
          label={t('today.kpi_nasiya_debt')}
          value={parseNum(todayQ.data?.nasiya_debt_uzs)}
          format={(n) => fmtUzsCompact(n, COMPACT_UNITS)}
          unit={t('common.currency_uzs')}
          hint={t('today.kpi_nasiya_debt_hint')}
          icon={<CalendarClock size={18} strokeWidth={2} />}
          tone={todayQ.data && todayQ.data.overdue_payments_count > 0 ? 'danger' : 'accent'}
          loading={todayQ.isLoading}
          delay={180}
        />
      </section>

      {/* Quick actions */}
      <section className="animate-fade-up" style={{ animationDelay: '240ms' }}>
        <h2 className="mb-3 text-label font-bold uppercase tracking-wider text-text-dim">
          {t('today.quick_actions')}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <QuickAction
            to="/purchase/new"
            icon={<ShoppingCart size={20} />}
            label={t('today.action_purchase')}
            tone="accent"
          />
          <QuickAction
            to="/sale/new"
            icon={<BadgeDollarSign size={20} />}
            label={t('today.action_sale')}
            tone="success"
          />
          <QuickAction
            to="/search"
            icon={<Search size={20} />}
            label={t('today.action_search')}
            tone="neutral"
          />
          <QuickAction
            to="/installments"
            icon={<CalendarClock size={20} />}
            label={t('nav.installments')}
            tone="neutral"
          />
        </div>
      </section>

      {/* Empty hero when nothing's happened yet */}
      {todayQ.data &&
        todayQ.data.sales_count_today === 0 &&
        todayQ.data.purchases_count_today === 0 &&
        todayQ.data.in_stock_count === 0 && (
          <EmptyState
            illustration={<EmptyStockIllustration />}
            title={t('today.no_data')}
            description={t('today.encourage_first_purchase')}
            action={
              <Link to="/purchase/new">
                <Button>
                  <ShoppingCart className="size-4" /> {t('today.action_purchase')}
                </Button>
              </Link>
            }
          />
        )}
    </div>
  );
}

function QuickAction({
  to,
  icon,
  label,
  tone,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  tone: 'accent' | 'success' | 'neutral';
}) {
  const ring =
    tone === 'accent'
      ? 'group-hover:ring-accent/40 group-hover:bg-accent-faded'
      : tone === 'success'
        ? 'group-hover:ring-success/40 group-hover:bg-success-faded'
        : 'group-hover:ring-border-strong group-hover:bg-bg3';
  const iconTone =
    tone === 'accent' ? 'text-accent' : tone === 'success' ? 'text-success' : 'text-text-dim';

  return (
    <Link
      to={to}
      className="card group flex cursor-pointer flex-col items-start gap-3 p-4 transition-all hover:border-border-strong md:p-5"
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-bg3 ring-1 ring-border transition-all',
          iconTone,
          ring,
        )}
      >
        {icon}
      </div>
      <div className="text-label font-semibold tracking-tight md:text-body">{label}</div>
    </Link>
  );
}
