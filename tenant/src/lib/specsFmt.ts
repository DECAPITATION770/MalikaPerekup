/** One-line specs summary for compact UI (Stock table row, SuccessModal). */

import i18n from '../i18n';
import type { DeviceCategory } from '../api/devices';

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Compact one-liner — e.g. ``"8/256 · Чёрный"``. Empty string if no
 *  meaningful values. Category drives which fields to surface first. */
export function specsSummary(
  category: DeviceCategory,
  specs: Record<string, unknown> | null | undefined,
): string {
  if (!specs) return '';
  const parts: string[] = [];

  if (category === 'phone' || category === 'tablet' || category === 'smartwatch') {
    const ram = num(specs.ram_gb);
    const storage = num(specs.storage_gb);
    if (ram != null && storage != null) parts.push(`${ram}/${storage}`);
    else if (storage != null) parts.push(`${storage} GB`);
    else if (ram != null) parts.push(`${ram} GB ОЗУ`);

    const color = str(specs.color);
    if (color) parts.push(color);
  } else if (category === 'laptop') {
    const ram = num(specs.ram_gb);
    const storage = num(specs.storage_gb);
    if (ram != null && storage != null) parts.push(`${ram}/${storage}`);
    const cpu = str(specs.cpu);
    if (cpu) parts.push(cpu);
  } else if (category === 'accessory') {
    const color = str(specs.color);
    if (color) parts.push(color);
  } else {
    // ``other`` — best-effort: first 2 string values.
    const vals: string[] = [];
    for (const v of Object.values(specs)) {
      const s = str(v);
      if (s) vals.push(s);
      if (vals.length >= 2) break;
    }
    parts.push(...vals);
  }

  return parts.join(' · ');
}

/** Render a single spec value for the detail page. Translates connectivity
 *  list keys, adds units to ram/storage/battery/screen, falls back to
 *  ``String(val)`` for the rest. */
export function formatSpecValue(key: string, val: unknown): string {
  if (val == null || val === '') return '—';

  if (Array.isArray(val)) {
    return val.map((v) => i18n.t(`specs.conn.${v}`, { defaultValue: String(v) })).join(', ');
  }

  switch (key) {
    case 'ram_gb':
    case 'storage_gb':
      return Number(val) >= 1024 ? `${Number(val) / 1024} TB` : `${val} GB`;
    case 'battery_health_pct':
      return `${val}%`;
    case 'screen_inches':
      return `${val}"`;
    default:
      return String(val);
  }
}
