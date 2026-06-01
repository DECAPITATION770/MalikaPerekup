/**
 * Today — three KPIs (profit / inventory / nasiya debt), quick actions,
 * and an overdue alert. Phase 3 port replaces the legacy custom KpiCard
 * stack with the new shadcn-styled KpiCard + real useCountUp animation,
 * framer-motion staggered entry, and Tg haptic on overdue alert tap.
 */
import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Minus,
  Package,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { KpiCard, type KpiDelta } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ReceiveTodayCard } from '@/components/ReceiveTodayCard';
import { FrozenIcon } from '@/components/icons';
import { EmptyStockIllustration } from '@/components/illustrations';
import { getPeriodReport, getShopMe, getToday } from '@/api/reports';
import { compactUnits, fmtUzs, fmtUzsCompact, greetingKey } from '@/lib/fmt';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';

// Recharts pulls in ~40 KB minified — code-split it so the dashboard's
// first paint isn't taxed for a sparkline that only renders when there's at
// least one non-zero day. Suspense fallback is empty (the slot is decorative).
const ProfitSparkLazy = lazy(() =>
  import('@/components/charts/ProfitSpark').then((m) => ({ default: m.ProfitSpark })),
);

const parseNum = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const isoTashkent = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);

// Re-compute the 7-day spark window inside queryFn (not at module load) so a
// tab kept open across midnight pulls fresh dates on the next refetch instead
// of being stuck on yesterday's range until the user reloads.
function sparkRange(): [string, string] {
  const now = Date.now();
  return [isoTashkent(new Date(now - 6 * 86_400_000)), isoTashkent(new Date(now))];
}

