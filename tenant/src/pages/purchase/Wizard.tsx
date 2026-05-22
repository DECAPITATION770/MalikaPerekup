import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import Button from '@/components/ui/button-default';
import { TOTAL_STEPS, type WizardStep } from './types';

// ─── Step header (single bar with 4 dots) ──────────────────────────────

export function WizardProgress({
  step, completed, onJump,
}: {
  step: WizardStep;
  completed: [boolean, boolean, boolean, boolean];
  onJump: (s: WizardStep) => void;
}) {
  const { t } = useTranslation();
  const labels: string[] = [
    t('purchase.step1_short'),
    t('purchase.step2_short'),
    t('purchase.step3_short'),
    t('purchase.step4_short'),
  ];

  return (
    <ol className="flex items-stretch gap-1.5 select-none" aria-label={t('purchase.wizard_progress_aria')}>
      {labels.map((label, i) => {
        const s = i as WizardStep;
        const isCurrent = s === step;
        const isDone = completed[s];
        const isPast = s < step;
        const clickable = isPast || isDone;
        return (
          <li key={s} className="flex-1 min-w-0">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(s)}
              className={`w-full h-12 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-caption font-bold tracking-tight
                ${isCurrent
                  ? 'bg-accent-faded border-accent/50 text-accent'
                  : isDone
                    ? 'bg-success-faded border-success/30 text-success cursor-pointer hover:border-success/60'
                    : 'bg-bg2 border-border text-text-muted'}
                ${clickable && !isCurrent ? 'cursor-pointer' : ''}
                ${!clickable && !isCurrent ? 'cursor-default' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-micro shrink-0
                ${isCurrent ? 'bg-accent text-white' : isDone ? 'bg-success/20 text-success' : 'bg-bg3 text-text-muted'}`}
              >
                {isDone && !isCurrent ? <Check size={11} strokeWidth={3} /> : s + 1}
              </span>
              <span className="truncate hidden sm:inline">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Sticky footer (Back / Next or Submit) ─────────────────────────────

export function WizardFooter({
  step, canGoBack, onBack, onNext, submitting, submitLabel,
}: {
  step: WizardStep;
  canGoBack: boolean;
  onBack: () => void;
  onNext: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const isLast = step === (TOTAL_STEPS - 1);

  return (
    <div className="sticky bottom-16 md:bottom-4 z-30 card-elev shadow-2xl flex items-center gap-2 p-2.5 md:p-3">
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={onBack}
        disabled={!canGoBack}
        icon={<ChevronLeft size={16} />}
        aria-label={t('purchase.wizard_back')}
        className="!px-3 md:!px-5"
      >
        <span className="hidden md:inline">{t('purchase.wizard_back')}</span>
      </Button>
      <Button
        type={isLast ? 'submit' : 'button'}
        size="lg"
        full
        onClick={isLast ? undefined : onNext}
        loading={isLast && submitting}
        icon={isLast ? <ShoppingCart size={16} /> : <ChevronRight size={16} />}
      >
        {isLast ? submitLabel : t('purchase.wizard_next')}
      </Button>
    </div>
  );
}

// ─── Step shell (consistent spacing across steps) ──────────────────────

export function StepShell({
  step, title, subtitle, children,
}: {
  step: WizardStep;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      key={step}
      className="flex flex-col gap-5 animate-fade-up"
      aria-labelledby={`step-${step}-title`}
    >
      <header className="flex flex-col gap-1">
        <span className="text-caption text-text-muted font-semibold tracking-wider uppercase">
          {step + 1} / {TOTAL_STEPS}
        </span>
        <h2 id={`step-${step}-title`} className="text-title font-bold tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-text-dim leading-relaxed">{subtitle}</p>}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
