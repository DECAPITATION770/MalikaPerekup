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
  footer,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn(SIZE[size])}>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
