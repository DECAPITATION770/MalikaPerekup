import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { todayIsoTashkent } from './types';

function yesterdayIsoTashkent(): string {
  const [y, m, d] = todayIsoTashkent().split('-').map(Number);
  // Build a UTC date for the local 'today', subtract one day, format back.
  const ms = Date.UTC(y, m - 1, d) - 86_400_000;
  const x = new Date(ms);
  const yyyy = x.getUTCFullYear();
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(x.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
}

/** Today / Yesterday quick chips + custom picker. 99% of purchases are
 *  registered same day — date input shouldn't cost a click. */
export default function DateChips({ value, onChange }: Props) {
  const { t } = useTranslation();
  const today = todayIsoTashkent();
  const yesterday = yesterdayIsoTashkent();
  const isToday = value === today;
  const isYesterday = value === yesterday;
  const isOther = !isToday && !isYesterday;
  const [pickerOpen, setPickerOpen] = useState(isOther);

  const chip = (active: boolean, label: string, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`h-11 px-4 rounded-xl border text-label font-bold tracking-tight transition-all cursor-pointer
        ${active
          ? 'bg-accent-faded border-accent/50 text-accent'
          : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-label text-text-dim font-medium tracking-tight">
        {t('purchase.purchase_date_label')}
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        {chip(isToday, t('common.today'), () => { onChange(today); setPickerOpen(false); }, 'today')}
        {chip(isYesterday, t('common.yesterday'), () => { onChange(yesterday); setPickerOpen(false); }, 'yesterday')}
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o || isOther)}
          className={`h-11 px-4 rounded-xl border text-label font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5
            ${isOther || pickerOpen
              ? 'bg-accent-faded border-accent/50 text-accent'
              : 'bg-bg2 border-border text-text-dim hover:border-border-strong hover:text-text'}`}
        >
          <Calendar size={14} />
          {t('purchase.date_other')}
        </button>
      </div>
      {(pickerOpen || isOther) && (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 h-11 bg-bg2 rounded-xl border border-border focus:border-accent transition-colors px-3.5 text-body text-text outline-none w-full md:w-auto"
        />
      )}
    </div>
  );
}
