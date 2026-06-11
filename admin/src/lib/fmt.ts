/**
 * Money / date / plan formatters for the admin UI.
 *
 * The admin panel sees aggregates across shops, so totals can grow large
 * (millions of UZS). `fmtUZSCompact` collapses big numbers to a short form
 * that fits in KPI tiles; everywhere else the full grouped form is used.
 */
import { formatDistanceToNowStrict, format } from 'date-fns';
import { ru } from 'date-fns/locale';

const NBSP = ' '; // narrow no-break space, used as thousand separator

/** Full grouped form: 1234567 → "1 234 567". UZS has no kopecks in cash. */
export function fmtUZS(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '0';
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Compact form: 1 234 567 → "1.2 млн". Used in KPI tiles where space is tight. */
export function fmtUZSCompact(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n) || n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' млрд';
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' млн';
  if (abs >= 10_000) return Math.round(n / 1_000) + ' тыс';
  return fmtUZS(n);
}

export function fmtTime(iso: string): string {
  try {
    return format(new Date(iso), 'HH:mm');
  } catch {
    return '—';
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: ru });
  } catch {
    return '—';
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'd MMM yyyy, HH:mm', { locale: ru });
  } catch {
    return '—';
  }
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: ru });
  } catch {
    return '—';
  }
}

/** Localised plan name. Falls back to the raw key for unknown plans. */
const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  basic: 'Basic',
  business: 'Business',
};
export function planLabel(plan: string | null | undefined): string {
  if (!plan) return '—';
  return PLAN_LABELS[plan] ?? plan;
}

/** Categorise an installment due date so the row can render the right chip. */
export type DueStatus = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'normal';
export function dueDateStatus(iso: string | null | undefined): DueStatus | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 7) return 'soon';
    return 'normal';
  } catch {
    return null;
  }
}
