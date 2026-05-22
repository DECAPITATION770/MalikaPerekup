/**
 * SaleNew — sell a device: pick stock device → buyer → deal (cash/nasiya)
 * → optional nasiya schedule with live preview.
 *
 * Phase 3 port: legacy toast → sonner, useTgBack → useTgBackButton, Tg
 * MainButton with dynamic «Продать / Оформить рассрочку» label + haptic.
 * Reuses the ported purchase primitives (SegmentedRow, SellerSearch),
 * CurrencyDualInput and DocumentUploader.
 */
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  Headphones,
  Info,
  Laptop,
  Package as PackageIcon,
  Search,
  Smartphone,
  Tablet,
  Watch,
  X,
  type LucideIcon,
} from 'lucide-react';

import Button from '@/components/ui/button-default';
import LabeledInput from '@/components/ui/labeled-input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CurrencyDualInput from '@/components/CurrencyDualInput';
import DocumentUploader from '@/components/DocumentUploader';
import BrandBadge from '@/components/BrandBadge';
import { createSale, createInstallmentPlan, requestSaleUploadUrl } from '@/api/sales';
import {
  listDevices,
  getDevicePhotoUrls,
  type DeviceOut,
  type DeviceWithPurchaseOut,
  type DeviceCategory,
} from '@/api/devices';
import { formatSpecValue } from '@/lib/specsFmt';
import { getExchangeRateHint } from '@/api/reports';
import type { CounterpartyOut } from '@/api/counterparties';
import { useDebounced } from '@/lib/useDebounced';
import { fmtMoneyInput, parseMoneyInput, moneyToNumber } from '@/lib/money';
import { fmtUzs } from '@/lib/fmt';
import { useTgBackButton, useTgMainButton, useTgHaptic } from '@/lib/telegram';
import { track } from '@/lib/analytics';
import { SegmentedRow } from './purchase/primitives';
import { SellerSearch as CounterpartySearch } from './purchase/SellerSearch';
import { cn } from '@/lib/utils';

const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  accessory: Headphones,
  other: PackageIcon,
};

const CONDITION_VARIANT: Record<
  DeviceOut['condition'],
  'success' | 'accent' | 'warning' | 'danger'
> = { new: 'success', good: 'accent', normal: 'warning', broken: 'danger' };

const STATUS_VARIANT: Record<
  DeviceOut['status'],
  'success' | 'warning' | 'muted' | 'danger' | 'neutral'
> = {
  in_stock: 'success',
  reserved: 'warning',
  sold: 'muted',
  returned: 'danger',
  written_off: 'neutral',
};

const DOC_TYPES = ['passport', 'id_card', 'driver_license', 'other'] as const;
type Currency = 'UZS' | 'USD';
type SaleType = 'cash' | 'nasiya';
type PeriodType = 'daily' | 'weekly' | 'monthly';

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

const schema = z
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

type FormValues = z.infer<typeof schema>;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-body-lg font-bold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-hint text-text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function DeviceRow({
  device,
  selected,
  onSelect,
}: {
  device: DeviceWithPurchaseOut;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICON[device.category] ?? PackageIcon;
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-xl border p-3 text-left transition-all',
          selected ? 'border-accent bg-accent-faded' : 'border-border bg-bg2 active:bg-bg3',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg3">
          <Icon size={16} className="text-text-dim" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <BrandBadge brand={device.brand} size="sm" />
            <span className="truncate text-body font-bold">{device.model}</span>
          </div>
          <div className="mt-0.5 text-caption text-text-muted">
            {device.imei ?? device.serial ?? '—'}
          </div>
        </div>
        {selected && <Check size={16} className="shrink-0 text-accent" />}
      </button>
      <button
        type="button"
        onClick={() => setInfoOpen(true)}
        aria-label={t('sale.device_info')}
        className="flex w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-bg2 text-text-dim transition-colors hover:text-text active:bg-bg3"
      >
        <Info size={18} />
      </button>
      <DeviceDetailDialog device={device} open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  );
}

/** «Жать → мини-окно с подробным инфо об устройстве»: full specs, condition,
 *  defects, photos and the purchase price, shown without leaving the sale. */
