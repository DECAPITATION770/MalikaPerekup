/**
 * /dev/showcase — visual QA page rendering every primitive in both themes.
 *
 * Lives under `_dev/` so we can drop it (or guard it behind an env flag)
 * for production builds in Phase 7. Today it's the smoke test for Phase 2
 * identity work: brand-mark + 7 icons + 4 illustrations + KpiCard with
 * real useCountUp + EmptyState + every Button/Badge variant in both
 * dark and light theme.
 */
import { useState } from 'react';
import {
  ShoppingCart,
  BadgeDollarSign,
  CalendarClock,
  Package,
  TrendingUp,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MalikaWordmark } from '@/components/brand/MalikaWordmark';
import {
  MalikaLogo,
  NasiyaIcon,
  QrStickerIcon,
  FrozenIcon,
  RestockIcon,
  MarketplaceIcon,
  RepeatLastIcon,
} from '@/components/icons';
import {
  EmptyStockIllustration,
  NoSearchResultsIllustration,
  NoSalesIllustration,
  NoInstallmentsIllustration,
} from '@/components/illustrations';

/** Force a theme override on this page so designers can A/B compare. */
function useLocalTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.classList.contains('light') ? 'light' : 'dark',
  );
  const toggle = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('light', next === 'light');
      return next;
    });
  };
  return [theme, toggle] as const;
}

const ICONS = [
  { Cmp: MalikaLogo, label: 'MalikaLogo' },
  { Cmp: NasiyaIcon, label: 'NasiyaIcon' },
  { Cmp: QrStickerIcon, label: 'QrStickerIcon' },
  { Cmp: FrozenIcon, label: 'FrozenIcon' },
  { Cmp: RestockIcon, label: 'RestockIcon' },
  { Cmp: MarketplaceIcon, label: 'MarketplaceIcon' },
  { Cmp: RepeatLastIcon, label: 'RepeatLastIcon' },
] as const;

const ILLUSTRATIONS = [
  { Cmp: EmptyStockIllustration, label: 'EmptyStock' },
  { Cmp: NoSearchResultsIllustration, label: 'NoSearchResults' },
  { Cmp: NoSalesIllustration, label: 'NoSales' },
  { Cmp: NoInstallmentsIllustration, label: 'NoInstallments' },
] as const;

const fmtUzs = (n: number) =>
  Math.round(n).toLocaleString('ru-RU', { useGrouping: true }).replace(/,/g, ' ');

