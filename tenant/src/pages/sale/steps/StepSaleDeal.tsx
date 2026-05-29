/**
 * StepSaleDeal — step 2 of the sale wizard: the transaction. A compact
 * reminder of the device being sold, then sale type (cash/nasiya), price,
 * date, the buyer (directory search or manual entry), and — for nasiya — the
 * installment schedule with a live preview. Buyer documents auto-expand for
 * nasiya, where a passport actually matters.
 */
import { useTranslation } from 'react-i18next';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from 'react-hook-form';
import { Check, X } from 'lucide-react';

import LabeledInput from '@/components/ui/labeled-input';
import CurrencyDualInput from '@/components/CurrencyDualInput';
import DocumentUploader from '@/components/DocumentUploader';
import BrandBadge from '@/components/BrandBadge';
import { requestSaleUploadUrl } from '@/api/sales';
import type { DeviceWithPurchaseOut } from '@/api/devices';
import type { CounterpartyOut } from '@/api/counterparties';
import type { ExchangeRateHint } from '@/api/reports';
import { fmtMoneyInput, moneyToNumber } from '@/lib/money';
import { fmtUzs } from '@/lib/fmt';
import { specsSummary } from '@/lib/specsFmt';
import { cn } from '@/lib/utils';

import { OptionalGroup, SegmentedRow } from '../../purchase/primitives';
import { SellerSearch as CounterpartySearch } from '../../purchase/SellerSearch';
import { StepShell } from '../../purchase/Wizard';
import { DOC_TYPES, type SaleFormValues } from '../types';

type Currency = 'UZS' | 'USD';
type SaleType = 'cash' | 'nasiya';
type PeriodType = 'daily' | 'weekly' | 'monthly';

interface Props {
  control: Control<SaleFormValues>;
  register: UseFormRegister<SaleFormValues>;
  setValue: UseFormSetValue<SaleFormValues>;
  watch: UseFormWatch<SaleFormValues>;
  errors: FieldErrors<SaleFormValues>;
  selectedDevice: DeviceWithPurchaseOut | null;
  selectedBuyerId: number | null;
  onPickBuyer: (cp: CounterpartyOut) => void;
  onClearBuyer: () => void;
  buyerPhotos: string[];
  onBuyerPhotosChange: (next: string[]) => void;
  rateHints?: ExchangeRateHint;
  /** Bumped on draft restore to remount + re-seed the uncontrolled price input. */
  priceResetKey: number;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-1 text-caption font-semibold tracking-tight text-text-muted">
      {children}
    </div>
  );
}

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

