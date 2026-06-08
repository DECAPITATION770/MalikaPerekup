import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, X, ArrowLeft } from 'lucide-react';
import { listCounterparties, type CounterpartyOut, type CounterpartyType } from '@/api/counterparties';
import { useDebounced } from '@/lib/useDebounced';
import { RoleBadge } from '@/components/CounterpartyRoleBadge';

// ─── Counterparty autocomplete (works for both seller in purchase and
//     buyer in sale; pass `type` to scope the search). ──────────────────

export function SellerSearch({
  disabled, onPick, type, placeholderKey = 'purchase.seller_search_placeholder',
}: {
  disabled: boolean;
  onPick: (cp: CounterpartyOut) => void;
  /** Optional role hint — leave undefined to show all counterparties (a past
   *  seller can be today's buyer and vice versa). */
  type?: CounterpartyType;
  placeholderKey?: string;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQ = useDebounced(q.trim(), 250);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['counterparties', 'search', type, { q: debouncedQ }],
    queryFn: () => listCounterparties({ q: debouncedQ, type, limit: 6 }),
    enabled: !disabled && debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (disabled) {
      setQ(''); setOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (disabled) return null;

  const items = query.data?.items ?? [];
  const showDropdown = open && debouncedQ.length >= 2 && (query.isFetching || items.length > 0);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 bg-bg2 rounded-xl border border-border focus-within:border-accent transition-colors h-12 px-3.5">
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t(placeholderKey)}
          className="flex-1 bg-transparent outline-none text-body placeholder:text-text-muted"
          spellCheck={false}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); setOpen(false); }}
            className="text-text-muted hover:text-text p-0.5 cursor-pointer"
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-30 left-0 right-0 mt-1 card-elev shadow-2xl overflow-hidden animate-fade-in max-h-[300px] overflow-y-auto">
          {query.isFetching && items.length === 0 ? (
            <div className="px-4 py-3 text-label text-text-muted">{t('common.loading')}</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-3 text-label text-text-muted">—</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((cp) => (
                <li key={cp.id}>
                  <button
                    type="button"
                    onClick={() => { onPick(cp); setOpen(false); setQ(''); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-bg3 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-body font-semibold tracking-tight truncate">{cp.full_name}</div>
                        <RoleBadge type={cp.type} />
                      </div>
                      <div className="text-caption text-text-muted font-mono truncate">
                        {cp.phone ?? '—'}
                      </div>
                    </div>
                    <ArrowLeft size={14} className="text-text-muted rotate-180 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
