import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AdminOut } from '../types';
import { UNAUTHORIZED_EVENT } from '../api/client';

interface AuthState {
  token: string | null;
  admin: AdminOut | null;
  setAuth: (token: string, admin: AdminOut) => void;
  logout: () => void;
}

const AuthCtx = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [admin, setAdmin] = useState<AdminOut | null>(() => {
    const s = localStorage.getItem('admin_me');
    return s ? JSON.parse(s) : null;
  });

  const setAuth = useCallback((tok: string, me: AdminOut) => {
    localStorage.removeItem('admin_manual_logout');
    localStorage.setItem('admin_token', tok);
    localStorage.setItem('admin_me', JSON.stringify(me));
    setToken(tok);
    setAdmin(me);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_me');
    localStorage.setItem('admin_manual_logout', '1');
    setToken(null);
    setAdmin(null);
  }, []);

  // Listen for 401s from any axios call → logout via React state
  useEffect(() => {
    const handler = () => {
      // Show a toast via window event so we don't need to import here
      window.dispatchEvent(new CustomEvent('admin:session-expired'));
      logout();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [logout]);

  // Cross-tab logout sync — if another tab logs out, this tab follows
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'admin_token' && e.newValue === null) {
        setToken(null);
        setAdmin(null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return <AuthCtx.Provider value={{ token, admin, setAuth, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
