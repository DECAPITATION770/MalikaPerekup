/**
 * StepSaleDevice — step 1 of the sale wizard: pick the in-stock device you're
 * selling. Search + list of in-stock devices, each row tap-to-select with an
 * «info» button opening full specs/photos/purchase price without leaving the
 * step. Mirrors the purchase wizard's device step.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, Info, Search, ShoppingCart } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BrandBadge from '@/components/BrandBadge';
import DeviceTile from '@/components/DeviceTile';
import {
  listDevices,
  getDevicePhotoUrls,
  type DeviceWithPurchaseOut,
  type DeviceOut,
} from '@/api/devices';
import { getPurchaseByDevice } from '@/api/purchases';
import { formatSpecValue, specsSummary } from '@/lib/specsFmt';
import { fmtUzs } from '@/lib/fmt';
import { useDebounced } from '@/lib/useDebounced';
import { cn } from '@/lib/utils';

import { StepShell } from '../../purchase/Wizard';

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
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-label text-text-muted">{t('sale.device_empty')}</p>
              <Link
                to="/purchase/new"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-label font-bold text-[rgb(var(--c-on-accent))] transition-colors hover:bg-accent-hover"
              >
                <ShoppingCart size={16} />
                {t('nav.buy')}
              </Link>
            </div>
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
  const [infoOpen, setInfoOpen] = useState(false);
  // Meta row shown under the model: «6/64 · Чёрный · 3 дн.» so the perekup
  // can pick «that older one» / «that more-expensive one» without opening
  // each card. Purchase price sits on its own line, right-aligned.
  const specs = specsSummary(device.category, device.specs);
  const days = device.days_in_stock;
  const cost = device.purchase_price_uzs;
  return (
    // Same card surface + density as every other list. The whole row selects;
    // the (i) is a compact secondary action. Card is a <div> so the inner
    // select + info buttons aren't nested (invalid button-in-button).
    <div
      className={cn(
        'card flex items-center gap-2 px-4 py-3 transition-all',
        selected ? 'border-accent ring-1 ring-accent' : 'hover:border-border-strong',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <DeviceTile
          brand={device.brand}
          model={device.model}
          category={device.category}
          photoUrl={device.photo_url}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <BrandBadge brand={device.brand} size="sm" />
            <span className="truncate text-body font-bold">{device.model}</span>
          </div>
          {/* Fixed 3-line card so every row is the same height: specs +
              condition on the left (specs truncates), days pinned to the right
              edge — never wraps to its own line — and price below. Earlier the
              meta wrapped, so «days» dropped to a new line on some cards and
              made the heights uneven. */}
          <div className="mt-1 flex items-center justify-between gap-2 text-caption">
            <div className="flex min-w-0 items-center gap-2">
              {specs && <span className="truncate text-text-muted">{specs}</span>}
              <Badge dot variant={CONDITION_VARIANT[device.condition]} size="sm" className="shrink-0">
                {t(`condition.${device.condition}`)}
              </Badge>
            </div>
            {days != null && (
              <span className="shrink-0 tabular-nums text-text-muted">
                {t('sale.device_days', { count: days })}
              </span>
            )}
          </div>
          {cost && (
            <div className="mt-1 text-caption font-bold tabular-nums text-text">
              {fmtUzs(cost)} UZS
            </div>
          )}
        </div>
        {selected && <Check size={18} className="shrink-0 text-accent" />}
      </button>
      <button
        type="button"
        onClick={() => setInfoOpen(true)}
        aria-label={t('sale.device_info')}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg3 hover:text-text"
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
  // From whom this unit was bought — provenance context while choosing what to
  // sell. Fetched lazily when the dialog opens (shared cache with StockDetail).
  const purchaseQ = useQuery({
    queryKey: ['purchase-by-device', device.id],
    queryFn: () => getPurchaseByDevice(device.id),
    enabled: open,
  });
  const purchase = purchaseQ.data;

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
            <Badge dot variant={CONDITION_VARIANT[device.condition]} size="sm">
              {t(`condition.${device.condition}`)}
            </Badge>
            <Badge dot variant={STATUS_VARIANT[device.status]} size="sm">
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

          {/* From whom it was bought — weak accent, links to the supplier. */}
          {purchase?.seller_name && (
            <div className="flex items-center gap-1 text-caption text-text-muted">
              <span>{t('sale.bought_from')}</span>
              {purchase.counterparty_id ? (
                <Link
                  to={`/counterparties/${purchase.counterparty_id}`}
                  className="truncate font-medium text-text-dim underline-offset-2 transition-colors hover:text-accent hover:underline"
                >
                  {purchase.seller_name}
                </Link>
              ) : (
                <span className="truncate font-medium text-text-dim">{purchase.seller_name}</span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
