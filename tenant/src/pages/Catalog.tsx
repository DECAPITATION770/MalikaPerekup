/**
 * Catalog (номенклатура) — the shop's reusable device templates: default
 * specs + a photo per model so the purchase wizard pre-fills instead of
 * re-typing (CLAUDE.md §15). Per-shop; filled by hand here and automatically
 * on every purchase. List + search + category filter, add/edit in a Sheet.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search as SearchIcon, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import BrandBadge from '@/components/BrandBadge';
import DevicePhoto from '@/components/DevicePhoto';
import DocumentUploader from '@/components/DocumentUploader';
import SpecsForm from '@/pages/purchase/SpecsForm';
import { CATEGORY_ICON, CategoryPicker, Field, OptionalGroup } from '@/pages/purchase/primitives';
import {
  createCatalogModel,
  deleteCatalogModel,
  listCatalog,
  requestCatalogUploadUrl,
  updateCatalogModel,
  type CatalogModelOut,
} from '@/api/catalog';
import type { DeviceCategory } from '@/api/devices';
import { useDebounced } from '@/lib/useDebounced';
import { useTgHaptic } from '@/lib/telegram';

/** "8/256 · Чёрный" — a one-line read of the spec chips that matter at a glance. */
function specSummary(specs: Record<string, unknown>): string {
  const ram = specs.ram_gb;
  const storage = specs.storage_gb;
  const color = specs.color;
  const parts: string[] = [];
  if (ram && storage) parts.push(`${ram}/${storage}`);
  else if (storage) parts.push(String(storage));
  if (color) parts.push(String(color));
  return parts.join(' · ');
}

interface FormState {
  id?: number;
  category: DeviceCategory;
  brand: string;
  model: string;
  default_specs: Record<string, unknown>;
  photos: string[];
}

const EMPTY_FORM: FormState = {
  category: 'phone',
  brand: '',
  model: '',
  default_specs: {},
  photos: [],
};

