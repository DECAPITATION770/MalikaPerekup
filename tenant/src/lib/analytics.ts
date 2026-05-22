/**
 * Plausible analytics wrapper. No-ops unless the Plausible script has
 * loaded (it's added to index.html guarded by VITE_PLAUSIBLE_DOMAIN at
 * runtime). Privacy-friendly, cookie-less — safe for a finance app.
 *
 * Usage: track('sale_created', { type: 'nasiya' })
 */
type PlausibleFn = (
  event: string,
  opts?: { props?: Record<string, string | number | boolean> },
) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn & { q?: unknown[] };
  }
}

export type AnalyticsEvent =
  | 'purchase_created'
  | 'sale_created'
  | 'installment_paid'
  | 'installment_paid_offline'
  | 'qr_printed'
  | 'report_exported'
  | 'error_seen';

export function track(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break the app */
  }
}