export function Showcase() {
  const [theme, toggle] = useLocalTheme();

  return (
    <div className="min-h-dvh bg-bg text-text">
      {/* Sticky header with brand + theme toggle */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <MalikaWordmark size="md" className="text-text" />
          <div className="flex items-center gap-3">
            <Badge variant="accent">/dev/showcase</Badge>
            <Button variant="secondary" size="sm" onClick={toggle} aria-label="Переключить тему">
              {theme === 'dark' ? <Sun /> : <Moon />}
              {theme === 'dark' ? 'Светлая' : 'Тёмная'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-10 space-y-12 hero-mesh">
        {/* ── Brand ────────────────────────────────────────────────────── */}
        <Section title="Brand" description="Wordmark и компактный лого">
          <div className="flex flex-wrap items-end gap-8 p-6 card">
            <MalikaWordmark size="sm" />
            <MalikaWordmark size="md" />
            <MalikaWordmark size="lg" />
            <MalikaWordmark size="md" bare />
            <div className="flex items-end gap-3">
              <MalikaLogo size={24} className="text-text" />
              <MalikaLogo size={32} className="text-text" />
              <MalikaLogo size={48} className="text-text" />
            </div>
          </div>
        </Section>

        {/* ── Custom icons ─────────────────────────────────────────────── */}
        <Section title="Custom icons" description="7 SVG-иконок поверх Lucide для брендовых кейсов">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {ICONS.map(({ Cmp, label }) => (
              <div
                key={label}
                className="card flex flex-col items-center gap-2 p-4 text-text-dim hover:text-accent transition-colors"
              >
                <Cmp size={32} />
                <span className="text-caption font-mono text-text-muted">{label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Buttons ──────────────────────────────────────────────────── */}
        <Section title="Buttons" description="5 вариантов × 3 размера. Все на shadcn + cva.">
          <div className="card p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="success">Success</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="link">Link</Button>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">sm</Button>
              <Button size="md">md (default)</Button>
              <Button size="lg">lg</Button>
              <Button size="icon" aria-label="Закупка">
                <ShoppingCart />
              </Button>
              <Button loading>Загрузка</Button>
              <Button disabled>Disabled</Button>
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button full>
                <ShoppingCart /> Закупить устройство
              </Button>
              <Button variant="success" full>
                <BadgeDollarSign /> Продать
              </Button>
            </div>
          </div>
        </Section>

        {/* ── Badges ───────────────────────────────────────────────────── */}
        <Section title="Badges" description="Тоны: success / warning / danger / accent / neutral / muted / outline">
          <div className="card p-6 flex flex-wrap gap-2">
            <Badge variant="success">В наличии</Badge>
            <Badge variant="warning">Витрина</Badge>
            <Badge variant="danger">Просрочено</Badge>
            <Badge variant="accent">Nasiya</Badge>
            <Badge variant="neutral">Куплено</Badge>
            <Badge variant="muted">Возврат</Badge>
            <Badge variant="outline">Архив</Badge>
            <Badge size="sm" variant="danger">
              SM
            </Badge>
          </div>
        </Section>

        {/* ── KPI ──────────────────────────────────────────────────────── */}
        <Section
          title="KpiCard"
          description="Реальная анимация чисел через useCountUp + RAF easeOut (600 мс). Никаких фейковых scale-up."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KpiCard
              label="Прибыль сегодня"
              value={1_234_567}
              format={fmtUzs}
              unit="UZS"
              icon={<TrendingUp size={18} />}
              tone="success"
              delta={{ dir: 'up', pct: 23, label: 'vs вчера' }}
            />
            <KpiCard
              label="Замороженные деньги"
              value={84_500_000}
              format={fmtUzs}
              unit="UZS"
              icon={<Package size={18} />}
              tone="warning"
              hint="Стоимость витрины"
              delay={120}
            />
            <KpiCard
              label="Долги по рассрочке"
              value={12_400_000}
              format={fmtUzs}
              unit="UZS"
              icon={<CalendarClock size={18} />}
              tone="danger"
              delta={{ dir: 'down', pct: 8, label: 'за неделю' }}
              delay={240}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <KpiCard
              label="Загрузка"
              value={0}
              tone="accent"
              loading
              icon={<TrendingUp size={18} />}
            />
            <KpiCard
              label="Нет данных"
              value={0}
              format={fmtUzs}
              unit="UZS"
              tone="neutral"
              icon={<Package size={18} />}
              delta={{ dir: 'flat', label: 'без изменений' }}
            />
            <Card>
              <CardHeader>
                <CardTitle>Скелетон</CardTitle>
                <CardDescription>Shimmer-эффект из tailwind keyframe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ── Illustrations ────────────────────────────────────────────── */}
        <Section title="Illustrations" description="4 outline-иллюстрации для empty states. Все currentColor + одна амбра.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ILLUSTRATIONS.map(({ Cmp, label }) => (
              <EmptyState
                key={label}
                illustration={<Cmp />}
                title={label}
                description="Пример пустого состояния. Иллюстрация + заголовок + описание + CTA — единый паттерн через `<EmptyState />`."
                action={<Button>Начать</Button>}
              />
            ))}
          </div>
        </Section>

        {/* ── Cards ────────────────────────────────────────────────────── */}
        <Section title="Cards" description="card / card-elev — реальная глубина за счёт box-shadow stack">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader>
                <CardTitle>Обычная карточка</CardTitle>
                <CardDescription>
                  bg-bg2 + триплет box-shadow + inset top-highlight. Светлая тема смягчает тени.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-dim leading-relaxed">
                  Используется для большинства поверхностей.
                </p>
              </CardContent>
            </Card>
            <div className="card-elev p-6 space-y-2">
              <div className="text-subhead font-bold">Поднятая карточка (card-elev)</div>
              <p className="text-sm text-text-dim leading-relaxed">
                bg-bg3, более глубокая тень. Применяется для важных KPI и активных состояний.
              </p>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-title font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-text-dim mt-1">{description}</p>
      </header>
      {children}
    </section>
  );
}
