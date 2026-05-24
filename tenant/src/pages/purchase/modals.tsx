import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart } from 'lucide-react';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button-default';

// ─── Draft restore modal ────────────────────────────────────────────────
//
// Shared by the purchase and sale wizards. Copy defaults to the purchase
// strings; callers override title/body/icon for their own flow.

export function DraftRestoreModal({
  open,
  onContinue,
  onDiscard,
  title,
  body,
  icon,
}: {
  open: boolean;
  onContinue: () => void;
  onDiscard: () => void;
  title?: string;
  body?: string;
  icon?: ReactNode;
}) {
  const { t } = useTranslation();
  const titleText = title ?? t('purchase.draft_restore_title');
  const bodyText = body ?? t('purchase.draft_restore_body');
  return (
    <Modal
      open={open}
      onClose={onDiscard}
      size="sm"
      srTitle={titleText}
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
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-faded text-accent">
          {icon ?? <ShoppingCart size={22} />}
        </div>
        <h2 className="text-base font-bold tracking-tight">{titleText}</h2>
        <p className="max-w-xs text-sm leading-relaxed text-text-dim">{bodyText}</p>
      </div>
    </Modal>
  );
}