export default function Today() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const todayQ = useQuery({ queryKey: ['reports', 'today'], queryFn: getToday });
  const shopQ = useQuery({ queryKey: ['shops', 'me'], queryFn: getShopMe });
  const sparkQ = useQuery({
    queryKey: ['reports', 'period', 'spark-7d'],
    queryFn: () => {
      const [from, to] = sparkRange();
      return getPeriodReport(from, to);
    },
    staleTime: 5 * 60_000,
  });
  const sparkData = (sparkQ.data?.profit_by_day ?? []).map((d) => ({
    day: d.day,
    profit: parseNum(d.profit_uzs),
  }));
  // Hide the sparkline when every point is zero — a flat green line at the
  // bottom of the first KPI card reads as a stray divider, not a trend.
  const hasSparkSignal = sparkData.some((d) => d.profit !== 0);

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
    // Full-width — internal KPI grids (3-col secondary pair, 3-col flow
    // stats) already distribute themselves across whatever room is given,
    // so no outer max-width is needed.
    <div className="relative flex flex-col gap-5 md:gap-7">
      {/* Ambient mesh behind the hero — pure decoration */}
      <div
        aria-hidden
        className="hero-mesh pointer-events-none absolute inset-x-0 -top-6 -z-10 h-64 md:-top-10"
      />

      {/* Hero — tight on mobile so 3 KPIs clear the fold on 420×820 (CLAUDE.md
          §15, UX_AUDIT P1 #4). Greeting stays the headline; shop name moves
          to a half-step dim sub-line so the H1 never wraps. Desktop opens up
          to the display-size hero on a single row. `title` carries the full
          string for truncated names — single-handed perekupschiks like
          «Абдурахмон Тошкентбоев» trip the ellipsis and lose context. */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1
          className="truncate font-display text-title-sm font-semibold leading-tight tracking-[-0.03em] md:text-display"
          title={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        >
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        {shopQ.data && (
          <div
            className="mt-0.5 truncate text-hint text-text-muted md:text-body-xl md:text-text-dim"
            title={shopQ.data.name}
          >
            {shopQ.data.name}
          </div>
        )}
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

      {/* Receive today — the single retention-critical block. UX_AUDIT §retention
          #1: Nasiya is the only daily-action category in the product; without
          surfacing «who owes you today, with a call button» the feature is a
          passive archive. Card hides itself when there are no overdue plans,
          so a clean day stays calm. The old single-line «overdue alert» is
          superseded by this richer panel. */}
      <ReceiveTodayCard delay={40} />

      {/* Hero KPI — Прибыль сегодня. One anchor per screen: removes the
          "three equal KPIs" flatness flagged in style review. No card chrome
          here — the hero sits on the page bg with one big amber numeral so
          the eye lands on profit first; secondary KPIs follow in a compact
          pair below. Spark line moves into the hero block since it's
          intrinsic to the profit story. */}
      <ProfitHero
        value={parseNum(todayQ.data?.profit_today)}
        delta={profitDelta}
        loading={todayQ.isLoading}
        spark={
          sparkData.length >= 2 && hasSparkSignal ? (
            <Suspense fallback={<div className="h-9" />}>
              <ProfitSparkLazy data={sparkData} />
            </Suspense>
          ) : null
        }
      />

      {/* Secondary KPI pair — Замороженные + Долги. Compact 2-col grid so
          both clear the fold on 420×820 even with the hero block above. */}
      <section className="grid grid-cols-2 gap-3 md:gap-4">
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
          size="compact"
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
          size="compact"
          loading={todayQ.isLoading}
          delay={180}
        />
      </section>

      {/* Money of the day — already-fetched figures that were hidden.
          No vertical dividers between cells: this is a summary trio, not a
          spreadsheet — the divide-x line made it look like a card footer. */}
      {todayQ.data && (
        <section
          className="card grid animate-fade-up grid-cols-3 p-0"
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

      {/* «Быстрые действия» секция здесь раньше указывала на Контрагенты +
          Каталог — но обе ссылки уже доступны через Sidebar (desktop) и
          MoreHorizontal-drawer в AppHeader (mobile). Дублировали chrome и
          притворялись действиями, будучи справочниками. Удалили чтобы Today
          не тащил мёртвый вес и KPI/ReceiveTodayCard занимали фолд. */}

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

/**
 * ProfitHero — the single dominant KPI on Today. Lives without `.card`
 * chrome (no border, no shadow) so the eye treats it as part of the page
 * surface, not as a competing tile against the secondary pair below.
 *
 * Display: 48px on mobile, 64px on desktop, weight 300 in display-face so
 * the numeral reads as confident-quiet — Tesla App / Linear influence. The
 * full-precision `fmtUzs` is used here (vs the compact `fmtUzsCompact` on
 * the secondary KPIs) because the hero earns the room; using compact «12.5M»
 * for the headline value reads as down-rounded estimation, not a number.
 */
function ProfitHero({
  value,
  delta,
  loading,
  spark,
}: {
  value: number;
  delta?: KpiDelta;
  loading?: boolean;
  spark?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const DeltaIcon = delta
    ? delta.dir === 'up'
      ? ArrowUp
      : delta.dir === 'down'
        ? ArrowDown
        : Minus
    : null;
  const isNeg = (delta?.dir ?? 'flat') === 'down';

  return (
    <section
      className="animate-fade-up"
      style={{ animationDelay: '60ms' }}
      aria-label={t('today.kpi_profit_today')}
    >
      <div className="flex items-center gap-2 text-label font-medium text-text-dim">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent-faded text-accent"
          aria-hidden
        >
          <TrendingUp size={13} strokeWidth={2.2} />
        </span>
        <span>{t('today.kpi_profit_today')}</span>
      </div>

      <div className="mt-2 flex items-baseline gap-2.5">
        {loading ? (
          <Skeleton className="h-12 w-48 md:h-16 md:w-64" />
        ) : (
          <>
            <span className="font-display text-[48px] font-light leading-none tracking-[-0.04em] tabular-nums text-accent md:text-[64px]">
              {fmtUzs(value)}
            </span>
            <span className="text-body-lg font-semibold text-text-muted">
              {t('common.currency_uzs')}
            </span>
          </>
        )}
      </div>

      {(delta || !loading) && (
        <div className="mt-2 flex items-center gap-2 text-hint">
          {delta && DeltaIcon && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold tabular-nums',
                delta.dir === 'up'
                  ? 'bg-success-faded text-success'
                  : isNeg
                    ? 'bg-danger-faded text-danger'
                    : 'bg-bg3 text-text-muted',
              )}
            >
              <DeltaIcon size={11} strokeWidth={2.6} />
              {delta.pct !== undefined && `${delta.pct}%`}
            </span>
          )}
          {delta && <span className="text-text-muted">{delta.label}</span>}
          {!delta && !loading && (
            <span className="text-text-muted">{t('today.kpi_profit_today_hint')}</span>
          )}
        </div>
      )}

      {spark && <div className="mt-3">{spark}</div>}
    </section>
  );
}

