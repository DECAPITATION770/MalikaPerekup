/**
 * Adapter over the shadcn Dialog primitive that preserves the old
 * `<Modal open onClose title footer dirty>` API used across admin pages.
 * `dirty` triggers an "are you sure?" confirm on outside-click dismissal
 * (so users don't lose typed input on accidental Esc / click-out).
 */
import { type ReactNode, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** When the user has edited the form, dismiss-confirm prompt before close. */
  dirty?: boolean;
}

export default function Modal({ open, onClose, title, children, footer, dirty }: ModalProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          {title && (
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
          )}
          {children}
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Закрыть без сохранения?</DialogTitle>
          </DialogHeader>
          <p className="text-hint text-text-dim leading-relaxed">
            Изменения, которые вы ввели, не будут сохранены.
          </p>
          <DialogFooter>
            <button
              onClick={() => setConfirmOpen(false)}
              className="h-10 rounded-lg border border-border bg-bg2 px-4 text-label font-semibold hover:bg-bg3 cursor-pointer"
            >
              Не закрывать
            </button>
            <button
              onClick={() => {
                setConfirmOpen(false);
                onClose();
              }}
              className="h-10 rounded-lg bg-danger px-4 text-label font-semibold text-white hover:bg-danger/90 cursor-pointer"
            >
              Закрыть
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
