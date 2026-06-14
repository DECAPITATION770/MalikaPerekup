/**
 * StockDetail — device card with hero, specs, notes, buy/sell timeline,
 * and a QR sticker. Phase 3 port: shadcn Badge/Skeleton/Dialog, a real
 * QR-print preview dialog (fetches qr.png blob), Tg MainButton «Печать
 * QR-стикера», copy-token fallback.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  Upload,
  Watch,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrStickerIcon } from '@/components/icons';
import AttachmentUploader from '@/components/AttachmentUploader';
import { AttachmentTimeline } from '@/components/AttachmentTimeline';
import { listDeviceTimeline, type AttachmentOut } from '@/api/attachments';
import {
  getDevice,
  getDeviceQrPng,
  getDevicePhotoUrls,
  type DeviceCategory,
  type DeviceOut,
} from '@/api/devices';
import { getPurchaseByDevice, type PurchaseOut } from '@/api/purchases';
import { getSalesByDevice, returnSale, type SaleOut } from '@/api/sales';
import { fmtDate, fmtUzs } from '@/lib/fmt';
import { formatSpecValue } from '@/lib/specsFmt';
import BrandBadge from '@/components/BrandBadge';
import DevicePhoto from '@/components/DevicePhoto';
import { brandTextColor, brandTint } from '@/lib/brand';
import { useTheme } from '@/lib/theme';
import { useTgBackButton, useTgMainButton, useTgHaptic } from '@/lib/telegram';
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

function daysInStock(createdIso: string): number {
  const ms = Date.now() - new Date(createdIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border/60 bg-bg3 p-3.5">
      <div className="text-caption text-text-muted">{label}</div>
      <div className={cn('text-body-lg font-bold tabular-nums', accent && 'text-accent')}>
        {value}
      </div>
    </div>
  );
}

function BatteryTile({ label, pct }: { label: string; pct: number }) {
  const tone = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border/60 bg-bg3 p-3.5">
      <div className="text-caption text-text-muted">{label}</div>
      <div className="text-body-lg font-bold tabular-nums">{pct}%</div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-bg">
        <div
          className={cn('h-full rounded-full', tone)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function StockDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { resolved } = useTheme();
  const haptic = useTgHaptic();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const query = useQuery({
    queryKey: ['device', Number(id)],
    queryFn: () => getDevice(Number(id!)),
    enabled: Boolean(id),
  });

  // Photos are private — fetch short-lived signed URLs once the device (and
  // therefore its photo count) is known.
  const photosQuery = useQuery({
    queryKey: ['device-photos', Number(id)],
    queryFn: () => getDevicePhotoUrls(Number(id!)),
    enabled: Boolean(query.data?.photos?.length),
  });
  const photoUrls = photosQuery.data ?? [];

  // Unified attachments timeline — pulls everything linked to this device
  // (its own photos + purchase seller docs + sale buyer docs + post-sale
  // receipts/warranty) in one request. The local mirror lets us patch the
  // list optimistically on upload/delete without a refetch round-trip.
  const attachmentsQuery = useQuery({
    queryKey: ['attachments', 'device', Number(id)],
    queryFn: () => listDeviceTimeline(Number(id!)),
    enabled: Boolean(id),
  });
  const [attachments, setAttachments] = useState<AttachmentOut[]>([]);
  useEffect(() => {
    if (attachmentsQuery.data) setAttachments(attachmentsQuery.data);
  }, [attachmentsQuery.data]);

  // Purchase price for the hero facts. Same queryKey as DeviceTimeline → the
  // two share one network request via React Query's cache.
  const purchaseQuery = useQuery({
    queryKey: ['purchase-by-device', Number(id)],
    queryFn: () => getPurchaseByDevice(Number(id!)),
    enabled: Boolean(id),
    retry: false,
  });

  // Native Telegram BackButton → return to the previous screen (the showcase
  // / installments / wherever we came from). Without this the Mini App shows
  // only the ✕ "close" chrome and the user can't get back from a device card.
  useTgBackButton(useCallback(() => navigate(-1), [navigate]));

  // Tg MainButton → sell this device (the frequent action); QR print is the
  // primary only for devices that aren't in stock anymore.
  useTgMainButton(
    query.data
      ? query.data.status === 'in_stock'
        ? {
            text: t('stock.sell_this'),
            onClick: () => {
              haptic.select();
              navigate('/sale/new', { state: { deviceId: query.data!.id } });
            },
          }
        : {
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
      className="flex w-fit items-center gap-1.5 text-label font-semibold text-text-dim transition-colors hover:text-text"
    >
      <ArrowLeft size={16} /> {t('stock.back')}
    </Link>
  );

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError) {
    return (
      <div className="flex animate-fade-up flex-col gap-6">
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
  // Treat optional JSON arrays as never-null so older rows (or a partial
  // backend payload) can't crash the page on `.length` / `.map`.
  const photos = d?.photos ?? [];
  const defects = d?.defects ?? [];
  if (!d) return null;

  const Icon = CATEGORY_ICON[d.category];
  const heroUrl = photoUrls[0];
  const allSpecs = Object.entries(d.specs ?? {}).filter(([, v]) => v !== null && v !== '');
  // Battery shows in the facts strip, so keep it out of the generic spec chips.
  const specs = allSpecs.filter(([k]) => k !== 'battery_health_pct');
  const batteryPct = Number(d.specs?.battery_health_pct);
  const hasBattery = Number.isFinite(batteryPct) && batteryPct > 0;
  const days = daysInStock(d.created_at);
  const priceUzs = purchaseQuery.data?.price_uzs ?? null;

  return (
    <div className="flex w-full animate-fade-up flex-col gap-5">
      {BackLink}

      {/* Hero */}
      <div className="card flex flex-col gap-5 p-5 sm:flex-row">
        {/* Brand-tinted bg sits behind both states; the photo fully covers it
            when it loads and shows through as the icon backdrop on failure
            (MinIO presigned URLs do go 404 — guard against the broken-image
            glyph filling half the viewport). */}
        <div
          className="flex h-48 w-full shrink-0 items-center justify-center overflow-hidden rounded-card ring-1 ring-border sm:h-36 sm:w-36"
          style={{
            backgroundColor: brandTint(d.brand, 0.14),
            color: brandTextColor(d.brand, resolved),
          }}
        >
          {photos.length > 0 && photosQuery.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <DevicePhoto
              src={heroUrl}
              alt={`${d.brand} ${d.model}`}
              loading="eager"
              fallback={<Icon size={44} strokeWidth={1.4} />}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <BrandBadge brand={d.brand} size="md" />
            <h1 className="mt-1.5 text-title font-bold leading-tight tracking-tight">{d.model}</h1>
            <div className="mt-1 font-mono text-caption text-text-muted">
              {d.imei
                ? `${t('stock.imei')} ${d.imei}`
                : d.serial
                  ? `${t('stock.serial')} ${d.serial}`
                  : t('stock.no_imei')}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge dot variant={STATUS_VARIANT[d.status]} size="sm">
              {t(`status.${d.status}`)}
            </Badge>
            <Badge dot variant={CONDITION_VARIANT[d.condition]} size="sm">
              {t(`condition.${d.condition}`)}
            </Badge>
            {/* Category is descriptive metadata, not a state — quieter
                «muted» variant so the row reads status > condition > kind. */}
            <Badge variant="muted" size="sm">
              {t(`category.${d.category}`)}
            </Badge>
          </div>
          <div className="text-caption text-text-muted">
            {t('stock.detail_created')}: {fmtDate(d.created_at)}
          </div>
        </div>
      </div>

      {/* Primary action — sell this device (web / non-TG fallback) */}
      {d.status === 'in_stock' && (
        <Link
          to="/sale/new"
          state={{ deviceId: d.id }}
          onClick={() => haptic.select()}
          className="md:self-start"
        >
          <Button size="lg" className="w-full md:w-auto">
            <BadgeDollarSign className="size-4" />
            {t('stock.sell_this')}
          </Button>
        </Link>
      )}

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label={t('sale.detail_purchase_price')}
          accent
          value={
            priceUzs ? (
              <>
                {fmtUzs(priceUzs)}{' '}
                <span className="text-caption font-normal text-text-muted">UZS</span>
              </>
            ) : (
              '—'
            )
          }
        />
        <StatTile label={t('stock.detail_days_in_stock')} value={t('stock.days_n', { n: days })} />
        {hasBattery && <BatteryTile label={t('specs.battery_health')} pct={batteryPct} />}
      </div>

      {/* Files & history — unified attachments view, split into two
          distinct cards so the user reads them as separate purposes:
          one is «add a new file» (action), the other is «browse the
          whole story» (read). Without the visual break they read as a
          single mashed panel, which the partner flagged as confusing
          («тут стиль странный, не получается загрузить»). */}
      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-body-lg font-bold tracking-tight">
            {t('stock.detail_files_title')}
          </h2>
          <p className="text-caption text-text-muted">
            {t('stock.detail_files_subtitle')}
          </p>
        </header>

        {/* Upload panel — its own card with a heading so the action
            surface is unmistakable. Accepts any file type (photos, PDF
            scans, .heic from iOS) — the «only photos» implication of the
            previous dashed-tile-only layout was a false constraint. */}
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-label font-semibold text-text-dim">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-faded text-accent"
            >
              <Upload size={13} strokeWidth={2.2} />
            </span>
            {t('stock.detail_files_upload_title')}
          </div>
          <AttachmentUploader
            ownerType="device"
            ownerId={d.id}
            items={attachments.filter((a) => a.owner_type === 'device')}
            onChange={(deviceFiles) => {
              // Patch only the device-owner slice; keep purchase/sale
              // rows untouched so the timeline still aggregates the full
              // device story.
              setAttachments((prev) => [
                ...prev.filter((a) => a.owner_type !== 'device'),
                ...deviceFiles,
              ]);
            }}
            kind="other"
            alwaysShowAdd
          />
          <p className="text-caption text-text-muted">
            {t('stock.detail_files_upload_hint')}
          </p>
        </div>

        {/* Read panel — chronological timeline of files across this
            device + its purchase + its sale. Distinct card so «история»
            reads as a history, not a continuation of the uploader. */}
        <AttachmentTimeline
          items={attachments}
          onChange={setAttachments}
        />
      </section>

      {/* Specs */}
      {specs.length > 0 && (
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_specs')}</h2>
          <div className="flex flex-wrap gap-2">
            {specs.map(([key, val]) => (
              <span
                key={key}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-bg3 px-3 text-label"
              >
                <span className="text-text-muted">
                  {t(`specs.${key}`, { defaultValue: key.replace(/_/g, ' ') })}
                </span>
                <span className="font-bold text-text">{formatSpecValue(key, val)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Defects */}
      {defects.length > 0 && (
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="text-body-lg font-bold tracking-tight">{t('purchase.defects_label')}</h2>
          <div className="flex flex-wrap gap-1.5">
            {defects.map((k) => (
              <Badge key={k} variant="warning" size="sm">
                {t(`purchase.defects.${k}`, { defaultValue: k })}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {d.notes && (
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_notes')}</h2>
          <p className="text-body leading-relaxed text-text-dim">{d.notes}</p>
        </div>
      )}

      <DeviceTimeline deviceId={d.id} />

      <ReturnSaleAction deviceId={d.id} deviceStatus={d.status} />

      {/* QR token + print — stacks on narrow phones (inside Telegram the
          webview is ~360-390px wide; a single row overflowed and the buttons
          overlapped the token label). */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-faded text-accent">
            <QrStickerIcon size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-label font-bold">{t('stock.detail_qr')}</div>
            <div className="truncate font-mono text-caption text-text-muted">{d.qr_token}</div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={copyQr}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-bg3 px-3.5 text-label font-semibold transition-all hover:border-border-strong"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? t('stock.detail_qr_copied') : t('stock.detail_qr_copy')}
          </button>
          {/* Secondary, not primary: «Продать аппарат» up the page already
              owns the amber CTA on this screen — print is a utility, not the
              main verb. Two amber CTAs side-by-side dilute the call to sell. */}
          <Button size="sm" variant="secondary" onClick={() => setQrOpen(true)}>
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
        <div className="flex size-48 items-center justify-center rounded-xl bg-white p-3">
          {loading ? (
            <Skeleton className="size-full" />
          ) : url ? (
            <img
              src={url}
              alt="QR"
              className="size-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <span className="text-body text-danger">{t('common.error_load')}</span>
          )}
        </div>
        <div className="text-center text-label font-bold">{label}</div>
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
          <p className="text-body leading-relaxed text-text-dim">{t('stock.return_body')}</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-label font-medium text-text-dim">
              {t('stock.return_reason_label')}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('stock.return_reason_ph')}
              rows={2}
              className="resize-none rounded-xl border border-border bg-bg2 px-3.5 py-2.5 text-body text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
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
      <div className="card flex flex-col gap-3 p-5">
        <h2 className="text-body-lg font-bold tracking-tight">{t('stock.detail_history')}</h2>
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (events.length === 0) return null;

  return (
    <div className="card flex flex-col gap-3 p-5">
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
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
          cfg.tone,
        )}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-label font-semibold tracking-tight">
          {cfg.label} ·{' '}
          {e.ref.counterparty_id ? (
            <Link
              to={`/counterparties/${e.ref.counterparty_id}`}
              className="font-normal text-accent hover:underline"
            >
              {e.party}
            </Link>
          ) : (
            <span className="font-normal text-text-dim">{e.party}</span>
          )}
        </div>
        <div className="text-caption text-text-muted">{fmtDate(e.date)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-label font-bold tabular-nums">{fmtUzs(e.amount)}</div>
        <div className="text-micro text-text-muted">UZS</div>
      </div>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex w-full animate-fade-up flex-col gap-5">
      <Skeleton className="h-4 w-20" />
      <div className="card flex gap-5 p-5">
        <Skeleton className="size-32 rounded-xl" />
        <div className="flex flex-1 flex-col gap-3 pt-1">
          <Skeleton className="h-5 w-[65%]" />
          <Skeleton className="h-3 w-2/5" />
          <div className="mt-1 flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
