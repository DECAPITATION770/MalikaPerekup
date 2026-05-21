import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/auth';
import { loginPassword, loginTelegram, getMe } from '../api/auth';
import Spinner from '../components/ui/Spinner';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Eye, EyeOff, Send, ChevronDown, User as UserIcon, Lock } from 'lucide-react';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void } };
  }
}

interface PasswordFormProps { onSuccess: (token: string) => void }

function PasswordForm({ onSuccess }: PasswordFormProps) {
  const { t } = useTranslation();
  const loginRef = useRef<HTMLInputElement>(null);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateLogin = (v: string) => v.trim().length < 3 ? t('login.min_login') : '';
  const validatePassword = (v: string) => v.length < 8 ? t('login.min_password') : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const le = validateLogin(login);
    const pe = validatePassword(password);
    setLoginErr(le);
    setPasswordErr(pe);
    if (le) { loginRef.current?.focus(); return; }
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
        required
        prefix={<UserIcon size={16} strokeWidth={1.8} />}
        placeholder="ivan_kupez"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={login}
        error={loginErr}
        onChange={(e) => { setLogin(e.target.value); if (loginErr) setLoginErr(validateLogin(e.target.value)); }}
        onBlur={(e) => setLoginErr(validateLogin(e.target.value))}
      />
      <Input
        label={t('login.password_label')}
        required
        type={showPass ? 'text' : 'password'}
        prefix={<Lock size={16} strokeWidth={1.8} />}
        suffix={
          <button
            type="button"
            onClick={() => setShowPass((s) => !s)}
            className="text-text-muted hover:text-text-dim transition-colors p-0.5 cursor-pointer"
            aria-label={showPass ? t('login.hide_password') : t('login.show_password')}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        placeholder="••••••••"
        autoComplete="current-password"
        value={password}
        error={passwordErr}
        onChange={(e) => { setPassword(e.target.value); if (passwordErr) setPasswordErr(validatePassword(e.target.value)); }}
        onBlur={(e) => setPasswordErr(validatePassword(e.target.value))}
      />

      {apiError && (
        <div role="alert" className="text-sm text-danger bg-danger-faded border border-danger/40 rounded-xl px-4 py-3 leading-snug animate-fade-in">
          {apiError}
        </div>
      )}

      <Button type="submit" full size="lg" loading={loading}>
        {t('login.submit')}
      </Button>
    </form>
  );
}

function Logo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center mb-8 animate-fade-up">
      <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white font-bold text-title mb-4 shadow-glow-accent select-none">
        M
      </div>
      <h1 className="text-title font-bold tracking-tight">{t('login.title')}</h1>
      <p className="text-text-dim text-sm mt-1">{t('login.subtitle')}</p>
    </div>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const { token, setAuth } = useAuth();

  const hasTg = Boolean(window.Telegram?.WebApp?.initData);
  const manualLogout = localStorage.getItem('tenant_manual_logout') === '1';

  const [passOpen, setPassOpen] = useState(false);
  const passBodyRef = useRef<HTMLDivElement>(null);
  const [passBodyH, setPassBodyH] = useState(0);

  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [tgTimedOut, setTgTimedOut] = useState(false);
  const abortedRef = useRef(false);

  useEffect(() => {
    if (passBodyRef.current) setPassBodyH(passBodyRef.current.scrollHeight);
  }, [passOpen]);

  useEffect(() => {
    if (!hasTg || manualLogout || token) return;
    window.Telegram!.WebApp!.ready?.();
    void doTgLogin();
    const timer = setTimeout(() => { setTgTimedOut(true); setTgLoading(false); }, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (token) return <Navigate to="/" replace />;

  const handleSuccess = async (access_token: string) => {
    localStorage.removeItem('tenant_manual_logout');
    localStorage.setItem('tenant_token', access_token);
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
      if (abortedRef.current || localStorage.getItem('tenant_manual_logout') === '1') return;
      await handleSuccess(access_token);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setTgError(status === 401 ? t('login.error_no_access') : t('login.error_generic'));
    } finally {
      setTgLoading(false);
    }
  };

  // Telegram auto-login spinner
  if (hasTg && !manualLogout && !tgError && !tgTimedOut) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 p-4">
        <Spinner size={32} />
        <p className="text-text-dim text-sm">{t('login.tg_loading')}</p>
        <button
          onClick={() => setTgTimedOut(true)}
          className="text-xs text-accent hover:text-accent-hover transition-colors mt-4 font-semibold cursor-pointer"
        >
          {t('login.fallback_to_password')}
        </button>
      </div>
    );
  }

  // Inside Telegram, but user explicitly logged out — show TG button + password fallback
  if (hasTg && manualLogout) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Logo />
          <div className="card-elev overflow-hidden animate-fade-up" style={{ animationDelay: '60ms' }}>
            <div className="p-5 flex flex-col gap-3">
              <Button onClick={doTgLogin} full size="lg" loading={tgLoading} icon={<Send size={16} />}>
                {t('login.tab_telegram')}
              </Button>
              {tgError && (
                <div role="alert" className="text-sm text-danger bg-danger-faded border border-danger/40 rounded-xl px-4 py-3 animate-fade-in">
                  {tgError}
                </div>
              )}
            </div>

            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => setPassOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-text-dim hover:text-text transition-colors cursor-pointer"
                aria-expanded={passOpen}
              >
                {t('login.tab_password')}
                <ChevronDown
                  size={16}
                  className="transition-transform duration-200 shrink-0"
                  style={{ transform: passOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
              <div
                style={{
                  maxHeight: passOpen ? `${passBodyH || 400}px` : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 240ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                <div ref={passBodyRef} className="px-5 pb-5">
                  <PasswordForm onSuccess={handleSuccess} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Plain web — only password form
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="card-elev p-6 animate-fade-up" style={{ animationDelay: '60ms' }}>
          {tgError && (
            <div role="alert" className="mb-4 text-sm text-danger bg-danger-faded border border-danger/40 rounded-xl px-4 py-3">
              {tgError}
            </div>
          )}
          <PasswordForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
