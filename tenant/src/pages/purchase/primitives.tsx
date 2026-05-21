import { forwardRef, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Smartphone, Tablet, Laptop, Watch, Headphones, Package as PackageIcon,
  Check, type LucideIcon,
} from 'lucide-react';
import type { DeviceCategory } from '../../api/devices';
import { CATEGORIES } from './types';

export const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  phone: Smartphone, tablet: Tablet, laptop: Laptop, smartwatch: Watch,
  accessory: Headphones, other: PackageIcon,
};

// ─── Progress badge ─────────────────────────────────────────────────────

export function ProgressBadge({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  const all = done === total;
  return (
    <div
      className={`shrink-0 px-3 h-9 rounded-full border text-hint font-bold tabular-nums tracking-tight flex items-center gap-1.5 transition-colors
        ${all
          ? 'bg-success-faded border-success/40 text-success'
          : 'bg-bg2 border-border text-text-dim'}`}
    >
      {all && <Check size={14} />}
      {t('purchase.section_progress', { n: done, total })}
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────

export function Section({
  number, title, hint, children, delay, completed,
}: {
  number: number; title: string; hint: string;
  children: ReactNode; delay: number; completed: boolean;
}) {
  return (
    <section
      className={`card p-5 md:p-6 flex flex-col gap-4 animate-fade-up transition-colors
        ${completed ? 'border-success/30' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-label font-bold tabular-nums transition-all
            ${completed
              ? 'bg-success-faded text-success'
              : 'bg-accent-faded text-accent'}`}
        >
          {completed ? <Check size={16} /> : number}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-body-xl md:text-subhead font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-text-muted mt-0.5">{hint}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label text-text-dim font-medium tracking-tight flex items-center gap-1">
        {label}
        {required && <span className="text-danger" aria-hidden="true">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Category picker (icon grid) ────────────────────────────────────────

export function CategoryPicker({ value, onChange }: { value: DeviceCategory; onChange: (v: DeviceCategory) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICON[c];
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`flex flex-col items-center gap-1.5 p-3.5 rounded-xl border transition-all cursor-pointer
              ${active
                ? 'bg-accent-faded border-accent/50 text-accent'
                : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="text-caption font-semibold tracking-tight">{t(`category.${c}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Segmented row (radio chips) ────────────────────────────────────────

export function SegmentedRow<T extends string>({
  value, onChange, options, allowEmpty = false,
}: {
  value: T | '';
  onChange: (v: T | '') => void;
  options: { value: T; label: string }[];
  allowEmpty?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(allowEmpty && active ? ('' as T | '') : o.value)}
            className={`h-11 px-4 rounded-lg border text-hint font-semibold tracking-tight transition-all cursor-pointer
              ${active
                ? 'bg-accent-faded border-accent/40 text-accent'
                : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Textarea ───────────────────────────────────────────────────────────

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, ...rest }, ref,
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-label text-text-dim font-medium tracking-tight">{label}</label>
      )}
      <textarea
        ref={ref}
        {...rest}
        className={`bg-bg2 rounded-xl border px-3.5 py-3 text-body text-text outline-none transition-colors resize-none placeholder:text-text-muted leading-relaxed
          ${error ? 'border-danger' : 'border-border focus:border-accent'}`}
      />
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </div>
  );
});
