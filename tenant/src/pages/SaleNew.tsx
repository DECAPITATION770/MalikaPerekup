import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Search, Smartphone, Tablet, Laptop, Watch, Headphones,
  Package as PackageIcon, Check, X, ChevronDown, type LucideIcon,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import CurrencyDualInput from '../components/ui/CurrencyDualInput';
import { useToast } from '../components/ui/Toast';
import DocumentUploader from '../components/ui/DocumentUploader';
import { createSale, createInstallmentPlan, requestSaleUploadUrl } from '../api/sales';
import { listDevices, type DeviceOut, type DeviceCategory } from '../api/devices';
import { getExchangeRateHint } from '../api/reports';
import { useDebounced } from '../lib/useDebounced';
import { fmtMoneyInput, parseMoneyInput, moneyToNumber } from '../lib/money';
import { fmtUzs } from '../lib/fmt';
import { useTgBack } from '../lib/useTelegram';
import { SegmentedRow } from './purchase/primitives';
import { SellerSearch as CounterpartySearch } from './purchase/SellerSearch';
import type { CounterpartyOut } from '../api/counterparties';

const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone, tablet: Tablet, laptop: Laptop, smartwatch: Watch,
  accessory: Headphones, other: PackageIcon,
};

const DOC_TYPES = ['passport', 'id_card', 'driver_license', 'other'] as const;
type Currency = 'UZS' | 'USD';
type SaleType = 'cash' | 'nasiya';
type PeriodType = 'daily' | 'weekly' | 'monthly';

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

const schema = z.object({
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
}).superRefine((v, ctx) => {
  if (moneyToNumber(v.price) <= 0) {
    ctx.addIssue({ code: 'custom', path: ['price'], message: '' });
  }
  if (v.currency === 'USD' && !v.exchange_rate) {
    ctx.addIssue({ code: 'custom', path: ['exchange_rate'], message: '' });
  }
  if (v.sale_type === 'nasiya') {
    if (!v.period_count || v.period_count < 1) {
      ctx.addIssue({ code: 'custom', path: ['period_count'], message: '' });
    }
    if (!v.start_date) {
      ctx.addIssue({ code: 'custom', path: ['start_date'], message: '' });
    }
  }
});

