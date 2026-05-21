import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** When true, ESC / overlay click / X show a confirm dialog before closing. */
  dirty?: boolean;
}

export default function Modal({ open, onClose, title, children, footer, dirty }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => {
        const focusable = dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }, 0);
    } else if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
      // Only restore focus if the trigger is still in the DOM (avoids React warnings
      // when the trigger unmounted, e.g. logout flow that navigates away).
      previousFocusRef.current.focus();
    }
  }, [open]);

  const requestClose = () => {
    if (dirty) setConfirmOpen(true);
    else onClose();
  };

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={requestClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md bg-bg3 rounded-2xl border border-border shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <h2 id="modal-title" className="text-[17px] font-bold tracking-tight">{title}</h2>
          <button
            onClick={requestClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-dim hover:text-text hover:bg-bg2 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 pb-5">{footer}</div>}
      </div>

      {/* Inline confirm — using portal-less mini dialog to avoid recursion */}
      {confirmOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm bg-bg3 rounded-2xl border border-border shadow-2xl p-5 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-bold tracking-tight mb-2">{t('common.unsaved_changes_title')}</h3>
            <p className="text-sm text-text-dim leading-relaxed mb-4">{t('common.unsaved_changes_body')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 h-11 rounded-xl bg-bg2 hover:bg-bg border border-border text-text font-semibold cursor-pointer"
              >
                {t('common.stay')}
              </button>
              <button
                onClick={() => { setConfirmOpen(false); onClose(); }}
                className="flex-1 h-11 rounded-xl bg-danger hover:bg-[#C9382A] text-white font-semibold cursor-pointer"
              >
                {t('common.discard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
