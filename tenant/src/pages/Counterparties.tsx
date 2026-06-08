/**
 * Counterparties — directory of sellers/buyers.
 *
 * Redesigned from a flat list of name+phone rows into a CRM-style card:
 * brand-tinted avatar (stable colour per name), inline quick actions
 * (call / write TG / copy phone) that don't navigate, relative «last
 * contact» time, and a danger-tinted left border for rows with outstanding
 * nasiya debt. The whole card stays clickable to open the full detail —
 * action icons stopPropagation so a tap on the phone doesn't open the
 * page first.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Check,
  Copy,
  Phone,
  Pin,
  Search as SearchIcon,
  Send,
  ShoppingCart,
  User,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  listCounterparties,
  type CounterpartyListItem,
  type CounterpartyType,
} from '@/api/counterparties';
import { useDebounced } from '@/lib/useDebounced';
import { compactUnits, fmtUzsCompact } from '@/lib/fmt';
import { brandTextColor, brandTint } from '@/lib/brand';
import { RoleBadge } from '@/components/CounterpartyRoleBadge';
import { useTgHaptic } from '@/lib/telegram';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

type Filter = CounterpartyType | 'all';

function initials(name: string) {
  return (
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/**
 * Relative-time formatter, locale-agnostic glue around the i18n strings.
 * Shows «вчера» / «3 дня назад» / «в этом месяце» / «более года назад»
 * — works the same whether the value is yesterday or a year stale.
 */
function relativeTime(
  t: (k: string, opts?: Record<string, unknown>) => string,
  iso: string,
): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return t('counterparties.today');
  if (days === 1) return t('counterparties.yesterday');
  if (days < 7) return t('counterparties.days_ago', { count: days });
  if (days < 30) return t('counterparties.weeks_ago', { count: Math.floor(days / 7) });
  if (days < 365) return t('counterparties.months_ago', { count: Math.floor(days / 30) });
  return t('counterparties.year_plus');
}