type FormValues = z.infer<typeof schema>;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 flex flex-col gap-4">
      <div>
        <h2 className="text-body-lg font-bold tracking-tight">{title}</h2>
        {hint && <p className="text-hint text-text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function DeviceRow({ device, selected, onSelect }: { device: DeviceOut; selected: boolean; onSelect: () => void }) {
  const Icon = CATEGORY_ICON[device.category] ?? PackageIcon;
  return (
    <button type="button" onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
        ${selected ? 'border-accent bg-accent-faded' : 'border-border bg-bg2 active:bg-bg3'}`}>
      <div className="w-9 h-9 rounded-lg bg-bg3 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-text-dim" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-body font-bold truncate">{device.brand} {device.model}</div>
        <div className="text-caption text-text-muted">{device.imei ?? device.serial ?? '—'}</div>
      </div>
      {selected && <Check size={16} className="text-accent shrink-0" />}
    </button>
  );
}

export default function SaleNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  useTgBack(() => navigate(-1));

  const [deviceSearch, setDeviceSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceOut | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [buyerPhotos, setBuyerPhotos] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const debouncedSearch = useDebounced(deviceSearch.trim(), 300);

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices-stock', debouncedSearch],
    queryFn: () => listDevices({ status: 'in_stock', q: debouncedSearch || undefined, limit: 20 }),
    enabled: !selectedDevice,
  });

  const { data: rateHints } = useQuery({
    queryKey: ['exchange-rate-hint'],
    queryFn: getExchangeRateHint,
    staleTime: 5 * 60_000,
  });

  const {
    register, control, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      device_id: undefined as unknown as number,
      buyer_name: '', buyer_phone: '', buyer_doc_type: '', buyer_doc_number: '', buyer_tg: '',
      sale_type: 'cash', currency: 'UZS',
      price: '', exchange_rate: '', sale_date: todayIso(), comment: '',
      down_payment: '', period_type: 'monthly', period_count: 3, start_date: todayIso(),
    },
  });

  const saleType = watch('sale_type');

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const sale = await createSale({
        device_id: values.device_id,
        buyer: {
          full_name: values.buyer_name.trim(),
          phone: values.buyer_phone || null,
          doc_type: values.buyer_doc_type || null,
          doc_number: values.buyer_doc_number || null,
          tg_username: values.buyer_tg || null,
          photos: buyerPhotos,
        },
        sale_type: values.sale_type,
        currency: values.currency,
        price: parseMoneyInput(values.price),
        exchange_rate: values.currency === 'USD' ? parseMoneyInput(values.exchange_rate ?? '') : null,
        sale_date: values.sale_date,
        comment: values.comment || null,
      });
      if (values.sale_type === 'nasiya') {
        await createInstallmentPlan(sale.id, {
          total_amount: parseMoneyInput(values.price),
          down_payment: values.down_payment ? parseMoneyInput(values.down_payment) : undefined,
          period_type: values.period_type,
          period_count: values.period_count!,
          start_date: values.start_date!,
        });
      }
    },
    onSuccess: () => setDone(true),
    onError: () => toast.error(t('sale.errors.submit_failed')),
  });

  const onSelectDevice = (device: DeviceOut) => {
    setSelectedDevice(device);
    setValue('device_id', device.id, { shouldValidate: true });
  };

  const onClearDevice = () => {
    setSelectedDevice(null);
    setValue('device_id', undefined as unknown as number);
    setDeviceSearch('');
  };

  const onPickBuyer = (cp: CounterpartyOut) => {
    setSelectedBuyerId(cp.id);
    setValue('buyer_name', cp.full_name, { shouldValidate: true });
    setValue('buyer_phone', cp.phone ?? '');
    setValue('buyer_doc_type', cp.doc_type ?? '');
    setValue('buyer_doc_number', cp.doc_number ?? '');
    setValue('buyer_tg', cp.tg_username ? `@${cp.tg_username.replace(/^@/, '')}` : '');
  };

  const onClearBuyer = () => {
    setSelectedBuyerId(null);
    setValue('buyer_name', '');
    setValue('buyer_phone', '');
    setValue('buyer_doc_type', '');
    setValue('buyer_doc_number', '');
    setValue('buyer_tg', '');
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 animate-fade-up px-4">
        <div className="w-16 h-16 rounded-2xl bg-success-faded flex items-center justify-center">
          <Check size={28} className="text-success" />
        </div>
        <div className="text-center">
          <h2 className="text-title-sm font-bold">{t('sale.success_title')}</h2>
          <p className="text-body text-text-dim mt-1">{t('sale.success_body')}</p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button size="md" onClick={() => { setDone(false); window.location.reload(); }}>
            {t('sale.success_another')}
          </Button>
          <Button variant="secondary" size="md" onClick={() => navigate('/')}>
            {t('sale.success_view')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4 animate-fade-up pb-28 md:pb-6">
      <h1 className="text-title font-bold tracking-tight">{t('sale.title')}</h1>

      {/* Device picker */}
      <Section title={t('sale.section_device')} hint={t('sale.section_device_hint')}>
        {selectedDevice ? (
          <div className="flex flex-col gap-2">
            <DeviceRow device={selectedDevice} selected onSelect={() => {}} />
            <button type="button" onClick={onClearDevice}
              className="text-hint text-accent font-medium text-left px-1">
              {t('sale.device_clear')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-bg2 rounded-xl border border-border focus-within:border-accent transition-colors h-12 px-3.5">
              <Search size={16} className="text-text-muted shrink-0" />
              <input value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)}
                placeholder={t('sale.device_search')}
                className="flex-1 bg-transparent outline-none text-body placeholder:text-text-muted" />
            </div>
            {errors.device_id && (
              <span className="text-xs text-danger">{t('sale.errors.device_required')}</span>
            )}
            {devicesLoading ? (
              <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-bg2 animate-pulse" />
              ))}</div>
            ) : (devicesData?.items.length ?? 0) === 0 ? (
              <p className="text-label text-text-muted text-center py-4">{t('sale.device_empty')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {devicesData!.items.map((d) => (
                  <DeviceRow key={d.id} device={d} selected={false} onSelect={() => onSelectDevice(d)} />
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {/* Buyer info */}
      <Section title={t('sale.section_buyer')} hint={t('sale.section_buyer_hint')}>
        <CounterpartySearch
          disabled={selectedBuyerId !== null}
          onPick={onPickBuyer}
          type="buyer"
          placeholderKey="sale.buyer_search"
        />
        {selectedBuyerId !== null && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-success-faded border border-success/30 animate-fade-in">
            <div className="flex items-center gap-2 text-success font-semibold text-label">
              <Check size={16} />
              {t('purchase.seller_existing')}
            </div>
            <button
              type="button"
              onClick={onClearBuyer}
              className="text-text-dim hover:text-text text-xs flex items-center gap-1 cursor-pointer"
            >
              <X size={12} /> {t('common.cancel')}
            </button>
          </div>
        )}

        <Input label={t('sale.buyer_name_label')} required
          placeholder={t('sale.buyer_name_placeholder')}
          error={errors.buyer_name ? t('sale.errors.buyer_required') : undefined}
          {...register('buyer_name')} />
        <Input label={t('sale.buyer_phone_label')}
          placeholder={t('sale.buyer_phone_placeholder')}
          type="tel" inputMode="tel"
          {...register('buyer_phone')} />

        {/* Документы и tg необязательны при cash-продаже — спрячем под collapse.
            Если уже заполнены (приходит из CounterpartySearch) — раскроем сразу. */}
        <BuyerDocsCollapse>
          <Input label={t('sale.buyer_tg_label')}
            placeholder={t('sale.buyer_tg_placeholder')}
            {...register('buyer_tg')} />
          <div className="flex flex-col gap-1.5">
            <label className="text-label text-text-dim font-medium">{t('sale.buyer_doc_type_label')}</label>
            <Controller name="buyer_doc_type" control={control} render={({ field }) => (
              <SegmentedRow
                value={(field.value as typeof DOC_TYPES[number]) || ''}
                onChange={field.onChange}
                allowEmpty
                options={DOC_TYPES.map((d) => ({ value: d, label: t(`purchase.doc_type.${d}`) }))}
              />
            )} />
          </div>
          <Input label={t('sale.buyer_doc_number_label')}
            placeholder={t('sale.buyer_doc_number_placeholder')}
            {...register('buyer_doc_number')} />
          <DocumentUploader
            label={t('sale.buyer_photos_label')}
            value={buyerPhotos}
            onChange={setBuyerPhotos}
            requestUploadUrl={requestSaleUploadUrl}
          />
        </BuyerDocsCollapse>
      </Section>

      {/* Deal */}
      <Section title={t('sale.section_deal')} hint={t('sale.section_deal_hint')}>
        {/* Sale type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label text-text-dim font-medium">{t('sale.sale_type_label')}</label>
          <Controller name="sale_type" control={control} render={({ field }) => (
            <SegmentedRow
              value={field.value}
              onChange={field.onChange}
              options={(['cash', 'nasiya'] as SaleType[]).map((st) => ({ value: st, label: t(`sale.${st}`) }))}
            />
          )} />
        </div>

        <CurrencyDualInput
          label={t('sale.price_label')}
          required
          rateHints={rateHints}
          priceError={errors.price ? t('sale.errors.price_positive') : undefined}
          rateError={errors.exchange_rate ? t('sale.errors.rate_required') : undefined}
          onChange={({ currency: curr, price: p, rate }) => {
            setValue('currency', curr as Currency, { shouldValidate: true });
            setValue('price', fmtMoneyInput(p), { shouldValidate: true });
            setValue('exchange_rate', rate ? fmtMoneyInput(rate) : '', { shouldValidate: true });
          }}
        />

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label text-text-dim font-medium">{t('sale.date_label')}</label>
          <input type="date" max={todayIso()} {...register('sale_date')}
            className="bg-bg2 rounded-xl border border-border h-12 px-3.5 text-body text-text outline-none focus:border-accent transition-colors" />
        </div>

        {/* Comment */}
        <Input label={t('sale.comment_label')} placeholder={t('sale.comment_placeholder')}
          {...register('comment')} />
      </Section>

      {/* Nasiya section */}
      {saleType === 'nasiya' && (
        <Section title={t('sale.nasiya_section')}>
          <Controller name="down_payment" control={control} render={({ field }) => (
            <Input label={t('sale.down_payment_label')} inputMode="numeric"
              placeholder={t('sale.down_payment_placeholder')}
              suffix={<span className="text-hint text-text-muted font-medium">{watch('currency')}</span>}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(fmtMoneyInput(e.target.value))} />
          )} />

          <div className="flex flex-col gap-1.5">
            <label className="text-label text-text-dim font-medium">{t('sale.period_type_label')}</label>
            <Controller name="period_type" control={control} render={({ field }) => (
              <SegmentedRow
                value={field.value}
                onChange={field.onChange}
                options={(['daily', 'weekly', 'monthly'] as PeriodType[]).map((pt) => ({ value: pt, label: t(`sale.period_${pt}`) }))}
              />
            )} />
          </div>

          <Controller name="period_count" control={control} render={({ field }) => (
            <Input label={t('sale.period_count_label')} required inputMode="numeric"
              placeholder="12"
              error={errors.period_count ? t('sale.errors.period_count_required') : undefined}
              value={field.value !== undefined ? String(field.value) : ''}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                field.onChange(Number.isFinite(n) ? n : undefined);
              }} />
          )} />

          <div className="flex flex-col gap-1.5">
            <label className="text-label text-text-dim font-medium">{t('sale.start_date_label')}</label>
            <input type="date" {...register('start_date')}
              className="bg-bg2 rounded-xl border border-border h-12 px-3.5 text-body text-text outline-none focus:border-accent transition-colors" />
            {errors.start_date && (
              <span className="text-xs text-danger">{t('sale.errors.start_date_required')}</span>
            )}
          </div>

          <NasiyaPreview
            price={watch('price')}
            currency={watch('currency')}
            exchangeRate={watch('exchange_rate')}
            downPayment={watch('down_payment') ?? ''}
            periodCount={watch('period_count')}
          />
        </Section>
      )}

      {/* Sticky submit */}
      <div className="fixed bottom-16 inset-x-0 md:static md:bottom-auto p-4 md:p-0 bg-gradient-to-t from-bg via-bg/95 to-transparent md:bg-none z-30">
        <Button type="submit" size="lg" loading={mutation.isPending} disabled={mutation.isPending} className="w-full">
          {saleType === 'nasiya' ? t('sale.submit_nasiya') : t('sale.submit')}
        </Button>
      </div>
    </form>
  );
}

/** Live math for the nasiya block so the seller can tell the buyer
 *  "6 платежей по 250 000 UZS" without doing it in their head. */
function NasiyaPreview({
  price, currency, exchangeRate, downPayment, periodCount,
}: {
  price: string; currency: 'UZS' | 'USD'; exchangeRate?: string;
  downPayment: string; periodCount?: number;
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
      <div className="rounded-xl border border-danger/30 bg-danger-faded text-danger px-3 py-2.5 text-label font-semibold text-center">
        {t('sale.nasiya_warn_down')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-bg3 px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-caption text-text-muted uppercase tracking-wider">
          {t('sale.nasiya_summary')}
        </div>
        <div className="text-body-lg font-bold tabular-nums text-text mt-0.5 truncate">
          {fmtUzs(remainingUzs)} UZS
        </div>
      </div>
      {periods > 0 && perPaymentUzs > 0 && (
        <div className="text-right min-w-0">
          <div className="text-caption text-text-muted">
            {periods} ×
          </div>
          <div className="text-body-lg font-bold tabular-nums text-success mt-0.5 truncate">
            {fmtUzs(perPaymentUzs)} UZS
          </div>
        </div>
      )}
    </div>
  );
}

/** Документы покупателя — опционально при cash, скрыты под collapse. */
function BuyerDocsCollapse({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-label font-semibold text-text-dim hover:text-text transition-colors cursor-pointer"
      >
        <span>{t('sale.buyer_docs_optional')}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-4 flex flex-col gap-4 animate-fade-in">{children}</div>}
    </div>
  );
}

