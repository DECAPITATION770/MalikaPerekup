import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '../lib/api'

type Owner = {
  id: number
  tg_id: number | null
  tg_username: string | null
  tg_first_name: string | null
}

type Tenant = {
  id: number
  name: string
  is_active: boolean
  created_at: string
  suspended_at: string | null
  owner: Owner | null
}

type CreatePayload = {
  name: string
  owner_tg_id?: number
  owner_tg_username?: string
}

function ownerLabel(owner: Owner | null): string {
  if (!owner) return '—'
  if (owner.tg_username) return `@${owner.tg_username}`
  if (owner.tg_id !== null) return `tg_id ${owner.tg_id}`
  return `user #${owner.id}`
}

function CreateForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'tg_id' | 'username'>('username')
  const [identifier, setIdentifier] = useState('')

  const mutation = useMutation({
    mutationFn: (payload: CreatePayload) =>
      api<Tenant>('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setName('')
      setIdentifier('')
      onSuccess()
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedId = identifier.trim().replace(/^@/, '')
    if (!trimmedName || !trimmedId) return

    const payload: CreatePayload = { name: trimmedName }
    if (mode === 'tg_id') {
      const parsed = Number.parseInt(trimmedId, 10)
      if (!Number.isFinite(parsed)) {
        mutation.reset()
        return
      }
      payload.owner_tg_id = parsed
    } else {
      payload.owner_tg_username = trimmedId
    }
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-neutral-800 p-4">
      <h2 className="text-lg font-semibold">Создать tenant</h2>

      <label className="block">
        <span className="text-xs text-neutral-400">Название магазина</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2"
          placeholder="Galaxy Mobile"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs text-neutral-400">Привязать владельца по:</legend>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={mode === 'username'}
              onChange={() => setMode('username')}
            />
            @username
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={mode === 'tg_id'}
              onChange={() => setMode('tg_id')}
            />
            tg_id (число)
          </label>
        </div>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2"
          placeholder={mode === 'username' ? '@johndoe' : '123456789'}
        />
      </fieldset>

      {mutation.isError ? (
        <p className="text-sm text-red-400 break-all">{(mutation.error as Error).message}</p>
      ) : null}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium"
      >
        {mutation.isPending ? 'Создаю…' : 'Создать'}
      </button>
    </form>
  )
}

export default function AdminTenants() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api<Tenant[]>('/api/admin/tenants'),
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Super-admin · Tenants</h1>
        <p className="text-sm text-neutral-400">Создавай и просматривай магазины-подписчиков.</p>
      </header>

      <CreateForm onSuccess={() => void qc.invalidateQueries({ queryKey: ['tenants'] })} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Список ({data?.length ?? 0})</h2>
        {isLoading ? <p className="text-neutral-400">Загрузка…</p> : null}
        {error ? (
          <p className="text-red-400">Ошибка: {(error as Error).message}</p>
        ) : null}
        {data && data.length === 0 ? (
          <p className="text-neutral-500 text-sm">Пока пусто. Создай первый tenant выше.</p>
        ) : null}
        {data && data.length > 0 ? (
          <ul className="space-y-2">
            {data.map((t) => (
              <li
                key={t.id}
                className="rounded border border-neutral-800 p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-neutral-500">
                    #{t.id} · {ownerLabel(t.owner)} · {t.is_active ? '🟢 active' : '🔴 suspended'}
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
