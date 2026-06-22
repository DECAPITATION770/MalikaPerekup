/**
 * Platform admins — list every admin account and add new ones without
 * touching .env. Deactivation is soft (is_active=false): the row stays for
 * the access log, but the admin can no longer sign in. The server refuses to
 * deactivate your own account or the last active admin; the UI mirrors that.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Power, PowerOff, Send, ShieldCheck, UserCog } from 'lucide-react';

import { getAdmins, createAdmin, updateAdmin } from '../api';
import { useAuth } from '../store/auth';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { fmtRelative } from '../lib/fmt';
import { useNow } from '../lib/useNow';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    full_name: z.string().min(1, 'required').max(120),
    tg_id: z.string().optional(),
    tg_username: z.string().optional(),
    login: z
      .string()
      .regex(/^[a-zA-Z0-9_.-]*$/, 'login_chars')
      .max(64)
      .optional()
      .or(z.literal('')),
    password: z.string().max(128).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.login && data.login.length > 0 && data.login.length < 3) {
      ctx.addIssue({ code: 'custom', message: 'min_3_chars', path: ['login'] });
    }
    if (data.password && data.password.length > 0 && data.password.length < 8) {
      ctx.addIssue({ code: 'custom', message: 'min_8_chars', path: ['password'] });
    }
    const hasTg = !!data.tg_id?.trim();
    const hasLogin = !!data.login?.trim();
    if (!hasTg && !hasLogin) {
      ctx.addIssue({ code: 'custom', message: 'auth_required', path: ['tg_id'] });
    }
    if (hasLogin && !data.password?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'password_required_with_login', path: ['password'] });
    }
    if (data.password?.trim() && !hasLogin) {
      ctx.addIssue({ code: 'custom', message: 'login_required_with_password', path: ['login'] });
    }
  });

type FormValues = z.infer<typeof schema>;

export default function Admins() {
  const { t } = useTranslation();
  const { admin: me } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  useNow();

  const { data, isLoading, isError, refetch, error } = useQuery({
    queryKey: ['admins'],
    queryFn: getAdmins,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onBlur' });

  const errMsg = (key: keyof FormValues): string | undefined => {
    const m = errors[key]?.message;
    if (!m) return undefined;
    const map: Record<string, string> = {
      required: t('admins.err_required'),
      min_3_chars: t('admins.err_min_3'),
      min_8_chars: t('admins.err_min_8'),
      login_chars: t('admins.err_login_chars'),
      auth_required: t('admins.err_auth_required'),
      password_required_with_login: t('admins.err_password_required'),
      login_required_with_password: t('admins.err_login_required'),
    };
    return map[m] ?? m;
  };

  const createMut = useMutation({
    mutationFn: (v: FormValues) =>
      createAdmin({
        full_name: v.full_name,
        tg_id: v.tg_id ? Number(v.tg_id) : null,
        tg_username: v.tg_username || null,
        login: v.login || null,
        password: v.password || null,
      }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success(t('admins.created', { name: a.full_name }));
      setOpen(false);
      reset();
    },
    onError: (e: unknown) => {
      const status = (e as { response?: { status?: number } }).response?.status;
      toast.error(status === 409 ? t('admins.err_conflict') : t('admins.err_generic'));
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateAdmin(id, { is_active }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success(vars.is_active ? t('admins.activated') : t('admins.deactivated'));
    },
    onError: (e: unknown) => {
      const status = (e as { response?: { status?: number } }).response?.status;
      toast.error(status === 422 ? t('admins.err_lockout') : t('admins.err_generic'));
    },
  });

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <header className="fia flex items-center justify-between">
        <div>
          <h1 className="text-title font-bold tracking-tight">{t('admins.title')}</h1>
          {data && <p className="mt-0.5 text-hint text-text-dim">{data.length}</p>}
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden /> {t('admins.add')}
        </Button>
      </header>

      <section className="card fia fia-1 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <TableRowSkeleton key={i} cols={3} />
            ))}
          </div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} error={error} />
        ) : !data?.length ? (
          <EmptyState icon={UserCog} label={t('admins.empty')} />
        ) : (
          <div className="divide-y divide-border">
            {data.map((a) => {
              const isSelf = a.id === me?.id;
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[1fr_1fr_120px_44px] items-center gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-faded text-caption font-bold uppercase text-accent">
                      {a.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-label font-semibold">
                        {a.full_name}
                        {isSelf && (
                          <span className="ml-1.5 text-caption font-normal text-text-muted">
                            {t('admins.you')}
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono text-caption text-text-muted">
                        {a.login || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 text-label">
                    {a.tg_username ? (
                      <a
                        href={`https://t.me/${a.tg_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 truncate text-accent hover:underline"
                      >
                        <Send size={12} aria-hidden /> @{a.tg_username}
                      </a>
                    ) : a.tg_id ? (
                      <span className="font-mono text-text-dim">{a.tg_id}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                    <div className="mt-0.5 text-caption text-text-muted">
                      {fmtRelative(a.last_login_at)}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <Badge variant={a.is_active ? 'success' : 'neutral'} size="sm" dot>
                      {a.is_active ? t('admins.active') : t('admins.inactive')}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    {a.is_active ? (
                      <button
                        type="button"
                        title={isSelf ? t('admins.cant_self') : t('admins.deactivate')}
                        aria-label={t('admins.deactivate')}
                        disabled={isSelf || toggleMut.isPending}
                        className="shrink-0 cursor-pointer text-text-dim hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => {
                          if (window.confirm(t('admins.deactivate_confirm', { name: a.full_name }))) {
                            toggleMut.mutate({ id: a.id, is_active: false });
                          }
                        }}
                      >
                        <PowerOff size={16} aria-hidden />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title={t('admins.activate')}
                        aria-label={t('admins.activate')}
                        disabled={toggleMut.isPending}
                        className="shrink-0 cursor-pointer text-text-dim hover:text-success disabled:opacity-40"
                        onClick={() => toggleMut.mutate({ id: a.id, is_active: true })}
                      >
                        <Power size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-accent" aria-hidden />
              {t('admins.add_title')}
            </DialogTitle>
          </DialogHeader>

          <form
            id="create-admin-form"
            onSubmit={handleSubmit((v) => createMut.mutate(v))}
            className="flex flex-col gap-3"
            noValidate
          >
            <Input
              label={t('admins.full_name')}
              placeholder="Иванов Иван"
              required
              error={errMsg('full_name')}
              {...register('full_name')}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('admins.tg_id')}
                placeholder="123456789"
                inputMode="numeric"
                error={errMsg('tg_id')}
                {...register('tg_id')}
              />
              <Input
                label={t('admins.tg_username')}
                placeholder="username"
                left={<span className="text-text-muted">@</span>}
                {...register('tg_username')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('admins.login')}
                placeholder="admin2"
                autoComplete="off"
                error={errMsg('login')}
                {...register('login')}
              />
              <Input
                label={t('admins.password')}
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                error={errMsg('password')}
                {...register('password')}
              />
            </div>
            <p className="leading-relaxed text-caption text-text-muted">
              {t('admins.auth_hint')}
            </p>
          </form>

          <DialogFooter>
            <Button variant="secondary" full onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="create-admin-form" full loading={createMut.isPending}>
              {t('admins.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
