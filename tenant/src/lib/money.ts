// Money input helpers: format with NBSP thousand-separators while typing,
// strip back to a plain numeric string for state.

const NBSP = ' '; // narrow no-break space — same separator as fmt.ts

/** Format a raw user input as grouped digits. Keeps a single '.' or ',' for decimals. */
export function fmtMoneyInput(raw: string): string {
  if (!raw) return '';
  // Allow only digits + one decimal separator
  const cleaned = raw.replace(/[^\d.,]/g, '');
  // Normalize comma → dot for split, then we render with the same dot
  const [intPartRaw, ...rest] = cleaned.replace(/,/g, '.').split('.');
  const intPart = intPartRaw.replace(/^0+(?=\d)/, ''); // trim leading zeros
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  if (rest.length === 0) return grouped;
  // join all extra dots back into the fractional part (but cap at 2 digits — UZS rounds, USD has cents)
  const frac = rest.join('').slice(0, 2);
  return `${grouped}.${frac}`;
}

/** Strip formatting → plain numeric string. Returns '' for empty input. */
export function parseMoneyInput(formatted: string): string {
  if (!formatted) return '';
  return formatted.replace(/\s/g, '').replace(',', '.');
}

/** Parse formatted money to a number, NaN-safe. */
export function moneyToNumber(formatted: string): number {
  const n = Number(parseMoneyInput(formatted));
  return Number.isFinite(n) ? n : 0;
}

/** Format a numeric amount with NBSP thousand separators (display-only, no decimal). */
export function fmtAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const fixed = Math.round(value);
  return fixed.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}
