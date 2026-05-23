import { useTranslation } from 'react-i18next';
import { ShoppingCart } from 'lucide-react';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button-default';

// ─── Draft restore modal ────────────────────────────────────────────────

export function DraftRestoreModal({
  open,
  onContinue,
  onDiscard,
}: {
  open: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onDiscard}
      size="sm"
      srTitle={t('purchase.draft_restore_title')}
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
          <ShoppingCart size={22} />
        </div>
        <h2 className="text-base font-bold tracking-tight">{t('purchase.draft_restore_title')}</h2>
        <p className="max-w-xs text-sm leading-relaxed text-text-dim">
          {t('purchase.draft_restore_body')}
        </p>
      </div>
    </Modal>
  );
}
