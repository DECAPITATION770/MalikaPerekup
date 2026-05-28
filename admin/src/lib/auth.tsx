import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { api, clearToken, setToken } from './api'

type User = {
  id: number
  tenant_id: number | null
  role: 'super_admin' | 'owner'
  tg_id: number | null
  tg_username: string | null
  tg_first_name: string | null
}

type AuthState =
  | { status: 'loading' }
  | { status: 'authed'; user: User }
  | { status: 'forbidden'; reason: string }
  | { status: 'error'; message: string }

const AuthContext = createContext<AuthState>({ status: 'loading' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Admin app doesn't run inside Telegram in v1 — initData is always empty.
        // Either DEV_AUTH_BYPASS (dev) or super-admin tg_id matched on backend handles it.
        const { access_token } = await api<{ access_token: string }>('/api/auth/telegram', {
          method: 'POST',
          body: JSON.stringify({ init_data: '' }),
        })
        if (cancelled) return
        setToken(access_token)
        const user = await api<User>('/api/auth/me')
        if (cancelled) return

        // HARD gate: admin app is super-admin-only. Refuse owners explicitly.
        if (user.role !== 'super_admin') {
          clearToken()
          setState({
            status: 'forbidden',
            reason: `Эта панель только для super-admin. Твоя роль: ${user.role}.`,
          })
          return
        }

        setState({ status: 'authed', user })
      } catch (err) {
        if (cancelled) return
        clearToken()
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'auth failed',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
