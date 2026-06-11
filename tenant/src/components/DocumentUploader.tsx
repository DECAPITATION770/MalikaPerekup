import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, AlertCircle, FileText } from 'lucide-react';
import axios from 'axios';

import { FilePicker } from '@/components/FilePicker';

interface Props {
  value: string[];                                     // current S3 keys
  onChange: (next: string[]) => void;
  /** Hits POST /<scope>/upload-url to get a signed PUT URL + key. */
  requestUploadUrl: (filename: string) => Promise<{ url: string; key: string }>;
  label?: string;
  max?: number;
  /** ``accept`` for the file input. ``undefined`` (default) → any file type. */
  accept?: string;
}

/** Local metadata for a freshly-uploaded file, keyed by its S3 key. Lets us
 *  render a real thumbnail / filename without a signed-GET round-trip — we
 *  still have the original ``File`` in this session. */
interface FileMeta {
  name: string;
  isImage: boolean;
  url?: string;            // objectURL for image previews (revoked on remove)
}

/** PII upload pattern from CLAUDE.md §10: the Mini App signs a short-lived
 *  presigned PUT URL on the server, then uploads bytes straight to MinIO/R2.
 *  The API never touches the file — only stores the resulting key.
 *
 *  Shows a thumbnail for images and an icon + filename for anything else,
 *  each with a delete button. Accepts any file type by default. */
export default function DocumentUploader({
  value, onChange, requestUploadUrl, label, max = 6, accept,
}: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, FileMeta>>({});

  // Revoke any outstanding objectURLs when the component unmounts.
  const metaRef = useRef(meta);
  metaRef.current = meta;
  useEffect(
    () => () => {
      for (const m of Object.values(metaRef.current)) {
        if (m.url) URL.revokeObjectURL(m.url);
      }
    },
    [],
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErr(null);
    const remaining = max - value.length;
    const queue = Array.from(files).slice(0, remaining);

    for (const file of queue) {
      setBusy((n) => n + 1);
      try {
        const { url, key } = await requestUploadUrl(file.name);
        await axios.put(url, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        const isImage = file.type.startsWith('image/');
        setMeta((prev) => ({
          ...prev,
          [key]: {
            name: file.name,
            isImage,
            url: isImage ? URL.createObjectURL(file) : undefined,
          },
        }));
        onChange([...value, key]);
      } catch {
        setErr(t('common.upload_failed'));
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  const remove = (i: number) => {
    const key = value[i];
    const m = meta[key];
    if (m?.url) URL.revokeObjectURL(m.url);
    if (key) {
      setMeta((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    onChange(value.filter((_, idx) => idx !== i));
  };

  const canAdd = value.length + busy < max;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-label text-text-dim font-medium tracking-tight">{label}</label>
      )}
      <div className="flex flex-wrap items-start gap-2">
        {value.map((key, i) => {
          const m = meta[key];
          return (
            <div
              key={key}
              className="relative w-20 h-20 rounded-xl overflow-hidden border border-border bg-bg3 shrink-0"
            >
              {m?.isImage && m.url ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-1.5 text-text-dim">
                  <FileText size={20} />
                  <span className="text-micro text-text-muted truncate w-full text-center leading-tight">
                    {m?.name ?? t('common.file_n', { n: i + 1 })}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={t('common.delete')}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-bg/80 backdrop-blur flex items-center justify-center text-text hover:bg-danger hover:text-white transition-colors cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {Array.from({ length: busy }).map((_, i) => (
          <div
            key={`busy-${i}`}
            className="w-20 h-20 rounded-xl border border-border bg-bg2 flex items-center justify-center text-text-muted shrink-0"
          >
            <Loader2 size={18} className="animate-spin" />
          </div>
        ))}

        {canAdd && <FilePicker onPick={handleFiles} accept={accept} />}
      </div>
      {err && (
        <span className="text-hint text-danger flex items-center gap-1">
          <AlertCircle size={11} />{err}
        </span>
      )}
    </div>
  );
}