function CounterpartyCard({ cp }: { cp: CounterpartyListItem }) {
  const { t } = useTranslation();
  const { resolved } = useTheme();
  const haptic = useTgHaptic();
  const [copied, setCopied] = useState(false);

  // Decimals come over the wire as strings (CLAUDE.md §9) — parse for compare,
  // format with fmtUzsCompact for display. Treat NaN as «no debt».
  const owed = Number(cp.outstanding_nasiya_uzs);
  const hasDebt = Number.isFinite(owed) && owed > 0;
  const units = compactUnits(t);

  // Stable colour per counterparty so the same person reads identically
  // wherever they show up in the app (list, detail, search results).
  const avatarBg = brandTint(cp.full_name, 0.18);
  const avatarFg = brandTextColor(cp.full_name, resolved);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cp.phone) return;
    try {
      await navigator.clipboard.writeText(cp.phone);
    } catch {
      // Private-mode browsers block clipboard — fail silently, popover
      // still shows the number for manual copy.
    }
    haptic.tap('light');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Link
      to={`/counterparties/${cp.id}`}
      className={cn(
        // Full-width row layout — mimics Stock's divider-table pattern.
        // Width is justified by spreading info across columns (name |
        // phone | last contact | debt | actions), not by empty padding,
        // so a 1920px row reads dense, not stretched.
        'card flex items-center gap-3 px-4 py-3 transition-all hover:border-border-strong active:scale-[0.998] md:gap-4',
        hasDebt && 'border-l-[3px] border-l-danger pl-[13px]',
      )}
    >
      {/* Column 1 — avatar */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-label font-bold tracking-tight"
        style={{ backgroundColor: avatarBg, color: avatarFg }}
        aria-hidden
      >
        {initials(cp.full_name)}
      </div>

      {/* Column 2 — name + role + comment. Takes the elastic width;
          everything to the right is shrink-0. min-w-0 so truncate works
          on the name when the row is narrow. */}
      <div className="flex min-w-0 flex-[2] flex-col gap-0.5 md:flex-[3]">
        <div className="flex items-center gap-1.5">
          {cp.is_pinned && (
            <Pin
              size={13}
              fill="currentColor"
              className="shrink-0 text-accent"
              aria-label={t('counterparties.pinned')}
            />
          )}
          <span className="truncate text-body-lg font-bold tracking-tight">
            {cp.full_name}
          </span>
          <RoleBadge type={cp.type} className="hidden md:inline-flex" />
        </div>
        {cp.comment ? (
          <p className="line-clamp-1 text-caption italic text-text-muted">
            «{cp.comment}»
          </p>
        ) : (
          // Mobile shows role inline below the name; on md+ role is shown
          // inline with the name and this slot stays empty. Keep a meta-line
          // on mobile so the card height stays consistent.
          <div className="md:hidden">
            <RoleBadge type={cp.type} />
          </div>
        )}
      </div>

      {/* Column 3 — phone (desktop only, mobile keeps the call action) */}
      <div className="hidden min-w-0 flex-1 items-center gap-1.5 text-hint text-text-muted md:flex">
        {cp.phone ? (
          <>
            <Phone size={12} strokeWidth={1.8} className="shrink-0" />
            <span className="truncate font-mono">{cp.phone}</span>
          </>
        ) : (
          <span className="text-text-muted/50">—</span>
        )}
      </div>

      {/* Column 4 — deals + last contact (desktop only) */}
      <div className="hidden min-w-0 flex-1 flex-col text-hint md:flex">
        {cp.deals_count > 0 ? (
          <span className="truncate tabular-nums text-text-dim">
            {t('counterparties.deals_n', { count: cp.deals_count })}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
        {cp.last_deal_at && (
          <span className="truncate text-caption text-text-muted">
            {relativeTime(t, cp.last_deal_at)}
          </span>
        )}
      </div>

      {/* Column 5 — debt pill (only when applicable) */}
      {hasDebt && (
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-danger/30 bg-danger-faded px-2.5 py-1 text-caption font-bold tabular-nums text-danger md:inline-flex">
          <Wallet size={11} strokeWidth={2.2} />
          {fmtUzsCompact(owed, units)} UZS
        </div>
      )}

      {/* Quick actions — the entire wrapper stopPropagation()s clicks so a
          tap on Tel / TG doesn't also navigate to the detail page. */}
      <div
        className="flex shrink-0 items-center gap-1 self-start"
        onClick={(e) => e.stopPropagation()}
      >
        {cp.phone && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t('counterparties.contact')}
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg3 text-success transition-all hover:border-border-strong active:scale-[0.95]"
              >
                <Phone size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-60 p-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 pb-1.5 pt-1 text-caption text-text-muted">
                {cp.phone}
              </div>
              <div className="flex flex-col gap-0.5">
                <a
                  href={`tel:${cp.phone}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic.tap('light');
                  }}
                  className="focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-label font-medium text-text transition-colors hover:bg-bg2"
                >
                  <Phone size={15} className="text-success" />
                  {t('counterparties.call')}
                </a>
                <button
                  type="button"
                  onClick={onCopy}
                  className="focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-label font-medium text-text transition-colors hover:bg-bg2"
                >
                  {copied ? (
                    <>
                      <Check size={15} className="text-success" />
                      <span className="text-success">
                        {t('counterparties.copied')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy size={15} className="text-text-dim" />
                      {t('counterparties.copy_phone')}
                    </>
                  )}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {cp.tg_username && (
          <a
            href={`https://t.me/${cp.tg_username}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              haptic.tap('light');
            }}
            aria-label="Telegram"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-accent/40 bg-accent-faded text-accent transition-all hover:bg-accent/15 active:scale-[0.95]"
          >
            <Send size={14} />
          </a>
        )}
      </div>
    </Link>
  );
}

