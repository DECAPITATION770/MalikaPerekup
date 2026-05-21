import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; text: string }

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, text }]);
    // Errors stay long enough to actually read (scaled by length);
    // success/info are transient. Any toast is tap-to-dismiss.
    const ttl = kind === 'error'
      ? Math.min(12000, Math.max(6000, text.length * 90))
      : 3600;
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, ttl);
  }, []);

  const api: ToastApi = {
    success: (t) => push('success', t),
    error:   (t) => push('error', t),
    info:    (t) => push('info', t),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-20 right-4 md:bottom-4 z-[100] flex flex-col items-end gap-2 pointer-events-none">
        {items.map((it) => (
          <ToastCard key={it.id} kind={it.kind} text={it.text} onClose={() => remove(it.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ kind, text, onClose }: { kind: Kind; text: string; onClose: () => void }) {
  const Icon = kind === 'success' ? CheckCircle2 : kind === 'error' ? AlertCircle : Info;
  const tone =
    kind === 'success' ? 'bg-success-faded border-success/40 text-success'
    : kind === 'error'   ? 'bg-danger-faded border-danger/40 text-danger'
    :                      'bg-bg3 border-border text-text';

  return (
    <button
      type="button"
      onClick={onClose}
      role={kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto text-left px-4 py-3 rounded-xl border ${tone} text-label font-semibold tracking-tight flex items-start gap-2 shadow-lg animate-slide-in-right max-w-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <span className="flex-1">{text}</span>
    </button>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
