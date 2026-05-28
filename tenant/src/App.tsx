import { AuthProvider, useAuth } from './lib/auth'
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

  // Super-admins use the separate admin app (different URL/origin).
  if (auth.user.role === 'super_admin') {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Это страница владельцев магазинов</h1>
        <p className="text-sm text-neutral-400">
          Ты вошёл как super-admin. Управление tenant'ами — в отдельной админ-панели.
        </p>
        <p className="text-xs text-neutral-600">
          Локально: <code className="text-neutral-300">http://localhost:5180</code>
        </p>
      </div>
    )
  }

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