export default function Catalog() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const haptic = useTgHaptic();

  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q.trim(), 300);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CatalogModelOut | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog', debouncedQ],
    queryFn: () => listCatalog({ q: debouncedQ || undefined, limit: 100 }),
  });

  const items = data?.items ?? [];

  const saveMut = useMutation({
    mutationFn: (f: FormState) => {
      const payload = {
        category: f.category,
        brand: f.brand.trim(),
        model: f.model.trim(),
        default_specs: f.default_specs,
        photos: f.photos,
      };
      return f.id ? updateCatalogModel(f.id, payload) : createCatalogModel(payload);
    },
    onSuccess: () => {
      haptic.notify('success');
      toast.success(t('catalog.saved'));
      qc.invalidateQueries({ queryKey: ['catalog'] });
      setEditing(null);
    },
    onError: (err: unknown) => {
      haptic.notify('error');
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status === 409 ? t('catalog.duplicate') : t('common.error_load'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCatalogModel(id),
    onSuccess: () => {
      haptic.notify('success');
      toast.success(t('catalog.deleted'));
      qc.invalidateQueries({ queryKey: ['catalog'] });
      setConfirmDelete(null);
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('common.error_load'));
    },
  });

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header — compact inline title on mobile (count appended), full
          heading + side action on desktop. Matches the list-page hero idiom
          shared with Stock/Sales. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 md:hidden">
        <h1 className="font-display text-title font-semibold tracking-[-0.03em]">
          {t('catalog.title')}
        </h1>
        <span className="text-body text-text-dim">
          {(data?.total ?? 0) > 0
            ? `· ${t('catalog.total', { count: data!.total })}`
            : `· ${t('catalog.subtitle')}`}
        </span>
      </div>
      <div className="hidden items-start justify-between gap-3 md:flex">
        <div>
          <h1 className="font-display text-title font-semibold tracking-[-0.03em]">
            {t('catalog.title')}
          </h1>
          <p className="text-body text-text-dim mt-0.5">
            {(data?.total ?? 0) > 0
              ? t('catalog.total', { count: data!.total })
              : t('catalog.subtitle')}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setEditing({ ...EMPTY_FORM })}>
          <Plus className="size-4" />
          {t('catalog.add')}
        </Button>
      </div>

      {/* Sticky search + add-CTA strip on mobile — sticks flush under the
          AppHeader (which is itself sticky at top-0 + safe-area padding) so
          notched devices don't ghost the strip behind the chrome. Desktop
          flattens the strip back into the page flow. */}
      <div
        className="sticky z-30 -mx-4 flex items-center gap-2 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
      >
        <div className="relative flex-1">
          <SearchIcon
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('catalog.search')}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            className="pl-10"
          />
        </div>
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY_FORM })}
          aria-label={t('catalog.add')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-bg2 text-text-dim transition-colors hover:border-border-strong hover:text-text md:hidden"
        >
          <Plus size={18} aria-hidden />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-4 text-body text-danger">{t('common.error_load')}</div>
      ) : items.length === 0 ? (
        <EmptyState
          illustration={
            <div className="w-14 h-14 rounded-card bg-bg3 flex items-center justify-center text-text-muted">
              <Plus size={24} />
            </div>
          }
          title={t('catalog.empty_title')}
          description={t('catalog.empty_body')}
          action={
            !debouncedQ && (
              <Button variant="secondary" onClick={() => setEditing({ ...EMPTY_FORM })}>
                <Plus className="size-4" />
                {t('catalog.add')}
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((m) => {
            const Icon = CATEGORY_ICON[m.category];
            const summary = specSummary(m.default_specs);
            return (
              <div
                key={m.id}
                className="card flex items-center gap-3 px-4 py-3 transition-all hover:border-border-strong"
              >
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: m.id,
                      category: m.category,
                      brand: m.brand,
                      model: m.model,
                      default_specs: { ...(m.default_specs ?? {}) },
                      photos: [...(m.photos ?? [])],
                    })
                  }
                  className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer"
                >
                  {/* DevicePhoto guards against 404 from presigned-URL drift;
                      a bare <img> would leave a broken-image glyph in the
                      list. Falls back to the same category-icon tile. */}
                  <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-bg3 flex items-center justify-center text-text-muted">
                    <DevicePhoto
                      src={m.photo_urls[0]}
                      alt={`${m.brand} ${m.model}`}
                      fallback={<Icon size={20} />}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BrandBadge brand={m.brand} />
                      <span className="text-body-lg font-bold tracking-tight truncate">
                        {m.model}
                      </span>
                    </div>
                    <div className="text-hint text-text-dim mt-0.5">
                      {[t(`category.${m.category}`), summary].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </button>
                {m.purchase_count > 0 && (
                  // `title` is the hover-tooltip for sighted users; SRs read
                  // `aria-label`. Setting both to the same copy made SRs
                  // announce the chip twice — drop the `title` and let the
                  // accessible name carry the meaning.
                  <div
                    aria-label={t('catalog.purchase_count', { n: m.purchase_count })}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-bg3 px-2.5 text-caption font-bold tabular-nums text-text-dim"
                  >
                    <ShoppingCart size={12} strokeWidth={2} aria-hidden />
                    {m.purchase_count}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmDelete(m)}
                  aria-label={t('common.delete')}
                  className="shrink-0 p-2 rounded-lg text-text-muted hover:bg-danger-faded/40 hover:text-danger transition-colors cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <CatalogFormSheet
        form={editing}
        onClose={() => setEditing(null)}
        onSave={(f) => saveMut.mutate(f)}
        saving={saveMut.isPending}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('catalog.delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? t('catalog.delete_body', {
                    name: `${confirmDelete.brand} ${confirmDelete.model}`,
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
              className="bg-danger text-white hover:bg-danger/90"
            >
              <Trash2 className="size-4" /> {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CatalogFormSheet({
  form,
  onClose,
  onSave,
  saving,
}: {
  form: FormState | null;
  onClose: () => void;
  onSave: (f: FormState) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (form) setDraft(form);
  }, [form]);

  const valid = draft.brand.trim().length > 0 && draft.model.trim().length > 0;
  const hasExtra =
    Object.keys(draft.default_specs).length > 0 || draft.photos.length > 0;

  return (
    <Sheet open={!!form} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{draft.id ? t('catalog.edit') : t('catalog.add')}</SheetTitle>
          <SheetDescription>{t('catalog.form_hint')}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          <Field label={t('purchase.category_label')} required>
            <CategoryPicker
              value={draft.category}
              onChange={(category) => setDraft((d) => ({ ...d, category }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('catalog.brand')} required>
              <Input
                value={draft.brand}
                onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                placeholder="Apple"
              />
            </Field>
            <Field label={t('catalog.model')} required>
              <Input
                value={draft.model}
                onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                placeholder="iPhone 14 Pro"
              />
            </Field>
          </div>

          <OptionalGroup
            key={draft.id ?? 'new'}
            defaultOpen={hasExtra}
            bodyClassName="mt-4 flex flex-col gap-4 animate-fade-in"
          >
            <SpecsForm
              category={draft.category}
              value={draft.default_specs}
              onChange={(default_specs) => setDraft((d) => ({ ...d, default_specs }))}
            />
            <Field label={t('catalog.photos')}>
              <DocumentUploader
                value={draft.photos}
                onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
                requestUploadUrl={requestCatalogUploadUrl}
                accept="image/*"
                max={3}
              />
            </Field>
          </OptionalGroup>
        </div>

        <SheetFooter>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => onSave(draft)}
            disabled={!valid || saving}
            className="flex-1"
          >
            {t('common.save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
