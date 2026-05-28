import type { User } from '../lib/auth'

export default function OwnerHome({ user }: { user: User }) {
  const displayName =
    user.tg_username ? `@${user.tg_username}` : user.tg_first_name || `user#${user.id}`

  return (
    <div className="mx-auto max-w-lg space-y-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Malika v2</h1>
      <p className="text-neutral-200">Привет, {displayName}!</p>
      <p className="text-sm text-neutral-500">
        Tenant #{user.tenant_id} · role: {user.role}
      </p>
      <p className="text-xs text-neutral-600">
        Бизнес-фичи (закупка, продажа, склад, контрагенты) — следующий шаг.
      </p>
    </div>
  )
}
