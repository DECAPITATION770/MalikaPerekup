/**
 * Reports — period KPIs + recharts dashboard (profit-by-day area chart,
 * top-models bar chart) + working XLSX export.
 *
 * Phase 3 port: replaces the hand-rolled SVG sparkline with recharts
 * AreaChart + BarChart (responsive, with tooltips), shadcn Tabs for
 * presets, shadcn Card/Button.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart2,
  Clock,
  Download,
  Package,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getInventoryValue,
  getPeriodReport,
  getPeriodReportXlsx,
} from '@/api/reports';
import { fmtUzs, fmtUzsCompact } from '@/lib/fmt';
import { useTgHaptic } from '@/lib/telegram';

const COMPACT = { thousand: 'тыс', million: 'млн', billion: 'млрд' };

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
}

type Preset = '7d' | '30d' | '90d' | 'custom';

export default function Reports() {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState(daysAgo(30));
  const [customTo, setCustomTo] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const { from, to } = useMemo(() => {
    if (preset === '7d') return { from: daysAgo(7), to: todayStr() };
    if (preset === '30d') return { from: daysAgo(30), to: todayStr() };
    if (preset === '90d') return { from: daysAgo(90), to: todayStr() };
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-period', from, to],
    queryFn: () => getPeriodReport(from, to),
    enabled: !!from && !!to && from <= to,
  });

  const { data: inv } = useQuery({
    queryKey: ['inventory-value'],
    queryFn: getInventoryValue,
    staleTime: 60_000,
  });

  const exportXlsx = async () => {
    if (!data || exporting) return;
    setExporting(true);
    haptic.tap('light');
    try {
      const blob = await getPeriodReportXlsx(from, to);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `malika-report-${from}_${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const dayData = (data?.profit_by_day ?? []).map((d) => ({
    day: d.day.slice(5), // MM-DD
    profit: Number(d.profit_uzs),
  }));
  const topData = (data?.top_models ?? []).map((m) => ({
    name: `${m.brand} ${m.model}`,
    profit: Number(m.total_profit_uzs),
    units: m.units_sold,
  }));

  const hasChartData = dayData.length >= 2 && dayData.some((d) => d.profit > 0);

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title font-bold tracking-tight">{t('reports.title')}</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportXlsx}
          disabled={!data || exporting}
          loading={exporting}
        >
          <Download className="size-4" />
          {t('reports.export')}
        </Button>
      </div>

      <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)}>
        <TabsList>
          <TabsTrigger value="7d">{t('reports.p7d')}</TabsTrigger>
          <TabsTrigger value="30d">{t('reports.p30d')}</TabsTrigger>
          <TabsTrigger value="90d">{t('reports.p90d')}</TabsTrigger>
          <TabsTrigger value="custom">{t('reports.custom')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {preset === 'custom' && (
        <Card className="p-4 flex flex-col sm:flex-row gap-3 animate-fade-in">
          <div className="flex flex-col gap-1 flex-1">
            <Label htmlFor="from">{t('reports.from')}</Label>
            <Input
              id="from"
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <Label htmlFor="to">{t('reports.to')}</Label>
            <Input
              id="to"
              type="date"
              value={customTo}
              min={customFrom}
              max={todayStr()}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-11"
            />
          </div>
        </Card>
      )}

      {inv && (
        <Card className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-text-dim">
            <Package size={15} />
            <span className="text-label font-semibold">{t('reports.inventory_title')}</span>
          </div>
          <div className="flex gap-5">
            <div className="text-right">
              <div className="text-caption text-text-muted">{t('reports.in_stock')}</div>
              <div className="text-body-xl font-bold tabular-nums">{inv.in_stock_count}</div>
            </div>
            <div className="text-right">
              <div className="text-caption text-text-muted">{t('reports.inventory_value')}</div>
              <div className="text-body-xl font-bold tabular-nums">
                {fmtUzs(inv.inventory_value_uzs)} UZS
              </div>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !data || (data.sales_count === 0 && data.purchases_count === 0) ? (
        <EmptyState
          illustration={
            <div className="w-14 h-14 rounded-2xl bg-bg3 flex items-center justify-center text-text-muted">
              <BarChart2 size={26} />
            </div>
          }
          title={t('reports.empty')}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<TrendingUp size={14} />}
              label={t('reports.profit')}
              value={`${fmtUzs(data.profit_uzs)} UZS`}
              sub={
                data.sales_count > 0
                  ? `${t('reports.avg_profit')}: ${fmtUzs(data.avg_profit_per_sale_uzs)} UZS`
                  : undefined
              }
              accent
            />
            <StatCard
              icon={<BarChart2 size={14} />}
              label={t('reports.revenue')}
              value={`${fmtUzs(data.revenue_uzs)} UZS`}
            />
            <StatCard
              icon={<ShoppingCart size={14} />}
              label={t('reports.purchases')}
              value={String(data.purchases_count)}
            />
            <StatCard
              icon={<RotateCcw size={14} />}
              label={t('reports.sales')}
              value={String(data.sales_count)}
              sub={
                data.returns_count > 0
                  ? `${t('reports.returns')}: ${data.returns_count}`
                  : undefined
              }
            />
          </div>

          {/* Profit by day — recharts area */}
          {hasChartData && (
            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-text-dim">
                <TrendingUp size={14} />
                <span className="text-caption font-semibold uppercase tracking-wider">
                  {t('reports.profit_by_day')}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dayData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--c-success))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="rgb(var(--c-success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-border))" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: 'rgb(var(--c-text-muted))' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'rgb(var(--c-text-muted))' }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(v) => fmtUzsCompact(v, COMPACT)}
                  />
                  <RTooltip content={<ChartTooltip unit="UZS" />} />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="rgb(var(--c-success))"
                    strokeWidth={2}
                    fill="url(#profitFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Top models — recharts horizontal bars */}
          {topData.length > 0 && (
            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-text-dim">
                <BarChart2 size={14} />
                <span className="text-caption font-semibold uppercase tracking-wider">
                  {t('reports.top_models')}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(120, topData.length * 44)}>
                <BarChart
                  layout="vertical"
                  data={topData}
                  margin={{ top: 0, right: 12, left: 4, bottom: 0 }}
                >
                  <XAxis type="number" hide tickFormatter={(v) => fmtUzsCompact(v, COMPACT)} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11, fill: 'rgb(var(--c-text-dim))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RTooltip content={<ChartTooltip unit="UZS" />} cursor={{ fill: 'rgb(var(--c-bg3))' }} />
                  <Bar dataKey="profit" radius={[0, 6, 6, 0]} barSize={20}>
                    {topData.map((_, i) => (
                      <Cell key={i} fill="rgb(var(--c-accent))" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {data.avg_days_in_stock !== null && (
            <Card className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-dim">
                <Clock size={14} />
                <span className="text-label font-semibold">{t('reports.avg_days')}</span>
              </div>
              <span className="text-lg font-bold tabular-nums">
                {data.avg_days_in_stock.toFixed(1)}
              </span>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-text-dim">
        {icon}
        <span className="text-caption font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div
        className={`text-title-sm font-bold tabular-nums tracking-tight leading-tight ${
          accent ? 'text-success' : ''
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-caption text-text-muted">{sub}</div>}
    </Card>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { name?: string; units?: number } }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-bg3 px-3 py-2 shadow-lg text-xs">
      <div className="text-text-muted">{p.payload.name ?? label}</div>
      <div className="font-bold tabular-nums text-text">
        {fmtUzs(p.value)} {unit}
      </div>
      {p.payload.units !== undefined && (
        <div className="text-text-muted tabular-nums">{p.payload.units} шт</div>
      )}
    </div>
  );
}
