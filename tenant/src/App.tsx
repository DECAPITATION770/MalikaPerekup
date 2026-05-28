import { AuthProvider, useAuth } from './lib/auth'
import { isInTelegram } from './lib/telegram'

function Content() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <p className="text-neutral-400">Загрузка…</p>
  }
  if (auth.status === 'error') {
    return (
      <div className="space-y-2 text-center">
        <p className="text-red-400">Ошибка авторизации</p>
        <p className="text-xs text-neutral-500 break-all max-w-md">{auth.message}</p>
      </div>
    )
  }

  const { user } = auth
  const displayName =
    user.tg_username && user.tg_username !== 'devuser'
      ? `@${user.tg_username}`
      : user.tg_first_name || `user#${user.id}`

  return (
    <div className="text-center space-y-3">
      <h1 className="text-3xl font-semibold">Malika v2</h1>
      <p className="text-base text-neutral-200">Привет, {displayName}!</p>
      <p className="text-xs text-neutral-500">
        {isInTelegram() ? 'Открыто в Telegram' : 'Открыто в браузере (DEV_AUTH_BYPASS)'}
        {' · user_id='}
        {user.id}
      </p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <main className="min-h-screen flex items-center justify-center p-8">
        <Content />
      </main>
    </AuthProvider>
  )
}
