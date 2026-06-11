/**
 * Thin adapter that re-exports `sonner`'s toast under the old useToast API
 * (`toast.success / .error / .info / .warning`) so existing pages keep working
 * without per-page rewrites. New code should `import { toast } from 'sonner'`
 * directly.
 */
import { toast as sonner } from 'sonner';

export interface AdminToast {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const adapter: AdminToast = {
  success: (m) => sonner.success(m),
  error: (m) => sonner.error(m),
  info: (m) => sonner.info(m),
  warning: (m) => sonner.warning(m),
};

export function useToast(): AdminToast {
  return adapter;
}

/** No-op placeholder so any leftover `<ToastProvider />` import still resolves. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
