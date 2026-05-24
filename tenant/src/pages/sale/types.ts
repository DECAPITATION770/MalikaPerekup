import { z } from 'zod';
import type { FieldErrors } from 'react-hook-form';
import { moneyToNumber } from '@/lib/money';

export const DOC_TYPES = ['passport', 'id_card', 'driver_license', 'other'] as const;

export const DRAFT_KEY = 'tenant_sale_draft_v1';
export const DRAFT_DEBOUNCE_MS = 500;

// ─── Wizard step model ─────────────────────────────────────────────────
//
// Mirrors the purchase wizard: «Устройство» (pick the stock device you're
// selling) and «Сделка» (the transaction — type + price + buyer + nasiya).
// 2 steps on purpose, so cash/nasiya is chosen in the same step as the buyer
// and the buyer's documents can react to it.

export const TOTAL_STEPS = 2;
export type WizardStep = 0 | 1; // 0 = device, 1 = deal

export type SaleFormValues = {
  device_id: number | undefined;
  buyer_name: string;
  buyer_phone: string;
  buyer_doc_type: string;
  buyer_doc_number: string;
  buyer_tg: string;
  sale_type: 'cash' | 'nasiya';
  currency: 'UZS' | 'USD';
  price: string;
  exchange_rate: string;
  sale_date: string;
  comment: string;
  down_payment: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  period_count: number | undefined;
  start_date: string;
};

/** Which fields are validated when leaving a step (Next pressed). */
export const STEP_FIELDS: Record<WizardStep, (keyof SaleFormValues)[]> = {
  0: ['device_id'],
  1: [
    'buyer_name',
    'buyer_phone',
    'sale_type',
    'currency',
    'price',
    'exchange_rate',
    'sale_date',
    'comment',
    'down_payment',
    'period_type',
    'period_count',
    'start_date',
  ],
};

export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

export function emptyDefaults(): SaleFormValues {
  return {
    device_id: undefined,
    buyer_name: '',
    buyer_phone: '',
    buyer_doc_type: '',
    buyer_doc_number: '',
    buyer_tg: '',
    sale_type: 'cash',
    currency: 'UZS',
    price: '',
    exchange_rate: '',
    sale_date: todayIso(),
    comment: '',
    down_payment: '',
    period_type: 'monthly',
    period_count: 3,
    start_date: todayIso(),
  };
}

// Messages stay empty — SaleNew renders its own error copy per field, same as
// the legacy single-page form did.
export const schema = z
  .object({
    device_id: z.number({ invalid_type_error: 'required' }).int().positive(),
    buyer_name: z.string().min(1),
    buyer_phone: z.string().optional(),
    buyer_doc_type: z.string().optional(),
    buyer_doc_number: z.string().optional(),
    buyer_tg: z.string().optional(),
    sale_type: z.enum(['cash', 'nasiya']),
    currency: z.enum(['UZS', 'USD']),
    price: z.string().min(1),
    exchange_rate: z.string().optional(),
    sale_date: z.string().min(1),
    comment: z.string().optional(),
    down_payment: z.string().optional(),
    period_type: z.enum(['daily', 'weekly', 'monthly']),
    period_count: z.number().int().min(1).optional(),
    start_date: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (moneyToNumber(v.price) <= 0) ctx.addIssue({ code: 'custom', path: ['price'], message: '' });
    if (v.currency === 'USD' && !v.exchange_rate)
      ctx.addIssue({ code: 'custom', path: ['exchange_rate'], message: '' });
    if (v.sale_type === 'nasiya') {
      if (!v.period_count || v.period_count < 1)
        ctx.addIssue({ code: 'custom', path: ['period_count'], message: '' });
      if (!v.start_date) ctx.addIssue({ code: 'custom', path: ['start_date'], message: '' });
    }
  });

/** Per-step completeness for ``WizardProgress``. */
export function computeStepStatus(
  v: SaleFormValues,
  errors: FieldErrors<SaleFormValues>,
): [boolean, boolean] {
  const s0 = !!v.device_id && !errors.device_id;

  const priceOk = moneyToNumber(v.price) > 0 && !errors.price;
  const rateOk =
    v.currency === 'USD' ? moneyToNumber(v.exchange_rate) > 0 && !errors.exchange_rate : true;
  const buyerOk = !!v.buyer_name.trim() && !errors.buyer_name;
  const nasiyaOk =
    v.sale_type === 'nasiya' ? !!v.period_count && v.period_count >= 1 && !!v.start_date : true;
  const s1 = buyerOk && priceOk && rateOk && !!v.sale_date && nasiyaOk;

  return [s0, s1];
}
