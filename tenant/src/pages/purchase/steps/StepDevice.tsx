/**
 * StepDevice — screen 1 of the 2-step purchase: the physical device you hold.
 * Search-first model picker (catalog ∪ history, "create new") collapses to a
 * compact chosen-model bar; below it the device fields (IMEI, condition,
 * specs, photos). Brand is never a separate grid — it rides with the model,
 * or is inferred + edited as a single field when creating a new one.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { ArrowLeft, Check, ChevronRight, Pencil, Plus, Repeat, Search } from 'lucide-react';

import { getRecentModels, type RecentModelOut } from '@/api/devices';
import { listCatalog, type CatalogModelOut } from '@/api/catalog';
import { getLastPurchase, type LastPurchaseTemplate } from '@/api/purchases';
import { Input } from '@/components/ui/input';
import { useDebounced } from '@/lib/useDebounced';
import { inferBrandCategory } from '@/lib/inferModel';

import { StepShell } from '../Wizard';
import { CATEGORY_ICON, CategoryPicker, Field } from '../primitives';
import { SuggestField } from '../SuggestField';
import { type FormValues } from '../types';
import DeviceFields from './DeviceFields';

interface Props {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  values: FormValues;
  setValue: UseFormSetValue<FormValues>;
  errors: FieldErrors<FormValues>;
  devicePhotos: string[];
  onDevicePhotosChange: (next: string[]) => void;
  /** Repeat the last purchase (fills device + seller) — parent jumps to «Сделка». */
  onRepeatLast: (tpl: LastPurchaseTemplate) => void;
}

type UnifiedModel =
  | { kind: 'catalog'; item: CatalogModelOut }
  | { kind: 'recent'; item: RecentModelOut };


