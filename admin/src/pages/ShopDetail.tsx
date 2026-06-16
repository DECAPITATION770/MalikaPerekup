/**
 * Single shop page — admin view with stats, owner info, and 3 admin
 * actions (change plan, set credentials, freeze / unfreeze). The shop
 * id comes from the URL.
 *
 * Modals use the shared `Modal` adapter (Dialog under the hood) so all
 * three flows share the dismiss-confirm behaviour when the user has
 * typed something.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bot,
  HelpCircle,
  Key,
  Lock,
  Phone,
  RefreshCw,
  Send,
  Shield,
  Snowflake,
  Sun,
} from 'lucide-react';

import {
  freezeShop,
  getShop,
  setOwnerCredentials,
  unfreezeShop,
  updateShop,
  updateUserContact,
} from '../api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PlanExpiryBadge } from '../components/PlanExpiryBadge';
import Modal from '../components/ui/Modal';
import QueryError from '../components/ui/QueryError';
import { CardSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { fmtDate, fmtRelative, fmtUZS, planLabel } from '../lib/fmt';
import { useNow } from '../lib/useNow';
import { cn } from '@/lib/utils';

const SOURCE_KEYS = ['telegram', 'password', 'bot_start', 'admin'] as const;
type SourceKey = (typeof SOURCE_KEYS)[number];

const SOURCE_ICONS: Record<SourceKey, { Icon: typeof Send; color: string }> = {
  telegram: { Icon: Send, color: 'text-accent' },
  password: { Icon: Lock, color: 'text-text-dim' },
  bot_start: { Icon: Bot, color: 'text-warning' },
  admin: { Icon: Shield, color: 'text-success' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0">
      <span className="shrink-0 text-label text-text-dim">{label}</span>
      <span className="truncate text-right text-label font-semibold">
        {value ?? '—'}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'accent';
}) {
  const toneClass = {
    default: 'text-text',
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
    accent: 'text-accent',
  }[tone];
  return (
    <div className="card p-4">
      <div className="text-caption font-medium tracking-tight text-text-muted">
        {label}
      </div>
      <div
        className={cn(
          'mt-1.5 text-title-sm font-bold tabular-nums tracking-tight',
          toneClass,
        )}
      >
        {value}
      </div>
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
  const [contactModal, setContactModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [newPlanUntil, setNewPlanUntil] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cNote, setCNote] = useState('');

  const shopId = Number(id);

  const {
    data: shop,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
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
    onSuccess: () => {
      invalidate();
      toast.success(t('shop_detail.toast_unfrozen'));
    },
    onError: () => toast.error(t('shop_detail.toast_unfreeze_failed')),
  });
  const planMut = useMutation({
    mutationFn: () =>
      updateShop(shopId, {
        plan: newPlan || undefined,
        plan_until: newPlanUntil ? newPlanUntil : null,
      }),
    onSuccess: () => {
      setPlanModal(false);
      invalidate();
      toast.success(t('shop_detail.toast_plan_updated'));
    },
    onError: () => toast.error(t('shop_detail.toast_plan_failed')),
  });
  const credsMut = useMutation({
    mutationFn: () =>
      setOwnerCredentials(shopId, {
        login: newLogin.trim() || undefined,
        password: newPassword || undefined,
      }),
    onSuccess: () => {
      setCredsModal(false);
      invalidate();
      toast.success(t('shop_detail.toast_creds_updated'));
    },
    onError: () => toast.error(t('shop_detail.toast_creds_failed')),
  });
  const contactMut = useMutation({
    mutationFn: () =>
      updateUserContact(shop!.owner.id, {
        phone: cPhone.trim() || null,
        admin_contact_note: cNote.trim() || null,
      }),
    onSuccess: () => {
      setContactModal(false);
      invalidate();
      toast.success(t('shop_detail.toast_contact_saved'));
    },
    onError: () => toast.error(t('shop_detail.toast_contact_failed')),
  });

  // A single dirty flag is enough — `credsCanSave` was a duplicate.
  const credsDirty = newLogin.trim().length > 0 || newPassword.length > 0;
  const freezeDirty = freezeReason.length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6 md:p-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-6 md:p-8">
        <QueryError onRetry={() => refetch()} error={error} />
      </div>
    );
  }
  if (!shop) {
    return <div className="p-6 text-text-dim">{t('shop_detail.not_found')}</div>;
  }

  const sourceKey =
    shop.owner.last_login_source &&
    SOURCE_KEYS.includes(shop.owner.last_login_source as SourceKey)
      ? (shop.owner.last_login_source as SourceKey)
      : null;
  const sourceIcon = sourceKey ? SOURCE_ICONS[sourceKey] : null;
  const sourceLabel = sourceKey
    ? t(`shop_detail.source_${sourceKey}` as const)
    : shop.owner.last_login_source
      ? t('shop_detail.source_unknown')
      : null;

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <header className="fia flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/shops')}
          aria-label={t('shop_detail.back')}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-bg2 text-text-dim transition-colors hover:bg-bg3 hover:text-text"
        >
          <ArrowLeft size={18} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-subhead font-bold tracking-tight">
            {shop.name}
          </h1>
          <div className="text-hint text-text-dim">
            #{shop.id} · {t('shop_detail.created_at_short')} {fmtDate(shop.created_at)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={shop.is_frozen ? 'danger' : 'success'} dot>
            {shop.is_frozen ? t('shops.frozen') : t('shops.active')}
          </Badge>
          <Badge variant="accent">{planLabel(shop.plan)}</Badge>
        </div>
      </header>

      {/* Stats */}
      <div className="fia fia-1 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t('shop_detail.devices_in_stock')}
          value={String(shop.stats.devices_in_stock)}
          tone="accent"
        />
        <StatCard
          label={t('shop_detail.sales_total')}
          value={fmtUZS(shop.stats.sales_total_uzs)}
          tone="success"
        />
        <StatCard
          label={t('shop_detail.profit_total')}
          value={fmtUZS(shop.stats.profit_total_uzs)}
          tone="success"
        />
        <StatCard
          label={t('shop_detail.inventory_value')}
          value={fmtUZS(shop.stats.inventory_value_uzs)}
        />
        <StatCard
          label={t('shop_detail.nasiya_plans')}
          value={String(shop.stats.nasiya_active_plans)}
        />
        <StatCard
          label={t('shop_detail.nasiya_debt')}
          value={fmtUZS(shop.stats.nasiya_debt_uzs)}
          tone={Number(shop.stats.nasiya_debt_uzs) > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Info cards */}
      <div className="fia fia-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="card px-5 pb-3 pt-4">
          <div className="mb-3 text-hint font-semibold tracking-tight text-text-dim">
            {t('shop_detail.shop_section')}
          </div>
          <Row
            label={t('shop_detail.plan_label')}
            value={
              <Badge variant="accent" size="sm">
                {planLabel(shop.plan)}
              </Badge>
            }
          />
          <Row
            label={t('shop_detail.plan_until')}
            value={
              shop.plan_until ? (
                <span className="flex items-center gap-2">
                  {fmtDate(shop.plan_until)}
                  <PlanExpiryBadge planUntil={shop.plan_until} />
                </span>
              ) : (
                '—'
              )
            }
          />
          {shop.is_frozen && (
            <>
              <Row
                label={t('shop_detail.frozen_at')}
                value={shop.frozen_at ? fmtRelative(shop.frozen_at) : '—'}
              />
              <Row
                label={t('shop_detail.freeze_reason_label')}
                value={<span className="text-danger">{shop.frozen_reason || '—'}</span>}
              />
            </>
          )}
        </section>

        <section className="card px-5 pb-3 pt-4">
          <div className="mb-3 text-hint font-semibold tracking-tight text-text-dim">
            {t('shop_detail.owner_label')}
          </div>
          <Row label={t('create_shop.owner_name')} value={shop.owner.full_name} />
          <Row
            label={t('shop_detail.tg_username')}
            value={shop.owner.tg_username ? `@${shop.owner.tg_username}` : '—'}
          />
          <Row label={t('shop_detail.phone')} value={shop.owner.phone} />
          <Row
            label={t('shop_detail.contact_note')}
            value={shop.owner.admin_contact_note}
          />
          <Row label={t('shop_detail.login')} value={shop.owner.login} />
          <Row
            label={t('shop_detail.has_password')}
            value={
              <Badge variant={shop.owner.has_password ? 'success' : 'neutral'} size="sm">
                {shop.owner.has_password ? t('common.yes') : t('common.no')}
              </Badge>
            }
          />
          <Row
            label={t('shop_detail.last_login')}
            value={
              <span className="flex items-center justify-end gap-1.5">
                {sourceIcon ? (
                  <sourceIcon.Icon size={12} className={sourceIcon.color} aria-hidden />
                ) : sourceLabel ? (
                  <HelpCircle size={12} className="text-text-muted" aria-hidden />
                ) : null}
                {fmtRelative(shop.owner.last_login_at)}
                {sourceLabel && (
                  <span className="text-caption text-text-muted">({sourceLabel})</span>
                )}
              </span>
            }
          />
        </section>
      </div>

      {/* Actions */}
      <div className="fia fia-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setNewPlan(shop.plan);
              setNewPlanUntil(shop.plan_until ?? '');
              setPlanModal(true);
            }}
          >
            <RefreshCw size={15} aria-hidden /> {t('shop_detail.change_plan_btn')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setNewLogin(shop.owner.login ?? '');
              setNewPassword('');
              setCredsModal(true);
            }}
          >
            <Key size={15} aria-hidden /> {t('shop_detail.set_creds_btn')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCPhone(shop.owner.phone ?? '');
              setCNote(shop.owner.admin_contact_note ?? '');
              setContactModal(true);
            }}
          >
            <Phone size={15} aria-hidden /> {t('shop_detail.edit_contact')}
          </Button>
        </div>
        {shop.is_frozen ? (
          <Button
            variant="secondary"
            size="sm"
            loading={unfreezeMut.isPending}
            onClick={() => unfreezeMut.mutate()}
          >
            <Sun size={15} aria-hidden /> {t('shop_detail.unfreeze_btn')}
          </Button>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setFreezeModal(true)}>
            <Snowflake size={15} aria-hidden /> {t('shop_detail.freeze_btn')}
          </Button>
        )}
      </div>

      {/* Freeze modal */}
      <Modal
        open={freezeModal}
        onClose={() => {
          setFreezeModal(false);
          setFreezeReason('');
        }}
        title={t('shop_detail.confirm_freeze')}
        dirty={freezeDirty}
        footer={
          <>
            <Button variant="secondary" full onClick={() => setFreezeModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              full
              loading={freezeMut.isPending}
              onClick={() => freezeMut.mutate()}
            >
              <Snowflake size={15} aria-hidden /> {t('shop_detail.freeze_btn')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-hint text-text-muted">{t('shop_detail.freeze_warning')}</p>
        <Input
          label={t('shop_detail.freeze_reason_label')}
          placeholder={t('shop_detail.freeze_placeholder')}
          value={freezeReason}
          onChange={(e) => setFreezeReason(e.target.value)}
        />
      </Modal>

      {/* Plan modal */}
      <Modal
        open={planModal}
        onClose={() => setPlanModal(false)}
        title={t('shop_detail.change_plan_btn')}
        dirty={!!shop && (newPlan !== shop.plan || newPlanUntil !== (shop.plan_until ?? ''))}
        footer={
          <>
            <Button variant="secondary" full onClick={() => setPlanModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button full loading={planMut.isPending} onClick={() => planMut.mutate()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-hint font-medium tracking-tight text-text-dim">
              {t('shop_detail.plan_label')}
            </label>
            <div className="flex h-11 overflow-hidden rounded-lg border border-border bg-bg2">
              {['trial', 'basic', 'business'].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setNewPlan(p)}
                  className={cn(
                    'flex-1 cursor-pointer text-label font-bold transition-colors',
                    newPlan === p
                      ? 'bg-accent text-accent-fg'
                      : 'bg-transparent text-text-dim hover:text-text',
                  )}
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
            onChange={(e) => setNewPlanUntil(e.target.value)}
            hint={t('shop_detail.plan_until_hint')}
          />
        </div>
      </Modal>

      {/* Credentials modal */}
      <Modal
        open={credsModal}
        onClose={() => {
          setCredsModal(false);
          setNewLogin('');
          setNewPassword('');
        }}
        title={t('shop_detail.set_creds_btn')}
        dirty={credsDirty}
        footer={
          <div className="flex w-full flex-col gap-2">
            {!credsDirty && (
              <p className="text-center text-caption text-text-muted">
                {t('common.required_at_least_one')}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                full
                onClick={() => {
                  setCredsModal(false);
                  setNewLogin('');
                  setNewPassword('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                full
                loading={credsMut.isPending}
                disabled={!credsDirty}
                onClick={() => credsMut.mutate()}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t('shop_detail.login')}
            placeholder="owner_login"
            autoComplete="off"
            value={newLogin}
            onChange={(e) => setNewLogin(e.target.value)}
          />
          <Input
            label={t('shop_detail.password_new')}
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            hint={t('shop_detail.password_hint')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={contactModal}
        onClose={() => setContactModal(false)}
        title={t('shop_detail.edit_contact')}
        footer={
          <div className="flex w-full gap-2">
            <Button variant="secondary" full onClick={() => setContactModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              full
              loading={contactMut.isPending}
              onClick={() => contactMut.mutate()}
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t('shop_detail.phone')}
            placeholder="+998 90 123 45 67"
            value={cPhone}
            onChange={(e) => setCPhone(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-label font-medium text-text-dim">
              {t('shop_detail.contact_note')}
            </label>
            <textarea
              className="min-h-24 rounded-lg border border-border bg-bg2 px-3 py-2 text-label text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              value={cNote}
              onChange={(e) => setCNote(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