export default function StepSaleDeal({
  control,
  register,
  setValue,
  watch,
  errors,
  selectedDevice,
  selectedBuyerId,
  onPickBuyer,
  onClearBuyer,
  buyerPhotos,
  onBuyerPhotosChange,
  rateHints,
  priceResetKey,
}: Props) {
  const { t } = useTranslation();
  const saleType = watch('sale_type');

  return (
    <StepShell
      step={1}
      total={2}
      title={t('sale.step_deal_title')}
      subtitle={t('sale.step_deal_subtitle')}
    >
      {/* Compact reminder of what's being sold — brand, model, IMEI on row 1;
          specs summary + cost on row 2 so the perekup remembers what they
          paid for it and can sanity-check the sale price below. */}
      {selectedDevice && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-bg2 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <BrandBadge brand={selectedDevice.brand} size="sm" />
            <span className="truncate text-label font-bold tracking-tight">
              {selectedDevice.model}
            </span>
            <span className="ml-auto shrink-0 font-mono text-caption text-text-muted">
              {selectedDevice.imei ?? selectedDevice.serial ?? '—'}
            </span>
          </div>
          {(() => {
            const specs = specsSummary(selectedDevice.category, selectedDevice.specs);
            const cost = selectedDevice.purchase_price_uzs;
            if (!specs && !cost) return null;
            return (
              <div className="flex items-center gap-2 text-caption text-text-dim">
                {specs && <span className="truncate">{specs}</span>}
                {specs && cost && <span className="text-text-muted">·</span>}
                {cost && (
                  <span className="shrink-0">
                    {t('sale.cost_reminder', { amount: fmtUzs(cost) })}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Deal + Buyer — side-by-side on desktop, stacked on mobile.
          Single grid so both sections share the same row baseline. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
      {/* Deal type + price */}
      <div className="flex flex-col gap-2">
        <SectionLabel>{t('sale.section_deal')}</SectionLabel>
        <div className="card flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-label font-medium text-text-dim">
              {t('sale.sale_type_label')}
            </label>
            <Controller
              name="sale_type"
              control={control}
              render={({ field }) => (
                <SegmentedRow
                  value={field.value}
                  onChange={field.onChange}
                  options={(['cash', 'nasiya'] as SaleType[]).map((st) => ({
                    value: st,
                    label: t(`sale.${st}`),
                  }))}
                />
              )}
            />
            <p className="text-hint text-text-muted">{t('sale.sale_type_hint')}</p>
          </div>

          <CurrencyDualInput
            key={priceResetKey}
            label={t('sale.price_label')}
            required
            rateHints={rateHints}
            defaultCurrency={watch('currency') as Currency}
            defaultPrice={watch('price')}
            defaultRate={watch('exchange_rate')}
            priceError={errors.price ? t('sale.errors.price_positive') : undefined}
            rateError={errors.exchange_rate ? t('sale.errors.rate_required') : undefined}
            onChange={({ currency: curr, price: p, rate }) => {
              setValue('currency', curr as Currency, { shouldValidate: true });
              setValue('price', fmtMoneyInput(p), { shouldValidate: true });
              setValue('exchange_rate', rate ? fmtMoneyInput(rate) : '', { shouldValidate: true });
            }}
          />

          {selectedDevice?.purchase_price_uzs && (
            <ProfitPreview
              priceUzs={salePriceInUzs(
                watch('price'),
                watch('currency') as Currency,
                watch('exchange_rate'),
              )}
              costUzs={selectedDevice.purchase_price_uzs}
              cashLabel={t('sale.profit_cash')}
              lossLabel={t('sale.profit_loss')}
              breakevenLabel={t('sale.profit_breakeven')}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-label font-medium text-text-dim">{t('sale.date_label')}</label>
            <input
              type="date"
              max={todayIso()}
              {...register('sale_date')}
              className="h-12 rounded-xl border border-border bg-bg2 px-3.5 text-body text-text outline-none transition-colors focus:border-accent"
            />
          </div>

          <LabeledInput
            label={t('sale.comment_label')}
            placeholder={t('sale.comment_placeholder')}
            {...register('comment')}
          />
        </div>
      </div>

      {/* Buyer */}
      <div className="flex flex-col gap-2">
        <SectionLabel>{t('sale.section_buyer')}</SectionLabel>
        <div className="card flex flex-col gap-4 p-4">
          <CounterpartySearch
            disabled={selectedBuyerId !== null}
            onPick={onPickBuyer}
            type="buyer"
            placeholderKey="sale.buyer_search"
          />
          {selectedBuyerId !== null ? (
            <div className="flex animate-fade-in items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-faded px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-label font-semibold text-success">
                <Check size={16} className="shrink-0" />
                <span className="truncate">{watch('buyer_name')}</span>
              </div>
              <button
                type="button"
                onClick={onClearBuyer}
                className="flex shrink-0 cursor-pointer items-center gap-1 text-hint text-text-dim hover:text-text"
              >
                <X size={12} /> {t('common.cancel')}
              </button>
            </div>
          ) : (
            <>
              <LabeledInput
                label={t('sale.buyer_name_label')}
                required
                placeholder={t('sale.buyer_name_placeholder')}
                error={errors.buyer_name ? t('sale.errors.buyer_required') : undefined}
                {...register('buyer_name')}
              />
              <LabeledInput
                label={t('sale.buyer_phone_label')}
                placeholder={t('sale.buyer_phone_placeholder')}
                type="tel"
                inputMode="tel"
                {...register('buyer_phone')}
              />

              {/* Auto-expanded for nasiya: a passport matters when the buyer owes
                  money. `key` re-seeds the open state when the sale type flips. */}
              <OptionalGroup
                key={saleType}
                defaultOpen={saleType === 'nasiya'}
                title={t('sale.buyer_docs_optional')}
                bodyClassName="mt-4 flex flex-col gap-4 animate-fade-in"
              >
                <LabeledInput
                  label={t('sale.buyer_tg_label')}
                  placeholder={t('sale.buyer_tg_placeholder')}
                  {...register('buyer_tg')}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-label font-medium text-text-dim">
                    {t('sale.buyer_doc_type_label')}
                  </label>
                  <Controller
                    name="buyer_doc_type"
                    control={control}
                    render={({ field }) => (
                      <SegmentedRow
                        value={(field.value as (typeof DOC_TYPES)[number]) || ''}
                        onChange={field.onChange}
                        allowEmpty
                        options={DOC_TYPES.map((d) => ({
                          value: d,
                          label: t(`purchase.doc_type.${d}`),
                        }))}
                      />
                    )}
                  />
                </div>
                <LabeledInput
                  label={t('sale.buyer_doc_number_label')}
                  placeholder={t('sale.buyer_doc_number_placeholder')}
                  {...register('buyer_doc_number')}
                />
                <DocumentUploader
                  label={t('sale.buyer_photos_label')}
                  value={buyerPhotos}
                  onChange={onBuyerPhotosChange}
                  requestUploadUrl={requestSaleUploadUrl}
                />
              </OptionalGroup>
            </>
          )}
        </div>
      </div>

      </div>
      {/* /Deal + Buyer grid */}

      {/* Nasiya */}
      {saleType === 'nasiya' && (
        <div className="flex flex-col gap-2">
          <SectionLabel>{t('sale.nasiya_section')}</SectionLabel>
          <div className="card flex flex-col gap-4 p-4">
            <Controller
              name="down_payment"
              control={control}
              render={({ field }) => (
                <LabeledInput
                  label={t('sale.down_payment_label')}
                  inputMode="numeric"
                  placeholder={t('sale.down_payment_placeholder')}
                  suffix={
                    <span className="text-hint font-medium text-text-muted">
                      {watch('currency')}
                    </span>
                  }
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(fmtMoneyInput(e.target.value))}
                />
              )}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-label font-medium text-text-dim">
                {t('sale.period_type_label')}
              </label>
              <Controller
                name="period_type"
                control={control}
                render={({ field }) => (
                  <SegmentedRow
                    value={field.value}
                    onChange={field.onChange}
                    options={(['daily', 'weekly', 'monthly'] as PeriodType[]).map((pt) => ({
                      value: pt,
                      label: t(`sale.period_${pt}`),
                    }))}
                  />
                )}
              />
            </div>

            <Controller
              name="period_count"
              control={control}
              render={({ field }) => (
                <LabeledInput
                  label={t('sale.period_count_label')}
                  required
                  inputMode="numeric"
                  placeholder="12"
                  error={errors.period_count ? t('sale.errors.period_count_required') : undefined}
                  value={field.value !== undefined ? String(field.value) : ''}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    field.onChange(Number.isFinite(n) ? n : undefined);
                  }}
                />
              )}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-label font-medium text-text-dim">
                {t('sale.start_date_label')}
              </label>
              <input
                type="date"
                {...register('start_date')}
                className="h-12 rounded-xl border border-border bg-bg2 px-3.5 text-body text-text outline-none transition-colors focus:border-accent"
              />
              {errors.start_date && (
                <span className="text-hint text-danger">{t('sale.errors.start_date_required')}</span>
              )}
            </div>

            <NasiyaPreview
              price={watch('price')}
              currency={watch('currency')}
              exchangeRate={watch('exchange_rate')}
              downPayment={watch('down_payment') ?? ''}
              periodCount={watch('period_count')}
            />
          </div>
        </div>
      )}
    </StepShell>
  );
}

/** Live nasiya math: "6 платежей по 250 000 UZS" without mental arithmetic. */
function NasiyaPreview({
  price,
  currency,
  exchangeRate,
  downPayment,
  periodCount,
}: {
  price: string;
  currency: 'UZS' | 'USD';
  exchangeRate?: string;
  downPayment: string;
  periodCount?: number;
}) {
  const { t } = useTranslation();
  const priceN = moneyToNumber(price);
  const downN = moneyToNumber(downPayment || '0');
  const rateN = moneyToNumber(exchangeRate || '0');
  const toUzs = (v: number) => (currency === 'USD' ? v * rateN : v);
  const priceUzs = toUzs(priceN);
  const downUzs = toUzs(downN);
  const remainingUzs = Math.max(priceUzs - downUzs, 0);
  const periods = Number(periodCount) || 0;
  const perPaymentUzs = periods > 0 ? remainingUzs / periods : 0;
  const downTooBig = priceUzs > 0 && downUzs > priceUzs;

  if (priceUzs <= 0) return null;

  if (downTooBig) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger-faded px-3 py-2.5 text-center text-label font-semibold text-danger">
        {t('sale.nasiya_warn_down')}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-bg3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-caption tracking-tight text-text-muted">
          {t('sale.nasiya_summary')}
        </div>
        <div className="mt-0.5 truncate text-body-lg font-bold tabular-nums text-text">
          {fmtUzs(remainingUzs)} UZS
        </div>
      </div>
      {periods > 0 && perPaymentUzs > 0 && (
        <div className="min-w-0 text-right">
          <div className="text-caption text-text-muted">{periods} ×</div>
          <div className="mt-0.5 truncate text-body-lg font-bold tabular-nums text-success">
            {fmtUzs(perPaymentUzs)} UZS
          </div>
        </div>
      )}
    </div>
  );
}

/** Sale price in UZS, taking currency + rate into account. */
function salePriceInUzs(price: string, currency: Currency, rate: string): number {
  const priceN = moneyToNumber(price);
  if (currency === 'UZS') return priceN;
  const rateN = moneyToNumber(rate || '0');
  return priceN * rateN;
}

/**
 * Live profit indicator. The single most-asked-for KPI in the audit — the
 * perekup wants to see «am I in the black yet?» the moment they type the
 * price. Green when positive, neutral on breakeven, danger when in the
 * red. Hidden until the sale price is non-zero (avoid the «−9 118 480»
 * scarecrow on an empty form).
 */
function ProfitPreview({
  priceUzs,
  costUzs,
  cashLabel,
  lossLabel,
  breakevenLabel,
}: {
  priceUzs: number;
  costUzs: string;
  cashLabel: string;
  lossLabel: string;
  breakevenLabel: string;
}) {
  if (priceUzs <= 0) return null;
  const cost = moneyToNumber(costUzs);
  const profit = priceUzs - cost;
  const isLoss = profit < 0;
  const isFlat = profit === 0;
  const label = isLoss ? lossLabel : isFlat ? breakevenLabel : cashLabel;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5',
        isLoss
          ? 'border-danger/30 bg-danger-faded'
          : isFlat
            ? 'border-border bg-bg3'
            : 'border-success/30 bg-success-faded',
      )}
    >
      <span
        className={cn(
          'text-caption font-semibold tracking-tight',
          isLoss ? 'text-danger' : isFlat ? 'text-text-dim' : 'text-success',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'truncate text-body-lg font-bold tabular-nums',
          isLoss ? 'text-danger' : isFlat ? 'text-text' : 'text-success',
        )}
      >
        {isLoss ? '' : '+'}
        {fmtUzs(profit)} UZS
      </span>
    </div>
  );
}
