import api from './client';

export interface TodayDashboard {
  today: string; // ISO date

  // Three "headline numbers" from CLAUDE.md §15
  profit_today: string;          // Прибыль сегодня (Decimal-as-string)
  profit_yesterday: string;      // То же за вчера — для ↑/↓ дельты в KPI
  inventory_value_uzs: string;   // Замороженные деньги
  nasiya_debt_uzs: string;       // Долги по Nasiya

  // Supporting
  revenue_today: string;
  sales_count_today: number;
  purchases_count_today: number;

  in_stock_count: number;
  overdue_payments_count: number;
}

export async function getToday(): Promise<TodayDashboard> {
  const { data } = await api.get<TodayDashboard>('/reports/today');
  return data;
}

export interface RateSource {
  rate: string;   // Decimal-as-string, UZS per 1 USD
  as_of: string;  // ISO date
  stale: boolean; // cb_uz only: cached CBU date is before today
}

export interface ExchangeRateHint {
  last_used: RateSource | null; // this shop's last USD purchase rate
  cb_uz: RateSource | null;     // official Central Bank of Uzbekistan rate
}

export async function getExchangeRateHint(): Promise<ExchangeRateHint> {
  const { data } = await api.get<ExchangeRateHint>('/reports/exchange-rate-hint');
  return data;
}

export interface ShopMe {
  id: number;
  name: string;
  language_default: 'ru' | 'uz';
  plan: string;
  plan_until: string | null;
  is_frozen: boolean;
}

export async function getShopMe(): Promise<ShopMe> {
  const { data } = await api.get<ShopMe>('/shops/me');
  return data;
}

export interface TopModelEntry {
  brand: string;
  model: string;
  units_sold: number;
  total_profit_uzs: string;
}

export interface DayProfit {
  day: string;          // ISO date
  profit_uzs: string;   // Decimal-as-string
}

export interface PeriodReport {
  date_from: string;
  date_to: string;
  purchases_count: number;
  purchases_total_uzs: string;
  sales_count: number;
  revenue_uzs: string;
  profit_uzs: string;
  avg_profit_per_sale_uzs: string;
  returns_count: number;
  top_models: TopModelEntry[];
  avg_days_in_stock: number | null;
  profit_by_day: DayProfit[];
}

export interface InventoryValue {
  in_stock_count: number;
  inventory_value_uzs: string;
  by_category: Record<string, string>;
}

export async function getPeriodReport(from: string, to: string): Promise<PeriodReport> {
  const { data } = await api.get<PeriodReport>('/reports/period', { params: { from, to } });
  return data;
}

/** Same period data as a real .xlsx workbook (generated server-side).
 *  Fetched as a blob so the auth header is sent. */
export async function getPeriodReportXlsx(from: string, to: string): Promise<Blob> {
  const { data } = await api.get<Blob>('/reports/period.xlsx', {
    params: { from, to },
    responseType: 'blob',
  });
  return data;
}

export async function getInventoryValue(): Promise<InventoryValue> {
  const { data } = await api.get<InventoryValue>('/reports/inventory-value');
  return data;
}
