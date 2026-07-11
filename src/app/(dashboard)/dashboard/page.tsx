import Link from "next/link";
import { Badge, Icon, LinkButton } from "@/components/ui";
import { DashboardWelcome } from "@/components/dashboard/dashboard-welcome";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { StatTile } from "@/components/dashboard/stat-tile";
import { countCategories } from "@/db/queries/categories";
import { countNewOrders, getMonthRevenue, getOrders } from "@/db/queries/orders";
import { countLowStock, countProducts } from "@/db/queries/products";
import { getOnboardingStatus } from "@/db/queries/onboarding-status";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { getOwnShop } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Табло — Frizmo Shops" };

const dateFormat = new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short" });

export default async function DashboardPage() {
  const { shop } = await getOwnShop();

  if (!shop) {
    return <DashboardWelcome />;
  }

  const [productCount, categoryCount, newOrders, monthRevenue, recentOrders, lowStock] =
    await Promise.all([
      countProducts(shop.id),
      countCategories(shop.id),
      countNewOrders(shop.id),
      getMonthRevenue(shop.id),
      getOrders(shop.id),
      countLowStock(shop.id),
    ]);

  const isDraft = shop.status === "draft";
  const latest = recentOrders.items.slice(0, 5);
  /* Д1: онбординг чеклист — само след първия продукт (иначе е рано); сам се
     скрива когато всичките 6 стъпки са готови. */
  const onboarding = productCount > 0 ? await getOnboardingStatus(shop) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header: поздрав + статус + CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
            {shop.name}
          </h1>
          <div className="mt-1.5">
            {isDraft ? (
              <Badge tone="neutral">Чернова — очаква публикуване</Badge>
            ) : shop.status === "published" ? (
              <Badge tone="success">Публикуван</Badge>
            ) : (
              <Badge tone="danger">Временно затворен</Badge>
            )}
          </div>
        </div>
        <LinkButton href="/dashboard/products/new">Нов продукт</LinkButton>
      </div>

      {onboarding && <OnboardingChecklist result={onboarding} />}

      {/* KPI лента */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Нови поръчки"
          value={newOrders}
          icon="bell"
          href="/dashboard/orders?status=new"
          accent={newOrders > 0}
        />
        <StatTile label="Приходи този месец" value={formatPrice(monthRevenue)} icon="trending-up" />
        <StatTile label="Продукти" value={productCount} icon="store" href="/dashboard/products" />
        {lowStock > 0 ? (
          <StatTile
            label="Нисък склад"
            value={lowStock}
            icon="bell"
            href="/dashboard/products?stock=low"
            accent
          />
        ) : (
          <StatTile
            label="Категории"
            value={categoryCount}
            icon="palette"
            href="/dashboard/categories"
          />
        )}
      </div>

      {/* Две колони: последни поръчки (голямо) + следващи стъпки (тясно) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Последни поръчки */}
        <section className="rounded-card border border-surface-200 bg-surface-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink-900">Последни поръчки</h2>
            {latest.length > 0 && (
              <Link
                href="/dashboard/orders"
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Виж всички →
              </Link>
            )}
          </div>

          {latest.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-surface-100 text-ink-500">
                <Icon name="bell" size={24} />
              </span>
              <div>
                <p className="font-medium text-ink-900">Още няма поръчки</p>
                <p className="mt-1 text-sm text-ink-500">
                  Публикувай магазина и сподели адреса — първите поръчки ще се появят тук.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-surface-100">
              {latest.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-50 sm:px-5"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs font-medium tabular-nums text-ink-500">
                          #{String(order.orderNumber).padStart(4, "0")}
                        </span>
                        <span className="truncate font-medium text-ink-900">{order.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-xs text-ink-500">
                          {dateFormat.format(order.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-ink-900">
                      {formatPrice(order.totalCents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Следващи стъпки / бързи действия */}
        <aside className="flex flex-col gap-4 rounded-card border border-surface-200 bg-surface-0 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Следващи стъпки</h2>

          {isDraft && (
            <div className="rounded-control bg-brand-surface p-4">
              <p className="font-bold text-brand-surface-ink">Публикувай магазина си</p>
              <p className="mt-1 text-sm text-brand-surface-muted">
                Магазинът е още чернова. Публикувай го от таб „Уебсайт“, за да е на живо.
              </p>
              <Link
                href="/dashboard/website"
                className="mt-3 inline-flex h-10 items-center rounded-control bg-brand-surface-ink px-4 text-sm font-bold text-brand-surface transition-transform hover:-translate-y-0.5"
              >
                Към „Уебсайт“
              </Link>
            </div>
          )}

          <nav className="flex flex-col gap-1">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-surface-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-100 text-ink-700 transition-colors group-hover:bg-brand-50 group-hover:text-brand-700">
                  <Icon name={link.icon} size={18} />
                </span>
                <span className="flex-1 text-sm font-medium text-ink-900">{link.label}</span>
                <span aria-hidden className="text-ink-500 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  { href: "/dashboard/products/new", label: "Добави продукт", icon: "store" },
  { href: "/dashboard/categories", label: "Организирай категории", icon: "palette" },
  { href: "/dashboard/fulfillment", label: "Настрой доставка и плащане", icon: "trending-up" },
  { href: "/dashboard/website", label: "Персонализирай магазина", icon: "image" },
] as const;
