/**
 * Settings — shop profile + language, password setup, logout.
 * Phase 3 port: shadcn Form-pattern via react-hook-form + zod, shadcn
 * Select for language, shadcn AlertDialog for logout confirm. Three
 * cards (shop / plan / password) on a clean stack.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { setupPassword, updateShop } from '@/api/auth';
import { getShopMe } from '@/api/reports';
import { useAuth } from '@/store/auth';
import { useTgHaptic } from '@/lib/telegram';
import { fmtDate } from '@/lib/fmt';
import { cn } from '@/lib/utils';

// ── Password form ─────────────────────────────────────────────────────

function passwordSchema(t: (k: string) => string) {
  return z
    .object({
      login: z.string().trim().min(3, t('login.min_login')),
      password: z.string().min(8, t('login.min_password')),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, {
      path: ['confirm'],
      message: t('settings.password_mismatch'),
    });
}

function PasswordSection() {
  const { t } = useTranslation();
  const haptic = useTgHaptic();

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors, isSubmitting, isValid },
  } = useForm<{ login: string; password: string; confirm: string }>({
    resolver: zodResolver(passwordSchema(t)),
    defaultValues: { login: '', password: '', confirm: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async ({ login, password }) => {
    try {
      await setupPassword(login.trim(), password);
      haptic.notify('success');
      toast.success(t('settings.password_ok'));
      resetForm();
    } catch {
      haptic.notify('error');
      toast.error(t('settings.password_failed'));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.password_section')}</CardTitle>
        <p className="text-hint text-text-muted mt-1">{t('settings.password_hint')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field
            id="login"
            label={t('settings.login_label')}
            placeholder={t('settings.login_placeholder')}
            autoComplete="username"
            error={errors.login?.message}
            {...register('login')}
          />
          <Field
            id="password"
            type="password"
            label={t('settings.new_password_label')}
            placeholder={t('settings.new_password_placeholder')}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Field
            id="confirm"
            type="password"
            label={t('settings.confirm_label')}
            placeholder={t('settings.new_password_placeholder')}
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register('confirm')}
          />
          <Button type="submit" disabled={!isValid} loading={isSubmitting}>
            {t('settings.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Tiny <Input>+<Label>+error trio. Local to this page; if reused later we'll
// promote to components/ui/field.tsx.
const Field = (() => {
  type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
    id: string;
    label: string;
    error?: string;
  };
  const Cmp = ({ id, label, error, ...rest }: FieldProps) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...rest} aria-invalid={!!error} />
      {error && (
        <span role="alert" className="text-xs text-danger animate-fade-in">
          {error}
        </span>
      )}
    </div>
  );
  Cmp.displayName = 'Field';
  return Cmp;
})();

// ── Shop section ──────────────────────────────────────────────────────

function ShopSection() {
  const { t, i18n } = useTranslation();
  const haptic = useTgHaptic();
  const qc = useQueryClient();

  const { data: shop } = useQuery({ queryKey: ['shop-me'], queryFn: getShopMe });

  const [shopName, setShopName] = useState('');
  const [lang, setLang] = useState<'ru' | 'uz'>('ru');
  const [dirty, setDirty] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (shop && !synced) {
      setShopName(shop.name);
      setLang(shop.language_default);
      setSynced(true);
    }
  }, [shop, synced]);

  const m = useMutation({
    mutationFn: () => updateShop({ name: shopName.trim(), language_default: lang }),
    onSuccess: () => {
      haptic.notify('success');
      toast.success(t('settings.save_ok'));
      void i18n.changeLanguage(lang);
      qc.invalidateQueries({ queryKey: ['shop-me'] });
      qc.invalidateQueries({ queryKey: ['shops', 'me'] });
      setDirty(false);
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('common.error_load'));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.shop_section')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field
          id="shop_name"
          label={t('settings.shop_name_label')}
          placeholder={t('settings.shop_name_placeholder')}
          value={shopName}
          onChange={(e) => {
            setShopName(e.target.value);
            setDirty(true);
          }}
        />

        <div className="flex flex-col gap-1.5">
          <Label>{t('settings.language_label')}</Label>
          <div className="flex gap-2">
            {(['ru', 'uz'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLang(l);
                  setDirty(true);
                }}
                className={cn(
                  'h-9 px-4 rounded-lg border text-label font-semibold transition-all cursor-pointer',
                  lang === l
                    ? 'bg-accent-faded border-accent/40 text-accent'
                    : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text',
                )}
              >
                {t(`settings.lang_${l}`)}
              </button>
            ))}
          </div>
        </div>

        <Button
          disabled={!dirty || !shopName.trim()}
          loading={m.isPending}
          onClick={() => m.mutate()}
        >
          {t('settings.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Plan section ──────────────────────────────────────────────────────

function PlanSection() {
  const { t } = useTranslation();
  const { data: shop } = useQuery({ queryKey: ['shop-me'], queryFn: getShopMe });
  if (!shop) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.plan_section')}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <Badge variant={shop.plan === 'trial' ? 'warning' : 'success'}>
          {shop.plan === 'trial' ? t('settings.plan_trial') : t('settings.plan_active')}
        </Badge>
        {shop.plan_until && (
          <span className="text-hint text-text-dim">
            {t('settings.plan_until', { date: fmtDate(shop.plan_until) })}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

// ── Account section ───────────────────────────────────────────────────

function AccountSection() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const handleLogout = () => {
    localStorage.setItem('tenant_manual_logout', '1');
    logout();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.account_section')}</CardTitle>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="secondary">
              <LogOut className="size-4" />
              {t('settings.logout')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('logout.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('logout.body')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className="bg-danger hover:bg-danger/90 text-white"
              >
                <LogOut className="size-4" /> {t('common.logout')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function Settings() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 max-w-2xl animate-fade-up">
      <h1 className="text-title font-bold tracking-tight">{t('settings.title')}</h1>
      <ShopSection />
      <PlanSection />
      <PasswordSection />
      <AccountSection />
    </div>
  );
}
