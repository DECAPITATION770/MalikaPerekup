import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import type { DeviceCategory } from '@/api/devices';

interface Props {
  category: DeviceCategory;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/** Preset chip values per spec. Last chip — «Другое» — раскрывает свободный ввод. */
const RAM_GB = [4, 6, 8, 12, 16];
const STORAGE_GB = [64, 128, 256, 512, 1024];
const STORAGE_GB_LAPTOP = [256, 512, 1024, 2048];
const RAM_GB_LAPTOP = [8, 16, 32, 64];
const STORAGE_GB_WATCH = [16, 32, 64, 128];
const COLORS = ['Чёрный', 'Белый', 'Синий', 'Зелёный', 'Красный', 'Серый'];
const BATTERY_PCT = [100, 95, 90, 85, 80, 75];

const SMARTWATCH_CONNECTIVITY = ['gps', 'lte', 'wifi'];
const ACCESSORY_CONNECTIVITY = ['bluetooth', 'usb_c', 'lightning', 'wired'];

// ─── Atoms ────────────────────────────────────────────────────────────

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-label text-text-dim font-medium tracking-tight">
        {children}
      </label>
      {hint && <span className="text-caption text-text-muted">{hint}</span>}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, inputMode, suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode ?? 'text'}
        className={`h-11 bg-bg2 rounded-xl border border-border focus:border-accent transition-colors px-3.5 text-body text-text outline-none placeholder:text-text-muted w-full
          ${suffix ? 'pr-10' : ''}`}
        autoComplete="off"
      />
      {suffix && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted text-label font-semibold pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Универсальная сетка чипов с последним «Другое» — раскрывает свободный ввод.
 *  Активный chip остаётся подсвечен. Если текущее значение не из presets и не
 *  пустое — автоматически считается «custom» и сразу раскрыт. */
function ChipRowWithCustom<T extends string | number>({
  value, options, formatter, onPick, parseCustom, customPlaceholder, customSuffix,
}: {
  value: T | null;
  options: T[];
  formatter: (v: T) => string;
  onPick: (v: T | null) => void;
  /** Парсинг пользовательского ввода. Если возвращает ``null`` — игнорировать (но
   *  поле не сбрасывать; пользователь может допечатывать). */
  parseCustom: (raw: string) => T | null;
  customPlaceholder?: string;
  customSuffix?: string;
}) {
  const { t } = useTranslation();
  const isPreset = value != null && options.includes(value as T);
  const startedAsCustom = value != null && !isPreset;
  const [customOpen, setCustomOpen] = useState(startedAsCustom);
  const [draft, setDraft] = useState<string>(startedAsCustom ? String(value) : '');

  // Reflect external resets (e.g. «Повторить последнюю»).
  if (value == null && draft !== '') {
    setDraft('');
    setCustomOpen(false);
  }

  const onCustomChange = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === '') { onPick(null); return; }
    const parsed = parseCustom(raw);
    if (parsed != null) onPick(parsed);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((o) => {
          const active = !customOpen && value === o;
          return (
            <button
              key={String(o)}
              type="button"
              onClick={() => {
                setCustomOpen(false);
                setDraft('');
                onPick(active ? null : o);
              }}
              className={`h-10 px-3.5 rounded-lg border text-hint font-bold tracking-tight transition-all cursor-pointer tabular-nums
                ${active
                  ? 'bg-accent-faded border-accent/50 text-accent'
                  : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
            >
              {formatter(o)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const next = !customOpen;
            setCustomOpen(next);
            // При открытии «Другое» сбрасываем preset-выбор.
            if (next && isPreset) onPick(null);
          }}
          className={`h-10 px-3.5 rounded-lg border text-hint font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5
            ${customOpen || startedAsCustom
              ? 'bg-accent-faded border-accent/50 text-accent'
              : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
        >
          <Pencil size={13} />
          {t('specs.custom')}
        </button>
      </div>
      {customOpen && (
        <TextInput
          value={draft}
          onChange={onCustomChange}
          placeholder={customPlaceholder}
          inputMode={typeof options[0] === 'number' ? 'numeric' : 'text'}
          suffix={customSuffix}
        />
      )}
    </div>
  );
}

function ToggleChips({
  value, options, label, onChange,
}: {
  value: string[];
  options: string[];
  label: (key: string) => string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(active ? value.filter((v) => v !== o) : [...value, o])}
            aria-pressed={active}
            className={`h-10 px-3.5 rounded-lg border text-hint font-bold tracking-tight transition-all cursor-pointer
              ${active
                ? 'bg-accent-faded border-accent/50 text-accent'
                : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
          >
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

// ─── Per-category forms ──────────────────────────────────────────────

export default function SpecsForm({ category, value, onChange }: Props) {
  const { t } = useTranslation();
  const set = (key: string, v: unknown) => {
    const next = { ...value };
    if (v === null || v === undefined || v === '') delete next[key];
    else next[key] = v;
    onChange(next);
  };

  const parseInt32 = (raw: string): number | null => {
    const n = Number(raw.replace(/\s/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };
  const parseBatteryPct = (raw: string): number | null => {
    const n = Number(raw.replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
  };

  if (category === 'phone' || category === 'tablet') {
    return (
      <div className="flex flex-col gap-4">
        <FieldLabel>{t('specs.ram_gb')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.ram_gb as number | undefined) ?? null}
          options={RAM_GB}
          formatter={(v) => `${v} GB`}
          onPick={(v) => set('ram_gb', v)}
          parseCustom={parseInt32}
          customPlaceholder={t('specs.ram_custom_placeholder')}
          customSuffix="GB"
        />

        <FieldLabel>{t('specs.storage_gb')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.storage_gb as number | undefined) ?? null}
          options={STORAGE_GB}
          formatter={(v) => v >= 1024 ? `${v / 1024} TB` : `${v} GB`}
          onPick={(v) => set('storage_gb', v)}
          parseCustom={parseInt32}
          customPlaceholder={t('specs.storage_custom_placeholder')}
          customSuffix="GB"
        />

        <FieldLabel>{t('specs.color')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.color as string | undefined) ?? null}
          options={COLORS}
          formatter={(v) => v}
          onPick={(v) => set('color', v)}
          parseCustom={(raw) => raw.trim() || null}
          customPlaceholder={t('specs.color_placeholder')}
        />

        <FieldLabel hint={t('specs.battery_health_hint')}>{t('specs.battery_health')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.battery_health_pct as number | undefined) ?? null}
          options={BATTERY_PCT}
          formatter={(v) => `${v}%`}
          onPick={(v) => set('battery_health_pct', v)}
          parseCustom={parseBatteryPct}
          customPlaceholder="88"
          customSuffix="%"
        />
      </div>
    );
  }

  if (category === 'laptop') {
    return (
      <div className="flex flex-col gap-4">
        <FieldLabel>{t('specs.ram_gb')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.ram_gb as number | undefined) ?? null}
          options={RAM_GB_LAPTOP}
          formatter={(v) => `${v} GB`}
          onPick={(v) => set('ram_gb', v)}
          parseCustom={parseInt32}
          customPlaceholder={t('specs.ram_custom_placeholder')}
          customSuffix="GB"
        />

        <FieldLabel>{t('specs.storage_gb')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.storage_gb as number | undefined) ?? null}
          options={STORAGE_GB_LAPTOP}
          formatter={(v) => v >= 1024 ? `${v / 1024} TB` : `${v} GB`}
          onPick={(v) => set('storage_gb', v)}
          parseCustom={parseInt32}
          customPlaceholder={t('specs.storage_custom_placeholder')}
          customSuffix="GB"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('specs.cpu')}</FieldLabel>
            <TextInput
              value={(value.cpu as string | undefined) ?? ''}
              onChange={(v) => set('cpu', v)}
              placeholder={t('specs.cpu_placeholder')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('specs.gpu')}</FieldLabel>
            <TextInput
              value={(value.gpu as string | undefined) ?? ''}
              onChange={(v) => set('gpu', v)}
              placeholder={t('specs.gpu_placeholder')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('specs.screen_inches')}</FieldLabel>
            <TextInput
              value={value.screen_inches == null ? '' : String(value.screen_inches)}
              onChange={(v) => set('screen_inches', v ? Number(v) : null)}
              placeholder={t('specs.screen_inches_placeholder')}
              inputMode="decimal"
              suffix={'"'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('specs.color')}</FieldLabel>
            <TextInput
              value={(value.color as string | undefined) ?? ''}
              onChange={(v) => set('color', v)}
              placeholder={t('specs.color_placeholder')}
            />
          </div>
        </div>
      </div>
    );
  }

  if (category === 'smartwatch') {
    return (
      <div className="flex flex-col gap-4">
        <FieldLabel>{t('specs.storage_gb')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.storage_gb as number | undefined) ?? null}
          options={STORAGE_GB_WATCH}
          formatter={(v) => `${v} GB`}
          onPick={(v) => set('storage_gb', v)}
          parseCustom={parseInt32}
          customPlaceholder={t('specs.storage_custom_placeholder')}
          customSuffix="GB"
        />

        <FieldLabel>{t('specs.color')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.color as string | undefined) ?? null}
          options={COLORS}
          formatter={(v) => v}
          onPick={(v) => set('color', v)}
          parseCustom={(raw) => raw.trim() || null}
          customPlaceholder={t('specs.color_placeholder')}
        />

        <FieldLabel hint={t('specs.battery_health_hint')}>{t('specs.battery_health')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.battery_health_pct as number | undefined) ?? null}
          options={BATTERY_PCT}
          formatter={(v) => `${v}%`}
          onPick={(v) => set('battery_health_pct', v)}
          parseCustom={parseBatteryPct}
          customPlaceholder="88"
          customSuffix="%"
        />

        <FieldLabel>{t('specs.connectivity')}</FieldLabel>
        <ToggleChips
          value={(value.connectivity as string[] | undefined) ?? []}
          options={SMARTWATCH_CONNECTIVITY}
          label={(k) => t(`specs.conn.${k}`)}
          onChange={(next) => set('connectivity', next)}
        />
      </div>
    );
  }

  if (category === 'accessory') {
    return (
      <div className="flex flex-col gap-4">
        <FieldLabel>{t('specs.color')}</FieldLabel>
        <ChipRowWithCustom
          value={(value.color as string | undefined) ?? null}
          options={COLORS}
          formatter={(v) => v}
          onPick={(v) => set('color', v)}
          parseCustom={(raw) => raw.trim() || null}
          customPlaceholder={t('specs.color_placeholder')}
        />

        <FieldLabel>{t('specs.connectivity')}</FieldLabel>
        <ToggleChips
          value={(value.connectivity as string[] | undefined) ?? []}
          options={ACCESSORY_CONNECTIVITY}
          label={(k) => t(`specs.conn.${k}`)}
          onChange={(next) => set('connectivity', next)}
        />
      </div>
    );
  }

  // ``other`` — free-form key-value pairs.
  const entries = Object.entries(value);
  const slots = Math.max(4, entries.length + 1);
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel hint={t('specs.other_hint')}>{t('specs.other_label')}</FieldLabel>
      <div className="flex flex-col gap-2">
        {Array.from({ length: slots }).map((_, i) => {
          const [k, v] = entries[i] ?? ['', ''];
          return (
            <div key={i} className="grid grid-cols-2 gap-2">
              <TextInput
                value={k}
                onChange={(newK) => {
                  const next: Record<string, unknown> = {};
                  entries.forEach(([key, val], idx) => {
                    if (idx === i) next[newK] = val;
                    else if (key) next[key] = val;
                  });
                  if (i >= entries.length && newK) next[newK] = '';
                  onChange(next);
                }}
                placeholder={t('specs.other_key')}
              />
              <TextInput
                value={String(v ?? '')}
                onChange={(newV) => {
                  if (!k) return;
                  set(k, newV);
                }}
                placeholder={t('specs.other_value')}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
