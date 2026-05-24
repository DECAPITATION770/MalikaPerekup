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
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  BookMarked,
  CalendarClock,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { KpiCard, type KpiDelta } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { FrozenIcon } from '@/components/icons';
import { EmptyStockIllustration } from '@/components/illustrations';
import { getPeriodReport, getShopMe, getToday } from '@/api/reports';
import { compactUnits, fmtUzs, fmtUzsCompact, greetingKey } from '@/lib/fmt';
import { useAuth } from '@/store/auth';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

const parseNum = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const isoTashkent = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
const SPARK_TO = isoTashkent(new Date());
const SPARK_FROM = isoTashkent(new Date(Date.now() - 6 * 86_400_000));

export default function Today() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const haptic = useTgHaptic();

  const todayQ = useQuery({ queryKey: ['reports', 'today'], queryFn: getToday });
  const shopQ = useQuery({ queryKey: ['shops', 'me'], queryFn: getShopMe });
  const sparkQ = useQuery({
    queryKey: ['reports', 'period', SPARK_FROM, SPARK_TO],
    queryFn: () => getPeriodReport(SPARK_FROM, SPARK_TO),
    staleTime: 5 * 60_000,
  });
  const sparkData = (sparkQ.data?.profit_by_day ?? []).map((d) => ({
    day: d.day,
    profit: parseNum(d.profit_uzs),
  }));

  const greeting = t(greetingKey());
  const firstName = user?.full_name?.split(' ')[0] ?? '';
  const COMPACT_UNITS = compactUnits(t);
  const overdueCount = todayQ.data?.overdue_payments_count ?? 0;

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
          {shopQ.data && <div className="mt-1 text-sm text-text-dim">{shopQ.data.name}</div>}
        </div>
      </motion.header>

      {/* Frozen-shop banner — account suspended, business endpoints 403 */}
      {shopQ.data?.is_frozen && (
        <div className="card-elev flex items-center gap-4 border-danger/40 bg-danger-faded/40 p-4 md:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-faded text-danger">
            <FrozenIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-body font-bold text-danger">{t('today.frozen_title')}</div>
            <div className="mt-0.5 text-hint text-text-dim">{t('today.frozen_body')}</div>
          </div>
        </div>
      )}

      {/* Overdue alert */}
      {overdueCount > 0 && (
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
              {t('today.overdue_alert_title', { count: overdueCount })}
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
          footer={sparkData.length >= 2 ? <ProfitSpark data={sparkData} /> : undefined}
        />
        <KpiCard
          label={t('today.kpi_inventory_value')}
          value={parseNum(todayQ.data?.inventory_value_uzs)}
          format={(n) => fmtUzsCompact(n, COMPACT_UNITS)}
          unit={t('common.currency_uzs')}
          hint={
            todayQ.data
              ? t('today.kpi_inventory_count', { count: todayQ.data.in_stock_count })
              : undefined
          }
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
          hint={
            overdueCount > 0
              ? t('today.kpi_nasiya_overdue', { count: overdueCount })
              : t('today.kpi_nasiya_debt_hint')
          }
          icon={<CalendarClock size={18} strokeWidth={2} />}
          tone={overdueCount > 0 ? 'danger' : 'accent'}
          loading={todayQ.isLoading}
          delay={180}
        />
      </section>

      {/* Money of the day — already-fetched figures that were hidden */}
      {todayQ.data && (
        <section
          className="card grid animate-fade-up grid-cols-3 divide-x divide-border p-0"
          style={{ animationDelay: '210ms' }}
        >
          <FlowStat
            label={t('today.sold')}
            value={String(todayQ.data.sales_count_today)}
            tone="success"
          />
          <FlowStat
            label={t('today.bought')}
            value={String(todayQ.data.purchases_count_today)}
            tone="accent"
          />
          <FlowStat
            label={t('today.revenue')}
            value={fmtUzsCompact(parseNum(todayQ.data.revenue_today), COMPACT_UNITS)}
          />
        </section>
      )}

      {/* Quick actions — only destinations without a persistent slot. Buy/Sell
          live in the bottom nav (mobile) / sidebar (desktop), Search is the
          header icon, Nasiya is a bottom-nav tab — so they'd just duplicate
          chrome that's always on screen. */}
      <section className="animate-fade-up" style={{ animationDelay: '240ms' }}>
        <h2 className="mb-3 text-label font-bold uppercase tracking-wider text-text-dim">
          {t('today.quick_actions')}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            to="/counterparties"
            icon={<Users size={20} />}
            label={t('nav.counterparties')}
            tone="neutral"
          />
          <QuickAction
            to="/catalog"
            icon={<BookMarked size={20} />}
            label={t('nav.catalog')}
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

function ProfitSpark({ data }: { data: { day: string; profit: number }[] }) {
  return (
    <div className="-mx-1 h-9">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="today-spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--c-success))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="rgb(var(--c-success))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="profit"
            stroke="rgb(var(--c-success))"
            strokeWidth={2}
            fill="url(#today-spark)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function FlowStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'accent';
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-3.5">
      <span className="text-caption text-text-muted">{label}</span>
      <span
        className={cn(
          'text-body-lg font-bold tabular-nums',
          tone === 'success' ? 'text-success' : tone === 'accent' ? 'text-accent' : 'text-text',
        )}
      >
        {value}
      </span>
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
