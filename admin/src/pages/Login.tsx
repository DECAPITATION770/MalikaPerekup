/**
 * Admin Login.
 *
 * Two paths:
 *   • Telegram auto-login — used inside the Telegram WebApp context
 *     (initData is verified server-side). Times out at 8 s with a
 *     fall-back to the password form.
 *   • Password fallback — login + password fields with show/hide toggle,
 *     blur-based validation, polite error messaging.
 *
 * Visual structure: centred card on a full-bleed background, Logo + title
 * above. Light/dark themes inherited from the global theme tokens — no
 * hardcoded hex anywhere.
 */
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Eye, EyeOff, Lock, Send, User } from 'lucide-react';

import { useAuth } from '../store/auth';
import { getMe, loginPassword, loginTelegram } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void } };
  }
}

// ─── Password form ───────────────────────────────────────────────────────────

function PasswordForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const { t } = useTranslation();
  const loginRef = useRef<HTMLInputElement>(null);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateLogin = (v: string) => (v.trim().length < 3 ? t('login.min_login') : '');
  const validatePassword = (v: string) => (v.length < 8 ? t('login.min_password') : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const le = validateLogin(login);
    const pe = validatePassword(password);
    setLoginErr(le);
    setPasswordErr(pe);
    if (le) {
      loginRef.current?.focus();
      return;
    }
    if (pe) return;

    setApiError('');
    setLoading(true);
    try {
      const { access_token } = await loginPassword(login.trim(), password);
      onSuccess(access_token);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setApiError(status === 401 ? t('login.error_invalid') : t('login.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        ref={loginRef}
        label={t('login.login_label')}
        placeholder="admin"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        left={<User size={15} aria-hidden />}
        value={login}
        error={loginErr}
        onChange={(e) => {
          setLogin(e.target.value);
          if (loginErr) setLoginErr(validateLogin(e.target.value));
        }}
        onBlur={(e) => setLoginErr(validateLogin(e.target.value))}
      />

      <div className="relative">
        <Input
          label={t('login.password_label')}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          type={showPass ? 'text' : 'password'}
          left={<Lock size={15} aria-hidden />}
          value={password}
          error={passwordErr}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordErr) setPasswordErr(validatePassword(e.target.value));
          }}
          onBlur={(e) => setPasswordErr(validatePassword(e.target.value))}
        />
        <button
          type="button"
          onClick={() => setShowPass((s) => !s)}
          aria-label={showPass ? t('login.hide_password') : t('login.show_password')}
          className="absolute right-3 top-[34px] cursor-pointer rounded p-1 text-text-muted transition-colors hover:text-text-dim"
        >
          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {apiError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-faded px-4 py-3 text-label leading-snug text-danger"
        >
          {apiError}
        </div>
      )}

      <Button type="submit" full size="lg" loading={loading}>
        {t('login.submit')}
      </Button>
    </form>
  );
}

// ─── Logo header ─────────────────────────────────────────────────────────────

function Logo() {
  const { t } = useTranslation();
  return (
    <div className="mb-8 flex flex-col items-center fia">
      <div className="mb-4 flex h-16 w-16 select-none items-center justify-center rounded-card bg-accent text-title font-bold text-accent-fg shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.6)]">
        M
      </div>
      <h1 className="text-title font-bold tracking-tight">{t('login.title')}</h1>
      <p className="mt-1 text-hint text-text-dim">{t('login.subtitle')}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Login() {
  const { t } = useTranslation();
  const { token, setAuth } = useAuth();

  const hasTg = Boolean(window.Telegram?.WebApp?.initData);
  const manualLogout = localStorage.getItem('admin_manual_logout') === '1';

  const [passOpen, setPassOpen] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [tgTimedOut, setTgTimedOut] = useState(false);
  // Aborts in-flight auto-login if user logs out in another tab during the 8 s window
  const abortedRef = useRef(false);

  useEffect(() => {
    if (!hasTg || manualLogout || token) return;
    window.Telegram!.WebApp!.ready?.();
    void doTgLogin();
    const timer = setTimeout(() => {
      setTgTimedOut(true);
      setTgLoading(false);
    }, 8000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'admin_manual_logout' && e.newValue === '1') {
        abortedRef.current = true;
        setTgLoading(false);
        setTgTimedOut(true);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (token) return <Navigate to="/" replace />;

  const handleSuccess = async (access_token: string) => {
    localStorage.removeItem('admin_manual_logout');
    localStorage.setItem('admin_token', access_token);
    const me = await getMe();
    setAuth(access_token, me);
  };

  const doTgLogin = async () => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    abortedRef.current = false;
    setTgError('');
    setTgLoading(true);
    try {
      const { access_token } = await loginTelegram(initData);
      if (abortedRef.current || localStorage.getItem('admin_manual_logout') === '1') return;
      await handleSuccess(access_token);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setTgError(status === 401 ? t('login.error_no_admin') : t('login.error_generic'));
    } finally {
      setTgLoading(false);
    }
  };

  // Telegram auto-login spinner state
  if (hasTg && !manualLogout && !tgError && !tgTimedOut) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-4 text-text">
        <Spinner size={32} className="text-accent" />
        <p className="text-hint text-text-dim">{t('login.tg_loading')}</p>
        <button
          type="button"
          onClick={() => setTgTimedOut(true)}
          className="mt-4 cursor-pointer text-caption font-semibold text-accent transition-colors hover:text-accent-hover"
        >
          {t('login.fallback_to_password')}
        </button>
      </div>
    );
  }

  // Telegram-context, post-logout: show TG button + collapsible password form
  if (hasTg && manualLogout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-text">
        <div className="w-full max-w-sm">
          <Logo />
          <div className="card-elev fia fia-1 overflow-hidden">
            <div className="flex flex-col gap-3 p-5">
              <Button size="lg" loading={tgLoading} onClick={doTgLogin}>
                <Send size={16} aria-hidden /> {t('login.tab_telegram')}
              </Button>
              {tgError && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/30 bg-danger-faded px-4 py-3 text-label text-danger"
                >
                  {tgError}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPassOpen((o) => !o)}
              aria-expanded={passOpen}
              className="flex w-full cursor-pointer items-center justify-between border-t border-border px-5 py-3 text-label font-semibold text-text-dim transition-colors hover:text-text"
            >
              {t('login.tab_password')}
              <ChevronDown
                size={16}
                className={cn(
                  'shrink-0 transition-transform duration-200',
                  passOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-200',
                passOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="border-t border-border px-5 pb-5 pt-4">
                  <PasswordForm onSuccess={handleSuccess} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Browser or TG failed → plain password form
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-text">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="card-elev fia fia-1 p-6">
          {tgError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-danger/30 bg-danger-faded px-4 py-3 text-label text-danger"
            >
              {tgError}
            </div>
          )}
          <PasswordForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
