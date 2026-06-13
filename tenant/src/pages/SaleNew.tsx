/**
 * SaleNew — 2-step sale wizard (Устройство → Сделка), mirroring the purchase
 * wizard: localStorage draft autosave + restore, buyer prefill from the
 * counterparty directory, per-step validation, and the native Telegram
 * MainButton/BackButton (with an in-page footer fallback for web).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BadgeDollarSign } from 'lucide-react';
import { toast } from 'sonner';

import { createSale, createInstallmentPlan } from '@/api/sales';
import { getExchangeRateHint } from '@/api/reports';
import { getDevice, type DeviceWithPurchaseOut } from '@/api/devices';
import type { CounterpartyOut } from '@/api/counterparties';
import { parseMoneyInput } from '@/lib/money';
import { useTelegram, useTgBackButton, useTgHaptic, useTgMainButton } from '@/lib/telegram';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

import {
  type SaleFormValues,
  schema,
  emptyDefaults,
  computeStepStatus,
  DRAFT_KEY,
  DRAFT_DEBOUNCE_MS,
  TOTAL_STEPS,
  STEP_FIELDS,
  type WizardStep,
} from './sale/types';
import { WizardProgress, WizardFooter } from './purchase/Wizard';
import { DraftRestoreModal } from './purchase/modals';
import StepSaleDevice from './sale/steps/StepSaleDevice';
import StepSaleDeal from './sale/steps/StepSaleDeal';

interface Draft extends SaleFormValues {
  _step?: WizardStep;
  _selectedDevice?: DeviceWithPurchaseOut | null;
  _selectedBuyerId?: number | null;
  _buyerPhotos?: string[];
}

export default function SaleNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useTgHaptic();
  const { mainButtonMounted } = useTelegram();

  const [step, setStep] = useState<WizardStep>(0);
  const [shaking, setShaking] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<Draft | null>(null);
  const [priceResetKey, setPriceResetKey] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<DeviceWithPurchaseOut | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [buyerPhotos, setBuyerPhotos] = useState<string[]>([]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    trigger,
    formState: { errors, isSubmitting, touchedFields, submitCount },
  } = useForm<SaleFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: emptyDefaults(),
    mode: 'onBlur',
  });

  const values = watch();
  const saleType = values.sale_type;

  // Mask not-yet-touched fields' errors until a submit attempt — same trick as
  // the purchase wizard so stepping forward doesn't light up the next step.
  const shownErrors = useMemo<FieldErrors<SaleFormValues>>(() => {
    if (submitCount > 0) return errors;
    const masked = { ...errors };
    (Object.keys(masked) as (keyof SaleFormValues)[]).forEach((k) => {
      if (!touchedFields[k]) delete masked[k];
    });
    return masked;
  }, [errors, touchedFields, submitCount]);

  const { data: rateHints } = useQuery({
    queryKey: ['exchange-rate-hint'],
    queryFn: getExchangeRateHint,
    staleTime: 5 * 60_000,
  });

  // Pre-select a device when arriving from its card («Продать этот аппарат»):
  // fetch it, jump straight to «Сделка». An explicit choice wins over a draft.
  const location = useLocation();
  const preselectId = (location.state as { deviceId?: number } | null)?.deviceId ?? null;
  const { data: preDevice } = useQuery({
    queryKey: ['device', preselectId],
    queryFn: () => getDevice(preselectId!),
    enabled: !!preselectId,
  });
  useEffect(() => {
    if (!preDevice) return;
    setSelectedDevice({
      ...preDevice,
      purchase_price_uzs: null,
      purchase_date: null,
      days_in_stock: null,
      photo_url: null,
    });
    setValue('device_id', preDevice.id, { shouldValidate: true });
    setStep(1);
    setDraftPrompt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preDevice]);

  // Draft restore (mount once).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Draft;
      if (parsed.device_id || parsed.buyer_name || parsed.price) {
        setDraftPrompt(parsed);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // Draft autosave.
  useEffect(() => {
    if (draftPrompt) return;
    const timer = setTimeout(() => {
      const v = getValues();
      const meaningful = v.device_id || v.buyer_name || v.price;
      if (meaningful) {
        const draft: Draft = {
          ...v,
          _step: step,
          _selectedDevice: selectedDevice,
          _selectedBuyerId: selectedBuyerId,
          _buyerPhotos: buyerPhotos,
        };
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
          /* quota */
        }
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [values, getValues, draftPrompt, step, selectedDevice, selectedBuyerId, buyerPhotos]);

  const restoreDraft = useCallback(() => {
    if (!draftPrompt) return setDraftPrompt(null);
    const { _step, _selectedDevice, _selectedBuyerId, _buyerPhotos, ...formValues } = draftPrompt;
    reset(formValues);
    setStep((_step ?? 0) as WizardStep);
    setSelectedDevice(_selectedDevice ?? null);
    setSelectedBuyerId(_selectedBuyerId ?? null);
    setBuyerPhotos(_buyerPhotos ?? []);
    setPriceResetKey((k) => k + 1);
    setDraftPrompt(null);
  }, [draftPrompt, reset]);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftPrompt(null);
  }, []);

  const stepStatus = useMemo(() => computeStepStatus(values, errors), [values, errors]);

  const onSelectDevice = (device: DeviceWithPurchaseOut) => {
    setSelectedDevice(device);
    setValue('device_id', device.id, { shouldValidate: true });
  };
  const onClearDevice = () => {
    setSelectedDevice(null);
    setValue('device_id', undefined, { shouldValidate: false });
  };

  const onPickBuyer = (cp: CounterpartyOut) => {
    setSelectedBuyerId(cp.id);
    setValue('buyer_name', cp.full_name, { shouldValidate: true });
    setValue('buyer_phone', cp.phone ?? '');
    setValue('buyer_doc_type', cp.doc_type ?? '');
    setValue('buyer_doc_number', cp.doc_number ?? '');
    setValue('buyer_tg', cp.tg_username ? `@${cp.tg_username.replace(/^@/, '')}` : '');
  };
  const onClearBuyer = () => {
    setSelectedBuyerId(null);
    setValue('buyer_name', '');
    setValue('buyer_phone', '');
    setValue('buyer_doc_type', '');
    setValue('buyer_doc_number', '');
    setValue('buyer_tg', '');
  };

  const mutation = useMutation({
    mutationFn: async (v: SaleFormValues) => {
      const sale = await createSale({
        device_id: v.device_id!,
        buyer: {
          full_name: v.buyer_name.trim(),
          phone: v.buyer_phone || null,
          doc_type: v.buyer_doc_type || null,
          doc_number: v.buyer_doc_number || null,
          tg_username: v.buyer_tg || null,
          photos: buyerPhotos,
        },
        sale_type: v.sale_type,
        currency: v.currency,
        price: parseMoneyInput(v.price),
        exchange_rate: v.currency === 'USD' ? parseMoneyInput(v.exchange_rate ?? '') : null,
        sale_date: v.sale_date,
        comment: v.comment || null,
      });
      if (v.sale_type === 'nasiya') {
        await createInstallmentPlan(sale.id, {
          total_amount: parseMoneyInput(v.price),
          down_payment: v.down_payment ? parseMoneyInput(v.down_payment) : undefined,
          period_type: v.period_type,
          period_count: v.period_count!,
          start_date: v.start_date!,
        });
      }
    },
    onSuccess: () => {
      haptic.notify('success');
      track('sale_created', { type: getValues('sale_type') });
      localStorage.removeItem(DRAFT_KEY);
      // Mirror the purchase flow: straight to the showcase with a toast — no
      // separate done screen. Highlight the sold device for one-tap access.
      const deviceId = getValues('device_id');
      toast.success(t('sale.success_toast'), {
        action: {
          label: t('sale.toast_open'),
          onClick: () => navigate(`/stock/${deviceId}`),
        },
      });
      navigate('/stock', { state: { highlightId: deviceId } });
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('sale.errors.submit_failed'));
    },
  });

  const onSubmit = handleSubmit(
    (v) => mutation.mutate(v),
    () => {
      haptic.notify('error');
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    },
  );

  const goNext = useCallback(async () => {
    const fields = STEP_FIELDS[step];
    const ok = await trigger(fields, { shouldFocus: true });
    if (!ok) {
      haptic.notify('error');
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }
    haptic.select();
    if (step < TOTAL_STEPS - 1) setStep((s) => (s + 1) as WizardStep);
  }, [step, trigger, haptic]);

  const goBack = useCallback(() => {
    if (step > 0) {
      haptic.select();
      setStep((s) => (s - 1) as WizardStep);
    }
  }, [step, haptic]);

  // Native Telegram BackButton: step back inside the wizard first, leave the
  // page only from step 0.
  useTgBackButton(
    useCallback(() => {
      if (step > 0) goBack();
      else navigate(-1);
    }, [step, goBack, navigate]),
  );

  const submitLabel = saleType === 'nasiya' ? t('sale.submit_nasiya') : t('sale.submit');

  // Native MainButton mirrors the footer: «Далее» on step 0, submit on step 1.
  // `isEnabled` is gated by stepStatus so the native button can't silently
  // no-op on an incomplete step (mirror the in-page footer's disabled state).
  const isLastStep = step === TOTAL_STEPS - 1;
  useTgMainButton({
    text: isLastStep ? submitLabel : t('purchase.wizard_next'),
    isLoaderVisible: isSubmitting || mutation.isPending,
    isEnabled: isLastStep || (stepStatus[step] ?? false),
    onClick: () => {
      if (!isLastStep) void goNext();
      else void onSubmit();
    },
  });

  return (
    <div className="flex w-full animate-fade-up flex-col gap-5">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-bg2 text-text-dim transition-colors hover:border-border-strong hover:text-text"
          aria-label={t('common.cancel')}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-title font-bold tracking-tight md:text-title-lg">{t('sale.title')}</h1>
        </div>
      </header>

      <WizardProgress
        step={step}
        completed={stepStatus}
        labels={[t('sale.step_device'), t('sale.step_deal')]}
        ariaLabel={t('sale.wizard_progress_aria')}
        onJump={(s) => setStep(s as WizardStep)}
      />

      <form
        onSubmit={(e) => e.preventDefault()}
        className={cn('flex flex-col gap-5', shaking && 'animate-shake')}
        noValidate
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <StepSaleDevice
                selectedDevice={selectedDevice}
                onSelect={onSelectDevice}
                onClear={onClearDevice}
                error={errors.device_id ? t('sale.errors.device_required') : undefined}
              />
            )}
            {step === 1 && (
              <StepSaleDeal
                control={control}
                register={register}
                setValue={setValue}
                watch={watch}
                errors={shownErrors}
                selectedDevice={selectedDevice}
                selectedBuyerId={selectedBuyerId}
                onPickBuyer={onPickBuyer}
                onClearBuyer={onClearBuyer}
                buyerPhotos={buyerPhotos}
                onBuyerPhotosChange={setBuyerPhotos}
                rateHints={rateHints}
                priceResetKey={priceResetKey}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* In-page footer is the fallback for web; hidden when the native TG
            MainButton/BackButton are mounted, to avoid a duplicate action bar. */}
        {!mainButtonMounted && (
          <WizardFooter
            step={step}
            totalSteps={TOTAL_STEPS}
            canGoBack={step > 0}
            canGoNext={stepStatus[step] ?? false}
            onBack={goBack}
            onNext={goNext}
            onSubmit={onSubmit}
            submitting={isSubmitting || mutation.isPending}
            submitLabel={submitLabel}
          />
        )}
      </form>

      <DraftRestoreModal
        open={draftPrompt !== null}
        onContinue={restoreDraft}
        onDiscard={discardDraft}
        title={t('sale.draft_restore_title')}
        body={t('sale.draft_restore_body')}
        icon={<BadgeDollarSign size={22} />}
      />
    </div>
  );
}
