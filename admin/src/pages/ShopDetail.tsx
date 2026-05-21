import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getShop, freezeShop, unfreezeShop, updateShop, setOwnerCredentials } from '../api';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/Skeleton';
import QueryError from '../components/ui/QueryError';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { fmtUZS, fmtDate, fmtRelative, planLabel } from '../lib/fmt';
import { useNow } from '../lib/useNow';
import { useToast } from '../components/ui/Toast';
import { ArrowLeft, Snowflake, Sun, RefreshCw, Key, Send, Lock, Bot, Shield, HelpCircle } from 'lucide-react';

const SOURCE_KEYS = ['telegram', 'password', 'bot_start', 'admin'] as const;
type SourceKey = typeof SOURCE_KEYS[number];

const SOURCE_ICONS: Record<SourceKey, { Icon: typeof Send; color: string }> = {
  telegram: { Icon: Send, color: 'text-accent' },
  password: { Icon: Lock, color: 'text-text-dim' },
  bot_start: { Icon: Bot, color: 'text-warning' },
  admin: { Icon: Shield, color: 'text-success' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0 gap-3">
      <span className="text-sm text-text-dim shrink-0">{label}</span>
      <span className="text-sm font-semibold text-right truncate">{value ?? '—'}</span>
    </div>
  );
}

