import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../store/auth';
import { getShopMe } from '../api/reports';
import { setupPassword, updateShop } from '../api/auth';
import { useToast } from '../components/ui/Toast';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { LogOut } from 'lucide-react';
import { fmtDate } from '../lib/fmt';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <h2 className="text-body-lg font-bold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { logout } = useAuth();

  const { data: shop } = useQuery({ queryKey: ['shop-me'], queryFn: getShopMe });

  const [shopName, setShopName] = useState('');
  const [lang, setLang]         = useState<'ru' | 'uz'>('ru');
  const [shopDirty, setShopDirty] = useState(false);
  const [synced, setSynced]       = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (shop && !synced) {
      setShopName(shop.name);
      setLang(shop.language_default);
      setSynced(true);
    }
  }, [shop, synced]);

  const shopMutation = useMutation({
    mutationFn: () => updateShop({ name: shopName.trim(), language_default: lang }),
    onSuccess: () => {
      toast.success(t('settings.save_ok'));
      i18n.changeLanguage(lang);
      qc.invalidateQueries({ queryKey: ['shop-me'] });
      setShopDirty(false);
    },
    onError: () => toast.error(t('common.error_load')),
  });

  const [login, setLogin]       = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirmPass, setConfirm] = useState('');
  const [passErr, setPassErr]   = useState('');

  const passMutation = useMutation({
    mutationFn: () => setupPassword(login.trim(), newPass),
    onSuccess: () => { toast.success(t('settings.password_ok')); setLogin(''); setNewPass(''); setConfirm(''); setPassErr(''); },
    onError: () => toast.error(t('settings.password_failed')),
  });

  const handlePassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setPassErr(t('settings.password_mismatch')); return; }
    setPassErr('');
    passMutation.mutate();
  };

  const handleLogout = () => { localStorage.setItem('tenant_manual_logout', '1'); logout(); };

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h1 className="text-title font-bold tracking-tight">{t('settings.title')}</h1>

      <Section title={t('settings.shop_section')}>
        <Input label={t('settings.shop_name_label')} placeholder={t('settings.shop_name_placeholder')}
          value={shopName} onChange={(e) => { setShopName(e.target.value); setShopDirty(true); }} />
        <div className="flex flex-col gap-1.5">
          <label className="text-label text-text-dim font-medium">{t('settings.language_label')}</label>
          <div className="flex gap-2">
            {(['ru', 'uz'] as const).map((l) => (
              <button key={l} type="button" onClick={() => { setLang(l); setShopDirty(true); }}
                className={`h-9 px-4 rounded-lg border text-label font-semibold transition-all cursor-pointer
                  ${lang === l ? 'bg-accent-faded border-accent/40 text-accent' : 'bg-bg2 border-border text-text-dim'}`}>
                {t(`settings.lang_${l}`)}
              </button>
            ))}
          </div>
        </div>
        <Button size="md" disabled={!shopDirty || !shopName.trim()} loading={shopMutation.isPending}
          onClick={() => shopMutation.mutate()}>{t('settings.save')}</Button>
      </Section>

      {shop && (
        <Section title={t('settings.plan_section')}>
          <div className="flex items-center justify-between">
            <span className="text-body font-semibold">
              {shop.plan === 'trial' ? t('settings.plan_trial') : t('settings.plan_active')}
            </span>
            {shop.plan_until && (
              <span className="text-hint text-text-dim">{t('settings.plan_until', { date: fmtDate(shop.plan_until) })}</span>
            )}
          </div>
        </Section>
      )}

      <Section title={t('settings.password_section')}>
        <p className="text-hint text-text-muted">{t('settings.password_hint')}</p>
        <form onSubmit={handlePassSubmit} className="flex flex-col gap-3">
          <Input label={t('settings.login_label')} placeholder={t('settings.login_placeholder')}
            autoComplete="username" autoCapitalize="none" value={login}
            onChange={(e) => setLogin(e.target.value)} />
          <Input label={t('settings.new_password_label')} placeholder={t('settings.new_password_placeholder')}
            type="password" autoComplete="new-password" value={newPass}
            onChange={(e) => setNewPass(e.target.value)} />
          <Input label={t('settings.confirm_label')} placeholder={t('settings.new_password_placeholder')}
            type="password" autoComplete="new-password" error={passErr} value={confirmPass}
            onChange={(e) => { setConfirm(e.target.value); if (passErr) setPassErr(''); }} />
          <Button type="submit" size="md" disabled={!login || newPass.length < 8 || !confirmPass}
            loading={passMutation.isPending}>{t('settings.save')}</Button>
        </form>
      </Section>

      <Section title={t('settings.account_section')}>
        <Button variant="secondary" size="md" onClick={() => setConfirmLogout(true)}>
          {t('settings.logout')}
        </Button>
      </Section>

      <Modal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title={t('logout.title')}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setConfirmLogout(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              full
              icon={<LogOut size={15} />}
              onClick={() => { setConfirmLogout(false); handleLogout(); }}
            >
              {t('common.logout')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-dim leading-relaxed">{t('logout.body')}</p>
      </Modal>
    </div>
  );
}
