/**
 * NotesTimeline — chronological interaction log for a counterparty.
 *
 * Displays past calls / meetings / messages / payments / system events,
 * newest first, with a kind-coloured icon and a relative-time stamp.
 * A quick-add row at the top lets the user append a note in two taps
 * (pick kind from the segmented control, type, save).
 *
 * Lives outside CounterpartyDetail so it can be reused on Sale/Purchase
 * detail screens later (a note kind=payment could attach to a Sale row
 * in v2 — same component, different owner endpoint).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  type CounterpartyNoteKind,
  type CounterpartyNoteOut,
  createCounterpartyNote,
  deleteCounterpartyNote,
  listCounterpartyNotes,
} from '@/api/counterparties';
import { useTgHaptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

interface Props {
  counterpartyId: number;
}

// Visual metadata per kind. ``Sparkles`` for ``system`` to differentiate
// auto-generated entries from user-typed ones — they read «something the
// app did, not something the user wrote down».
const KIND_META: Record<
  CounterpartyNoteKind,
  {
    Icon: typeof Phone;
    tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
  }
> = {
  call: { Icon: Phone, tone: 'success' },
  meeting: { Icon: CalendarDays, tone: 'accent' },
  message: { Icon: MessageCircle, tone: 'accent' },
  payment: { Icon: Wallet, tone: 'warning' },
  system: { Icon: Sparkles, tone: 'neutral' },
  other: { Icon: MessageCircle, tone: 'neutral' },
};

const TONE_BG: Record<string, string> = {
  accent: 'bg-accent-faded text-accent',
  success: 'bg-success-faded text-success',
  warning: 'bg-warning-faded text-warning',
  danger: 'bg-danger-faded text-danger',
  neutral: 'bg-bg3 text-text-dim',
};

// User-pickable kinds — `system` is auto-only and never appears in the form.
const USER_KINDS: CounterpartyNoteKind[] = ['call', 'meeting', 'message', 'payment', 'other'];

function relativeTime(
  t: (k: string, opts?: Record<string, unknown>) => string,
  iso: string,
): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return t('counterparties.just_now');
  if (mins < 60) return t('counterparties.minutes_ago', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('counterparties.hours_ago', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('counterparties.yesterday');
  if (days < 7) return t('counterparties.days_ago', { count: days });
  if (days < 30) return t('counterparties.weeks_ago', { count: Math.floor(days / 7) });
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function NotesTimeline({ counterpartyId }: Props) {
  const { t } = useTranslation();
  const haptic = useTgHaptic();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['counterparty-notes', counterpartyId],
    queryFn: () => listCounterpartyNotes(counterpartyId),
    enabled: Boolean(counterpartyId),
  });

  const [body, setBody] = useState('');
  const [kind, setKind] = useState<CounterpartyNoteKind>('call');
  const [showForm, setShowForm] = useState(false);

  const create = useMutation({
    mutationFn: () => createCounterpartyNote(counterpartyId, body.trim(), kind),
    onSuccess: () => {
      haptic.notify('success');
      setBody('');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['counterparty-notes', counterpartyId] });
    },
    onError: () => {
      haptic.notify('error');
      toast.error(t('counterparties.note_save_failed'));
    },
  });

  const remove = useMutation({
    mutationFn: (noteId: number) =>
      deleteCounterpartyNote(counterpartyId, noteId),
    onMutate: async (noteId) => {
      // Optimistic remove — restore on error.
      await qc.cancelQueries({
        queryKey: ['counterparty-notes', counterpartyId],
      });
      const prev = qc.getQueryData<CounterpartyNoteOut[]>([
        'counterparty-notes',
        counterpartyId,
      ]);
      qc.setQueryData<CounterpartyNoteOut[]>(
        ['counterparty-notes', counterpartyId],
        (current) => (current ?? []).filter((n) => n.id !== noteId),
      );
      return { prev };
    },
    onError: (_err, _noteId, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['counterparty-notes', counterpartyId], ctx.prev);
      }
      toast.error(t('counterparties.note_delete_failed'));
    },
  });

  const notes = q.data ?? [];

  return (
    <section className="card flex flex-col gap-3 p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-body-lg font-bold tracking-tight">
          {t('counterparties.notes_title')}
          {notes.length > 0 && (
            <span className="ml-2 text-caption font-normal tabular-nums text-text-muted">
              {notes.length}
            </span>
          )}
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              haptic.tap('light');
              setShowForm(true);
            }}
            className="focus-ring flex h-9 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-faded px-3 text-hint font-semibold text-accent transition-colors hover:bg-accent/15"
          >
            <Plus size={14} />
            {t('counterparties.note_add')}
          </button>
        )}
      </header>

      {/* Inline composer — visible only when adding so the panel reads
          clean by default. Cancel hides without losing typed text? No,
          we drop it on cancel — drafts feel undocumented otherwise. */}
      {showForm && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {USER_KINDS.map((k) => {
              const meta = KIND_META[k];
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    haptic.tap('light');
                    setKind(k);
                  }}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-hint font-semibold transition-all',
                    active
                      ? 'border-accent/40 bg-accent-faded text-accent'
                      : 'border-border bg-bg3 text-text-dim hover:border-border-strong hover:text-text',
                  )}
                >
                  <meta.Icon size={12} strokeWidth={2.2} />
                  {t(`counterparties.note_kind_${k}`)}
                </button>
              );
            })}
          </div>
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('counterparties.note_placeholder')}
            rows={3}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-body text-text outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setBody('');
              }}
              className="focus-ring flex h-9 items-center gap-1 rounded-lg px-3 text-hint font-semibold text-text-dim transition-colors hover:bg-bg3 hover:text-text"
            >
              <X size={14} />
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!body.trim() || create.isPending}
              onClick={() => create.mutate()}
              className="focus-ring flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-hint font-bold text-[rgb(var(--c-on-accent))] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-bg3 disabled:text-text-muted"
            >
              {t('counterparties.note_save')}
            </button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <ul className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-lg bg-bg3/40" />
          ))}
        </ul>
      ) : notes.length === 0 ? (
        <p className="py-2 text-center text-caption text-text-muted">
          {t('counterparties.notes_empty')}
        </p>
      ) : (
        <ul className="flex flex-col">
          {notes.map((note, idx) => {
            const meta = KIND_META[note.kind] ?? KIND_META.other;
            const tone = TONE_BG[meta.tone];
            const isLast = idx === notes.length - 1;
            return (
              <li
                key={note.id}
                className="group relative flex gap-3 pb-3 last:pb-0"
              >
                {/* Vertical timeline rail — drawn as the icon column's
                    pseudo-border so it tracks icon spacing without a
                    separate node. Last row hides its tail. */}
                {!isLast && (
                  <div
                    aria-hidden
                    className="absolute left-[15px] top-8 h-[calc(100%-32px)] w-px bg-border"
                  />
                )}
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-bg2',
                    tone,
                  )}
                  aria-hidden
                >
                  <meta.Icon size={14} strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption font-semibold text-text-dim">
                      {t(`counterparties.note_kind_${note.kind}`)}
                    </span>
                    <span className="shrink-0 text-caption text-text-muted">
                      {relativeTime(t, note.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-body leading-relaxed text-text">
                    {note.body}
                  </p>
                </div>
                {note.kind !== 'system' && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic.tap('light');
                      remove.mutate(note.id);
                    }}
                    aria-label={t('common.delete')}
                    className="self-start rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger-faded hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
