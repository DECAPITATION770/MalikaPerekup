import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { api, clearToken, setToken } from './api'
import { getInitData } from './telegram'

export type Role = 'super_admin' | 'owner'

export type User = {
  id: number
  tenant_id: number | null
  role: Role
  tg_id: number | null
  tg_username: string | null
  tg_first_name: string | null
  language: string
}

type AuthState =
  | { status: 'loading' }
  | { status: 'authed'; user: User }
  | { status: 'error'; message: string }

const AuthContext = createContext<AuthState>({ status: 'loading' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const initData = getInitData()
        const { access_token } = await api<{ access_token: string }>('/api/auth/telegram', {
          method: 'POST',
          body: JSON.stringify({ init_data: initData }),
        })
        if (cancelled) return
        setToken(access_token)
        const user = await api<User>('/api/auth/me')
        if (cancelled) return
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
