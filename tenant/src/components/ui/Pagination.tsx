import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

export default function Pagination({ total, limit, offset, onChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  if (totalPages <= 1) return null;

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between gap-3 mt-6 animate-fade-in">
      <div className="text-xs text-text-muted tabular-nums">
        {currentPage} / {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => canPrev && onChange(Math.max(0, offset - limit))}
          disabled={!canPrev}
          className="h-9 w-9 rounded-lg border border-border bg-bg2 hover:bg-bg3 hover:border-border-strong text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => canNext && onChange(offset + limit)}
          disabled={!canNext}
          className="h-9 w-9 rounded-lg border border-border bg-bg2 hover:bg-bg3 hover:border-border-strong text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
