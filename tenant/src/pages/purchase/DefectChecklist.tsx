import { useTranslation } from 'react-i18next';
import { Check, AlertTriangle, Wrench, Package, Zap } from 'lucide-react';
import { DEFECT_KEYS, conditionFromDefects, type DefectKey } from './types';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

/** Icon hint per defect — guides the eye without needing labels. */
const ICON: Partial<Record<DefectKey, typeof Check>> = {
  scratches_body: AlertTriangle,
  scratches_screen: AlertTriangle,
  no_box: Package,
  screen_replaced: Wrench,
  battery_replaced: Wrench,
  not_original: Wrench,
  cracks: Zap,
  dead: Zap,
};

export default function DefectChecklist({ value, onChange }: Props) {
  const { t } = useTranslation();

  const toggle = (key: DefectKey) => {
    if (value.includes(key)) onChange(value.filter((v) => v !== key));
    else onChange([...value, key]);
  };

  const condition = conditionFromDefects(value);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-label text-text-dim font-medium tracking-tight">
          {t('purchase.defects_label')}
        </label>
        <span
          className={`text-caption font-bold px-2.5 py-1 rounded-lg border tabular-nums
            ${condition === 'new'
              ? 'bg-success-faded text-success border-success/30'
              : condition === 'good'
                ? 'bg-accent-faded text-accent border-accent/30'
                : condition === 'normal'
                  ? 'bg-warning-faded text-warning border-warning/30'
                  : 'bg-danger-faded text-danger border-danger/30'}`}
        >
          {t(`condition.${condition}`)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DEFECT_KEYS.map((key) => {
          const active = value.includes(key);
          const Icon = ICON[key] ?? AlertTriangle;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={active}
              className={`text-left rounded-xl border px-3.5 py-3 flex items-center gap-2.5 transition-all cursor-pointer
                ${active
                  ? 'bg-accent-faded border-accent/50 text-accent'
                  : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0
                ${active ? 'bg-accent text-white' : 'bg-bg3 text-text-muted'}`}
              >
                {active ? <Check size={13} strokeWidth={3} /> : <Icon size={13} strokeWidth={2} />}
              </div>
              <span className="text-label font-semibold tracking-tight leading-tight">
                {t(`purchase.defects.${key}`)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-caption text-text-muted">
        {t('purchase.defects_hint')}
      </p>
    </div>
  );
}
