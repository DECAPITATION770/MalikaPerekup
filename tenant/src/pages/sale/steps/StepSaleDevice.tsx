/**
 * StepSaleDevice — step 1 of the sale wizard: pick the in-stock device you're
 * selling. Search + list of in-stock devices, each row tap-to-select with an
 * «info» button opening full specs/photos/purchase price without leaving the
 * step. Mirrors the purchase wizard's device step.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  Headphones,
  Info,
  Laptop,
  Package as PackageIcon,
  Search,
  Smartphone,
  Tablet,
  Watch,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BrandBadge from '@/components/BrandBadge';
import {
  listDevices,
  getDevicePhotoUrls,
  type DeviceWithPurchaseOut,
  type DeviceCategory,
  type DeviceOut,
} from '@/api/devices';
import { formatSpecValue, specsSummary } from '@/lib/specsFmt';
import { fmtUzs } from '@/lib/fmt';
import { useDebounced } from '@/lib/useDebounced';
import { cn } from '@/lib/utils';

import { StepShell } from '../../purchase/Wizard';

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

interface Props {
  selectedDevice: DeviceWithPurchaseOut | null;
  onSelect: (d: DeviceWithPurchaseOut) => void;
  onClear: () => void;
  error?: string;
}

export default function StepSaleDevice({ selectedDevice, onSelect, onClear, error }: Props) {
  const { t } = useTranslation();
  const [deviceSearch, setDeviceSearch] = useState('');
  const debouncedSearch = useDebounced(deviceSearch.trim(), 300);

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices-stock', debouncedSearch],
    queryFn: () => listDevices({ status: 'in_stock', q: debouncedSearch || undefined, limit: 20 }),
    enabled: !selectedDevice,
  });

  return (
    <StepShell
      step={0}
      total={2}
      title={t('sale.step_device_title')}
      subtitle={t('sale.step_device_subtitle')}
    >
      {selectedDevice ? (
        <div className="flex flex-col gap-2">
          <DeviceRow device={selectedDevice} selected onSelect={() => {}} />
          <button
            type="button"
            onClick={onClear}
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
          {error && <span className="text-hint text-danger">{error}</span>}
          {devicesLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-bg2" />
              ))}
            </div>
          ) : (devicesData?.items.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-label text-text-muted">{t('sale.device_empty')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {!debouncedSearch && (
                <div className="px-1 text-caption font-semibold tracking-tight text-text-muted">
                  {t('sale.section_device_in_stock')}
                </div>
              )}
              {devicesData!.items.map((d) => (
                <DeviceRow key={d.id} device={d} selected={false} onSelect={() => onSelect(d)} />
              ))}
            </div>
          )}
        </>
      )}
    </StepShell>
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
  // Meta row shown under the model: «6/64 · Чёрный · 3 дн.» so the perekup
  // can pick «that older one» / «that more-expensive one» without opening
  // each card. Purchase price sits on its own line, right-aligned.
  const specs = specsSummary(device.category, device.specs);
  const days = device.days_in_stock;
  const cost = device.purchase_price_uzs;
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
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-caption text-text-muted">
            {specs && <span className="truncate">{specs}</span>}
            {specs && days !== null && days !== undefined && <span>·</span>}
            {days !== null && days !== undefined && (
              <span>{t('sale.device_days', { count: days })}</span>
            )}
          </div>
        </div>
        {cost && !selected && (
          <span className="shrink-0 self-center text-right text-label font-bold tabular-nums text-text">
            {fmtUzs(cost)} UZS
          </span>
        )}
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
  // Normalise optional JSON arrays once; covers null/undefined coming back
  // from older rows or partial payloads.
  const photos = device.photos ?? [];
  const defects = device.defects ?? [];
  const photosQ = useQuery({
    queryKey: ['device-photos', device.id],
    queryFn: () => getDevicePhotoUrls(device.id),
    enabled: open && photos.length > 0,
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

          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photosQ.isLoading ? (
                Array.from({ length: photos.length }).map((_, i) => (
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

          {defects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {defects.map((d) => (
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
