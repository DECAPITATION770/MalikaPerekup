import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createShop } from '../api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { ArrowLeft, ChevronDown, Lock } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Минимум 2 символа').max(120),
  language_default: z.enum(['ru', 'uz']),
  owner_full_name: z.string().min(1, 'Обязательное поле').max(120),
  owner_tg_id: z.string().optional(),
  owner_tg_username: z.string().optional(),
  owner_phone: z.string().optional(),
  owner_login: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]*$/, 'Только буквы, цифры, _ . -')
    .max(64)
    .optional()
    .or(z.literal('')),
  owner_password: z.string().max(128).optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.owner_login && data.owner_login.length > 0 && data.owner_login.length < 3) {
    ctx.addIssue({ code: 'too_small', minimum: 3, type: 'string', inclusive: true, message: 'Минимум 3 символа', path: ['owner_login'] });
  }
  if (data.owner_password && data.owner_password.length > 0 && data.owner_password.length < 8) {
    ctx.addIssue({ code: 'too_small', minimum: 8, type: 'string', inclusive: true, message: 'Минимум 8 символов', path: ['owner_password'] });
  }
  // Cross-field: owner needs at least one auth method (Telegram ID or login)
  const hasTg = !!data.owner_tg_id?.trim();
  const hasLogin = !!data.owner_login?.trim();
  if (!hasTg && !hasLogin) {
    ctx.addIssue({ code: 'custom', message: 'auth_required', path: ['owner_tg_id'] });
  }
  // If login is provided, password must be too (and vice versa)
  if (hasLogin && !data.owner_password?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'password_required_with_login', path: ['owner_password'] });
  }
  if (data.owner_password?.trim() && !hasLogin) {
    ctx.addIssue({ code: 'custom', message: 'login_required_with_password', path: ['owner_login'] });
  }
});

type FormValues = z.infer<typeof schema>;

export default function CreateShop() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [credsOpen, setCredsOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { language_default: 'ru' },
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  const lang = watch('language_default');

  // Translate custom zod messages (auth_required etc.) into i18n strings
  // Auto-expand creds accordion when login/password has an error after submit
  useEffect(() => {
    if (errors.owner_login || errors.owner_password) setCredsOpen(true);
  }, [errors.owner_login, errors.owner_password]);

  const errMsg = (key: keyof FormValues): string | undefined => {
    const m = errors[key]?.message;
    if (!m) return undefined;
    if (m === 'auth_required') return t('create_shop.auth_required');
    if (m === 'password_required_with_login') return t('create_shop.password_required_with_login');
    if (m === 'login_required_with_password') return t('create_shop.login_required_with_password');
    return m;
  };

  const mut = useMutation({
    mutationFn: (values: FormValues) => createShop({
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
      toast.error(status === 409 ? t('create_shop.error_conflict') : t('create_shop.error_generic'));
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-6 max-w-xl w-full mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 fia">
          <button
            onClick={() => navigate('/shops')}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-text-dim hover:text-text hover:bg-bg3 transition-colors border border-border shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[19px] font-bold tracking-tight">{t('create_shop.title')}</h1>
        </div>

        <form id="create-shop-form" onSubmit={handleSubmit(v => mut.mutate(v))} className="flex flex-col gap-4" noValidate>
          {/* Shop section */}
          <div className="bg-bg3 rounded-2xl border border-border p-5 flex flex-col gap-4 fia fia-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">{t('create_shop.shop_section')}</div>

            <Input
              label={t('create_shop.shop_name')}
              placeholder="Malika Electronics"
              required
              error={errMsg('name')}
              {...register('name')}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] text-text-dim font-medium">{t('create_shop.language')}</label>
              <div className="flex rounded-xl overflow-hidden border border-border bg-bg2 h-12">
                {(['ru', 'uz'] as const).map(l => (
                  <button
                    type="button"
                    key={l}
                    onClick={() => setValue('language_default', l)}
                    className={`flex-1 border-none text-sm font-bold transition-colors cursor-pointer ${
                      lang === l ? 'bg-accent text-white' : 'bg-transparent text-text-dim hover:text-text'
                    }`}
                  >
                    {l === 'ru' ? t('create_shop.lang_ru') : t('create_shop.lang_uz')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Owner section */}
          <div className="bg-bg3 rounded-2xl border border-border p-5 flex flex-col gap-4 fia fia-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">{t('create_shop.owner_section')}</div>

            <Input
              label={t('create_shop.owner_name')}
              placeholder="Иванов Иван Иванович"
              required
              error={errMsg('owner_full_name')}
              {...register('owner_full_name')}
            />

            <div className="grid grid-cols-2 gap-3">
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

            <p className="text-[12px] text-text-muted leading-relaxed">
              {t('create_shop.tg_id_required_hint')}
            </p>
          </div>

          {/* Optional credentials — collapsed */}
          <div className="bg-bg3 rounded-2xl border border-border overflow-hidden fia fia-3">
            <button
              type="button"
              onClick={() => setCredsOpen(o => !o)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-bg2 transition-colors cursor-pointer"
              aria-expanded={credsOpen}
            >
              <Lock size={16} className="text-text-dim shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{t('create_shop.creds_section')}</div>
                <div className="text-xs text-text-muted mt-0.5">{t('create_shop.creds_hint')}</div>
              </div>
              <ChevronDown
                size={16}
                className="text-text-dim shrink-0 transition-transform"
                style={{ transform: credsOpen ? 'rotate(180deg)' : 'none' }}
              />
            </button>
            {credsOpen && (
              <div className="border-t border-border px-5 py-4 grid grid-cols-2 gap-3 fia">
                <Input
                  label={t('create_shop.owner_login')}
                  placeholder="owner123"
                  error={errMsg('owner_login')}
                  autoComplete="off"
                  {...register('owner_login')}
                />
                <Input
                  label={t('create_shop.owner_password')}
                  type="password"
                  placeholder="••••••••"
                  error={errMsg('owner_password')}
                  autoComplete="new-password"
                  {...register('owner_password')}
                />
              </div>
            )}
          </div>

          {mut.isError && (
            <div role="alert" className="text-sm text-danger bg-[#3D1414] border border-[#7A2828] rounded-xl px-4 py-3 fia">
              {(mut.error as { response?: { status?: number } }).response?.status === 409
                ? t('create_shop.error_conflict')
                : t('create_shop.error_generic')}
            </div>
          )}
        </form>
      </div>

      {/* Sticky bottom CTA */}
      <div className="sticky bottom-0 bg-bg/90 backdrop-blur-md border-t border-border p-4 z-10">
        <div className="max-w-xl mx-auto flex gap-3">
          <Button variant="secondary" size="lg" onClick={() => navigate('/shops')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-shop-form" loading={mut.isPending} full size="lg">
            {t('create_shop.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
