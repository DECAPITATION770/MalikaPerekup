import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

/** Returns page numbers / null (=ellipsis) using a 7-slot window. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | null)[] = [1];
  if (current > 4) out.push(null);
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) out.push(p);
  if (current < total - 3) out.push(null);
  out.push(total);
  return out;
}

export default function Pagination({ total, limit, offset, onChange }: Props) {
  const { t } = useTranslation();
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;

  const goto = (p: number) => onChange((p - 1) * limit);
  const win = pageWindow(page, pages);
  const pillBase = 'h-8 min-w-[32px] px-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer';

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1 text-text-dim">
      <button
        onClick={() => goto(page - 1)}
        disabled={page === 1}
        aria-label={t('common.prev')}
        className={`${pillBase} hover:bg-bg2 disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <ChevronLeft size={16} />
      </button>
      {win.map((p, i) =>
        p === null ? (
          <span key={`e${i}`} className="px-1 text-text-muted text-xs select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => goto(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${pillBase} ${p === page ? 'bg-accent text-white' : 'hover:bg-bg2 text-text-dim'}`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => goto(page + 1)}
        disabled={page >= pages}
        aria-label={t('common.next')}
        className={`${pillBase} hover:bg-bg2 disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
