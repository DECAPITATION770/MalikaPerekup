/**
 * StockDetail — device card with hero, specs, notes, buy/sell timeline,
 * and a QR sticker. Phase 3 port: shadcn Badge/Skeleton/Dialog, a real
 * QR-print preview dialog (fetches qr.png blob), Tg MainButton «Печать
 * QR-стикера», copy-token fallback.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BadgeDollarSign,
  Check,
  Copy,
  Headphones,
  Laptop,
  Package as PackageIcon,
  Printer,
  RotateCcw,
  ShoppingCart,
  Smartphone,
  Tablet,
  Watch,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QrStickerIcon } from '@/components/icons';
import {
  getDevice,
  getDeviceQrPng,
  type DeviceCategory,
  type DeviceOut,
} from '@/api/devices';
import { getPurchaseByDevice, type PurchaseOut } from '@/api/purchases';
import { getSalesByDevice, returnSale, type SaleOut } from '@/api/sales';
import { fmtDate, fmtUzs } from '@/lib/fmt';
import { formatSpecValue } from '@/lib/specsFmt';
import { useTgMainButton, useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

const CATEGORY_ICON: Record<DeviceCategory, React.ElementType> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  accessory: Headphones,
  other: PackageIcon,
};

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

const CONDITION_VARIANT: Record<
  DeviceOut['condition'],
  'success' | 'accent' | 'warning' | 'danger'
> = {
  new: 'success',
  good: 'accent',
  normal: 'warning',
  broken: 'danger',
};

export default function StockDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const query = useQuery({
    queryKey: ['device', Number(id)],
    queryFn: () => getDevice(Number(id!)),
    enabled: Boolean(id),
  });

  // Tg MainButton → open QR sticker print dialog.
  useTgMainButton(
    query.data
      ? {
          text: t('stock.detail_qr_print'),
          onClick: () => {
            haptic.tap('medium');
            setQrOpen(true);
          },
        }
      : null,
  );

  const copyQr = () => {
    navigator.clipboard.writeText(query.data?.qr_token ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const BackLink = (
    <Link
      to="/stock"
      className="flex items-center gap-1.5 text-text-dim hover:text-text transition-colors text-label font-semibold w-fit"
    >
      <ArrowLeft size={16} /> {t('stock.back')}
    </Link>
  );

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError) {
    return (
      <div className="flex flex-col gap-6 animate-fade-up">
        {BackLink}
        <EmptyState
          title={t('common.error_load')}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const d = query.data;
  if (!d) return null;

  const Icon = CATEGORY_ICON[d.category];
  const photo = d.photos[0];
  const specs = Object.entries(d.specs ?? {}).filter(([, v]) => v !== null && v !== '');

  return (
    <div className="flex flex-col gap-5 animate-fade-up max-w-2xl">
      {BackLink}

      {/* Hero */}
      <div className="card p-5 flex flex-col sm:flex-row gap-5">
        <div className="w-full sm:w-32 h-44 sm:h-32 shrink-0 rounded-xl bg-bg3 ring-1 ring-border flex items-center justify-center text-text-muted overflow-hidden">
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon size={40} strokeWidth={1.4} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-title font-bold tracking-tight leading-tight">
            {d.brand} {d.model}
          </h1>
          <div className="text-caption text-text-muted font-mono mt-1">
            {d.imei
              ? `${t('stock.imei')} ${d.imei}`
              : d.serial
                ? `${t('stock.serial')} ${d.serial}`
                : t('stock.no_imei')}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <Badge variant={STATUS_VARIANT[d.status]} size="sm">
              {t(`status.${d.status}`)}
            </Badge>
            <Badge variant={CONDITION_VARIANT[d.condition]} size="sm">
              {t(`condition.${d.condition}`)}
            </Badge>
            <Badge variant="neutral" size="sm">
              {t(`category.${d.category}`)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 mt-4 text-caption text-text-muted">
            <span>
              {t('stock.detail_created')}: {fmtDate(d.created_at)}
            </span>
            {d.updated_at !== d.created_at && (
              <span>
                {t('stock.detail_updated')}: {fmtDate(d.updated_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Specs */}
      {specs.length > 0 && (
        <div className="card p-5 flex flex-col gap-3">
          <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_specs')}</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {specs.map(([key, val]) => (
              <div key={key}>
                <dt className="text-caption text-text-muted">
                  {t(`specs.${key}`, { defaultValue: key.replace(/_/g, ' ') })}
                </dt>
                <dd className="text-label font-semibold text-text mt-0.5 break-words">
                  {formatSpecValue(key, val)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Notes */}
      {d.notes && (
        <div className="card p-5 flex flex-col gap-2">
          <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_notes')}</h2>
          <p className="text-body text-text-dim leading-relaxed">{d.notes}</p>
        </div>
      )}

      <DeviceTimeline deviceId={d.id} />

      <ReturnSaleAction deviceId={d.id} deviceStatus={d.status} />

      {/* QR token + print */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-accent-faded flex items-center justify-center shrink-0 text-accent">
            <QrStickerIcon size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-label font-bold">{t('stock.detail_qr')}</div>
            <div className="text-caption text-text-muted font-mono truncate">{d.qr_token}</div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={copyQr}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border bg-bg3 text-label font-semibold hover:border-border-strong transition-all cursor-pointer"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? t('stock.detail_qr_copied') : t('stock.detail_qr_copy')}
          </button>
          <Button size="sm" onClick={() => setQrOpen(true)}>
            <Printer className="size-4" />
            {t('stock.detail_qr_print')}
          </Button>
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <QrStickerDialog deviceId={d.id} label={`${d.brand} ${d.model}`} />
          </Dialog>
        </div>
      </div>
    </div>
  );
}

// ── QR sticker print dialog ───────────────────────────────────────────

function QrStickerDialog({ deviceId, label }: { deviceId: number; label: string }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const qrQ = useQuery({
    queryKey: ['device-qr-png', deviceId],
    queryFn: () => getDeviceQrPng(deviceId),
  });

  useEffect(() => {
    if (!qrQ.data) return;
    const objectUrl = URL.createObjectURL(qrQ.data);
    setUrl(objectUrl);
    setLoading(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [qrQ.data]);

  const print = () => {
    if (!url) return;
    const w = window.open('', '_blank', 'width=400,height=500');
    if (!w) return;
    w.document.write(
      `<html><head><title>${label}</title></head>` +
        `<body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui">` +
        `<img src="${url}" style="width:240px;height:240px;image-rendering:pixelated"/>` +
        `<div style="margin-top:12px;font-weight:700">${label}</div>` +
        `</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <DialogContent className="max-w-xs">
      <DialogHeader>
        <DialogTitle>{t('stock.detail_qr_print')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="size-48 rounded-xl bg-white p-3 flex items-center justify-center">
          {loading ? (
            <Skeleton className="size-full" />
          ) : url ? (
            <img src={url} alt="QR" className="size-full object-contain [image-rendering:pixelated]" />
          ) : (
            <span className="text-danger text-sm">{t('common.error_load')}</span>
          )}
        </div>
        <div className="text-label font-bold text-center">{label}</div>
        <Button full onClick={print} disabled={!url}>
          <Printer className="size-4" />
          {t('stock.detail_qr_print')}
        </Button>
      </div>
    </DialogContent>
  );
}

// ── Return action ─────────────────────────────────────────────────────

function ReturnSaleAction({
  deviceId,
  deviceStatus,
}: {
  deviceId: number;
  deviceStatus: DeviceOut['status'];
}) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const salesQ = useQuery({
    queryKey: ['sales-by-device', deviceId],
    queryFn: () => getSalesByDevice(deviceId),
  });
  const activeSale = (salesQ.data ?? []).find((s) => s.status === 'active');

  const m = useMutation({
    mutationFn: () => returnSale(activeSale!.id, reason),
    onSuccess: () => {
      haptic.notify('success');
      toast.success(t('stock.return_ok'));
      qc.invalidateQueries({ queryKey: ['device', deviceId] });
      qc.invalidateQueries({ queryKey: ['sales-by-device', deviceId] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      setOpen(false);
      setReason('');
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('stock.return_failed'));
    },
  });

  // Only offer a return when the device is currently sold with an active sale.
  if (deviceStatus !== 'sold' || !activeSale) return null;

  return (
    <>
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        <RotateCcw className="size-4" />
        {t('stock.return_action')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('stock.return_title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-dim leading-relaxed">{t('stock.return_body')}</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-label text-text-dim font-medium">
            {t('stock.return_reason_label')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('stock.return_reason_ph')}
            rows={2}
            className="bg-bg2 rounded-xl border border-border px-3.5 py-2.5 text-body text-text outline-none focus:border-accent transition-colors resize-none placeholder:text-text-muted"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" full onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" full loading={m.isPending} onClick={() => m.mutate()}>
            <RotateCcw className="size-4" />
            {t('stock.return_confirm')}
          </Button>
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────

type TimelineEvent =
  | { kind: 'purchase'; date: string; amount: string; party: string; ref: PurchaseOut }
  | { kind: 'sale'; date: string; amount: string; party: string; ref: SaleOut }
  | { kind: 'return'; date: string; amount: string; party: string; ref: SaleOut };

function DeviceTimeline({ deviceId }: { deviceId: number }) {
  const { t } = useTranslation();
  const purchaseQ = useQuery({
    queryKey: ['purchase-by-device', deviceId],
    queryFn: () => getPurchaseByDevice(deviceId),
    retry: false,
  });
  const salesQ = useQuery({
    queryKey: ['sales-by-device', deviceId],
    queryFn: () => getSalesByDevice(deviceId),
  });

  const events: TimelineEvent[] = [];
  if (purchaseQ.data) {
    events.push({
      kind: 'purchase',
      date: purchaseQ.data.purchase_date,
      amount: purchaseQ.data.price_uzs,
      party: purchaseQ.data.seller_name,
      ref: purchaseQ.data,
    });
  }
  for (const s of salesQ.data ?? []) {
    events.push({
      kind: 'sale',
      date: s.sale_date,
      amount: s.sale_price_uzs,
      party: s.buyer_name,
      ref: s,
    });
    if (s.status === 'returned' && s.returned_at) {
      events.push({
        kind: 'return',
        date: s.returned_at.slice(0, 10),
        amount: s.sale_price_uzs,
        party: s.buyer_name,
        ref: s,
      });
    }
  }
  const KIND_ORDER = { purchase: 0, sale: 1, return: 2 };
  events.sort((a, b) =>
    a.date === b.date ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind] : a.date.localeCompare(b.date),
  );

  if (purchaseQ.isLoading || salesQ.isLoading) {
    return (
      <div className="card p-5 flex flex-col gap-3">
        <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_history')}</h2>
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (events.length === 0) return null;

  return (
    <div className="card p-5 flex flex-col gap-3">
      <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_history')}</h2>
      <ol className="flex flex-col gap-3">
        {events.map((e, i) => (
          <TimelineRow key={i} e={e} />
        ))}
      </ol>
    </div>
  );
}

function TimelineRow({ e }: { e: TimelineEvent }) {
  const { t } = useTranslation();
  const cfg = {
    purchase: {
      Icon: ShoppingCart,
      tone: 'text-accent bg-accent-faded ring-accent/30',
      label: t('stock.event_purchase'),
    },
    sale: {
      Icon: BadgeDollarSign,
      tone: 'text-success bg-success-faded ring-success/30',
      label: t('stock.event_sale'),
    },
    return: {
      Icon: RotateCcw,
      tone: 'text-danger bg-danger-faded ring-danger/30',
      label: t('stock.event_return'),
    },
  }[e.kind];
  const { Icon } = cfg;
  return (
    <li className="flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center ring-1 shrink-0', cfg.tone)}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-label font-semibold tracking-tight truncate">
          {cfg.label} · <span className="text-text-dim font-normal">{e.party}</span>
        </div>
        <div className="text-caption text-text-muted">{fmtDate(e.date)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-label font-bold tabular-nums">{fmtUzs(e.amount)}</div>
        <div className="text-micro text-text-muted">UZS</div>
      </div>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-fade-up max-w-2xl">
      <Skeleton className="h-4 w-20" />
      <div className="card p-5 flex gap-5">
        <Skeleton className="size-32 rounded-xl" />
        <div className="flex-1 flex flex-col gap-3 pt-1">
          <Skeleton className="h-5 w-[65%]" />
          <Skeleton className="h-3 w-2/5" />
          <div className="flex gap-2 mt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
