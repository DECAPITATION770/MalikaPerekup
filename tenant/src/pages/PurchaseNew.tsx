/**
 * PurchaseNew — 4-step purchase wizard with localStorage draft autosave,
 * "repeat last" prefill, and per-step validation.
 *
 * Phase 3 port: legacy toast → sonner, legacy useTgBack → useTgBackButton,
 * framer-motion AnimatePresence between steps + Tg haptic on step change.
 * Step components + primitives were copied wholesale into ./purchase and
 * re-pathed to the new module aliases.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { createPurchase, type LastPurchaseTemplate } from '@/api/purchases';
import { getExchangeRateHint } from '@/api/reports';
import { fmtAmount, fmtMoneyInput, moneyToNumber, parseMoneyInput } from '@/lib/money';
import { useTgBackButton, useTgHaptic, useTgMainButton } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';

import {
  type FormValues,
  makeSchema,
  emptyDefaults,
  computeStepStatus,
  DRAFT_KEY,
  DRAFT_DEBOUNCE_MS,
  TOTAL_STEPS,
  STEP_FIELDS,
  type WizardStep,
  conditionFromDefects,
} from './purchase/types';
import { WizardProgress, WizardFooter } from './purchase/Wizard';
import StepDevice from './purchase/steps/StepDevice';
import StepDeal from './purchase/steps/StepDeal';
import { DraftRestoreModal } from './purchase/modals';

interface Draft extends FormValues {
  _step?: WizardStep;
  _devicePhotos?: string[];
  _sellerPhotos?: string[];
}

export default function PurchaseNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useTgHaptic();

  useTgBackButton(() => navigate(-1));

  const [step, setStep] = useState<WizardStep>(0);
  const [shaking, setShaking] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<Draft | null>(null);
  const [priceResetKey, setPriceResetKey] = useState(0);
  const [devicePhotos, setDevicePhotos] = useState<string[]>([]);
  const [sellerPhotos, setSellerPhotos] = useState<string[]>([]);

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    getValues,
    trigger,
    formState: { errors, isSubmitting, touchedFields, submitCount },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: emptyDefaults(),
    mode: 'onBlur',
  });

  const values = watch();
  const { currency, price, exchange_rate: rateRaw } = values;

  // The zod resolver validates the whole schema, so stepping forward leaves
  // errors on the next step's not-yet-touched fields. Only surface a field's
  // error once it's been touched (blurred) or after a submit attempt.
  const shownErrors = useMemo<FieldErrors<FormValues>>(() => {
    if (submitCount > 0) return errors;
    const masked = { ...errors };
    (Object.keys(masked) as (keyof FormValues)[]).forEach((k) => {
      if (!touchedFields[k]) delete masked[k];
    });
    return masked;
  }, [errors, touchedFields, submitCount]);

  const { data: rateHints } = useQuery({
    queryKey: ['exchange-rate-hint'],
    queryFn: getExchangeRateHint,
    staleTime: 5 * 60_000,
  });

  // USD autofill of exchange rate on step 4.
  useEffect(() => {
    if (currency !== 'USD') return;
    const current = getValues('exchange_rate');
    if (current && moneyToNumber(current) > 0) return;
    const hint = rateHints?.cb_uz ?? rateHints?.last_used;
    if (hint)
      setValue('exchange_rate', fmtMoneyInput(String(parseFloat(hint.rate))), {
        shouldValidate: false,
      });
  }, [currency, rateHints, getValues, setValue]);

  // Draft restore (mount once).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Draft;
      if (parsed.brand || parsed.model || parsed.seller_full_name || parsed.price) {
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
      const meaningful = v.brand || v.model || v.seller_full_name || v.price || v.imei;
      if (meaningful) {
        const draft: Draft = {
          ...v,
          _step: step,
          _devicePhotos: devicePhotos,
          _sellerPhotos: sellerPhotos,
        };
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
          /* quota */
        }
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [values, getValues, draftPrompt, step, devicePhotos, sellerPhotos]);

  const restoreDraft = useCallback(() => {
    if (!draftPrompt) return setDraftPrompt(null);
    const { _step, _devicePhotos, _sellerPhotos, ...formValues } = draftPrompt;
    reset(formValues);
    setStep((_step ?? 0) as WizardStep);
    setDevicePhotos(_devicePhotos ?? []);
    setSellerPhotos(_sellerPhotos ?? []);
    setPriceResetKey((k) => k + 1);
    setDraftPrompt(null);
  }, [draftPrompt, reset]);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftPrompt(null);
  }, []);

  const stepStatus = useMemo(() => computeStepStatus(values, errors), [values, errors]);

  const onRepeatLast = useCallback(
    (tpl: LastPurchaseTemplate) => {
      // shouldValidate:false — programmatic prefill must not light up errors on
      // the still-empty price before the user reaches «Сделка».
      setValue('category', tpl.device.category);
      setValue('brand', tpl.device.brand);
      setValue('model', tpl.device.model);
      setValue('condition', tpl.device.condition);
      setValue('defects', tpl.device.defects);
      setValue('specs', tpl.device.specs ?? {});
      setValue('counterparty_id', tpl.seller.counterparty_id);
      setValue('seller_full_name', tpl.seller.full_name);
      setValue('seller_phone', tpl.seller.phone ?? '');
      setValue('seller_doc_type', tpl.seller.doc_type ?? '');
      setValue('seller_doc_number', tpl.seller.doc_number ?? '');
      setValue(
        'seller_tg',
        tpl.seller.tg_username ? `@${tpl.seller.tg_username.replace(/^@/, '')}` : '',
      );
      // Device + seller are filled — jump straight to «Сделка» to confirm price.
      setStep(1);
    },
    [setValue],
  );

  const mutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: (data) => {
      haptic.notify('success');
      track('purchase_created', { currency: getValues('currency') });
      localStorage.removeItem(DRAFT_KEY);
      // No success modal — go straight to the showcase with a toast, and
      // highlight the just-created device there (one tap to its card).
      toast.success(t('purchase.success_toast'), {
        action: {
          label: t('purchase.toast_open'),
          onClick: () => navigate(`/stock/${data.device.id}`),
        },
      });
      navigate('/stock', { state: { highlightId: data.device.id } });
    },
    onError: (err: unknown) => {
      haptic.notify('error');
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) toast.error(t('purchase.errors.imei_conflict'));
      else toast.error(t('purchase.errors.submit_failed'));
    },
  });

  const onSubmit = handleSubmit((v) => {
    const cleaned = parseMoneyInput(v.price);
    const rate = parseMoneyInput(v.exchange_rate);
    const condition = conditionFromDefects(v.defects);
    mutation.mutate({
      device: {
        category: v.category,
        brand: v.brand.trim(),
        model: v.model.trim(),
        imei: v.imei.trim() || null,
        serial: v.serial.trim() || null,
        condition,
        defects: v.defects,
        specs: v.specs,
        photos: devicePhotos,
        notes: v.device_notes.trim() || null,
      },
      seller: {
        full_name: v.seller_full_name.trim(),
        phone: v.seller_phone.trim() || null,
        doc_type: v.seller_doc_type || null,
        doc_number: v.seller_doc_number.trim() || null,
        tg_username: v.seller_tg.trim().replace(/^@/, '') || null,
        photos: sellerPhotos,
      },
      currency: v.currency,
      price: cleaned,
      exchange_rate: v.currency === 'USD' ? rate : null,
      purchase_date: v.purchase_date,
      comment: v.comment.trim() || null,
    });
  });

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

  const submitLabel = (() => {
    const priceNum = moneyToNumber(price);
    if (priceNum <= 0) return t('purchase.submit');
    const rateNum = moneyToNumber(rateRaw);
    const uzs = currency === 'UZS' ? priceNum : priceNum * (rateNum > 0 ? rateNum : 0);
    if (uzs <= 0) return t('purchase.submit');
    return t('purchase.submit_for', { amount: fmtAmount(uzs) });
  })();

  // Native Telegram MainButton mirrors the wizard footer: «Далее» on steps
  // 1–3, the «Принять закупку …» submit on the last step.
  useTgMainButton({
    text: step < TOTAL_STEPS - 1 ? t('purchase.wizard_next') : submitLabel,
    isLoaderVisible: isSubmitting || mutation.isPending,
    onClick: () => {
      if (step < TOTAL_STEPS - 1) void goNext();
      else void onSubmit();
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl animate-fade-up flex-col gap-5">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-bg2 text-text-dim transition-colors hover:border-border-strong hover:text-text"
          aria-label={t('purchase.wizard_back')}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-title font-bold tracking-tight md:text-title-lg">
            {t('purchase.title')}
          </h1>
        </div>
      </header>

      <WizardProgress step={step} completed={stepStatus} onJump={setStep} />

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
              <StepDevice
                control={control}
                register={register}
                values={values}
                setValue={setValue}
                errors={shownErrors}
                devicePhotos={devicePhotos}
                onDevicePhotosChange={setDevicePhotos}
                onRepeatLast={onRepeatLast}
              />
            )}
            {step === 1 && (
              <StepDeal
                control={control}
                register={register}
                setValue={setValue}
                values={values}
                errors={shownErrors}
                sellerPhotos={sellerPhotos}
                onSellerPhotosChange={setSellerPhotos}
                rateHints={rateHints}
                priceResetKey={priceResetKey}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <WizardFooter
          step={step}
          canGoBack={step > 0}
          onBack={goBack}
          onNext={goNext}
          onSubmit={onSubmit}
          submitting={isSubmitting || mutation.isPending}
          submitLabel={submitLabel}
        />
      </form>

      <DraftRestoreModal
        open={draftPrompt !== null}
        onContinue={restoreDraft}
        onDiscard={discardDraft}
      />
    </div>
  );
}
