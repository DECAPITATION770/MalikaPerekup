import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeftRight, Pencil, Check } from 'lucide-react';
import { fmtMoneyInput, parseMoneyInput, moneyToNumber, fmtAmount } from '@/lib/money';
import type { ExchangeRateHint } from '@/api/reports';

type Currency = 'UZS' | 'USD';

export interface CurrencyCommit {
  currency: Currency;
  price: string;     // plain numeric string, no formatting
  rate: string | null; // null when currency=UZS
}

interface Props {
  label?: string;
  required?: boolean;
  rateHints?: ExchangeRateHint;
  onChange: (v: CurrencyCommit) => void;
  defaultCurrency?: Currency;
  defaultPrice?: string;
  defaultRate?: string;
  priceError?: string;
  rateError?: string;
}

export default function CurrencyDualInput({
  label,
  required,
  rateHints,
  onChange,
  defaultCurrency = 'UZS',
  defaultPrice = '',
  defaultRate = '',
  priceError,
  rateError,
}: Props) {
  const [active, setActive] = useState<Currency>(defaultCurrency);
  const [uzs, setUzs] = useState(defaultCurrency === 'UZS' ? defaultPrice : '');
  const [usd, setUsd] = useState(defaultCurrency === 'USD' ? defaultPrice : '');
  const [rate, setRate] = useState(defaultRate);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(defaultRate);
  const rateInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill rate from CBU hint (once, when hint arrives and rate is empty)
  useEffect(() => {
    if (rate) return;
    const hint = rateHints?.cb_uz ?? rateHints?.last_used;
    if (!hint) return;
    const formatted = fmtMoneyInput(String(Math.round(parseFloat(hint.rate))));
    setRate(formatted);
    setRateInput(formatted);
  }, [rateHints, rate]);

  const rateNum = moneyToNumber(rate);

  const emit = useCallback((currency: Currency, price: string, rateVal: string) => {
    onChange({
      currency,
      price: parseMoneyInput(price),
      rate: currency === 'USD' ? parseMoneyInput(rateVal) : null,
    });
  }, [onChange]);

  const recomputePassive = useCallback((activeCurr: Currency, activeVal: string, rateVal: string) => {
    const r = moneyToNumber(rateVal);
    if (activeCurr === 'UZS') {
      const u = moneyToNumber(activeVal);
      setUsd(u > 0 && r > 0 ? fmtMoneyInput(String((u / r).toFixed(2))) : '');
    } else {
      const u = moneyToNumber(activeVal);
      setUzs(u > 0 && r > 0 ? fmtMoneyInput(String(Math.round(u * r))) : '');
    }
  }, []);

  const handleUzsChange = (raw: string) => {
    const val = fmtMoneyInput(raw);
    setUzs(val);
    setActive('UZS');
    recomputePassive('UZS', val, rate);
    emit('UZS', val, rate);
  };

  const handleUsdChange = (raw: string) => {
    const val = fmtMoneyInput(raw);
    setUsd(val);
    setActive('USD');
    recomputePassive('USD', val, rate);
    emit('USD', val, rate);
  };

  const commitRate = (raw: string) => {
    const val = fmtMoneyInput(raw);
    setRate(val);
    setRateInput(val);
    setEditingRate(false);
    recomputePassive(active, active === 'UZS' ? uzs : usd, val);
    emit(active, active === 'UZS' ? uzs : usd, val);
  };

  const switchCurrency = () => {
    const next: Currency = active === 'UZS' ? 'USD' : 'UZS';
    setActive(next);
    emit(next, next === 'UZS' ? uzs : usd, rate);
  };

  const activeValue  = active === 'UZS' ? uzs : usd;
  const passiveLine  = active === 'UZS'
    ? (usd ? `≈ ${usd} USD` : rateNum > 0 ? '≈ 0 USD' : '≈ — USD')
    : (uzs ? `≈ ${uzs} UZS` : rateNum > 0 ? '≈ 0 UZS' : '≈ — UZS');

  const cbuHint  = rateHints?.cb_uz;
  const lastHint = rateHints?.last_used;

  return (
    <div className="flex flex-col gap-2">
      {/* Label row */}
      {(label || cbuHint) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label className="text-label text-text-dim font-medium tracking-tight flex items-center gap-1">
              {label}
              {required && <span className="text-danger" aria-hidden>*</span>}
            </label>
          )}
          {cbuHint && (
            <button
              type="button"
              onClick={() => commitRate(String(Math.round(parseFloat(cbuHint.rate))))}
              className="text-caption text-accent font-semibold px-2 py-0.5 rounded-md bg-accent-faded hover:bg-accent/20 transition-colors whitespace-nowrap"
            >
              CBU {fmtAmount(parseFloat(cbuHint.rate))}
            </button>
          )}
        </div>
      )}

      {/* Main amount field */}
      <div className={`flex items-center gap-2 bg-bg2 rounded-card border h-14 px-4 transition-colors
        focus-within:ring-4 focus-within:ring-accent/15
        ${priceError ? 'border-danger' : 'border-border focus-within:border-accent'}`}>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={activeValue}
          onChange={(e) => active === 'UZS' ? handleUzsChange(e.target.value) : handleUsdChange(e.target.value)}
          className="flex-1 bg-transparent text-text text-title-sm font-bold outline-none placeholder:text-text-muted tabular-nums"
        />
        <button
          type="button"
          onClick={switchCurrency}
          className="flex items-center gap-1.5 bg-bg3 border border-border rounded-xl px-3 py-1.5 text-hint font-bold text-text hover:border-border-strong transition-all shrink-0"
        >
          {active}
          <ArrowLeftRight size={10} className="text-text-dim" />
        </button>
      </div>

      {/* Equivalent + rate row */}
      <div className="flex items-center justify-between px-1 gap-2">
        <button
          type="button"
          onClick={switchCurrency}
          className="text-hint text-text-muted hover:text-text-dim transition-colors tabular-nums rounded-md px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {passiveLine}
        </button>

        {editingRate ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={rateInputRef}
              autoFocus
              inputMode="numeric"
              value={rateInput}
              onChange={(e) => setRateInput(fmtMoneyInput(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRate(rateInput); }}
              onBlur={() => commitRate(rateInput)}
              className="w-24 bg-bg3 border border-accent rounded-lg px-2 py-1 text-label text-text font-mono outline-none focus-visible:ring-2 focus-visible:ring-accent/40 tabular-nums"
            />
            <button type="button" onMouseDown={() => commitRate(rateInput)} className="text-success">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setEditingRate(true); setRateInput(rate); }}
            className="flex items-center gap-1 text-caption text-text-muted hover:text-text-dim transition-colors whitespace-nowrap rounded-md px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {rate ? `${fmtAmount(rateNum)} UZS/$` : 'курс?'}
            <Pencil size={9} />
          </button>
        )}
      </div>

      {/* Rate hint chips */}
      {!editingRate && lastHint && moneyToNumber(lastHint.rate) !== rateNum && (
        <div className="flex gap-1.5 px-1">
          <button
            type="button"
            onClick={() => commitRate(lastHint.rate)}
            className="text-caption px-2.5 py-1 rounded-lg border border-border bg-bg2 text-text-muted hover:border-border-strong hover:text-text transition-all"
          >
            Прошлый: {fmtAmount(parseFloat(lastHint.rate))}
          </button>
        </div>
      )}

      {priceError && <span className="text-hint text-danger animate-fade-in">{priceError}</span>}
      {rateError  && <span className="text-hint text-danger animate-fade-in">{rateError}</span>}
    </div>
  );
}
