import { z } from 'zod';
import type { TFunction } from 'i18next';
import type { FieldErrors } from 'react-hook-form';
import type { Currency } from '@/api/purchases';
import type { DeviceCategory, DeviceCondition } from '@/api/devices';
import { parseMoneyInput, moneyToNumber } from '@/lib/money';

export const CATEGORIES: DeviceCategory[] = ['phone', 'tablet', 'laptop', 'smartwatch', 'accessory', 'other'];
export const CONDITIONS: DeviceCondition[] = ['new', 'good', 'normal', 'broken'];
export const DOC_TYPES = ['passport', 'id_card', 'driver_license', 'other'] as const;

export const phoneRegex = /^\+?[0-9 ()-]{6,32}$/;
export const imeiRegex = /^[0-9]{14,15}$/;

export const DRAFT_KEY = 'tenant_purchase_draft_v3'; // v3 — 2-step (device + deal)
export const DRAFT_DEBOUNCE_MS = 500;

// ─── Wizard step model ─────────────────────────────────────────────────
//
// Collapsed from 4 steps to 2: «Аппарат» (the physical device you hold —
// model + IMEI + condition + photos) and «Сделка» (the transaction — price +
// seller). Brand is no longer a separate pick; it rides along with the model.

export const TOTAL_STEPS = 2;
export type WizardStep = 0 | 1; // 0 = device, 1 = deal

/** Which form fields are validated when leaving a step (Next pressed). */
export const STEP_FIELDS: Record<WizardStep, (keyof FormValues)[]> = {
  0: ['category', 'brand', 'model', 'imei', 'serial', 'condition', 'defects'],
  1: ['seller_full_name', 'seller_phone', 'currency', 'price', 'exchange_rate', 'purchase_date', 'comment'],
};

// ─── Defect checklist → condition derivation ───────────────────────────

/** Ordered list of toggle keys shown on step 2. */
export const DEFECT_KEYS = [
  'scratches_body',     // cosmetic
  'scratches_screen',   // cosmetic
  'no_box',             // cosmetic
  'screen_replaced',    // refurb → normal
  'battery_replaced',   // refurb → normal
  'not_original',       // refurb → normal
  'cracks',             // broken
  'dead',               // broken
] as const;

export type DefectKey = (typeof DEFECT_KEYS)[number];

const REFURB: ReadonlySet<DefectKey> = new Set([
  'screen_replaced', 'battery_replaced', 'not_original',
]);
const BROKEN: ReadonlySet<DefectKey> = new Set(['cracks', 'dead']);

/** Derive ``condition`` from checked defect keys.
 *  No defects → ``new`` (mint); only cosmetic → ``good``; any refurb → ``normal``;
 *  any broken-tier → ``broken``. */
export function conditionFromDefects(defects: string[]): DeviceCondition {
  if (defects.length === 0) return 'new';
  if (defects.some((d) => BROKEN.has(d as DefectKey))) return 'broken';
  if (defects.some((d) => REFURB.has(d as DefectKey))) return 'normal';
  return 'good';
}

// ─── Form values ───────────────────────────────────────────────────────

export type FormValues = {
  category: DeviceCategory;
  brand: string;
  model: string;
  imei: string;
  serial: string;
  condition: DeviceCondition;
  defects: string[];
  device_notes: string;
  specs: Record<string, unknown>;

  counterparty_id: number | null;
  seller_full_name: string;
  seller_phone: string;
  seller_doc_type: string;
  seller_doc_number: string;
  seller_tg: string;

  currency: Currency;
  price: string;
  exchange_rate: string;
  purchase_date: string;
  comment: string;
};

export function todayIsoTashkent(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function emptyDefaults(): FormValues {
  return {
    category: 'phone',
    brand: '', model: '', imei: '', serial: '',
    condition: 'new', defects: [], device_notes: '',
    specs: {},
    counterparty_id: null,
    seller_full_name: '', seller_phone: '',
    seller_doc_type: '', seller_doc_number: '', seller_tg: '',
    currency: 'UZS',
    price: '', exchange_rate: '',
    purchase_date: todayIsoTashkent(),
    comment: '',
  };
}

export function makeSchema(t: TFunction) {
  return z
    .object({
      category: z.enum(['phone', 'tablet', 'laptop', 'smartwatch', 'accessory', 'other']),
      brand: z.string().trim().min(1, t('purchase.errors.brand_required')).max(64),
      model: z.string().trim().min(1, t('purchase.errors.model_required')).max(120),
      imei: z
        .string()
        .trim()
        .max(32)
        .refine((v) => v === '' || imeiRegex.test(v), { message: t('purchase.errors.imei_format') }),
      serial: z.string().trim().max(64),
      condition: z.enum(['new', 'good', 'normal', 'broken']),
      defects: z.array(z.string()).max(32),
      device_notes: z.string().max(500),
      specs: z.record(z.string(), z.unknown()),

      counterparty_id: z.number().nullable(),
      seller_full_name: z.string().trim().min(1, t('purchase.errors.seller_name_required')).max(120),
      seller_phone: z
        .string()
        .trim()
        .max(32)
        .refine((v) => v === '' || phoneRegex.test(v), { message: t('purchase.errors.phone_format') }),
      seller_doc_type: z.string().max(32),
      seller_doc_number: z.string().trim().max(64),
      seller_tg: z.string().trim().max(64),

      currency: z.enum(['UZS', 'USD']),
      price: z
        .string()
        .min(1, t('purchase.errors.price_required'))
        .refine((v) => moneyToNumber(v) > 0, {
          message: t('purchase.errors.price_positive'),
        }),
      exchange_rate: z.string(),
      purchase_date: z.string().min(1),
      comment: z.string().max(500),
    })
    .superRefine((val, ctx) => {
      if (val.currency === 'USD') {
        const cleaned = parseMoneyInput(val.exchange_rate);
        if (cleaned === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['exchange_rate'],
            message: t('purchase.errors.rate_required'),
          });
        } else if (!(Number(cleaned) > 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['exchange_rate'],
            message: t('purchase.errors.rate_positive'),
          });
        }
      }
    });
}

/** Per-step completeness for ``WizardProgress``. */
export function computeStepStatus(
  v: FormValues,
  errors: FieldErrors<FormValues>,
): [boolean, boolean] {
  // Step 0 «Аппарат»: model picked (brand+model) and no device-field errors.
  // IMEI/serial/specs stay optional — the step is done once the model is set.
  const s0 =
    !!v.brand.trim() &&
    !!v.model.trim() &&
    !errors.brand &&
    !errors.model &&
    !errors.imei &&
    !errors.serial;

  // Step 1 «Сделка»: seller name + price (+ rate if USD) + date.
  const priceOk = moneyToNumber(v.price) > 0 && !errors.price;
  const rateOk =
    v.currency === 'USD'
      ? moneyToNumber(v.exchange_rate) > 0 && !errors.exchange_rate
      : true;
  const s1 =
    !!v.seller_full_name.trim() &&
    !errors.seller_full_name &&
    !errors.seller_phone &&
    priceOk &&
    rateOk &&
    !!v.purchase_date;

  return [s0, s1];
}
