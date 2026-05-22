import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Check, Printer } from 'lucide-react';
import { CATEGORY_ICON } from './primitives';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button-default';
import type { PurchaseWithDeviceOut } from '@/api/purchases';
import { getDeviceQrPng } from '@/api/devices';
import { specsSummary } from '@/lib/specsFmt';

// ─── Draft restore modal ────────────────────────────────────────────────

export function DraftRestoreModal({
  open, onContinue, onDiscard,
}: { open: boolean; onContinue: () => void; onDiscard: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onDiscard}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button onClick={onDiscard} variant="secondary" full size="md">
            {t('purchase.draft_discard')}
          </Button>
          <Button onClick={onContinue} full size="md">
            {t('purchase.draft_continue')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-accent-faded text-accent flex items-center justify-center">
          <ShoppingCart size={22} />
        </div>
        <h2 className="text-base font-bold tracking-tight">{t('purchase.draft_restore_title')}</h2>
        <p className="text-sm text-text-dim leading-relaxed max-w-xs">
          {t('purchase.draft_restore_body')}
        </p>
      </div>
    </Modal>
  );
}

// ─── Success modal ──────────────────────────────────────────────────────

export function SuccessModal({
  result, onClose, onAnother,
}: { result: PurchaseWithDeviceOut | null; onClose: () => void; onAnother: () => void }) {
  const { t } = useTranslation();
  const [printing, setPrinting] = useState(false);

  const printSticker = async () => {
    if (!result || printing) return;
    setPrinting(true);
    try {
      const blob = await getDeviceQrPng(result.device.id);
      const url = URL.createObjectURL(blob);
      const w = window.open('', '_blank', 'width=420,height=560');
      if (!w) { URL.revokeObjectURL(url); return; }
      const d = result.device;
      w.document.write(
        `<!doctype html><html><head><meta charset="utf-8"><title>${d.brand} ${d.model}</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif}
          .s{text-align:center;padding:16px;width:240px}
          .s img{width:200px;height:200px;display:block;margin:0 auto 10px}
          .n{font-size:14px;font-weight:700;line-height:1.25}
          .t{font-size:11px;font-family:monospace;color:#666;margin-top:4px;letter-spacing:1px}
          @media print{@page{margin:6mm}}
        </style></head>
        <body onload="window.focus();window.print()">
          <div class="s">
            <img src="${url}" alt="QR"/>
            <div class="n">${d.brand} ${d.model}</div>
            <div class="t">#${d.qr_token.slice(0, 8).toUpperCase()}</div>
          </div>
        </body></html>`,
      );
      w.document.close();
      w.onafterprint = () => { w.close(); URL.revokeObjectURL(url); };
    } finally {
      setPrinting(false);
    }
  };

  if (!result) return null;
  const CatIcon = CATEGORY_ICON[result.device.category];
  const summary = specsSummary(result.device.category, result.device.specs);
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      footer={
        <div className="flex flex-col gap-2">
          <Button onClick={onAnother} full size="md" icon={<ShoppingCart size={16} />}>
            {t('purchase.success_another')}
          </Button>
          <Button onClick={onClose} full variant="secondary" size="md">
            {t('purchase.success_view')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-success-faded text-success flex items-center justify-center">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h2 className="text-lg font-bold tracking-tight">{t('purchase.success_title')}</h2>
        <p className="text-sm text-text-dim leading-relaxed max-w-sm">{t('purchase.success_body')}</p>

        <div className="w-full mt-2 bg-bg2 rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-bg3 flex items-center justify-center text-text-dim shrink-0">
                <CatIcon size={15} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <div className="text-label font-bold tracking-tight truncate">{result.device.brand} {result.device.model}</div>
                <div className="text-caption text-text-muted truncate">
                  {t(`category.${result.device.category}`)}
                  {summary ? ` · ${summary}` : ''}
                </div>
              </div>
            </div>
            <span className="text-micro font-bold px-2 py-1 rounded-lg bg-success-faded text-success border border-success/20 shrink-0">
              {t('status.in_stock')}
            </span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <span className="text-caption text-text-muted">QR-стикер</span>
            <span className="font-mono text-caption text-text-dim tracking-wider">
              #{result.device.qr_token.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={printSticker}
          disabled={printing}
          className="w-full mt-1 h-11 flex items-center justify-center gap-2 rounded-xl border border-border bg-bg3 text-label font-bold hover:border-border-strong active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Printer size={16} className="text-accent" />
          {t('purchase.print_sticker')}
        </button>
      </div>
    </Modal>
  );
}
