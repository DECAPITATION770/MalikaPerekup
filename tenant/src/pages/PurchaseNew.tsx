import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { useToast } from '../components/ui/Toast';
import {
  createPurchase, type PurchaseWithDeviceOut, type LastPurchaseTemplate,
} from '../api/purchases';
import { getExchangeRateHint } from '../api/reports';
import { fmtAmount, fmtMoneyInput, moneyToNumber, parseMoneyInput } from '../lib/money';
import { useTgBack } from '../lib/useTelegram';

import {
  type FormValues, makeSchema, emptyDefaults, computeStepStatus,
  DRAFT_KEY, DRAFT_DEBOUNCE_MS, TOTAL_STEPS, STEP_FIELDS, type WizardStep,
  conditionFromDefects,
} from './purchase/types';
import { WizardProgress, WizardFooter } from './purchase/Wizard';
import Step1Model from './purchase/steps/Step1Model';
import Step2Device from './purchase/steps/Step2Device';
import Step3Seller from './purchase/steps/Step3Seller';
import Step4Price from './purchase/steps/Step4Price';
import { DraftRestoreModal, SuccessModal } from './purchase/modals';

interface Draft extends FormValues {
  _step?: WizardStep;
  _devicePhotos?: string[];
  _sellerPhotos?: string[];
}

