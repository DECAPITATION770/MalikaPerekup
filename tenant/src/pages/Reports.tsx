/**
 * Reports — period KPIs + recharts dashboard (profit-by-day area chart,
 * top-models bar chart) + working XLSX export.
 *
 * Phase 3 port: replaces the hand-rolled SVG sparkline with recharts
 * AreaChart + BarChart (responsive, with tooltips), shadcn Tabs for
 * presets, shadcn Card/Button.
 */
import { useEffect, useMemo, useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  getBreakdown,
  getExportColumns,
  getExportXlsx,
  getInventoryValue,
  getPeriodReport,
  getPeriodReportXlsx,
  sendExportXlsx,
  sendPeriodReportXlsx,
  type BreakdownGroupBy,
  type BreakdownRow,
  type ExportEntity,
} from '@/api/reports';
import { compactUnits, fmtUzs, fmtUzsCompact } from '@/lib/fmt';
import { isTelegramEnvironment, useTelegram, useTgHaptic } from '@/lib/telegram';
import { track } from '@/lib/analytics';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  // Captured once at app init — the launch hash isTelegramEnvironment() reads
  // is consumed by the SDK, so a fresh call on this route would read false.
  const { inTelegram } = useTelegram();
  const COMPACT = compactUnits(t);
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

  // Previous-period window of the same length, ending the day before `from`.
  // The delta computation answers "растёт ли бизнес?" — UX_AUDIT §retention
  // flagged Reports v0 as having raw numbers without trend context.
  const { prevFrom, prevTo } = useMemo(() => {
    if (!from || !to) return { prevFrom: '', prevTo: '' };
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    const lengthDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
    if (lengthDays < 0) return { prevFrom: '', prevTo: '' };
    const prevEnd = new Date(fromDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - lengthDays);
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    return { prevFrom: fmt(prevStart), prevTo: fmt(prevEnd) };
  }, [from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-period', from, to],
    queryFn: () => getPeriodReport(from, to),
    enabled: !!from && !!to && from <= to,
  });

  const { data: prevData } = useQuery({
    queryKey: ['reports-period', prevFrom, prevTo],
    queryFn: () => getPeriodReport(prevFrom, prevTo),
    enabled: !!prevFrom && !!prevTo && prevFrom <= prevTo,
    staleTime: 5 * 60_000,
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
      if (isTelegramEnvironment() || inTelegram) {
        // WebView can't save blob downloads — the bot delivers it to chat.
        await sendPeriodReportXlsx(from, to);
        toast.success(t('reports.export_sent'));
      } else {
        toast.message(t('reports.export_downloading'));
        const blob = await getPeriodReportXlsx(from, to);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `malika-report-${from}_${to}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      track('report_exported', { preset });
    } catch {
      toast.error(t('reports.export_error'));
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
    <div className="flex w-full animate-fade-up flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-title font-semibold tracking-[-0.03em]">{t('reports.title')}</h1>
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
        <Card className="flex animate-fade-in flex-col gap-3 p-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1">
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
          <div className="flex flex-1 flex-col gap-1">
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
        <Card className="flex items-center justify-between gap-4 p-4">
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
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-bg3 text-text-muted">
              <BarChart2 size={26} />
            </div>
          }
          title={t('reports.empty')}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<TrendingUp size={18} />}
              label={t('reports.profit')}
              value={`${fmtUzs(data.profit_uzs)} UZS`}
              delta={computeDelta(Number(data.profit_uzs), prevData ? Number(prevData.profit_uzs) : undefined)}
              deltaLabel={t('reports.vs_prev_period')}
              sub={
                data.sales_count > 0
                  ? `${t('reports.avg_profit')}: ${fmtUzs(data.avg_profit_per_sale_uzs)} UZS`
                  : undefined
              }
              accent
            />
            <StatCard
              icon={<BarChart2 size={18} />}
              label={t('reports.revenue')}
              value={`${fmtUzs(data.revenue_uzs)} UZS`}
              delta={computeDelta(Number(data.revenue_uzs), prevData ? Number(prevData.revenue_uzs) : undefined)}
              deltaLabel={t('reports.vs_prev_period')}
            />
            <StatCard
              icon={<ShoppingCart size={18} />}
              label={t('reports.purchases')}
              value={String(data.purchases_count)}
              delta={computeDelta(data.purchases_count, prevData?.purchases_count)}
              deltaLabel={t('reports.vs_prev_period')}
            />
            <StatCard
              icon={<RotateCcw size={18} />}
              label={t('reports.sales')}
              value={String(data.sales_count)}
              delta={computeDelta(data.sales_count, prevData?.sales_count)}
              deltaLabel={t('reports.vs_prev_period')}
              sub={
                data.returns_count > 0
                  ? `${t('reports.returns')}: ${data.returns_count}`
                  : undefined
              }
            />
          </div>

          {/* Profit by day — recharts area */}
          {hasChartData && (
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2 text-text-dim">
                <TrendingUp size={14} />
                <span className="text-caption font-semibold tracking-tight">
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
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgb(var(--c-border))"
                    vertical={false}
                  />
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
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2 text-text-dim">
                <BarChart2 size={14} />
                <span className="text-caption font-semibold tracking-tight">
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
                  <RTooltip
                    content={<ChartTooltip unit="UZS" />}
                    cursor={{ fill: 'rgb(var(--c-bg3))' }}
                  />
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
            <Card className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2 text-text-dim">
                <Clock size={14} />
                <span className="text-label font-semibold">{t('reports.avg_days')}</span>
              </div>
              <span className="text-subhead font-bold tabular-nums">
                {data.avg_days_in_stock.toFixed(1)}
              </span>
            </Card>
          )}
        </>
      )}

      {/* Конструктор разрезов — group active sales by any dimension over the
          same period selected above, with optional filters. */}
      {from && to && from <= to && <BreakdownBuilder from={from} to={to} />}

      {/* Выгрузка в Excel — flat table, pick entity + columns. */}
      <ExportTable from={from} to={to} />
    </div>
  );
}

const EXPORT_ENTITIES: ExportEntity[] = ['sales', 'devices', 'purchases'];

function ExportTable({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const { inTelegram } = useTelegram();
  const [entity, setEntity] = useState<ExportEntity>('sales');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [periodOnly, setPeriodOnly] = useState(true);
  const [busy, setBusy] = useState(false);

  const { data: columns } = useQuery({
    queryKey: ['export-columns', entity],
    queryFn: () => getExportColumns(entity),
  });

  // Default to all columns selected whenever the entity's column set loads.
  useEffect(() => {
    if (columns) setSelected(new Set(columns.map((c) => c.key)));
  }, [columns]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const download = async () => {
    if (!columns || selected.size === 0 || busy) return;
    setBusy(true);
    haptic.tap('light');
    try {
      // Preserve registry order, not click order.
      const ordered = columns.map((c) => c.key).filter((k) => selected.has(k));
      const range = periodOnly ? { from, to } : undefined;
      if (isTelegramEnvironment() || inTelegram) {
        // WebView can't save blob downloads — the bot delivers it to chat.
        await sendExportXlsx(entity, ordered, range);
        toast.success(t('reports.export_sent'));
      } else {
        toast.message(t('reports.export_downloading'));
        const blob = await getExportXlsx(entity, ordered, range);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `malika-${entity}-${from}_${to}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      track('report_exported', { preset: `table:${entity}` });
    } catch {
      toast.error(t('reports.export_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-text-dim">
          <Download size={14} />
          <span className="text-caption font-semibold tracking-tight">
            {t('reports.export_table_title')}
          </span>
        </div>
        <span className="text-caption text-text-muted">{t('reports.export_table_hint')}</span>
      </div>

      {/* Entity */}
      <div className="flex flex-col gap-1">
        <Label className="text-micro text-text-muted">{t('reports.export_entity')}</Label>
        <Select value={entity} onValueChange={(v) => setEntity(v as ExportEntity)}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPORT_ENTITIES.map((e) => (
              <SelectItem key={e} value={e}>
                {t(`reports.ent_${e}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Columns — toggle chips */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-micro text-text-muted">{t('reports.export_columns')}</Label>
          <div className="flex gap-2 text-caption">
            <button
              type="button"
              className="font-semibold text-accent hover:underline"
              onClick={() => columns && setSelected(new Set(columns.map((c) => c.key)))}
            >
              {t('reports.export_select_all')}
            </button>
            <span className="text-text-muted">·</span>
            <button
              type="button"
              className="font-semibold text-text-muted hover:text-text"
              onClick={() => setSelected(new Set())}
            >
              {t('reports.export_clear')}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(columns ?? []).map((c) => {
            const on = selected.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-caption font-medium transition-colors',
                  on
                    ? 'border-accent bg-accent-faded text-accent'
                    : 'border-border bg-bg2 text-text-muted hover:text-text',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Period toggle + download */}
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-caption text-text-dim">
          <Switch checked={periodOnly} onCheckedChange={setPeriodOnly} />
          {t('reports.export_period_only')}
        </label>
        <Button
          size="sm"
          onClick={download}
          loading={busy}
          disabled={busy || selected.size === 0}
        >
          <Download className="size-4" />
          {t('reports.export_download')}
        </Button>
      </div>
      {selected.size === 0 && (
        <span className="text-hint text-text-muted">{t('reports.export_no_columns')}</span>
      )}
    </Card>
  );
}

const GROUP_OPTIONS: { value: BreakdownGroupBy; key: string }[] = [
  { value: 'brand', key: 'reports.gb_brand' },
  { value: 'category', key: 'reports.gb_category' },
  { value: 'model', key: 'reports.gb_model' },
  { value: 'sale_type', key: 'reports.gb_sale_type' },
  { value: 'buyer', key: 'reports.gb_buyer' },
];
const CATEGORY_OPTIONS = ['phone', 'tablet', 'laptop', 'smartwatch', 'accessory', 'other'];

function BreakdownBuilder({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState<BreakdownGroupBy>('brand');
  const [category, setCategory] = useState('all');
  const [saleType, setSaleType] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['reports-breakdown', from, to, groupBy, category, saleType],
    queryFn: () =>
      getBreakdown(from, to, groupBy, {
        category: category === 'all' ? undefined : category,
        sale_type: saleType === 'all' ? undefined : saleType,
      }),
    enabled: !!from && !!to && from <= to,
  });

  // Localise the label for dimensions whose keys we have translations for;
  // brand / model / buyer are free-text data so we show them verbatim.
  const labelFor = (row: BreakdownRow): string => {
    if (groupBy === 'category') return t(`category.${row.key}`, row.label);
    if (groupBy === 'sale_type') return t(`sale.${row.key}`, row.label);
    return row.label;
  };

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-text-dim">
          <BarChart2 size={14} />
          <span className="text-caption font-semibold tracking-tight">
            {t('reports.breakdown_title')}
          </span>
        </div>
        <span className="text-caption text-text-muted">{t('reports.breakdown_hint')}</span>
      </div>

      {/* Filter bar: разрез + фильтры */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label className="text-micro text-text-muted">{t('reports.group_by')}</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as BreakdownGroupBy)}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {t(o.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-micro text-text-muted">{t('reports.filter_category')}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports.filter_all')}</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`category.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-micro text-text-muted">{t('reports.filter_payment')}</Label>
          <Select value={saleType} onValueChange={setSaleType}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports.filter_all')}</SelectItem>
              <SelectItem value="cash">{t('sale.cash')}</SelectItem>
              <SelectItem value="nasiya">{t('sale.nasiya')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data || data.rows.length === 0 ? (
        <div className="py-6 text-center text-caption text-text-muted">
          {t('reports.breakdown_empty')}
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(GROUP_OPTIONS.find((o) => o.value === groupBy)!.key)}</TableHead>
                <TableHead className="text-right">{t('reports.col_units')}</TableHead>
                <TableHead className="text-right">{t('reports.col_revenue')}</TableHead>
                <TableHead className="text-right">{t('reports.col_profit')}</TableHead>
                <TableHead className="text-right">{t('reports.col_margin')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="max-w-[40vw] truncate font-medium text-text">
                    {labelFor(row)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-text-dim">
                    {row.units_sold}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-text-dim">
                    {fmtUzs(row.revenue_uzs)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-success">
                    {fmtUzs(row.profit_uzs)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-text-muted">
                    {row.margin_pct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-text">{t('reports.total')}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-text">
                  {data.total_units}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-text">
                  {fmtUzs(data.total_revenue_uzs)}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums text-success">
                  {fmtUzs(data.total_profit_uzs)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-text-muted">
                  {Number(data.total_revenue_uzs) > 0
                    ? ((Number(data.total_profit_uzs) / Number(data.total_revenue_uzs)) * 100).toFixed(1)
                    : '0.0'}
                  %
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </Card>
  );
}

/** Period-over-period delta. Returns `undefined` if the previous period has
 *  no data (first run or genuinely zero), since "infinite improvement" pills
 *  are noise. Returns `dir:'flat'` with no pct when both are 0. */
interface Delta {
  dir: 'up' | 'down' | 'flat';
  pct?: number;
}
function computeDelta(current: number, previous?: number): Delta | undefined {
  if (previous === undefined) return undefined;
  if (previous === 0 && current === 0) return { dir: 'flat' };
  if (previous === 0) return { dir: current > 0 ? 'up' : 'down' };
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct === 0) return { dir: 'flat' };
  return { dir: pct > 0 ? 'up' : 'down', pct: Math.abs(pct) };
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  delta,
  deltaLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  delta?: Delta;
  deltaLabel?: string;
}) {
  // Single delta chip per card — colour follows direction (success up / danger
  // down / muted flat). Pct hidden when previous was 0 (would read as ∞%).
  const deltaCls =
    delta?.dir === 'up'
      ? 'text-success bg-success-faded'
      : delta?.dir === 'down'
        ? 'text-danger bg-danger-faded'
        : 'text-text-muted bg-bg3';
  const deltaSign = delta?.dir === 'up' ? '↑' : delta?.dir === 'down' ? '↓' : '·';

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-text-dim">
        {icon}
        <span className="text-caption font-semibold tracking-tight">{label}</span>
      </div>
      <div
        className={`font-display text-title-sm font-semibold tabular-nums leading-tight tracking-[-0.02em] ${
          accent ? 'text-success' : ''
        }`}
      >
        {value}
      </div>
      {delta && (
        <div className="flex items-center gap-1.5 text-hint">
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold tabular-nums ${deltaCls}`}
          >
            {deltaSign}
            {delta.pct !== undefined && ` ${delta.pct}%`}
          </span>
          {deltaLabel && <span className="text-text-muted">{deltaLabel}</span>}
        </div>
      )}
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
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-bg3 px-3 py-2 text-hint shadow-lg">
      <div className="text-text-muted">{p.payload.name ?? label}</div>
      <div className="font-bold tabular-nums text-text">
        {fmtUzs(p.value)} {unit}
      </div>
      {p.payload.units !== undefined && (
        <div className="tabular-nums text-text-muted">
          {p.payload.units} {t('reports.units_short')}
        </div>
      )}
    </div>
  );
}
