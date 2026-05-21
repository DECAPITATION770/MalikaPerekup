import { useState, useEffect, useRef } from 'react';
import { useController, type Control } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import Input from '../../components/ui/Input';
import { getDeviceSuggestions } from '../../api/devices';
import { useDebounced } from '../../lib/useDebounced';
import type { FormValues } from './types';

// ─── Brand / model autocomplete (own shop history) ──────────────────────

export function SuggestField({
  control, name, suggestField, brand, label, placeholder, required, error,
}: {
  control: Control<FormValues>;
  name: 'brand' | 'model';
  suggestField: 'brand' | 'model';
  brand?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  const { field } = useController({ control, name });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const value = String(field.value ?? '');
  const debounced = useDebounced(value.trim(), 250);

  const q = useQuery({
    queryKey: ['device-suggestions', suggestField, debounced, brand?.trim() ?? ''],
    queryFn: () =>
      getDeviceSuggestions({
        field: suggestField,
        q: debounced,
        brand: suggestField === 'model' ? brand?.trim() || undefined : undefined,
        limit: 8,
      }),
    enabled: open && debounced.length >= 1,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Drop a suggestion identical to what's already typed — nothing to pick.
  const items = (q.data ?? []).filter(
    (s) => s.toLowerCase() !== value.trim().toLowerCase(),
  );
  const showDropdown = open && debounced.length >= 1 && items.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <Input
        label={label}
        placeholder={placeholder}
        required={required}
        error={error}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => { field.onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={field.onBlur}
        name={field.name}
        ref={field.ref}
      />
      {showDropdown && (
        <div className="absolute z-30 top-full left-0 right-0 -mt-1 card-elev shadow-2xl overflow-hidden animate-fade-in max-h-[260px] overflow-y-auto">
          <ul className="divide-y divide-border">
            {items.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { field.onChange(s); setOpen(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-bg3 text-body font-medium tracking-tight cursor-pointer transition-colors"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