function DeviceDetailDialog({
  device,
  open,
  onOpenChange,
}: {
  device: DeviceWithPurchaseOut;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const photosQ = useQuery({
    queryKey: ['device-photos', device.id],
    queryFn: () => getDevicePhotoUrls(device.id),
    enabled: open && device.photos.length > 0,
  });
  const urls = photosQ.data ?? [];
  const specs = Object.entries(device.specs ?? {}).filter(([, v]) => v !== null && v !== '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('sale.detail_title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <BrandBadge brand={device.brand} size="md" />
            <div className="mt-1 text-body-lg font-bold tracking-tight">{device.model}</div>
            <div className="mt-0.5 font-mono text-caption text-text-muted">
              {device.imei
                ? `${t('stock.imei')} ${device.imei}`
                : device.serial
                  ? `${t('stock.serial')} ${device.serial}`
                  : t('stock.no_imei')}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="neutral" size="sm">
              {t(`category.${device.category}`)}
            </Badge>
            <Badge variant={CONDITION_VARIANT[device.condition]} size="sm">
              {t(`condition.${device.condition}`)}
            </Badge>
            <Badge variant={STATUS_VARIANT[device.status]} size="sm">
              {t(`status.${device.status}`)}
            </Badge>
          </div>

          {device.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photosQ.isLoading ? (
                Array.from({ length: device.photos.length }).map((_, i) => (
                  <div key={i} className="h-16 w-16 animate-pulse rounded-lg bg-bg3" />
                ))
              ) : urls.length > 0 ? (
                urls.map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                ))
              ) : (
                <span className="text-caption text-text-muted">{t('sale.detail_no_photos')}</span>
              )}
            </div>
          )}

          {specs.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {specs.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-caption text-text-muted">
                    {t(`specs.${k}`, { defaultValue: k.replace(/_/g, ' ') })}
                  </dt>
                  <dd className="mt-0.5 break-words text-label font-semibold text-text">
                    {formatSpecValue(k, v)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {device.defects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {device.defects.map((d) => (
                <Badge key={d} variant="warning" size="sm">
                  {t(`purchase.defects.${d}`, { defaultValue: d })}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-bg3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-caption text-text-muted">{t('sale.detail_purchase_price')}</div>
              <div className="mt-0.5 truncate text-body-lg font-bold tabular-nums text-text">
                {device.purchase_price_uzs ? `${fmtUzs(device.purchase_price_uzs)} UZS` : '—'}
              </div>
            </div>
            {device.days_in_stock != null && (
              <div className="shrink-0 text-right">
                <div className="text-caption text-text-muted">{t('sale.detail_in_stock')}</div>
                <div className="mt-0.5 text-body-lg font-bold tabular-nums text-text">
                  {t('stock.days_n', { n: device.days_in_stock, count: device.days_in_stock })}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SaleNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useTgHaptic();

  useTgBackButton(() => navigate(-1));

  const [deviceSearch, setDeviceSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceWithPurchaseOut | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [buyerPhotos, setBuyerPhotos] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [shaking, setShaking] = useState(false);

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
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      device_id: undefined as unknown as number,
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
        exchange_rate:
          values.currency === 'USD' ? parseMoneyInput(values.exchange_rate ?? '') : null,
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
    onSuccess: () => {
      haptic.notify('success');
      track('sale_created', { type: saleType });
      setDone(true);
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('sale.errors.submit_failed'));
    },
  });

  // Tactile "no" on a failed submit — error haptic + a brief shake.
  const onInvalid = () => {
    haptic.notify('error');
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  };
  const submit = handleSubmit((v) => mutation.mutate(v), onInvalid);

  // Tg MainButton mirrors the sticky submit button.
  useTgMainButton(
    !done
      ? {
          text: saleType === 'nasiya' ? t('sale.submit_nasiya') : t('sale.submit'),
          isLoaderVisible: mutation.isPending,
          onClick: () => submit(),
        }
      : null,
  );

  const onSelectDevice = (device: DeviceWithPurchaseOut) => {
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
      <div className="flex min-h-[60vh] animate-fade-up flex-col items-center justify-center gap-5 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-faded">
          <Check size={28} className="text-success" />
        </div>
        <div className="text-center">
          <h2 className="text-title-sm font-bold">{t('sale.success_title')}</h2>
          <p className="mt-1 text-body text-text-dim">{t('sale.success_body')}</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button
            size="md"
            onClick={() => {
              setDone(false);
              window.location.reload();
            }}
          >
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        'flex animate-fade-up flex-col gap-4 pb-28 md:pb-6',
        shaking && 'animate-shake',
      )}
    >
      <h1 className="text-title font-bold tracking-tight">{t('sale.title')}</h1>

      {/* Device picker */}
      <Section title={t('sale.section_device')} hint={t('sale.section_device_hint')}>
        {selectedDevice ? (
          <div className="flex flex-col gap-2">
            <DeviceRow device={selectedDevice} selected onSelect={() => {}} />
            <button
              type="button"
              onClick={onClearDevice}
              className="px-1 text-left text-hint font-medium text-accent"
            >
              {t('sale.device_clear')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex h-12 items-center gap-2 rounded-xl border border-border bg-bg2 px-3.5 transition-colors focus-within:border-accent">
              <Search size={16} className="shrink-0 text-text-muted" />
              <input
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                placeholder={t('sale.device_search')}
                className="flex-1 bg-transparent text-body outline-none placeholder:text-text-muted"
              />
            </div>
            {errors.device_id && (
              <span className="text-xs text-danger">{t('sale.errors.device_required')}</span>
            )}
            {devicesLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-bg2" />
                ))}
              </div>
            ) : (devicesData?.items.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-label text-text-muted">
                {t('sale.device_empty')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {devicesData!.items.map((d) => (
                  <DeviceRow
                    key={d.id}
                    device={d}
                    selected={false}
                    onSelect={() => onSelectDevice(d)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {/* Buyer */}
      <Section title={t('sale.section_buyer')} hint={t('sale.section_buyer_hint')}>
        <CounterpartySearch
          disabled={selectedBuyerId !== null}
          onPick={onPickBuyer}
          type="buyer"
          placeholderKey="sale.buyer_search"
        />
        {selectedBuyerId !== null && (
          <div className="flex animate-fade-in items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-faded px-4 py-3">
            <div className="flex items-center gap-2 text-label font-semibold text-success">
              <Check size={16} />
              {t('purchase.seller_existing')}
            </div>
            <button
              type="button"
              onClick={onClearBuyer}
              className="flex cursor-pointer items-center gap-1 text-xs text-text-dim hover:text-text"
            >
              <X size={12} /> {t('common.cancel')}
            </button>
          </div>
        )}

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

        <BuyerDocsCollapse>
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
            onChange={setBuyerPhotos}
            requestUploadUrl={requestSaleUploadUrl}
          />
        </BuyerDocsCollapse>
      </Section>

      {/* Deal */}
      <Section title={t('sale.section_deal')} hint={t('sale.section_deal_hint')}>
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
      </Section>

      {/* Nasiya */}
      {saleType === 'nasiya' && (
        <Section title={t('sale.nasiya_section')}>
          <Controller
            name="down_payment"
            control={control}
            render={({ field }) => (
              <LabeledInput
                label={t('sale.down_payment_label')}
                inputMode="numeric"
                placeholder={t('sale.down_payment_placeholder')}
                suffix={
                  <span className="text-hint font-medium text-text-muted">{watch('currency')}</span>
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

      {/* Sticky submit (fallback when not in Telegram MainButton context) */}
      <div className="fixed inset-x-0 bottom-16 z-30 bg-gradient-to-t from-bg via-bg/95 to-transparent p-4 md:static md:bottom-auto md:bg-none md:p-0">
        <Button
          type="submit"
          size="lg"
          loading={mutation.isPending}
          disabled={mutation.isPending}
          className="w-full"
        >
          {saleType === 'nasiya' ? t('sale.submit_nasiya') : t('sale.submit')}
        </Button>
      </div>
    </form>
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
        <div className="text-caption uppercase tracking-wider text-text-muted">
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

function BuyerDocsCollapse({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between text-label font-semibold text-text-dim transition-colors hover:text-text"
      >
        <span>{t('sale.buyer_docs_optional')}</span>
        <ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-4 flex animate-fade-in flex-col gap-4">{children}</div>}
    </div>
  );
}
