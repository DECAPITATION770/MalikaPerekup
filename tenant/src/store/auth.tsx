import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UNAUTHORIZED_EVENT } from '../api/client';
import type { UserOut } from '../api/auth';

interface AuthState {
  token: string | null;
  user: UserOut | null;
  setAuth: (token: string, user: UserOut) => void;
  logout: () => void;
  expired: boolean;
  clearExpired: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('tenant_token'));
  const [user, setUser] = useState<UserOut | null>(() => {
    const raw = localStorage.getItem('tenant_user');
    return raw ? (JSON.parse(raw) as UserOut) : null;
  });
  const [expired, setExpired] = useState(false);

  const setAuth = useCallback((t: string, u: UserOut) => {
    localStorage.setItem('tenant_token', t);
    localStorage.setItem('tenant_user', JSON.stringify(u));
    localStorage.removeItem('tenant_manual_logout');
    setToken(t);
    setUser(u);
    setExpired(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tenant_token');
    localStorage.removeItem('tenant_user');
    localStorage.setItem('tenant_manual_logout', '1');
    setToken(null);
    setUser(null);
  }, []);

  const clearExpired = useCallback(() => setExpired(false), []);

  useEffect(() => {
    const onUnauth = () => {
      if (localStorage.getItem('tenant_token')) {
        localStorage.removeItem('tenant_token');
        localStorage.removeItem('tenant_user');
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
