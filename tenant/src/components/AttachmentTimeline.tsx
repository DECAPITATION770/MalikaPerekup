/**
 * AttachmentTimeline — chronological story of every file linked to one
 * device.
 *
 * Aggregates attachments across the device + its purchase + its sales so
 * the user reads "what happened to this unit" in one place: seller's
 * passport at intake → device photos → buyer's passport at sale →
 * post-sale warranty card uploaded later.
 *
 * Files are grouped by `kind` for scannability (you can see all
 * receipts at once); within a group sorted by upload time. Each row
 * carries the file type icon, original filename, upload date, and a
 * delete button.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileImage,
  FileText,
  FileX,
  Receipt,
  ShieldCheck,
  User,
  Wrench,
  X,
} from 'lucide-react';

import {
  type AttachmentKind,
  type AttachmentOut,
  deleteAttachment as apiDelete,
} from '@/api/attachments';
import { fmtDate } from '@/lib/fmt';
import { cn } from '@/lib/utils';

interface Props {
  items: AttachmentOut[];
  onChange: (next: AttachmentOut[]) => void;
  /** Hide the per-row delete button — useful when the timeline is embedded
   *  in a read-only context (e.g. shared device card on `/d/:token`). */
  readonly?: boolean;
  /** Empty-state copy. Defaults to a generic "Файлы появятся здесь" — pass
   *  a more specific string when the owning page knows the story. */
  emptyMessage?: string;
}

// Icon + accent tone per attachment kind. Kept in one place so the legend
// at the top of the timeline matches the row icons one-to-one.
const KIND_META: Record<
  AttachmentKind,
  { Icon: typeof FileText; tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  device_photo: { Icon: FileImage, tone: 'accent' },
  seller_doc: { Icon: User, tone: 'warning' },
  buyer_doc: { Icon: User, tone: 'success' },
  receipt: { Icon: Receipt, tone: 'neutral' },
  warranty: { Icon: ShieldCheck, tone: 'success' },
  repair: { Icon: Wrench, tone: 'danger' },
  other: { Icon: FileText, tone: 'neutral' },
};

const TONE_CLS: Record<string, string> = {
  accent: 'bg-accent-faded text-accent',
  success: 'bg-success-faded text-success',
  warning: 'bg-warning-faded text-warning',
  danger: 'bg-danger-faded text-danger',
  neutral: 'bg-bg3 text-text-dim',
};

const isImageMime = (mime: string): boolean => mime.startsWith('image/');

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function AttachmentTimeline({
  items,
  onChange,
  readonly,
  emptyMessage,
}: Props) {
  const { t } = useTranslation();
  const [lightbox, setLightbox] = useState<AttachmentOut | null>(null);

  // Group by kind first, then sort each group by upload time. Empty groups
  // are filtered out so the legend at the top only shows kinds present.
  const groups = useMemo(() => {
    const byKind = new Map<AttachmentKind, AttachmentOut[]>();
    for (const a of items) {
      const list = byKind.get(a.kind) ?? [];
      list.push(a);
      byKind.set(a.kind, list);
    }
    // Stable order: roughly chronological in a typical device's life cycle.
    const order: AttachmentKind[] = [
      'seller_doc',
      'device_photo',
      'buyer_doc',
      'receipt',
      'warranty',
      'repair',
      'other',
    ];
    return order
      .filter((k) => byKind.has(k))
      .map((k) => ({
        kind: k,
        items: (byKind.get(k) ?? []).sort((a, b) =>
          a.uploaded_at.localeCompare(b.uploaded_at),
        ),
      }));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg3 text-text-muted">
          <FileX size={20} />
        </div>
        <p className="text-body text-text-dim">
          {emptyMessage ?? t('attachments.empty')}
        </p>
      </div>
    );
  }

  const remove = async (a: AttachmentOut) => {
    const prev = items;
    onChange(items.filter((x) => x.id !== a.id));
    try {
      await apiDelete(a.id);
    } catch {
      onChange(prev);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {groups.map(({ kind, items: group }) => {
          const meta = KIND_META[kind];
          const tone = TONE_CLS[meta.tone];
          return (
            <section key={kind} className="card flex flex-col gap-3 p-4">
              <header className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg',
                    tone,
                  )}
                  aria-hidden
                >
                  <meta.Icon size={14} strokeWidth={2.1} />
                </span>
                <h3 className="text-label font-semibold tracking-tight text-text">
                  {t(`attachments.kind_${kind}`)}
                </h3>
                <span className="text-hint tabular-nums text-text-muted">
                  · {group.length}
                </span>
              </header>

              <ul className="flex flex-col divide-y divide-border">
                {group.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <button
                      type="button"
                      onClick={() => isImageMime(a.mime_type) && setLightbox(a)}
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg3 transition-transform',
                        isImageMime(a.mime_type) &&
                          'cursor-zoom-in active:scale-95',
                      )}
                      aria-label={
                        isImageMime(a.mime_type)
                          ? t('attachments.open_image')
                          : a.original_name
                      }
                    >
                      {isImageMime(a.mime_type) && a.signed_url ? (
                        <img
                          src={a.signed_url}
                          alt={a.original_name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <FileText size={20} className="text-text-muted" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <a
                        href={a.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-body font-medium text-text hover:text-accent"
                        title={a.original_name}
                      >
                        {a.original_name}
                      </a>
                      <div className="mt-0.5 flex items-center gap-2 text-caption text-text-muted">
                        <span className="tabular-nums">
                          {formatBytes(a.size_bytes)}
                        </span>
                        <span>·</span>
                        <span>{fmtDate(a.uploaded_at)}</span>
                        {a.note && (
                          <>
                            <span>·</span>
                            <span className="truncate text-text-dim">
                              {a.note}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => remove(a)}
                        aria-label={t('common.delete')}
                        className="shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-danger-faded hover:text-danger"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Minimal lightbox — full image on tap-out background. No grid /
          carousel because the timeline is the index; users tap a thumbnail
          when they need to read details on one file. */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.original_name}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <img
            src={lightbox.signed_url}
            alt={lightbox.original_name}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label={t('common.close')}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-bg/90 text-text"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
