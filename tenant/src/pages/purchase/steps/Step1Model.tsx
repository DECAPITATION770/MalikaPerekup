import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Controller, type Control, type UseFormSetValue } from 'react-hook-form';
import { Repeat, Plus, ChevronRight, Pencil } from 'lucide-react';

import {
  getRecentModels,
  type RecentModelOut,
} from '../../../api/devices';
import { POPULAR_BRANDS } from '../../../lib/popularBrands';
import {
  getLastPurchase,
  type LastPurchaseTemplate,
} from '../../../api/purchases';

import { StepShell } from '../Wizard';
import { CATEGORY_ICON, CategoryPicker, Field } from '../primitives';
import { SuggestField } from '../SuggestField';
import { conditionFromDefects, type FormValues } from '../types';

interface Props {
  control: Control<FormValues>;
  values: FormValues;
  setValue: UseFormSetValue<FormValues>;
  /** Called when user taps the "Повторить последнюю" card — parent jumps to step 4. */
  onRepeatLast: (tpl: LastPurchaseTemplate) => void;
  /** Called when a chip or the "+ другая модель" fields produce a complete (brand, model). */
  onPicked: () => void;
  errors: { brand?: string; model?: string };
}

export default function Step1Model({
  control, values, setValue, onRepeatLast, onPicked, errors,
}: Props) {
  const { t } = useTranslation();
  const [manual, setManual] = useState(false);

  const { data: lastTpl } = useQuery({
    queryKey: ['purchases', 'last'],
    queryFn: getLastPurchase,
    staleTime: 60_000,
  });

  const { data: recent = [] } = useQuery({
    queryKey: ['devices', 'recent-models'],
    queryFn: () => getRecentModels(10),
    staleTime: 60_000,
  });

  const pickChip = (m: RecentModelOut) => {
    setValue('category', m.category, { shouldValidate: true });
    setValue('brand', m.brand, { shouldValidate: true });
    setValue('model', m.model, { shouldValidate: true });
    onPicked();
  };

  // ─── "Repeat last" card — only when shop has at least one purchase ───
  const repeatCard = lastTpl && (
    <button
      type="button"
      onClick={() => onRepeatLast(lastTpl)}
      className="w-full text-left card-elev p-4 md:p-5 flex items-center gap-4 hover:border-accent/40 active:scale-[0.998] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <div className="w-12 h-12 rounded-2xl bg-accent-faded text-accent flex items-center justify-center shrink-0">
        <Repeat size={22} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-caption text-text-muted font-semibold tracking-wider uppercase">
          {t('purchase.repeat_last_eyebrow')}
        </div>
        <div className="text-body-xl font-bold tracking-tight truncate mt-0.5">
          {lastTpl.device.brand} {lastTpl.device.model}
        </div>
        <div className="text-label text-text-dim mt-0.5 truncate">
          {t('purchase.repeat_last_from', { seller: lastTpl.seller.full_name })}
        </div>
      </div>
      <ChevronRight size={20} className="text-text-muted shrink-0" />
    </button>
  );

  // ─── Recent chip grid ─────────────────────────────────────────────────
  const chips = recent.length > 0 && (
    <div className="flex flex-col gap-2">
      <div className="text-caption text-text-muted font-semibold tracking-wider uppercase px-1">
        {t('purchase.recent_models')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {recent.map((m) => {
          const Icon = CATEGORY_ICON[m.category];
          const active = values.brand === m.brand && values.model === m.model;
          return (
            <button
              key={`${m.brand}-${m.model}-${m.category}`}
              type="button"
              onClick={() => pickChip(m)}
              className={`text-left rounded-2xl border p-3.5 flex items-center gap-3 transition-all cursor-pointer
                ${active
                  ? 'bg-accent-faded border-accent/50 text-accent'
                  : 'bg-bg2 border-border hover:border-border-strong active:scale-[0.99]'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                ${active ? 'bg-accent/20 text-accent' : 'bg-bg3 text-text-dim'}`}
              >
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-label font-bold tracking-tight truncate">{m.brand}</div>
                <div className="text-caption text-text-dim truncate">{m.model}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── Manual fallback (revealed by "+ другая модель") ─────────────────
  const popular = POPULAR_BRANDS[values.category] ?? [];
  const manualFields = (
    <div className="flex flex-col gap-4 animate-fade-up">
      <Field label={t('purchase.category_label')} required>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <CategoryPicker value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>

      {popular.length > 0 && (
        <Field label={t('purchase.brand_label')} required>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-1">
            {popular.map((brand) => {
              const active = values.brand === brand;
              return (
                <button
                  key={brand}
                  type="button"
                  onClick={() => setValue('brand', brand, { shouldValidate: true })}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer min-w-0
                    ${active
                      ? 'bg-accent-faded border-accent/50 text-accent shadow-glow-accent'
                      : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
                >
                  <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold text-label
                    ${active ? 'bg-accent/20 text-accent' : 'bg-bg3 text-text'}`}
                  >
                    {brand[0]}
                  </span>
                  <span className="text-caption font-semibold tracking-tight truncate">{brand}</span>
                </button>
              );
            })}
          </div>
          <SuggestField
            control={control}
            name="brand"
            suggestField="brand"
            placeholder={t('purchase.brand_other_placeholder')}
            error={errors.brand}
          />
        </Field>
      )}

      {popular.length === 0 && (
        <SuggestField
          control={control}
          name="brand"
          suggestField="brand"
          label={t('purchase.brand_label')}
          placeholder={t('purchase.brand_placeholder')}
          required
          error={errors.brand}
        />
      )}

      <SuggestField
        control={control}
        name="model"
        suggestField="model"
        brand={values.brand}
        label={t('purchase.model_label')}
        placeholder={t('purchase.model_placeholder')}
        required
        error={errors.model}
      />
    </div>
  );

  // First-use: no history → show manual fields by default so the user
  // is not staring at an empty step.
  const showManualByDefault = !lastTpl && recent.length === 0;
  const expandManual = manual || showManualByDefault || (!!values.brand && !recent.some(
    (r) => r.brand === values.brand && r.model === values.model,
  ));

  return (
    <StepShell
      step={0}
      title={t('purchase.step1_title')}
      subtitle={t('purchase.step1_subtitle')}
    >
      {repeatCard}

      {repeatCard && (chips || expandManual) && (
        <div className="flex items-center gap-3 text-caption text-text-muted">
          <div className="flex-1 h-px bg-border" />
          <span className="font-semibold uppercase tracking-wider">{t('purchase.or')}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {chips}

      {!expandManual && (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="card p-4 flex items-center gap-3 hover:border-border-strong active:scale-[0.99] transition-all cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-bg3 text-accent flex items-center justify-center">
            <Plus size={18} strokeWidth={2} />
          </div>
          <div className="text-label font-bold tracking-tight">
            {t('purchase.other_model')}
          </div>
        </button>
      )}

      {expandManual && (
        <div className="card p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4 text-caption text-text-muted">
            <Pencil size={13} className="text-text-dim" />
            <span className="font-semibold tracking-wider uppercase">
              {t('purchase.other_model')}
            </span>
          </div>
          {manualFields}
        </div>
      )}

      {/* Help text: condition starts at 'new' until step 2's defect list says otherwise */}
      <input type="hidden" {...{ value: conditionFromDefects(values.defects) }} />
    </StepShell>
  );
}
