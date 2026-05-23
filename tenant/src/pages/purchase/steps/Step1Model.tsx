import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Controller, type Control, type UseFormSetValue } from 'react-hook-form';
import { ArrowLeft, ChevronRight, Pencil, Plus, Repeat, Search } from 'lucide-react';

import { getRecentModels, type RecentModelOut } from '@/api/devices';
import { listCatalog, type CatalogModelOut } from '@/api/catalog';
import { POPULAR_BRANDS } from '@/lib/popularBrands';
import { brandColor, brandTint } from '@/lib/brand';
import { getLastPurchase, type LastPurchaseTemplate } from '@/api/purchases';
import { Input } from '@/components/ui/input';
import { useDebounced } from '@/lib/useDebounced';

import { StepShell } from '../Wizard';
import { CATEGORY_ICON, CategoryPicker, Field } from '../primitives';
import { SuggestField } from '../SuggestField';
import { conditionFromDefects, type FormValues } from '../types';

interface Props {
  control: Control<FormValues>;
  values: FormValues;
  setValue: UseFormSetValue<FormValues>;
  /** Called when user taps the "Повторить последнюю" shortcut — parent jumps to step 4. */
  onRepeatLast: (tpl: LastPurchaseTemplate) => void;
  /** Called when a catalog template is picked — parent pre-fills specs + photos. */
  onPickCatalog: (m: CatalogModelOut) => void;
  /** Called when a chip or the manual fields produce a complete (brand, model). */
  onPicked: () => void;
  errors: { brand?: string; model?: string };
}

/** Catalog templates and purchase history collapse into one searchable pool.
 *  Catalog entries are richer (specs + photo + autofill) so they win on a tie. */
type UnifiedModel =
  | { kind: 'catalog'; item: CatalogModelOut }
  | { kind: 'recent'; item: RecentModelOut };

const FREQUENT_COUNT = 4;
const VISIBLE_BRANDS = 6;

