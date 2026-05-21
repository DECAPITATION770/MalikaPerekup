import { useState, useEffect, useRef, useId } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/auth';
import { loginPassword, loginTelegram, getMe } from '../api';
import Spinner from '../components/ui/Spinner';
import { Eye, EyeOff, Send, ChevronDown } from 'lucide-react';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void } };
  }
}

// ─── Password form — defined at module level so React never remounts it ──────

interface PasswordFormProps {
  onSuccess: (token: string) => void;
}

function PasswordForm({ onSuccess }: PasswordFormProps) {
  const { t } = useTranslation();
  const loginId = useId();
  const passwordId = useId();
  const loginRef = useRef<HTMLInputElement>(null);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateLogin = (v: string) => {
    if (v.trim().length < 3) return t('login.min_login');
    return '';
  };
  const validatePassword = (v: string) => {
    if (v.length < 8) return t('login.min_password');
    return '';
  };

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
      {/* Login */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={loginId} className="text-[13px] text-text-dim font-medium tracking-tight flex items-center gap-1">
          {t('login.login_label')}
          <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <div className={`flex items-center gap-2 bg-bg2 rounded-xl border h-12 px-3.5 transition-colors ${loginErr ? 'border-danger' : 'border-border focus-within:border-accent'}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-text-dim shrink-0">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          <input
            ref={loginRef}
            id={loginId}
            className="flex-1 bg-transparent text-text text-[15px] font-medium outline-none placeholder:text-text-muted"
            placeholder="admin"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={login}
            onChange={e => { setLogin(e.target.value); if (loginErr) setLoginErr(validateLogin(e.target.value)); }}
            onBlur={e => setLoginErr(validateLogin(e.target.value))}
          />
        </div>
        {loginErr && (
          <span role="alert" className="text-xs text-danger">{loginErr}</span>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={passwordId} className="text-[13px] text-text-dim font-medium tracking-tight flex items-center gap-1">
          {t('login.password_label')}
          <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <div className={`flex items-center gap-2 bg-bg2 rounded-xl border h-12 px-3.5 transition-colors ${passwordErr ? 'border-danger' : 'border-border focus-within:border-accent'}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-text-dim shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input
            id={passwordId}
            className="flex-1 bg-transparent text-text text-[15px] font-medium outline-none placeholder:text-text-muted"
            type={showPass ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={e => { setPassword(e.target.value); if (passwordErr) setPasswordErr(validatePassword(e.target.value)); }}
            onBlur={e => setPasswordErr(validatePassword(e.target.value))}
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            className="text-text-muted hover:text-text-dim transition-colors shrink-0 p-0.5 cursor-pointer"
            aria-label={showPass ? t('login.hide_password') : t('login.show_password')}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {passwordErr && (
          <span role="alert" className="text-xs text-danger">{passwordErr}</span>
        )}
      </div>

      {apiError && (
        <div role="alert" className="text-sm text-danger bg-[#3D1414] border border-[#7A2828] rounded-xl px-4 py-3 leading-snug">
          {apiError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-[15px] tracking-tight transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading && <Spinner size={16} />}
        {t('login.submit')}
      </button>
    </form>
  );
}

// ─── Logo header ──────────────────────────────────────────────────────────────

function Logo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center mb-8 fia">
      <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-accent/20 select-none">
        M
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{t('login.title')}</h1>
      <p className="text-text-dim text-sm mt-1">{t('login.subtitle')}</p>
    </div>
  );
}

// ─── Main Login page ──────────────────────────────────────────────────────────

export default function Login() {
  const { t } = useTranslation();
  const { token, setAuth } = useAuth();

  const hasTg = Boolean(window.Telegram?.WebApp?.initData);
  const manualLogout = localStorage.getItem('admin_manual_logout') === '1';

  const [passOpen, setPassOpen] = useState(false);
  const passBodyRef = useRef<HTMLDivElement>(null);
  const [passBodyH, setPassBodyH] = useState(0);

  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [tgTimedOut, setTgTimedOut] = useState(false);
  // Aborts in-flight auto-login if user logs out in another tab during the 8s window
  const abortedRef = useRef(false);

  // Measure collapsed section height after it renders
  useEffect(() => {
    if (passBodyRef.current) setPassBodyH(passBodyRef.current.scrollHeight);
  }, [passOpen]);

  // Auto-login via Telegram on first open, with 8s timeout + cross-tab abort
  useEffect(() => {
    if (!hasTg || manualLogout || token) return;
    window.Telegram!.WebApp!.ready?.();
    doTgLogin();
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
      // Re-check the manual logout flag right before applying — it may have been
      // set in another tab during the network roundtrip.
      if (abortedRef.current || localStorage.getItem('admin_manual_logout') === '1') {
        return;
      }
      await handleSuccess(access_token);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      setTgError(status === 401 ? t('login.error_no_admin') : t('login.error_generic'));
    } finally {
      setTgLoading(false);
    }
  };

  // ── Telegram auto-login spinner ──────────────────────────────────────────
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

  // ── After logout in Telegram context ─────────────────────────────────────
  if (hasTg && manualLogout) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Logo />
          <div className="bg-bg3 rounded-2xl border border-border overflow-hidden fia fia-1">
            {/* Telegram button */}
            <div className="p-5 flex flex-col gap-3">
              <button
                onClick={doTgLogin}
                disabled={tgLoading}
                className="h-12 w-full rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-[15px] tracking-tight transition-all active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {tgLoading ? <Spinner size={16} /> : <Send size={16} />}
                {t('login.tab_telegram')}
              </button>
              {tgError && (
                <div role="alert" className="text-sm text-danger bg-[#3D1414] border border-[#7A2828] rounded-xl px-4 py-3">
                  {tgError}
                </div>
              )}
            </div>

            {/* Collapsible password section */}
            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => setPassOpen(o => !o)}
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

  // ── Browser / TG auth failed → plain password form ───────────────────────
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="bg-bg3 rounded-2xl border border-border p-6 fia fia-1">
          {tgError && (
            <div role="alert" className="mb-4 text-sm text-danger bg-[#3D1414] border border-[#7A2828] rounded-xl px-4 py-3">
              {tgError}
            </div>
          )}
          <PasswordForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
