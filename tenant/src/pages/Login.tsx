import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Lock, Send, User as UserIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MalikaWordmark } from '@/components/brand/MalikaWordmark';
import { MalikaLogo } from '@/components/icons/MalikaLogo';
import { useAuth } from '@/store/auth';
import { useTgHaptic } from '@/lib/telegram';
import { getMe, loginPassword, loginTelegram } from '@/api/auth';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void } };
  }
}

// ── Password form ──────────────────────────────────────────────────────

interface PasswordFormProps {
  onSuccess: (token: string) => void;
}

function passwordSchema(t: (k: string) => string) {
  return z.object({
    login: z.string().trim().min(3, t('login.min_login')),
    password: z.string().min(8, t('login.min_password')),
  });
}

function PasswordForm({ onSuccess }: PasswordFormProps) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ login: string; password: string }>({
    resolver: zodResolver(passwordSchema(t)),
    defaultValues: { login: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async ({ login, password }) => {
    setApiError('');
    try {
      const { access_token } = await loginPassword(login.trim(), password);
      haptic.notify('success');
      onSuccess(access_token);
    } catch (e) {
      haptic.notify('error');
      const status = (e as { response?: { status?: number } })?.response?.status;
      setApiError(status === 401 ? t('login.error_invalid') : t('login.error_generic'));
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login">
          {t('login.login_label')} <span className="text-danger">*</span>
        </Label>
        <div className="relative">
          <UserIcon
            size={16}
            strokeWidth={1.8}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
          />
          <Input
            id="login"
            placeholder="ivan_kupez"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className="pl-10"
            {...register('login')}
          />
        </div>
        {errors.login && (
          <span role="alert" className="text-hint text-danger animate-fade-in">
            {errors.login.message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">
          {t('login.password_label')} <span className="text-danger">*</span>
        </Label>
        <div className="relative">
          <Lock
            size={16}
            strokeWidth={1.8}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
          />
          <Input
            id="password"
            type={showPass ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            className="pl-10 pr-11"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPass((s) => !s)}
            aria-label={showPass ? t('login.hide_password') : t('login.show_password')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-dim transition-colors"
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && (
          <span role="alert" className="text-hint text-danger animate-fade-in">
            {errors.password.message}
          </span>
        )}
      </div>

      <AnimatePresence>
        {apiError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            role="alert"
            className="text-body text-danger bg-danger-faded border border-danger/40 rounded-xl px-4 py-3 leading-snug"
          >
            {apiError}
          </motion.div>
        )}
      </AnimatePresence>

      <Button type="submit" full size="lg" loading={isSubmitting}>
        {t('login.submit')}
      </Button>
    </form>
  );
}

// ── Brand block ────────────────────────────────────────────────────────

function Brand() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center mb-8 animate-fade-up">
      <div className="relative mb-4 shadow-glow-accent rounded-card">
        <MalikaLogo size={64} className="text-accent" />
      </div>
      <MalikaWordmark size="lg" className="text-text" />
      <p className="text-text-dim text-body mt-2">{t('login.subtitle')}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

export default function Login() {
  const { t } = useTranslation();
  const { token, setAuth } = useAuth();
  const haptic = useTgHaptic();

  const hasTg = Boolean(window.Telegram?.WebApp?.initData);
  const manualLogout = localStorage.getItem('tenant_manual_logout') === '1';

  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [tgTimedOut, setTgTimedOut] = useState(false);
  const abortedRef = useRef(false);

  const handleSuccess = async (accessToken: string) => {
    localStorage.removeItem('tenant_manual_logout');
    localStorage.setItem('tenant_token', accessToken);
    const me = await getMe();
    setAuth(accessToken, me);
  };

  const doTgLogin = async (explicit = false) => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    // An explicit «Войти через Telegram» tap overrides a prior manual logout;
    // the silent auto-login (explicit=false) still honours it.
    if (explicit) localStorage.removeItem('tenant_manual_logout');
    abortedRef.current = false;
    setTgError('');
    setTgLoading(true);
    try {
      const { access_token } = await loginTelegram(initData);
      if (!explicit && (abortedRef.current || localStorage.getItem('tenant_manual_logout') === '1'))
        return;
      haptic.notify('success');
      await handleSuccess(access_token);
    } catch (e) {
      haptic.notify('error');
      const status = (e as { response?: { status?: number } })?.response?.status;
      setTgError(status === 401 ? t('login.error_no_access') : t('login.error_generic'));
    } finally {
      setTgLoading(false);
    }
  };

  useEffect(() => {
    if (!hasTg || manualLogout || token) return;
    window.Telegram!.WebApp!.ready?.();
    void doTgLogin();
    const timer = window.setTimeout(() => {
      setTgTimedOut(true);
      setTgLoading(false);
    }, 8000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (token) return <Navigate to="/" replace />;

  // ── State A: TG autologin spinner ─────────────────────────────────
  if (hasTg && !manualLogout && !tgError && !tgTimedOut) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center gap-4 p-4 hero-mesh">
        <Loader2 className="size-8 text-accent animate-spin" />
        <p className="text-text-dim text-body">{t('login.tg_loading')}</p>
        <button
          onClick={() => setTgTimedOut(true)}
          className="text-hint text-accent hover:text-accent-hover transition-colors mt-4 font-semibold cursor-pointer"
        >
          {t('login.fallback_to_password')}
        </button>
      </div>
    );
  }

  // ── Login card: familiar login/password form + «Войти через Telegram» ──
  // Shown after a manual logout, on TG auto-login timeout, or in a plain
  // browser. The Telegram button only appears when initData is available.
  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center p-4 hero-mesh">
      <div className="w-full max-w-sm">
        <Brand />
        <Card className="card-elev p-6 animate-fade-up" style={{ animationDelay: '60ms' }}>
          {tgError && (
            <div
              role="alert"
              className="mb-4 text-body text-danger bg-danger-faded border border-danger/40 rounded-xl px-4 py-3"
            >
              {tgError}
            </div>
          )}
          <PasswordForm onSuccess={handleSuccess} />
          {hasTg && (
            <>
              <div className="my-4 flex items-center gap-3 text-caption text-text-muted">
                <span className="h-px flex-1 bg-border" />
                {t('login.or')}
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="secondary"
                full
                size="lg"
                onClick={() => doTgLogin(true)}
                loading={tgLoading}
              >
                <Send className="size-4" /> {t('login.tab_telegram')}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
