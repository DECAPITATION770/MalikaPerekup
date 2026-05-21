import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastContextValue {
  push: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems(arr => arr.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setItems(arr => [...arr, { id, kind, message }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value: ToastContextValue = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {items.map(t => (
          <Toast key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setClosing(true), 3700);
    return () => clearTimeout(t);
  }, []);

  const config = {
    success: { Icon: CheckCircle2, bg: 'bg-[#0F3F2A]', border: 'border-[#1F6E48]', text: 'text-success' },
    error:   { Icon: XCircle,      bg: 'bg-[#3D1414]', border: 'border-[#7A2828]', text: 'text-danger' },
    info:    { Icon: Info,         bg: 'bg-[#0E2A4A]', border: 'border-[#1F4F86]', text: 'text-accent' },
  }[item.kind];

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 ${config.bg} border ${config.border} rounded-xl px-4 py-3 min-w-[280px] max-w-md shadow-2xl ${closing ? 'animate-fade-out' : 'animate-slide-in'}`}
      style={{ animation: closing ? 'fadeOut 200ms ease-in forwards' : 'slideIn 220ms ease-out' }}
    >
      <config.Icon size={18} className={`${config.text} shrink-0 mt-0.5`} />
      <div className={`flex-1 text-sm font-medium ${config.text} leading-snug`}>{item.message}</div>
      <button
        onClick={onClose}
        aria-label="Закрыть"
        className={`${config.text} opacity-60 hover:opacity-100 transition-opacity shrink-0 cursor-pointer`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
