/**
 * Telegram WebApp bridge. Falls back gracefully when opened in a plain browser.
 *
 * In Telegram: window.Telegram.WebApp is injected by telegram-web-app.js (loaded in index.html).
 * In browser: window.Telegram is undefined → we return empty initData and rely on DEV_AUTH_BYPASS.
 */

type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function getInitData(): string {
  const wa = window.Telegram?.WebApp
  if (!wa) return ''
  wa.ready()
  wa.expand()
  return wa.initData ?? ''
}

export function isInTelegram(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData)
}
