import { AuthProvider, useAuth } from './lib/auth'
import Tenants from './pages/Tenants'

function Gate() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <p className="p-8 text-neutral-400">Загрузка…</p>
  }
  if (auth.status === 'forbidden') {
    return (
      <div className="mx-auto max-w-md space-y-2 p-8">
        <h1 className="text-xl font-semibold">Доступ запрещён</h1>
        <p className="text-sm text-neutral-400">{auth.reason}</p>
      </div>
    )
  }
  if (auth.status === 'error') {
    return (
      <div className="mx-auto max-w-md space-y-2 p-8">
        <h1 className="text-xl font-semibold text-red-400">Ошибка</h1>
        <p className="text-xs text-neutral-500 break-all">{auth.message}</p>
      </div>
    )
  }
  return <Tenants />
}

export default function App() {
  return (
    <AuthProvider>
      <main className="min-h-screen">
        <Gate />
      </main>
    </AuthProvider>
  )
}