export default function Counterparties() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const debouncedQ = useDebounced(q.trim(), 300);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['counterparties', debouncedQ, filter],
    queryFn: () =>
      listCounterparties({
        q: debouncedQ || undefined,
        type: filter === 'all' ? undefined : filter,
        limit: 50,
      }),
  });

  // Bind the raw `items` reference directly from data — the `?? []` fallback
  // used to live here, but that minted a new empty array every render and
  // re-triggered the useMemo below on every query state change.
  const items = data?.items;

  // Priority sort — debtors first (chase money), then by recent activity,
  // then alphabetical. The backend returns a stable list; this sort runs
  // client-side because the priority signal (debt + activity recency)
  // changes faster than the backend's index can keep up.
  const sortedItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    const score = (cp: CounterpartyListItem): number => {
      const debt = Number(cp.outstanding_nasiya_uzs);
      const hasDebt = Number.isFinite(debt) && debt > 0;
      const recencyDays = cp.last_deal_at
        ? Math.max(
            0,
            365 -
              Math.floor(
                (Date.now() - new Date(cp.last_deal_at).getTime()) /
                  86_400_000,
              ),
          )
        : 0;
      // Priority ladder, each band guaranteed to outrank the band below by
      // an order of magnitude:
      //   pinned    →  +10_000_000 (always at the top)
      //   debtors   →  +1_000_000  (must chase)
      //   recency   →  0..365      (most recent first within ties)
      return (
        (cp.is_pinned ? 10_000_000 : 0) +
        (hasDebt ? 1_000_000 : 0) +
        recencyDays
      );
    };
    return [...items].sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return a.full_name.localeCompare(b.full_name, 'ru');
    });
  }, [items]);

  const debtorCount =
    items?.filter((cp) => Number(cp.outstanding_nasiya_uzs) > 0).length ?? 0;

  return (
    // Full-width container. Cards arrange in a responsive grid below so
    // the desktop space fills with more contacts per screen instead of
    // centering a thin column inside empty margins (Stock-table idiom:
    // «use the whole content-area, never waste it»). Filter row stays
    // full-width since search + tabs need horizontal room.
    <div className="flex w-full animate-fade-up flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-title font-bold tracking-tight">
            {t('counterparties.title')}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body text-text-dim">
            {(data?.total ?? 0) > 0 && (
              <span>{t('counterparties.total', { count: data!.total })}</span>
            )}
            {debtorCount > 0 && (
              <>
                <span className="text-text-muted/50">·</span>
                <span className="font-semibold text-danger">
                  {t('counterparties.debtors_n', { count: debtorCount })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        <SearchIcon
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('counterparties.search')}
          autoComplete="off"
          spellCheck={false}
          className="pl-10"
        />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">{t('counterparties.all')}</TabsTrigger>
          <TabsTrigger value="seller">{t('counterparties.sellers')}</TabsTrigger>
          <TabsTrigger value="buyer">{t('counterparties.buyers')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-4 text-body text-danger">
          {t('common.error_load')}
        </div>
      ) : sortedItems.length === 0 ? (
        <EmptyState
          illustration={
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-bg3 text-text-muted">
              <User size={24} />
            </div>
          }
          title={t('counterparties.empty_title')}
          description={t('counterparties.empty_body')}
          action={
            !debouncedQ &&
            filter === 'all' && (
              <Link to="/purchase/new">
                <Button>
                  <ShoppingCart className="size-4" />
                  {t('today.action_purchase')}
                </Button>
              </Link>
            )
          }
        />
      ) : (
        // Single column, one row per contact — Stock-table idiom. Each row
        // spans the full width and packs info across visual columns
        // (avatar | name+role | phone | last contact | debt | actions),
        // so the width is meaningfully used instead of empty-padded.
        <div className="flex flex-col gap-2">
          {sortedItems.map((cp) => (
            <CounterpartyCard key={cp.id} cp={cp} />
          ))}
        </div>
      )}
    </div>
  );
}
