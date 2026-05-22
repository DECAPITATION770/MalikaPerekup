import { useEffect, useRef } from 'react';

interface TgBackButton {
  show(): void;
  hide(): void;
  onClick(fn: () => void): void;
  offClick(fn: () => void): void;
}
interface TgHaptic {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}
interface TelegramWebApp {
  BackButton: TgBackButton;
  HapticFeedback: TgHaptic;
  close(): void;
}

function getTg(): TelegramWebApp | null {
  const tg = (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
  return (tg as TelegramWebApp | undefined) ?? null;
}

export function useHaptic() {
  return {
    tap: () => getTg()?.HapticFeedback.impactOccurred('light'),
    select: () => getTg()?.HapticFeedback.selectionChanged(),
    success: () => getTg()?.HapticFeedback.notificationOccurred('success'),
    error: () => getTg()?.HapticFeedback.notificationOccurred('error'),
  };
}

export function useTgBack(handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const tg = getTg();
    if (!tg) return;
    const cb = () => handlerRef.current();
    tg.BackButton.show();
    tg.BackButton.onClick(cb);
    return () => {
      tg.BackButton.offClick(cb);
      tg.BackButton.hide();
    };
  }, []);
}
