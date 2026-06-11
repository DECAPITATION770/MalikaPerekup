/**
 * AttachmentUploader — generic file uploader for any owner entity.
 *
 * Replaces the per-feature DocumentUploader: the owner_type + owner_id
 * pair drive the API endpoint, so the same component works on device,
 * purchase, sale, counterparty cards. Supports any MIME type (image
 * preview when possible, file-icon fallback otherwise).
 *
 * Upload protocol (CLAUDE.md §10): POST /attachments/{type}/{id}/upload-url
 * → presigned PUT URL + persisted DB row → axios PUT bytes straight to
 * MinIO/R2. The API never touches the bytes.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, FileText, Loader2, X } from 'lucide-react';
import axios from 'axios';

import {
  type AttachmentKind,
  type AttachmentOut,
  type AttachmentOwnerType,
  deleteAttachment as apiDelete,
  requestUpload,
} from '@/api/attachments';
import { FilePicker } from '@/components/FilePicker';

interface Props {
  ownerType: AttachmentOwnerType;
  ownerId: number;
  /** Current attachments, fetched by the parent (we patch this list as the
   *  user adds/removes files so the optimistic UI updates without a refetch). */
  items: AttachmentOut[];
  onChange: (next: AttachmentOut[]) => void;
  /** Semantic kind to tag new uploads with. Drives icon + grouping in the
   *  timeline. Defaults to 'other' — pass a more specific kind when the
   *  caller knows the role (e.g. 'seller_doc' inside purchase wizard). */
  kind?: AttachmentKind;
  label?: string;
  /** Hard cap on the number of files. Default 6 mirrors the old
   *  DocumentUploader limit and matches what the API hot path expects. */
  max?: number;
  /** ``accept`` for the file input. ``undefined`` → any file type. */
  accept?: string;
  /** When true the «+» tile keeps rendering even after `max` is reached but
   *  shows as disabled. Useful when we want the affordance always present. */
  alwaysShowAdd?: boolean;
}

interface PendingMeta {
  /** ObjectURL for image preview while bytes are uploading. */
  previewUrl?: string;
  filename: string;
  isImage: boolean;
}

const isImageMime = (mime: string): boolean => mime.startsWith('image/');

export default function AttachmentUploader({
  ownerType,
  ownerId,
  items,
  onChange,
  kind = 'other',
  label,
  max = 6,
  accept,
  alwaysShowAdd,
}: Props) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingMeta[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Revoke pending objectURLs on unmount to avoid leaks during long sessions.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(
    () => () => {
      for (const p of pendingRef.current) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
    },
    [],
  );

  const remaining = max - items.length - pending.length;
  const canAdd = remaining > 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErr(null);
    const queue = Array.from(files).slice(0, remaining);

    // Stage previews immediately so the user sees motion the moment the
    // picker closes — the network round-trip can be 1–3 s on rural Uzbek
    // mobile, which feels broken without a placeholder.
    const stagedPreviews: PendingMeta[] = queue.map((f) => ({
      filename: f.name,
      isImage: isImageMime(f.type || ''),
      previewUrl: isImageMime(f.type || '')
        ? URL.createObjectURL(f)
        : undefined,
    }));
    setPending((p) => [...p, ...stagedPreviews]);

    const uploaded: AttachmentOut[] = [];
    for (const [i, file] of queue.entries()) {
      try {
        const { url, attachment_id } = await requestUpload(ownerType, ownerId, {
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          kind,
        });
        await axios.put(url, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        // Synthesise the new AttachmentOut locally so we don't refetch the
        // whole list — the parent's `items` arr just grows by one. The
        // signed_url falls back to the local objectURL until the next refetch
        // mints a fresh GET URL; both work in <img src>.
        uploaded.push({
          id: attachment_id,
          owner_type: ownerType,
          owner_id: ownerId,
          kind,
          original_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          note: null,
          sort_order: items.length + uploaded.length,
          uploaded_at: new Date().toISOString(),
          signed_url: stagedPreviews[i].previewUrl ?? '',
        });
      } catch {
        setErr(t('common.upload_failed'));
      }
    }
    onChange([...items, ...uploaded]);
    // Clear staged previews — they're now reflected in the parent's items.
    setPending((p) => {
      // Drop the prefix we just staged. Anything after (a concurrent batch)
      // stays. JS arrays are reference-stable for objects in the rest.
      const dropped = stagedPreviews.length;
      return p.slice(dropped);
    });
    for (const p of stagedPreviews) {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    }
  };

  const remove = async (id: number) => {
    // Optimistic remove — restore on failure. The DELETE is idempotent on
    // the server (404 means already gone, which is fine).
    const prev = items;
    onChange(items.filter((a) => a.id !== id));
    try {
      await apiDelete(id);
    } catch {
      onChange(prev);
      setErr(t('common.upload_failed'));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-label font-medium tracking-tight text-text-dim">
          {label}
        </label>
      )}
      <div className="flex flex-wrap items-start gap-2">
        {items.map((a) => (
          <div
            key={a.id}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-bg3"
          >
            {isImageMime(a.mime_type) && a.signed_url ? (
              <img
                src={a.signed_url}
                alt={a.original_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-text-dim">
                <FileText size={20} />
                <span className="w-full truncate text-center text-micro leading-tight text-text-muted">
                  {a.original_name}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(a.id)}
              aria-label={t('common.delete')}
              className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-bg/80 text-text backdrop-blur transition-colors hover:bg-danger hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {pending.map((p, i) => (
          <div
            key={`pending-${i}`}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-bg3"
          >
            {p.previewUrl ? (
              <img src={p.previewUrl} alt="" className="h-full w-full object-cover opacity-60" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-muted">
                <FileText size={20} />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-bg/40">
              <Loader2 size={18} className="animate-spin text-text" />
            </div>
          </div>
        ))}

        {(canAdd || alwaysShowAdd) && (
          <FilePicker onPick={handleFiles} disabled={!canAdd} accept={accept} />
        )}
      </div>
      {err && (
        <span className="flex items-center gap-1 text-hint text-danger">
          <AlertCircle size={11} />
          {err}
        </span>
      )}
    </div>
  );
}
