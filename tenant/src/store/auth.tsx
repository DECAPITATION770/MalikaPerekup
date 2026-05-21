/**
 * App-wide auth state. Same shape as the legacy MVP — token + user persisted
 * to localStorage, with a global UNAUTHORIZED event listener that wipes
 * credentials and surfaces a session-expired flag for the toast.
 *
 * No deps change: drop-in for legacy `useAuth()` callers.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { UNAUTHORIZED_EVENT } from '@/api/client';
import type { UserOut } from '@/api/auth';

interface AuthState {
  token: string | null;
  user: UserOut | null;
  setAuth: (token: string, user: UserOut) => void;
  logout: () => void;
  expired: boolean;
  clearExpired: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

const KEY_TOKEN = 'tenant_token';
const KEY_USER = 'tenant_user';
const KEY_MANUAL_LOGOUT = 'tenant_manual_logout';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(KEY_TOKEN));
  const [user, setUser] = useState<UserOut | null>(() => {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? (JSON.parse(raw) as UserOut) : null;
  });
  const [expired, setExpired] = useState(false);

  const setAuth = useCallback((t: string, u: UserOut) => {
    localStorage.setItem(KEY_TOKEN, t);
    localStorage.setItem(KEY_USER, JSON.stringify(u));
    localStorage.removeItem(KEY_MANUAL_LOGOUT);
    setToken(t);
    setUser(u);
    setExpired(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
    localStorage.setItem(KEY_MANUAL_LOGOUT, '1');
    setToken(null);
    setUser(null);
  }, []);

  const clearExpired = useCallback(() => setExpired(false), []);

  useEffect(() => {
    const onUnauth = () => {
      if (localStorage.getItem(KEY_TOKEN)) {
        localStorage.removeItem(KEY_TOKEN);
        localStorage.removeItem(KEY_USER);
        setToken(null);
        setUser(null);
        setExpired(true);
      }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauth);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauth);
  }, []);

  return (
    <AuthCtx.Provider value={{ token, user, setAuth, logout, expired, clearExpired }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
