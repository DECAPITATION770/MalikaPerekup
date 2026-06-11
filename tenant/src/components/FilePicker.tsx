/**
 * FilePicker — the unified "+ файл" add-tile used by every uploader.
 *
 * Tapping the tile opens the OS-native file picker directly. We don't gate it
 * behind a custom Камера/Галерея/Файл sheet — on mobile the system picker
 * already offers camera, photo library and files, and the extra sheet was
 * just one more tap. No `accept` restriction by default → any file type; the
 * MIME is read from the chosen file.
 *
 * Hidden input uses `sr-only` (not `hidden`/display:none) because Telegram
 * WebView and old iOS Safari silently ignore a programmatic `.click()` on a
 * `display:none` input — the picker never opens.
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

interface Props {
  onPick: (files: FileList | null) => void;
  disabled?: boolean;
  /** `accept` for the file input. `undefined` (default) → any file type. */
  accept?: string;
  /** Tile label — defaults to the shared "Добавить файл" copy. */
  label?: string;
}

export function FilePicker({ onPick, disabled, accept, label }: Props) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPick(e.target.files);
    e.target.value = ''; // allow re-picking the same file
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          haptic.tap('light');
          inputRef.current?.click();
        }}
        className={cn(
          'flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-text-dim transition-all hover:border-border-strong hover:text-text active:scale-[0.98]',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <Plus size={18} />
        <span className="text-micro font-semibold">{label ?? t('common.add_file')}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handle}
      />
    </>
  );
}
