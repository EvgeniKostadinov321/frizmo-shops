import { BreakdownTable } from "@/components/dashboard/breakdown-table";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Icon, TransitionLink } from "@/components/ui";
import {
  ANALYTICS_PERIODS,
  getAnalytics,
  type AnalyticsPeriod,
  type PeriodMetrics,
} from "@/db/queries/analytics";
import { getAnalyticsBreakdowns } from "@/db/queries/analytics-breakdowns";
import { requireShop } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { count, NOUNS } from "@/lib/plural";

export const metadata = { title: "Аналитика — Frizmo Shops" };

interface AnalyticsPageProps {
  searchParams: Promise<{ period?: string }>;
}

/** Промяна спрямо предишния период: "+18%" / "−7%" / "—" (при предишен 0). */
function delta(current: number, previous: number): { label: string; up: boolean | null } {
  if (previous === 0) return { label: "—", up: null };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: "0%", up: null };
  return { label: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`, up: pct > 0 };
}

function MetricCard({
  label,
  value,
  current,
  previous,
  periodDays,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  periodDays: number;
}) {
  const d = delta(current, previous);
  return (
    <div className="rounded-card border border-surface-200 bg-surface-0 p-4">
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums tracking-tight text-ink-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-500">
        {d.up !== null && (
          <span className={`font-bold ${d.up ? "text-success-600" : "text-danger-600"}`}>
            {d.label}
          </span>
        )}
        {d.up === null && <span className="font-bold text-ink-500">{d.label}</span>}{" "}
        спрямо предишните {periodDays} дни
      </p>
    </div>
  );
}

/** S5: аналитика с тренд — период, метрики, приходи по дни, топ продукти. */
export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const { shop } = await requireShop();
  const params = await searchParams;
  const parsed = Number(params.period);
  const period: AnalyticsPeriod = (ANALYTICS_PERIODS as readonly number[]).includes(parsed)
    ? (parsed as AnalyticsPeriod)
    : 30;

  const [{ current, previous, daily, topProducts }, breakdowns] = await Promise.all([
    getAnalytics(shop.id, period),
    getAnalyticsBreakdowns(shop.id, period),
  ]);

  const metric = (key: keyof PeriodMetrics) => ({ current: current[key], previous: previous[key] });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Аналитика</h1>
          <p className="mt-1 text-sm text-ink-500">
            Как се движи магазинът — поръчки, приходи и топ продукти по период.
          </p>
        </div>
        <div className="flex gap-2">
          {ANALYTICS_PERIODS.map((p) => (
            <TransitionLink
              key={p}
              href={p === 30 ? "/dashboard/analytics" : `/dashboard/analytics?period=${p}`}
              aria-current={period === p ? "true" : undefined}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                period === p
                  ? "border-brand-600 bg-brand-600 text-surface-0"
                  : "border-surface-200 bg-surface-0 text-ink-700 hover:border-surface-300 hover:text-ink-900"
              }`}
            >
              {p} дни
            </TransitionLink>
          ))}
        </div>
      </div>

      {/* Метрики със сравнение */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Приходи"
          value={formatPrice(current.revenueCents)}
          {...metric("revenueCents")}
          periodDays={period}
        />
        <MetricCard
          label="Поръчки"
          value={String(current.orderCount)}
          {...metric("orderCount")}
          periodDays={period}
        />
        <MetricCard
          label="Средна поръчка"
          value={formatPrice(current.avgOrderCents)}
          {...metric("avgOrderCents")}
          periodDays={period}
        />
        <MetricCard
          label="Нови абонати"
          value={String(current.newSubscribers)}
          {...metric("newSubscribers")}
          periodDays={period}
        />
      </div>

      {/* Приходи по дни */}
      <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Приходи по дни</h2>
        {current.orderCount === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Няма поръчки за периода.</p>
        ) : (
          <div className="mt-4">
            <RevenueChart daily={daily} />
          </div>
        )}
      </section>

      {/* Топ продукти */}
      <section className="rounded-card border border-surface-200 bg-surface-0">
        <div className="border-b border-surface-200 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Топ продукти</h2>
        </div>
        {topProducts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-100 text-ink-500">
              <Icon name="trending-up" size={22} />
            </span>
            <p className="text-sm text-ink-500">Няма продажби за периода.</p>
          </div>
        ) : (
          <ol className="divide-y divide-surface-100">
            {topProducts.map((product, i) => (
              <li key={product.name} className="flex items-center gap-4 px-5 py-3">
                <span className="font-display text-lg font-extrabold text-ink-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                  {product.name}
                </span>
                <span className="text-sm text-ink-500">{product.quantity} бр.</span>
                <span className="w-24 text-right font-bold tabular-nums text-ink-900">
                  {formatPrice(product.revenueCents)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* В3: Източници на поръчки */}
      <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Източници на поръчки</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-1 text-sm font-bold text-ink-700">По плащане</h3>
            <BreakdownTable rows={breakdowns.sources.byPayment} emptyText="Няма данни." />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold text-ink-700">По град</h3>
            <BreakdownTable rows={breakdowns.sources.byCity} emptyText="Няма данни." />
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold text-ink-700">Купони</h3>
            <BreakdownTable
              rows={[breakdowns.sources.coupon.withCoupon, breakdowns.sources.coupon.withoutCoupon]}
              emptyText="Няма данни."
            />
            <p className="mt-2 text-xs text-ink-500">
              Обща отстъпка: {formatPrice(breakdowns.sources.coupon.totalDiscountCents)}
            </p>
          </div>
        </div>
      </section>

      {/* В3: Конверсия абонати → клиенти */}
      <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">От абонати към клиенти</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Нови абонати" value={String(breakdowns.conversion.newSubscribers)} />
          <MiniStat
            label="Поръчали абонати"
            value={String(breakdowns.conversion.subscribersWhoOrdered)}
          />
          <MiniStat
            label="Welcome поръчки"
            value={String(breakdowns.conversion.welcomeOrders)}
          />
          <MiniStat
            label="Приходи от welcome"
            value={formatPrice(breakdowns.conversion.welcomeRevenueCents)}
          />
        </div>
      </section>

      {/* В3: Повторни клиенти (all-time) */}
      <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink-900">Повторни клиенти</h2>
          <p className="text-xs text-ink-500">за целия период</p>
        </div>
        <p className="mt-2 text-sm text-ink-700">
          <strong className="tabular-nums">{breakdowns.repeat.repeatCustomers}</strong> от{" "}
          <strong className="tabular-nums">{breakdowns.repeat.totalCustomers}</strong> клиенти са
          поръчвали повече от веднъж.
        </p>
        {breakdowns.repeat.top.length > 0 && (
          <ul className="mt-3 divide-y divide-surface-100">
            {breakdowns.repeat.top.map((r) => (
              <li key={r.phoneMasked} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 font-mono text-ink-900">{r.phoneMasked}</span>
                <span className="tabular-nums text-ink-500">{count(r.orderCount, NOUNS.order)}</span>
                <span className="w-24 text-right font-bold tabular-nums text-ink-900">
                  {formatPrice(r.totalCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* В3: Топ категории */}
      <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Топ категории</h2>
        <div className="mt-3">
          <BreakdownTable rows={breakdowns.categories} emptyText="Няма продажби за периода." />
        </div>
      </section>
    </div>
  );
}

/** Компактна метрика без сравнение (за разрезите). */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-surface-200 bg-surface-0 p-4">
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums tracking-tight text-ink-900">
        {value}
      </p>
    </div>
  );
}