function StatCard({ label, value, kind }: { label: string; value: string; kind?: 'green' | 'red' | 'yellow' | 'blue' | 'default' }) {
  const colors = { green: 'text-success', red: 'text-danger', yellow: 'text-warning', blue: 'text-accent', default: 'text-text' };
  return (
    <div className="bg-bg3 rounded-2xl border border-border p-4">
      <div className="text-[11px] text-text-muted font-bold uppercase tracking-[0.6px] mb-2">{label}</div>
      <div className={`text-xl font-bold tracking-tight tabular-nums ${colors[kind || 'default']}`}>{value}</div>
    </div>
  );
}

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  useNow();

  const [freezeModal, setFreezeModal] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [credsModal, setCredsModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [newPlanUntil, setNewPlanUntil] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const shopId = Number(id);

  const { data: shop, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: () => getShop(shopId),
    enabled: !!shopId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['shop', shopId] });

  const freezeMut = useMutation({
    mutationFn: () => freezeShop(shopId, freezeReason || undefined),
    onSuccess: () => {
      setFreezeModal(false);
      setFreezeReason('');
      invalidate();
      toast.success(t('shop_detail.toast_frozen'));
    },
    onError: () => toast.error(t('shop_detail.toast_freeze_failed')),
  });

  const unfreezeMut = useMutation({
    mutationFn: () => unfreezeShop(shopId),
    onSuccess: () => { invalidate(); toast.success(t('shop_detail.toast_unfrozen')); },
    onError: () => toast.error(t('shop_detail.toast_unfreeze_failed')),
  });

  const planMut = useMutation({
    // plan_until: send null when empty so backend clears the field instead of receiving "" → 422
    mutationFn: () => updateShop(shopId, {
      plan: newPlan || undefined,
      plan_until: newPlanUntil ? newPlanUntil : null,
    }),
    onSuccess: () => { setPlanModal(false); invalidate(); toast.success(t('shop_detail.toast_plan_updated')); },
    onError: () => toast.error(t('shop_detail.toast_plan_failed')),
  });

  const credsMut = useMutation({
    mutationFn: () => setOwnerCredentials(shopId, {
      login: newLogin.trim() || undefined,
      password: newPassword || undefined,
    }),
    onSuccess: () => { setCredsModal(false); invalidate(); toast.success(t('shop_detail.toast_creds_updated')); },
    onError: () => toast.error(t('shop_detail.toast_creds_failed')),
  });

  const credsCanSave = newLogin.trim().length > 0 || newPassword.length > 0;
  const credsDirty = newLogin.trim().length > 0 || newPassword.length > 0;
  const freezeDirty = freezeReason.length > 0;

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton />
        </div>
      </div>
    );
  }
  if (isError) return <div className="p-6 max-w-4xl mx-auto"><QueryError onRetry={() => refetch()} error={error} /></div>;
  if (!shop) return <div className="p-6 text-text-dim">{t('shop_detail.not_found')}</div>;

  const sourceKey = (shop.owner.last_login_source && SOURCE_KEYS.includes(shop.owner.last_login_source as SourceKey))
    ? shop.owner.last_login_source as SourceKey
    : null;
  const sourceIcon = sourceKey ? SOURCE_ICONS[sourceKey] : null;
  const sourceLabel = sourceKey
    ? t(`shop_detail.source_${sourceKey}` as const)
    : (shop.owner.last_login_source ? t('shop_detail.source_unknown') : null);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 fia">
        <button
          onClick={() => navigate('/shops')}
          aria-label={t('shop_detail.back')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-text-dim hover:text-text hover:bg-bg3 transition-colors border border-border shrink-0 cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{shop.name}</h1>
          <div className="text-sm text-text-dim">#{shop.id} · {t('shop_detail.created_at_short')} {fmtDate(shop.created_at)}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge kind={shop.is_frozen ? 'red' : 'green'} dot>
            {shop.is_frozen ? t('shops.frozen') : t('shops.active')}
          </Badge>
          <Badge kind="blue">{planLabel(shop.plan)}</Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 fia fia-1">
        <StatCard label={t('shop_detail.devices_in_stock')} value={String(shop.stats.devices_in_stock)} kind="blue" />
        <StatCard label={t('shop_detail.sales_total')} value={fmtUZS(shop.stats.sales_total_uzs)} kind="green" />
        <StatCard label={t('shop_detail.profit_total')} value={fmtUZS(shop.stats.profit_total_uzs)} kind="green" />
        <StatCard label={t('shop_detail.inventory_value')} value={fmtUZS(shop.stats.inventory_value_uzs)} />
        <StatCard label={t('shop_detail.nasiya_plans')} value={String(shop.stats.nasiya_active_plans)} />
        <StatCard label={t('shop_detail.nasiya_debt')} value={fmtUZS(shop.stats.nasiya_debt_uzs)} kind={Number(shop.stats.nasiya_debt_uzs) > 0 ? 'yellow' : 'default'} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 fia fia-2">
        <div className="bg-bg3 rounded-2xl border border-border px-5 pt-4 pb-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-3">{t('shop_detail.shop_section')}</div>
          <Row label={t('shop_detail.plan_label')} value={<Badge kind="blue" size="sm">{planLabel(shop.plan)}</Badge>} />
          <Row label={t('shop_detail.plan_until')} value={shop.plan_until ? fmtDate(shop.plan_until) : '—'} />
          {shop.is_frozen && (
            <>
              <Row label={t('shop_detail.frozen_at')} value={shop.frozen_at ? fmtRelative(shop.frozen_at) : '—'} />
              <Row label={t('shop_detail.freeze_reason_label')} value={<span className="text-danger">{shop.frozen_reason || '—'}</span>} />
            </>
          )}
        </div>

        <div className="bg-bg3 rounded-2xl border border-border px-5 pt-4 pb-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-3">{t('shop_detail.owner_label')}</div>
          <Row label={t('shop_detail.owner_label') === 'Egasi' ? 'F.I.O.' : 'ФИО'} value={shop.owner.full_name} />
          <Row label={t('shop_detail.tg_username')} value={shop.owner.tg_username ? `@${shop.owner.tg_username}` : '—'} />
          <Row label={t('shop_detail.phone')} value={shop.owner.phone} />
          <Row label={t('shop_detail.login')} value={shop.owner.login} />
          <Row label={t('shop_detail.has_password')} value={
            <Badge kind={shop.owner.has_password ? 'green' : 'gray'} size="sm">
              {shop.owner.has_password ? t('common.yes') : t('common.no')}
            </Badge>
          } />
          <Row label={t('shop_detail.last_login')} value={
            <span className="flex items-center gap-1.5 justify-end">
              {sourceIcon ? <sourceIcon.Icon size={12} className={sourceIcon.color} /> : sourceLabel ? <HelpCircle size={12} className="text-text-muted" /> : null}
              {fmtRelative(shop.owner.last_login_at)}
              {sourceLabel && <span className="text-text-muted text-xs">({sourceLabel})</span>}
            </span>
          } />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 fia fia-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setNewPlan(shop.plan); setNewPlanUntil(shop.plan_until ?? ''); setPlanModal(true); }}>
            <RefreshCw size={15} /> {t('shop_detail.change_plan_btn')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setNewLogin(shop.owner.login ?? ''); setNewPassword(''); setCredsModal(true); }}>
            <Key size={15} /> {t('shop_detail.set_creds_btn')}
          </Button>
        </div>
        {shop.is_frozen ? (
          <Button variant="secondary" size="sm" loading={unfreezeMut.isPending} onClick={() => unfreezeMut.mutate()}>
            <Sun size={15} /> {t('shop_detail.unfreeze_btn')}
          </Button>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setFreezeModal(true)}>
            <Snowflake size={15} /> {t('shop_detail.freeze_btn')}
          </Button>
        )}
      </div>

      {/* Freeze modal */}
      <Modal
        open={freezeModal}
        onClose={() => { setFreezeModal(false); setFreezeReason(''); }}
        title={t('shop_detail.confirm_freeze')}
        dirty={freezeDirty}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setFreezeModal(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" full loading={freezeMut.isPending} onClick={() => freezeMut.mutate()}>
              <Snowflake size={15} /> {t('shop_detail.freeze_btn')}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-text-muted mb-3">{t('shop_detail.freeze_warning')}</p>
        <Input
          label={t('shop_detail.freeze_reason_label')}
          placeholder={t('shop_detail.freeze_placeholder')}
          value={freezeReason}
          onChange={e => setFreezeReason(e.target.value)}
        />
      </Modal>

      {/* Plan modal */}
      <Modal
        open={planModal}
        onClose={() => setPlanModal(false)}
        title={t('shop_detail.change_plan_btn')}
        dirty={!!shop && (newPlan !== shop.plan || newPlanUntil !== (shop.plan_until ?? ''))}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setPlanModal(false)}>{t('common.cancel')}</Button>
            <Button full loading={planMut.isPending} onClick={() => planMut.mutate()}>{t('common.save')}</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] text-text-dim font-medium">{t('shop_detail.plan_label')}</label>
            <div className="flex rounded-xl overflow-hidden border border-border bg-bg2 h-12">
              {['trial', 'basic', 'business'].map(p => (
                <button
                  key={p}
                  onClick={() => setNewPlan(p)}
                  className={`flex-1 border-none text-sm font-bold transition-colors cursor-pointer ${
                    newPlan === p ? 'bg-accent text-white' : 'bg-transparent text-text-dim hover:text-text'
                  }`}
                >
                  {planLabel(p)}
                </button>
              ))}
            </div>
          </div>
          <Input
            label={t('shop_detail.plan_until')}
            type="date"
            value={newPlanUntil}
            onChange={e => setNewPlanUntil(e.target.value)}
            hint={t('shop_detail.plan_until_hint')}
          />
        </div>
      </Modal>

      {/* Credentials modal */}
      <Modal
        open={credsModal}
        onClose={() => { setCredsModal(false); setNewLogin(''); setNewPassword(''); }}
        title={t('shop_detail.set_creds_btn')}
        dirty={credsDirty}
        footer={
          <div className="flex flex-col gap-2">
            {!credsCanSave && (
              <p className="text-xs text-text-muted text-center">{t('common.required_at_least_one')}</p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" full onClick={() => { setCredsModal(false); setNewLogin(''); setNewPassword(''); }}>{t('common.cancel')}</Button>
              <Button full loading={credsMut.isPending} disabled={!credsCanSave} onClick={() => credsMut.mutate()}>{t('common.save')}</Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t('shop_detail.login')}
            placeholder="owner_login"
            value={newLogin}
            onChange={e => setNewLogin(e.target.value)}
            autoComplete="off"
          />
          <Input
            label={t('shop_detail.password_new')}
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            hint={t('shop_detail.password_hint')}
            autoComplete="new-password"
          />
        </div>
      </Modal>
    </div>
  );
}
