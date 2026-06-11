/**
 * Create-shop page — single form with three sections: shop, owner,
 * optional credentials. Validation uses zod + react-hook-form; cross-
 * field rules ensure the owner has at least one auth method (Telegram
 * id OR login+password).
 *
 * Layout: scrollable form fills the column; a sticky bottom CTA bar
 * keeps "Cancel" and "Create" reachable without scrolling.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Lock } from 'lucide-react';

import { createShop } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { cn } from '@/lib/utils';

/** Validation errors carry i18n keys (not user-visible text) so the page can
 *  translate them at render time. Bare `errMsg` builds the actual message. */
const schema = z
  .object({
    name: z.string().min(2, 'min_2_chars').max(120),
    language_default: z.enum(['ru', 'uz']),
    owner_full_name: z.string().min(1, 'required').max(120),
    owner_tg_id: z.string().optional(),
    owner_tg_username: z.string().optional(),
    owner_phone: z.string().optional(),
    owner_login: z
      .string()
      .regex(/^[a-zA-Z0-9_.-]*$/, 'login_chars')
      .max(64)
      .optional()
      .or(z.literal('')),
    owner_password: z.string().max(128).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.owner_login && data.owner_login.length > 0 && data.owner_login.length < 3) {
      ctx.addIssue({
        code: 'too_small',
        minimum: 3,
        type: 'string',
        inclusive: true,
        message: 'min_3_chars',
        path: ['owner_login'],
      });
    }
    if (data.owner_password && data.owner_password.length > 0 && data.owner_password.length < 8) {
      ctx.addIssue({
        code: 'too_small',
        minimum: 8,
        type: 'string',
        inclusive: true,
        message: 'min_8_chars',
        path: ['owner_password'],
      });
    }
    const hasTg = !!data.owner_tg_id?.trim();
    const hasLogin = !!data.owner_login?.trim();
    if (!hasTg && !hasLogin) {
      ctx.addIssue({ code: 'custom', message: 'auth_required', path: ['owner_tg_id'] });
    }
    if (hasLogin && !data.owner_password?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'password_required_with_login',
        path: ['owner_password'],
      });
    }
    if (data.owner_password?.trim() && !hasLogin) {
      ctx.addIssue({
        code: 'custom',
        message: 'login_required_with_password',
        path: ['owner_login'],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export default function CreateShop() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [credsOpen, setCredsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { language_default: 'ru' },
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  const lang = watch('language_default');

  // Auto-expand creds section once a related error appears after submit
  useEffect(() => {
    if (errors.owner_login || errors.owner_password) setCredsOpen(true);
  }, [errors.owner_login, errors.owner_password]);

  /** Map an internal validation key to its translated string. */
  const errMsg = (key: keyof FormValues): string | undefined => {
    const m = errors[key]?.message;
    if (!m) return undefined;
    const map: Record<string, string> = {
      required: t('create_shop.required'),
      min_2_chars: t('create_shop.min_2_chars'),
      min_3_chars: t('create_shop.min_3_chars'),
      min_8_chars: t('create_shop.min_8_chars'),
      login_chars: t('create_shop.login_chars'),
      auth_required: t('create_shop.auth_required'),
      password_required_with_login: t('create_shop.password_required_with_login'),
      login_required_with_password: t('create_shop.login_required_with_password'),
    };
    return map[m] ?? m;
  };

  const mut = useMutation({
    mutationFn: (values: FormValues) =>
      createShop({
        name: values.name,
        language_default: values.language_default,
        owner_full_name: values.owner_full_name,
        owner_tg_id: values.owner_tg_id ? Number(values.owner_tg_id) : null,
        owner_tg_username: values.owner_tg_username || null,
        owner_phone: values.owner_phone || null,
        owner_login: values.owner_login || null,
        owner_password: values.owner_password || null,
      }),
    onSuccess: (shop) => {
      qc.invalidateQueries({ queryKey: ['shops'] });
      toast.success(t('create_shop.toast_created', { name: shop.name }));
      navigate(`/shops/${shop.id}`);
    },
    onError: (e: unknown) => {
      const status = (e as { response?: { status?: number } }).response?.status;
      toast.error(
        status === 409 ? t('create_shop.error_conflict') : t('create_shop.error_generic'),
      );
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 p-6 pb-32 md:p-8">
        {/* Header */}
        <header className="fia mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/shops')}
            aria-label={t('shop_detail.back')}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-bg2 text-text-dim transition-colors hover:bg-bg3 hover:text-text"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
          <h1 className="text-subhead font-bold tracking-tight">
            {t('create_shop.title')}
          </h1>
        </header>

        <form
          id="create-shop-form"
          onSubmit={handleSubmit((v) => mut.mutate(v))}
          className="flex max-w-2xl flex-col gap-4"
          noValidate
        >
          {/* Shop section */}
          <section className="card fia fia-1 flex flex-col gap-4 p-5">
            <div className="text-hint font-semibold tracking-tight text-text-dim">
              {t('create_shop.shop_section')}
            </div>

            <Input
              label={t('create_shop.shop_name')}
              placeholder="Malika Electronics"
              required
              error={errMsg('name')}
              {...register('name')}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-hint font-medium tracking-tight text-text-dim">
                {t('create_shop.language')}
              </label>
              <div className="flex h-11 overflow-hidden rounded-lg border border-border bg-bg2">
                {(['ru', 'uz'] as const).map((l) => (
                  <button
                    type="button"
                    key={l}
                    onClick={() => setValue('language_default', l)}
                    className={cn(
                      'flex-1 cursor-pointer text-label font-bold transition-colors',
                      lang === l
                        ? 'bg-accent text-accent-fg'
                        : 'bg-transparent text-text-dim hover:text-text',
                    )}
                  >
                    {l === 'ru' ? t('create_shop.lang_ru') : t('create_shop.lang_uz')}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Owner section */}
          <section className="card fia fia-2 flex flex-col gap-4 p-5">
            <div className="text-hint font-semibold tracking-tight text-text-dim">
              {t('create_shop.owner_section')}
            </div>

            <Input
              label={t('create_shop.owner_name')}
              placeholder="Иванов Иван Иванович"
              required
              error={errMsg('owner_full_name')}
              {...register('owner_full_name')}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={t('create_shop.owner_tg_id')}
                placeholder="123456789"
                inputMode="numeric"
                hint={t('create_shop.owner_tg_id_hint')}
                error={errMsg('owner_tg_id')}
                {...register('owner_tg_id')}
              />
              <Input
                label={t('create_shop.owner_tg_username')}
                placeholder="username"
                left={<span className="text-text-muted">@</span>}
                {...register('owner_tg_username')}
              />
            </div>

            <Input
              label={t('create_shop.owner_phone')}
              placeholder="+998 99 123 45 67"
              type="tel"
              {...register('owner_phone')}
            />

            <p className="leading-relaxed text-caption text-text-muted">
              {t('create_shop.tg_id_required_hint')}
            </p>
          </section>

          {/* Optional credentials — collapsible */}
          <section className="card fia fia-3 overflow-hidden">
            <button
              type="button"
              onClick={() => setCredsOpen((o) => !o)}
              aria-expanded={credsOpen}
              className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-bg3"
            >
              <Lock size={16} className="shrink-0 text-text-dim" aria-hidden />
              <div className="flex-1">
                <div className="text-label font-semibold">
                  {t('create_shop.creds_section')}
                </div>
                <div className="mt-0.5 text-caption text-text-muted">
                  {t('create_shop.creds_hint')}
                </div>
              </div>
              <ChevronDown
                size={16}
                className={cn(
                  'shrink-0 text-text-dim transition-transform',
                  credsOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-200',
                credsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-1 gap-3 border-t border-border px-5 py-4 sm:grid-cols-2">
                  <Input
                    label={t('create_shop.owner_login')}
                    placeholder="owner123"
                    autoComplete="off"
                    error={errMsg('owner_login')}
                    {...register('owner_login')}
                  />
                  <Input
                    label={t('create_shop.owner_password')}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    error={errMsg('owner_password')}
                    {...register('owner_password')}
                  />
                </div>
              </div>
            </div>
          </section>

          {mut.isError && (
            <div
              role="alert"
              className="fia rounded-lg border border-danger/30 bg-danger-faded px-4 py-3 text-label text-danger"
            >
              {(mut.error as { response?: { status?: number } }).response?.status === 409
                ? t('create_shop.error_conflict')
                : t('create_shop.error_generic')}
            </div>
          )}
        </form>
      </div>

      {/* Sticky bottom CTA */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-bg/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Button variant="secondary" size="lg" onClick={() => navigate('/shops')}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-shop-form"
            loading={mut.isPending}
            full
            size="lg"
          >
            {t('create_shop.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
