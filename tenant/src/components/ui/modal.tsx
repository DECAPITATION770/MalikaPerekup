import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Legacy Modal API (open/onClose/title/footer/size) implemented over the
 * shadcn Dialog so ported wizard modals work unchanged. Default-exported
 * as `Modal` for drop-in compatibility.
 */
const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export default function Modal({
  open,
  onClose,
  title,
  srTitle,
  footer,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Screen-reader-only accessible name for modals that render their own heading. */
  srTitle?: string;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* aria-describedby disabled: body copy varies per modal, no shared description. */}
      <DialogContent className={cn(SIZE[size])} aria-describedby={undefined}>
        {title ? (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        ) : (
          // Radix requires a DialogTitle for screen readers even when the modal
          // renders its own visible heading — keep it visually hidden here.
          <DialogTitle className="sr-only">{srTitle}</DialogTitle>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