export default function PurchaseNew() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();

  useTgBack(() => navigate(-1));

  const [step, setStep] = useState<WizardStep>(0);
  const [done, setDone] = useState<PurchaseWithDeviceOut | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<Draft | null>(null);
  const [priceResetKey, setPriceResetKey] = useState(0);
  const [devicePhotos, setDevicePhotos] = useState<string[]>([]);
  const [sellerPhotos, setSellerPhotos] = useState<string[]>([]);

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    register, handleSubmit, control, watch, setValue, reset, getValues, trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: emptyDefaults(),
    mode: 'onBlur',
  });

  const values = watch();
  const { currency, price, exchange_rate: rateRaw } = values;

  // ─── Exchange-rate hint (USD autofill on step 4) ──────────────────────
  const { data: rateHints } = useQuery({
    queryKey: ['exchange-rate-hint'],
    queryFn: getExchangeRateHint,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (currency !== 'USD') return;
    const current = getValues('exchange_rate');
    if (current && moneyToNumber(current) > 0) return;
    const hint = rateHints?.cb_uz ?? rateHints?.last_used;
    if (hint) setValue('exchange_rate', fmtMoneyInput(String(parseFloat(hint.rate))), { shouldValidate: false });
  }, [currency, rateHints, getValues, setValue]);

  // ─── Draft restore (mount once) ───────────────────────────────────────
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Draft autosave ───────────────────────────────────────────────────
  useEffect(() => {
    if (draftPrompt) return; // wait until user decides
    const timer = setTimeout(() => {
      const v = getValues();
      const meaningful = v.brand || v.model || v.seller_full_name || v.price || v.imei;
      if (meaningful) {
        const draft: Draft = { ...v, _step: step, _devicePhotos: devicePhotos, _sellerPhotos: sellerPhotos };
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* quota */ }
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

  // ─── Step status (drives the progress bar) ────────────────────────────
  const stepStatus = useMemo(
    () => computeStepStatus(values, errors),
    [values, errors],
  );

  // ─── "Repeat last": prefill device + seller, jump to price step ──────
  const onRepeatLast = useCallback((tpl: LastPurchaseTemplate) => {
    setValue('category', tpl.device.category, { shouldValidate: true });
    setValue('brand', tpl.device.brand, { shouldValidate: true });
    setValue('model', tpl.device.model, { shouldValidate: true });
    setValue('condition', tpl.device.condition);
    setValue('defects', tpl.device.defects);
    setValue('specs', tpl.device.specs ?? {});
    setValue('counterparty_id', tpl.seller.counterparty_id);
    setValue('seller_full_name', tpl.seller.full_name, { shouldValidate: true });
    setValue('seller_phone', tpl.seller.phone ?? '', { shouldValidate: true });
    setValue('seller_doc_type', tpl.seller.doc_type ?? '');
    setValue('seller_doc_number', tpl.seller.doc_number ?? '');
    setValue('seller_tg', tpl.seller.tg_username ? `@${tpl.seller.tg_username.replace(/^@/, '')}` : '');
    // IMEI/serial/price/photos stay empty — those identify the new unit.
    setStep(3);
  }, [setValue]);

  // ─── Submit ───────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: (data) => {
      localStorage.removeItem(DRAFT_KEY);
      setDone(data);
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) toast.error(t('purchase.errors.imei_conflict'));
      else toast.error(t('purchase.errors.submit_failed'));
    },
  });

  const onSubmit = handleSubmit((v) => {
    const cleaned = parseMoneyInput(v.price);
    const rate = parseMoneyInput(v.exchange_rate);
    // ``condition`` is kept in sync with ``defects`` in Step2 — derive once
    // more here as a defence-in-depth (CLAUDE.md §1: don't trust the form).
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

  // ─── Step navigation ──────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    const fields = STEP_FIELDS[step];
    const ok = await trigger(fields, { shouldFocus: true });
    if (!ok) return;
    if (step < TOTAL_STEPS - 1) setStep((s) => (s + 1) as WizardStep);
  }, [step, trigger]);

  const goBack = useCallback(() => {
    if (step > 0) setStep((s) => (s - 1) as WizardStep);
  }, [step]);

  const handleAnother = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDone(null);
    setDevicePhotos([]);
    setSellerPhotos([]);
    setStep(0);
    reset(emptyDefaults());
  }, [reset]);

  // ─── Submit button label: amount in the button itself ─────────────────
  const submitLabel = (() => {
    const priceNum = moneyToNumber(price);
    if (priceNum <= 0) return t('purchase.submit');
    const rateNum = moneyToNumber(rateRaw);
    const uzs = currency === 'UZS' ? priceNum : priceNum * (rateNum > 0 ? rateNum : 0);
    if (uzs <= 0) return t('purchase.submit');
    return t('purchase.submit_for', { amount: fmtAmount(uzs) });
  })();

  return (
    <div className="flex flex-col gap-5 animate-fade-up max-w-3xl mx-auto w-full">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl border border-border bg-bg2 hover:border-border-strong text-text-dim hover:text-text transition-colors flex items-center justify-center cursor-pointer shrink-0"
          aria-label={t('purchase.wizard_back')}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-title md:text-title-lg font-bold tracking-tight">
            {t('purchase.title')}
          </h1>
        </div>
      </header>

      <WizardProgress step={step} completed={stepStatus} onJump={setStep} />

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {step === 0 && (
          <Step1Model
            control={control}
            values={values}
            setValue={setValue}
            onRepeatLast={onRepeatLast}
            onPicked={() => setStep(1)}
            errors={{ brand: errors.brand?.message, model: errors.model?.message }}
          />
        )}
        {step === 1 && (
          <Step2Device
            control={control}
            register={register}
            values={values}
            setValue={(name, v) => setValue(name, v)}
            errors={errors}
            devicePhotos={devicePhotos}
            onDevicePhotosChange={setDevicePhotos}
          />
        )}
        {step === 2 && (
          <Step3Seller
            control={control}
            register={register}
            setValue={setValue}
            values={values}
            errors={errors}
            sellerPhotos={sellerPhotos}
            onSellerPhotosChange={setSellerPhotos}
          />
        )}
        {step === 3 && (
          <Step4Price
            control={control}
            register={register}
            setValue={setValue}
            values={values}
            errors={errors}
            rateHints={rateHints}
            priceResetKey={priceResetKey}
          />
        )}

        <WizardFooter
          step={step}
          canGoBack={step > 0}
          onBack={goBack}
          onNext={goNext}
          submitting={isSubmitting || mutation.isPending}
          submitLabel={submitLabel}
        />
      </form>

      <SuccessModal
        result={done}
        onClose={() => navigate('/stock')}
        onAnother={handleAnother}
      />

      <DraftRestoreModal
        open={draftPrompt !== null}
        onContinue={restoreDraft}
        onDiscard={discardDraft}
      />
    </div>
  );
}
