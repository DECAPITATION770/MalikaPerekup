import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getToday, getShopMe } from '../api/reports';
import { useAuth } from '../store/auth';
import KpiCard, { type KpiDelta } from '../components/ui/KpiCard';
import Button from '../components/ui/Button';
import {
  TrendingUp, Package, CalendarClock,
  ShoppingCart, BadgeDollarSign, Search,
  AlertTriangle, ArrowUpRight,
} from 'lucide-react';
import { fmtUzs, fmtUzsCompact, greetingKey } from '../lib/fmt';

const COMPACT_UNITS = { thousand: 'тыс', million: 'млн', billion: 'млрд' };

export default function Today() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const todayQ = useQuery({ queryKey: ['reports', 'today'], queryFn: getToday });
  const shopQ  = useQuery({ queryKey: ['shops', 'me'],     queryFn: getShopMe });

  const greeting = t(greetingKey());
  const firstName = user?.full_name?.split(' ')[0] ?? '';

  const profitDelta: KpiDelta | undefined = todayQ.data
    ? (() => {
        const today = Number(todayQ.data.profit_today) || 0;
        const yest = Number(todayQ.data.profit_yesterday) || 0;
        const label = t('today.kpi_vs_yesterday');
        if (yest === 0) return { dir: today > 0 ? 'up' : 'flat', label };
        const pct = Math.round(((today - yest) / yest) * 100);
        return { dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', pct: Math.abs(pct), label };
      })()
    : undefined;

  return (
    <div className="relative flex flex-col gap-6 md:gap-8">
      {/* Ambient mesh wash behind the hero — pure decoration */}
      <div
        aria-hidden
        className="hero-mesh pointer-events-none absolute inset-x-0 -top-6 md:-top-10 h-64 -z-10"
      />
      {/* Header */}
      <header className="flex items-end justify-between gap-3 animate-fade-up">
        <div>
          <div className="text-label text-text-muted font-semibold uppercase tracking-wider">
            {greeting}{firstName ? `,` : ''}
          </div>
          <h1 className="text-title-lg md:text-display font-bold tracking-tight mt-1">
            {firstName || t('today.title')}
          </h1>
          {shopQ.data && (
            <div className="mt-1 text-sm text-text-dim">
              {shopQ.data.name}
              {shopQ.data.is_frozen && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning-faded text-warning text-caption font-bold uppercase tracking-wider">
                  {t('today.frozen_badge')}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Overdue alert */}
      {todayQ.data && todayQ.data.overdue_payments_count > 0 && (
        <Link
          to="/installments?status=overdue"
          className="card-elev p-4 md:p-5 flex items-center gap-4 border-warning/40 hover:border-warning transition-all group animate-fade-up"
          style={{ animationDelay: '40ms' }}
        >
          <div className="w-10 h-10 rounded-xl bg-warning-faded text-warning flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-body font-bold text-text">
              {t('today.overdue_alert_title', { count: todayQ.data.overdue_payments_count })}
            </div>
            <div className="text-hint text-text-dim mt-0.5">
              {t('today.overdue_alert_body')}
            </div>
          </div>
          <ArrowUpRight size={18} className="text-text-muted group-hover:text-warning transition-colors shrink-0" />
        </Link>
      )}

      {/* 3 headline KPI */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <KpiCard
          label={t('today.kpi_profit_today')}
          value={fmtUzs(todayQ.data?.profit_today ?? 0)}
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
          value={fmtUzsCompact(todayQ.data?.inventory_value_uzs ?? 0, COMPACT_UNITS)}
          unit={t('common.currency_uzs')}
          hint={t('today.kpi_inventory_value_hint')}
          icon={<Package size={18} strokeWidth={2} />}
          tone="warning"
          loading={todayQ.isLoading}
          delay={120}
        />
        <KpiCard
          label={t('today.kpi_nasiya_debt')}
          value={fmtUzsCompact(todayQ.data?.nasiya_debt_uzs ?? 0, COMPACT_UNITS)}
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
        <h2 className="text-label font-bold text-text-dim uppercase tracking-wider mb-3">
          {t('today.quick_actions')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction to="/purchase/new"   icon={<ShoppingCart size={20} />}    label={t('today.action_purchase')} tone="accent"  />
          <QuickAction to="/sale/new"       icon={<BadgeDollarSign size={20} />} label={t('today.action_sale')}     tone="success" />
          <QuickAction to="/search"         icon={<Search size={20} />}          label={t('today.action_search')}    tone="neutral" />
          <QuickAction to="/installments"   icon={<CalendarClock size={20} />}   label={t('nav.installments')}       tone="neutral" />
        </div>
      </section>

      {/* Encourage if everything is zero */}
      {todayQ.data &&
       todayQ.data.sales_count_today === 0 &&
       todayQ.data.purchases_count_today === 0 &&
       todayQ.data.in_stock_count === 0 && (
        <div className="card p-8 text-center animate-fade-up" style={{ animationDelay: '360ms' }}>
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-accent-faded text-accent flex items-center justify-center">
            <ShoppingCart size={24} />
          </div>
          <h3 className="text-base font-bold mb-1">{t('today.no_data')}</h3>
          <p className="text-sm text-text-dim mb-4 max-w-sm mx-auto leading-relaxed">
            {t('today.encourage_first_purchase')}
          </p>
          <Link to="/purchase/new" className="inline-block">
            <Button size="md" icon={<ShoppingCart size={16} />}>{t('today.action_purchase')}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function QuickAction({
  to, icon, label, tone,
}: { to: string; icon: React.ReactNode; label: string; tone: 'accent' | 'success' | 'neutral' }) {
  const ring =
    tone === 'accent'  ? 'group-hover:ring-accent/40  group-hover:bg-accent-faded'
    : tone === 'success' ? 'group-hover:ring-success/40 group-hover:bg-success-faded'
    :                      'group-hover:ring-border-strong group-hover:bg-bg3';
  const iconTone =
    tone === 'accent'  ? 'text-accent'
    : tone === 'success' ? 'text-success'
    :                      'text-text-dim';

  return (
    <Link
      to={to}
      className="card p-4 md:p-5 flex flex-col items-start gap-3 group transition-all hover:border-border-strong cursor-pointer"
    >
      <div className={`w-10 h-10 rounded-xl bg-bg3 flex items-center justify-center ring-1 ring-border ${iconTone} transition-all ${ring}`}>
        {icon}
      </div>
      <div className="text-label md:text-body font-semibold tracking-tight">{label}</div>
    </Link>
  );
}

