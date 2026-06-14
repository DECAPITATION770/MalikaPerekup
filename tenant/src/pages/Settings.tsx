/**
 * Settings — shop profile + language, password setup, logout.
 * Phase 3 port: shadcn Form-pattern via react-hook-form + zod, shadcn
 * Select for language, shadcn AlertDialog for logout confirm. Three
 * cards (shop / plan / password) on a clean stack.
 */
import { forwardRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Bell, BellOff, CalendarClock, CircleAlert, LogOut, Wallet } from 'lucide-react';

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
import { Switch } from '@/components/ui/switch';

import { getMe, setupPassword, updateNotificationPrefs, updateShop } from '@/api/auth';
import { getShopMe } from '@/api/reports';
import { useAuth } from '@/store/auth';
import { useTgHaptic } from '@/lib/telegram';
import { fmtDate } from '@/lib/fmt';
import { cn } from '@/lib/utils';
import { ThemeSegmented } from '@/components/ThemeToggle';

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
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

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

  // Prefill the saved login so it persists across visits (was always blank).
  useEffect(() => {
    if (me?.login) resetForm({ login: me.login, password: '', confirm: '' });
  }, [me?.login, resetForm]);

  const onSubmit = handleSubmit(async ({ login, password }) => {
    try {
      await setupPassword(login.trim(), password);
      haptic.notify('success');
      toast.success(t('settings.password_ok'));
      // Keep the (now saved) login visible; only clear the password fields.
      resetForm({ login: login.trim(), password: '', confirm: '' });
      qc.invalidateQueries({ queryKey: ['me'] });
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

// Tiny <Input>+<Label>+error trio. forwardRef so react-hook-form's
// register() ref reaches the underlying <input> (otherwise: "Function
// components cannot be given refs" + no focus-on-error).
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}
const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, error, ...rest },
  ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} ref={ref} {...rest} aria-invalid={!!error} />
      {error && (
        <span role="alert" className="text-hint text-danger animate-fade-in">
          {error}
        </span>
      )}
    </div>
  );
});

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
      // Persist so the choice survives a reload (matches header/sidebar togglers).
      localStorage.setItem('tenant_lang', lang);
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

// ── Appearance section ────────────────────────────────────────────────

function AppearanceSection() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.appearance_section')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <Label>{t('settings.theme_label')}</Label>
        <ThemeSegmented />
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

// ── Notifications section ─────────────────────────────────────────────

function NotificationsSection() {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const [enabled, setEnabled] = useState(true);
  const [chatId, setChatId] = useState('');
  const [chatErr, setChatErr] = useState<string | null>(null);

  // Hydrate local state once the user row loads.
  useEffect(() => {
    if (me) {
      setEnabled(me.notifications_enabled);
      setChatId(me.notify_tg_chat_id != null ? String(me.notify_tg_chat_id) : '');
    }
  }, [me]);

  const save = useMutation({
    mutationFn: () => {
      const trimmed = chatId.trim();
      const parsed = trimmed === '' ? null : Number(trimmed);
      return updateNotificationPrefs({ enabled, notify_tg_chat_id: parsed });
    },
    onSuccess: (updated) => {
      haptic.notify('success');
      toast.success(t('settings.notif_saved'));
      qc.setQueryData(['me'], updated);
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('settings.save_failed'));
    },
  });

  const onSave = () => {
    const trimmed = chatId.trim();
    // Allow blank (→ personal DM) or an integer chat id (groups are negative).
    if (trimmed !== '' && !/^-?\d+$/.test(trimmed)) {
      setChatErr(t('settings.notif_chat_invalid'));
      return;
    }
    setChatErr(null);
    save.mutate();
  };

  const types = [
    { icon: Wallet, key: 'settings.notif_type_due' },
    { icon: CircleAlert, key: 'settings.notif_type_overdue' },
    { icon: CalendarClock, key: 'settings.notif_type_daily' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.notifications_section')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Enable toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {enabled ? (
              <Bell size={18} className="text-accent" />
            ) : (
              <BellOff size={18} className="text-text-muted" />
            )}
            <div className="flex flex-col">
              <span className="text-label font-semibold text-text">
                {t('settings.notif_enabled_label')}
              </span>
              <span className="text-hint text-text-muted">{t('settings.notif_enabled_hint')}</span>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {/* What the user gets — makes the feature concrete (was invisible). */}
        {enabled && (
          <ul className="flex flex-col gap-2 rounded-xl bg-bg3 p-3">
            {types.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-2.5 text-caption text-text-dim">
                <Icon size={15} className="shrink-0 text-text-muted" />
                {t(key)}
              </li>
            ))}
          </ul>
        )}

        {/* Bot-not-connected warning — reminders silently fail otherwise. */}
        {enabled && me && !me.tg_connected && (
          <div className="flex items-start gap-2 rounded-xl bg-warning-faded/40 p-3 text-caption text-warning">
            <CircleAlert size={15} className="mt-0.5 shrink-0" />
            {t('settings.notif_not_connected')}
          </div>
        )}

        {/* Connected → reminders auto-deliver to the user's own DM. Make that
            explicit so the chat-id field below reads as an optional override,
            not a required step. */}
        {enabled && me?.tg_connected && (
          <div className="flex items-start gap-2 rounded-xl bg-success-faded/40 p-3 text-caption text-success">
            <Bell size={15} className="mt-0.5 shrink-0" />
            {t('settings.notif_auto_self', {
              at: me.tg_username ? ` (@${me.tg_username})` : '',
            })}
          </div>
        )}

        {/* Optional override chat (advanced) */}
        {enabled && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notif-chat">{t('settings.notif_chat_label')}</Label>
            <Input
              id="notif-chat"
              inputMode="numeric"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder={t('settings.notif_chat_placeholder')}
              autoComplete="off"
            />
            <span className="text-hint text-text-muted">{t('settings.notif_chat_hint')}</span>
            {chatErr && <span className="text-hint text-danger">{chatErr}</span>}
          </div>
        )}

        <Button onClick={onSave} loading={save.isPending} disabled={save.isPending} className="self-start">
          {t('settings.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  return (
    <div className="flex w-full flex-col gap-4 animate-fade-up">
      <h1 className="text-title font-bold tracking-tight">{t('settings.title')}</h1>
      <ShopSection />
      <AppearanceSection />
      <NotificationsSection />
      <PlanSection />
      <PasswordSection />
      <AccountSection />
    </div>
  );
}