export default function Step1Model({
  control,
  values,
  setValue,
  onRepeatLast,
  onPickCatalog,
  onPicked,
  errors,
}: Props) {
  const { t } = useTranslation();
  const [manual, setManual] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query.trim().toLowerCase(), 200);

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

  const { data: catalogPage } = useQuery({
    queryKey: ['catalog', 'wizard'],
    queryFn: () => listCatalog({ limit: 100 }),
    staleTime: 60_000,
  });

  // Merge catalog (sorted by frequency) + history, deduped by brand+model.
  // Frequency-ranked catalog keeps positions stable so the eye/finger learns
  // them — recency would reshuffle the list after every purchase.
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

  const pickChip = (m: RecentModelOut) => {
    setValue('category', m.category, { shouldValidate: true });
    setValue('brand', m.brand, { shouldValidate: true });
    setValue('model', m.model, { shouldValidate: true });
    onPicked();
  };

  const pick = (u: UnifiedModel) =>
    u.kind === 'catalog' ? onPickCatalog(u.item) : pickChip(u.item);

  // Start a brand-new model: prefill the typed text as the model name, then
  // open the manual form so the user picks category + brand.
  const createNew = () => {
    if (query.trim()) setValue('model', query.trim(), { shouldValidate: true });
    setManual(true);
  };

  const renderModelCard = (u: UnifiedModel) => {
    const { brand, model, category } = u.item;
    const Icon = CATEGORY_ICON[category];
    const active = values.brand === brand && values.model === model;
    const photo = u.kind === 'catalog' ? u.item.photo_urls[0] : undefined;
    return (
      <button
        key={u.kind === 'catalog' ? `c-${u.item.id}` : `r-${brand}-${model}-${category}`}
        type="button"
        onClick={() => pick(u)}
        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
          active
            ? 'border-accent/50 bg-accent-faded text-accent'
            : 'border-border bg-bg2 hover:border-border-strong active:scale-[0.99]'
        }`}
      >
        {photo ? (
          <img src={photo} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover bg-bg3" />
        ) : (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-accent/20 text-accent' : 'bg-bg3 text-text-dim'}`}
          >
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

  // ─── Manual create form (category + brand + model) ───────────────────
  const popular = POPULAR_BRANDS[values.category] ?? [];
  const shownBrands = showAllBrands ? popular : popular.slice(0, VISIBLE_BRANDS);
  const manualFields = (
    <div className="flex animate-fade-up flex-col gap-4">
      <Field label={t('purchase.category_label')} required>
        <Controller
          control={control}
          name="category"
          render={({ field }) => <CategoryPicker value={field.value} onChange={field.onChange} />}
        />
      </Field>

      {popular.length > 0 && (
        <Field label={t('purchase.brand_label')} required>
          <div className="mb-1 grid grid-cols-3 gap-2 md:grid-cols-6">
            {shownBrands.map((brand) => {
              const active = values.brand === brand;
              return (
                <button
                  key={brand}
                  type="button"
                  onClick={() => setValue('brand', brand, { shouldValidate: true })}
                  className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition-all ${
                    active
                      ? 'border-accent/50 bg-accent-faded text-accent shadow-glow-accent'
                      : 'border-border bg-bg2 text-text-dim hover:border-border-strong hover:text-text'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label font-bold ${active ? 'bg-accent/20 text-accent' : ''}`}
                    style={
                      active
                        ? undefined
                        : { backgroundColor: brandTint(brand, 0.16), color: brandColor(brand) }
                    }
                  >
                    {brand[0]}
                  </span>
                  <span className="truncate text-caption font-semibold tracking-tight">
                    {brand}
                  </span>
                </button>
              );
            })}
          </div>
          {popular.length > VISIBLE_BRANDS && !showAllBrands && (
            <button
              type="button"
              onClick={() => setShowAllBrands(true)}
              className="mb-1 cursor-pointer text-caption font-semibold text-accent hover:underline"
            >
              {t('purchase.more_brands')}
            </button>
          )}
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

  // First-use (nothing saved) → manual form straight away. Also stay in manual
  // when a brand is already set (e.g. restored draft) that isn't a saved model.
  const forcedManual = !lastTpl && myModels.length === 0;
  const showManual =
    manual ||
    forcedManual ||
    (!!values.brand &&
      !myModels.some((u) => u.item.brand === values.brand && u.item.model === values.model));

  // ── Manual mode: focused sub-screen ──
  if (showManual) {
    return (
      <StepShell step={0} title={t('purchase.step1_title')} subtitle={t('purchase.step1_subtitle')}>
        {!forcedManual && (
          <button
            type="button"
            onClick={() => setManual(false)}
            className="flex w-fit cursor-pointer items-center gap-1.5 text-caption font-semibold text-text-dim hover:text-text"
          >
            <ArrowLeft size={14} /> {t('purchase.back_to_search')}
          </button>
        )}
        <div className="card p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2 text-caption text-text-muted">
            <Pencil size={13} className="text-text-dim" />
            <span className="font-semibold uppercase tracking-wider">
              {t('purchase.other_model')}
            </span>
          </div>
          {manualFields}
        </div>
        <input type="hidden" {...{ value: conditionFromDefects(values.defects) }} />
      </StepShell>
    );
  }

  // ── Search-first browse mode ──
  const frequent = myModels.slice(0, FREQUENT_COUNT);

  return (
    <StepShell step={0} title={t('purchase.step1_title')} subtitle={t('purchase.step1_subtitle')}>
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
            onClick={createNew}
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

          {frequent.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="px-1 text-caption font-semibold uppercase tracking-wider text-text-muted">
                {t('purchase.frequent')}
              </div>
              <div className="grid grid-cols-2 gap-2">{frequent.map(renderModelCard)}</div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setManual(true)}
            className="flex w-fit cursor-pointer items-center gap-1.5 self-center py-1 text-caption font-semibold text-text-dim hover:text-text"
          >
            <Pencil size={13} /> {t('purchase.enter_manually')}
          </button>
        </>
      )}

      {/* Help text: condition starts at 'new' until step 2's defect list says otherwise */}
      <input type="hidden" {...{ value: conditionFromDefects(values.defects) }} />
    </StepShell>
  );
}
