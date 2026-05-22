// Money/date helpers shared across pages.

const NBSP = ' '; // narrow no-break space — readable thousand separator

/** Format a UZS amount as a grouped string. Accepts string (Decimal-as-string) or number. */
export function fmtUzs(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '0';
  // Strip fractional part for UZS (no kopecks in real cash).
  const fixed = Math.trunc(n);
  return fixed.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Compact form: 1 234 567 → "1.2 млн" (RU) — used inside small KPI cards.  */
export function fmtUzsCompact(
  value: string | number | null | undefined,
  units: { thousand: string; million: string; billion: string },
): string {
  if (value === null || value === undefined || value === '') return '0';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n) || n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000)
    return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' ' + units.billion;
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' ' + units.million;
  if (abs >= 10_000) return Math.round(n / 1_000) + ' ' + units.thousand;
  return fmtUzs(n);
}

/** Localised unit suffixes for {@link fmtUzsCompact}. Pass a `t` function so
 *  this module stays free of any i18n import. */
export function compactUnits(t: (key: string) => string): {
  thousand: string;
  million: string;
  billion: string;
} {
  return {
    thousand: t('common.unit_thousand'),
    million: t('common.unit_million'),
    billion: t('common.unit_billion'),
  };
}

export function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tashkent',
    });
  } catch {
    return '—';
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Tashkent',
    });
  } catch {
    return '—';
  }
}

export function greetingKey(
  date = new Date(),
): 'today.greeting_morning' | 'today.greeting_day' | 'today.greeting_evening' {
  const hour = Number(
    date.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tashkent' }),
  );
  if (hour < 12) return 'today.greeting_morning';
  if (hour < 18) return 'today.greeting_day';
  return 'today.greeting_evening';
}
