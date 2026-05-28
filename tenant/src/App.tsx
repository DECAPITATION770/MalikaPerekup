import { AuthProvider, useAuth } from './lib/auth'
import AdminTenants from './pages/AdminTenants'
import OwnerHome from './pages/OwnerHome'

function Routed() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <p className="text-neutral-400 p-8">Загрузка…</p>
  }
  if (auth.status === 'error') {
    return (
      <div className="p-8 space-y-2 max-w-md mx-auto">
        <p className="text-red-400">Ошибка авторизации</p>
        <p className="text-xs text-neutral-500 break-all">{auth.message}</p>
      </div>
    )
  }

  if (auth.user.role === 'super_admin') return <AdminTenants />
  return <OwnerHome user={auth.user} />
}

export default function App() {
  return (
    <AuthProvider>
      <main className="min-h-screen">
        <Routed />
      </main>
    </AuthProvider>
  )
}
