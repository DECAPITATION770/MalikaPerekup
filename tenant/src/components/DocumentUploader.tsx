import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, X, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface Props {
  value: string[];                                     // current S3 keys
  onChange: (next: string[]) => void;
  /** Hits POST /<scope>/upload-url to get a signed PUT URL + key. */
  requestUploadUrl: (filename: string) => Promise<{ url: string; key: string }>;
  label?: string;
  max?: number;
  accept?: string;
}

/** PII upload pattern from CLAUDE.md §10: the Mini App signs a short-lived
 *  presigned PUT URL on the server, then uploads bytes straight to MinIO/R2.
 *  The API never touches the file — only stores the resulting key. */
export default function DocumentUploader({
  value, onChange, requestUploadUrl, label, max = 6, accept = 'image/*,application/pdf',
}: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);

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
        onChange([...value, key]);
      } catch {
        setErr(t('common.upload_failed'));
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const canAdd = value.length + busy < max;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-label text-text-dim font-medium tracking-tight">{label}</label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {value.map((_, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-bg3 text-label font-semibold text-text"
          >
            <Paperclip size={13} className="text-success" />
            {t('common.photo_n', { n: i + 1 })}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove"
              className="text-text-muted hover:text-danger ml-0.5 -mr-1 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <span
            key={`busy-${i}`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-bg2 text-label text-text-muted"
          >
            <Loader2 size={13} className="animate-spin" />
            {t('common.uploading')}
          </span>
        ))}
        {canAdd && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-dashed border-border text-label font-semibold text-text-dim hover:text-text hover:border-border-strong active:scale-[0.98] transition-all cursor-pointer"
            >
              <Paperclip size={14} />
              {t('common.add_photo')}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
          </>
        )}
      </div>
      {err && (
        <span className="text-xs text-danger flex items-center gap-1">
          <AlertCircle size={11} />{err}
        </span>
      )}
    </div>
  );
}
