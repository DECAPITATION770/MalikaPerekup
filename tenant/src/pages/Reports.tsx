import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingCart, BarChart2, RotateCcw, Clock, Package, Download } from 'lucide-react';
import { getPeriodReport, getInventoryValue, getPeriodReportXlsx } from '../api/reports';
import { fmtUzs } from '../lib/fmt';

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
}

type Preset = '7d' | '30d' | '90d' | 'custom';

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-text-dim">
        {icon}
        <span className="text-caption font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-title-sm font-bold tabular-nums tracking-tight leading-tight">{value}</div>
      {sub && <div className="text-caption text-text-muted">{sub}</div>}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const W = 640, H = 72, P = 6;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => P + (i / (values.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${P},${H - P} ${line} ${W - P},${H - P}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-20"
      aria-hidden
    >
      <polygon points={area} className="fill-success/10" />
      <polyline
        points={line}
        className="stroke-success"
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function Reports() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState(daysAgo(30));
  const [customTo, setCustomTo] = useState(todayStr());

  const { from, to } = useMemo(() => {
    if (preset === '7d')  return { from: daysAgo(7),  to: todayStr() };
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

  const presets: { key: Preset; label: string }[] = [
    { key: '7d',     label: t('reports.p7d') },
    { key: '30d',    label: t('reports.p30d') },
    { key: '90d',    label: t('reports.p90d') },
    { key: 'custom', label: t('reports.custom') },
  ];

  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    if (!data || exporting) return;
    setExporting(true);
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

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title font-bold tracking-tight">{t('reports.title')}</h1>
        <button
          type="button"
          onClick={exportXlsx}
          disabled={!data || exporting}
          className="h-9 px-3.5 flex items-center gap-2 rounded-lg border border-border bg-bg2 text-label font-semibold text-text-dim hover:border-border-strong hover:text-text disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Download size={15} />
          {t('reports.export')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className={`h-9 px-4 rounded-lg border text-label font-semibold transition-all cursor-pointer
              ${preset === p.key ? 'bg-accent-faded border-accent/40 text-accent' : 'bg-bg2 border-border text-text-dim hover:border-border-strong'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="card p-4 flex flex-col sm:flex-row gap-3 animate-fade-in">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-hint text-text-dim font-medium">{t('reports.from')}</label>
            <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-bg2 rounded-xl border border-border px-3 py-2 text-body text-text outline-none focus:border-accent transition-colors" />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-hint text-text-dim font-medium">{t('reports.to')}</label>
            <input type="date" value={customTo} min={customFrom} max={todayStr()} onChange={(e) => setCustomTo(e.target.value)}
              className="bg-bg2 rounded-xl border border-border px-3 py-2 text-body text-text outline-none focus:border-accent transition-colors" />
          </div>
        </div>
      )}

      {inv && (
        <div className="card p-4 flex items-center justify-between gap-4">
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
              <div className="text-body-xl font-bold tabular-nums">{fmtUzs(inv.inventory_value_uzs)} UZS</div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map((i) => <div key={i} className="card h-24 animate-pulse bg-bg2" />)}</div>
      ) : !data || (data.sales_count === 0 && data.purchases_count === 0) ? (
        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <BarChart2 size={28} className="text-text-muted" />
          <p className="text-text-dim text-sm">{t('reports.empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<TrendingUp size={14} />} label={t('reports.profit')}
              value={`${fmtUzs(data.profit_uzs)} UZS`}
              sub={data.sales_count > 0 ? `${t('reports.avg_profit')}: ${fmtUzs(data.avg_profit_per_sale_uzs)} UZS` : undefined} />
            <StatCard icon={<BarChart2 size={14} />} label={t('reports.revenue')} value={`${fmtUzs(data.revenue_uzs)} UZS`} />
            <StatCard icon={<ShoppingCart size={14} />} label={t('reports.purchases')} value={String(data.purchases_count)} />
            <StatCard icon={<RotateCcw size={14} />} label={t('reports.sales')} value={String(data.sales_count)}
              sub={data.returns_count > 0 ? `${t('reports.returns')}: ${data.returns_count}` : undefined} />
          </div>

          {data.profit_by_day.length >= 2 &&
           data.profit_by_day.some((d) => Number(d.profit_uzs) > 0) && (
            <div className="card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-text-dim">
                <TrendingUp size={14} />
                <span className="text-caption font-semibold uppercase tracking-wider">
                  {t('reports.profit_by_day')}
                </span>
              </div>
              <Sparkline values={data.profit_by_day.map((d) => Number(d.profit_uzs))} />
            </div>
          )}

          {data.avg_days_in_stock !== null && (
            <div className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-dim">
                <Clock size={14} />
                <span className="text-label font-semibold">{t('reports.avg_days')}</span>
              </div>
              <span className="text-lg font-bold tabular-nums">{data.avg_days_in_stock.toFixed(1)}</span>
            </div>
          )}

          {data.top_models.length > 0 && (
            <div className="card p-4 flex flex-col gap-3">
              <h3 className="text-body font-bold">{t('reports.top_models')}</h3>
              <div className="flex flex-col gap-2">
                {data.top_models.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-caption text-text-muted tabular-nums w-4">{i + 1}</span>
                      <span className="text-body font-semibold truncate">{m.brand} {m.model}</span>
                      <span className="text-caption text-text-muted shrink-0">{m.units_sold} {t('reports.units')}</span>
                    </div>
                    <span className="text-label font-bold tabular-nums shrink-0 text-success">+{fmtUzs(m.total_profit_uzs)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