export default function StepDevice({
  control,
  register,
  values,
  setValue,
  errors,
  devicePhotos,
  onDevicePhotosChange,
  onRepeatLast,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query.trim().toLowerCase(), 200);
  const [creating, setCreating] = useState(false);
  const [editingModel, setEditingModel] = useState(false);

  const { data: lastTpl, isSuccess: lastDone } = useQuery({
    queryKey: ['purchases', 'last'],
    queryFn: getLastPurchase,
    staleTime: 60_000,
  });
  const { data: recent = [], isSuccess: recentDone } = useQuery({
    queryKey: ['devices', 'recent-models'],
    queryFn: () => getRecentModels(10),
    staleTime: 60_000,
  });
  const { data: catalogPage, isSuccess: catalogDone } = useQuery({
    queryKey: ['catalog', 'wizard'],
    queryFn: () => listCatalog({ limit: 100 }),
    staleTime: 60_000,
  });

  const myModels = useMemo<UnifiedModel[]>(() => {
    const cat = [...(catalogPage?.items ?? [])].sort(
      (a, b) => b.purchase_count - a.purchase_count,
    );
    const key = (b: string, m: string) => `${b.trim().toLowerCase()}|${m.trim().toLowerCase()}`;
    const seen = new Set<string>();
    const out: UnifiedModel[] = [];
    for (const c of cat) {
      const k = key(c.brand, c.model);
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ kind: 'catalog', item: c });
      }
    }
    for (const r of recent) {
      const k = key(r.brand, r.model);
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ kind: 'recent', item: r });
      }
    }
    return out;
  }, [catalogPage, recent]);

  const results = useMemo(() => {
    if (!debouncedQuery) return [];
    return myModels.filter((u) =>
      `${u.item.brand} ${u.item.model}`.toLowerCase().includes(debouncedQuery),
    );
  }, [myModels, debouncedQuery]);

  const hasModel = !!values.brand.trim() && !!values.model.trim();

  // Новый магазин: каталог, история и «последняя закупка» пусты — не утыкаемся
  // в пустой поиск, а сразу открываем форму ввода модели (бренд + модель с
  // автоподсказками). Считаем только после того как все 3 запроса завершились,
  // иначе действующий магазин на миг мигнёт createForm → browsePicker.
  const isEmptyShop =
    lastDone && recentDone && catalogDone && myModels.length === 0 && !lastTpl;

  // The model picker is a 3-mode machine. Naming the mode here keeps the JSX a
  // single lookup instead of a nested ternary:
  //   • create — typing a brand-new model, or a brand-new shop with nothing yet
  //   • chosen — a model is set; show the compact bar (tap «Изменить» to revisit)
  //   • browse — search results / frequent / repeat-last / «ввести вручную»
  const pickerMode: 'create' | 'chosen' | 'browse' =
    creating || isEmptyShop
      ? 'create'
      : hasModel && !editingModel
        ? 'chosen'
        : 'browse';

  // Programmatic fills use shouldValidate:false on purpose — the zod resolver
  // validates the whole schema, so validating here would light up errors on
  // not-yet-touched fields (price, seller) the moment a model is picked.
  const pick = (u: UnifiedModel) => {
    setValue('category', u.item.category);
    setValue('brand', u.item.brand);
    setValue('model', u.item.model);
    if (u.kind === 'catalog') {
      setValue('specs', u.item.default_specs ?? {});
      if (u.item.photos?.length) onDevicePhotosChange(u.item.photos);
    }
    setQuery('');
    setCreating(false);
    setEditingModel(false);
  };

  // Start a new model: prefill model from the search text, infer brand+category.
  const startCreate = () => {
    const qv = query.trim();
    if (qv) {
      setValue('model', qv);
      const { brand, category } = inferBrandCategory(qv);
      setValue('category', category);
      if (brand && !values.brand.trim()) setValue('brand', brand);
    }
    setCreating(true);
    setEditingModel(false);
  };

  const renderModelCard = (u: UnifiedModel) => {
    const { brand, model, category } = u.item;
    const Icon = CATEGORY_ICON[category];
    const photo = u.kind === 'catalog' ? u.item.photo_urls[0] : undefined;
    return (
      <button
        key={u.kind === 'catalog' ? `c-${u.item.id}` : `r-${brand}-${model}-${category}`}
        type="button"
        onClick={() => pick(u)}
        className="flex cursor-pointer items-center gap-3 rounded-card border border-border bg-bg2 p-3.5 text-left transition-all hover:border-border-strong active:scale-[0.99]"
      >
        {photo ? (
          <img src={photo} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover bg-bg3" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg3 text-text-dim">
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-label font-bold tracking-tight">{brand}</div>
          <div className="truncate text-caption text-text-dim">{model}</div>
        </div>
      </button>
    );
  };

  const browsePicker = (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('purchase.search_model')}
          className="h-12 pl-11 text-body"
          inputMode="search"
        />
      </div>

      {debouncedQuery ? (
        <>
          {results.length > 0 && (
            <div className="grid grid-cols-2 gap-2">{results.map(renderModelCard)}</div>
          )}
          <button
            type="button"
            onClick={startCreate}
            className="card flex cursor-pointer items-center gap-3 p-4 transition-all hover:border-accent/40 active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-faded text-accent">
              <Plus size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0 text-label font-bold tracking-tight">
              {t('purchase.create_model', { query: query.trim() })}
            </div>
          </button>
        </>
      ) : (
        <>
          {lastTpl && (
            <button
              type="button"
              onClick={() => onRepeatLast(lastTpl)}
              aria-label={t('purchase.repeat_last_eyebrow')}
              className="card flex w-full cursor-pointer items-center gap-3 p-3.5 text-left transition-all hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.998]"
            >
              <Repeat size={16} strokeWidth={2.2} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1 truncate text-label">
                <span className="font-bold tracking-tight">
                  {lastTpl.device.brand} {lastTpl.device.model}
                </span>
                <span className="text-text-dim">
                  {' · '}
                  {t('purchase.repeat_last_from', { seller: lastTpl.seller.full_name })}
                </span>
              </div>
              <ChevronRight size={16} className="shrink-0 text-text-muted" />
            </button>
          )}

          <button
            type="button"
            onClick={startCreate}
            className="flex w-fit cursor-pointer items-center gap-1.5 self-center py-1 text-caption font-semibold text-text-dim hover:text-text"
          >
            <Pencil size={13} /> {t('purchase.enter_manually')}
          </button>
        </>
      )}
    </div>
  );

  const createForm = (
    <div className="card flex flex-col gap-4 p-5 md:p-6">
      {!isEmptyShop && (
        <button
          type="button"
          onClick={() => setCreating(false)}
          className="flex w-fit cursor-pointer items-center gap-1.5 text-caption font-semibold text-text-dim hover:text-text"
        >
          <ArrowLeft size={14} /> {t('purchase.back_to_search')}
        </button>
      )}
      {isEmptyShop && (
        <p className="text-caption text-text-muted">{t('purchase.manual_first_hint')}</p>
      )}
      <Field label={t('purchase.category_label')} required>
        <Controller
          control={control}
          name="category"
          render={({ field }) => <CategoryPicker value={field.value} onChange={field.onChange} />}
        />
      </Field>
      <SuggestField
        control={control}
        name="brand"
        suggestField="brand"
        label={t('purchase.brand_label')}
        placeholder={t('purchase.brand_placeholder')}
        required
        error={errors.brand?.message}
      />
      <SuggestField
        control={control}
        name="model"
        suggestField="model"
        brand={values.brand}
        label={t('purchase.model_label')}
        placeholder={t('purchase.model_placeholder')}
        required
        error={errors.model?.message}
      />
    </div>
  );

  const chosenBar = (
    <button
      type="button"
      onClick={() => setEditingModel(true)}
      className="card flex w-full cursor-pointer items-center gap-3 p-3.5 text-left transition-all hover:border-border-strong"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-faded text-success">
        <Check size={18} strokeWidth={2.4} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-body-lg font-bold tracking-tight">
          {values.brand} {values.model}
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-caption font-semibold text-accent">
        <Pencil size={13} /> {t('purchase.change')}
      </span>
    </button>
  );

  return (
    <StepShell
      step={0}
      title={t('purchase.step_device_title')}
      subtitle={t('purchase.step_device_subtitle')}
    >
      {pickerMode === 'create' ? createForm : pickerMode === 'chosen' ? chosenBar : browsePicker}

      {hasModel && (
        <div className="flex flex-col gap-2">
          <div className="px-1 text-caption font-semibold tracking-tight text-text-muted">
            {t('purchase.device_section')}
          </div>
          <DeviceFields
            control={control}
            register={register}
            values={values}
            setValue={(name, v) => setValue(name, v)}
            errors={errors}
            devicePhotos={devicePhotos}
            onDevicePhotosChange={onDevicePhotosChange}
          />
        </div>
      )}
    </StepShell>
  );
}
