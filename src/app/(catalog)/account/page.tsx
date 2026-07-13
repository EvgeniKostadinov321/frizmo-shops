import type { Metadata } from "next";
import Link from "next/link";
import { LinkOrdersBanner } from "@/components/account/link-orders-banner";
import { countLinkableGuestOrders } from "@/actions/buyer";
import { getBuyerOrdersGlobal } from "@/db/queries/buyer-global";
import { requireBuyer } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Моят профил — Frizmo Shops", robots: { index: false } };

export default async function AccountHomePage() {
  const { profile } = await requireBuyer();
  const [orders, linkable] = await Promise.all([
    getBuyerOrdersGlobal(profile.id),
    countLinkableGuestOrders(),
  ]);
  const last = orders[0];
  const pending = linkable.ok ? linkable.data.count : 0;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
          Здравей{profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}!
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Поръчките, адресите и любимите ти — на едно място.
        </p>
      </div>
      <LinkOrdersBanner pending={pending} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/account/orders"
          className="rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600"
        >
          <p className="text-sm font-medium text-ink-900">Моите поръчки</p>
          {last ? (
            <p className="mt-1 text-sm text-ink-500">
              Последна: №{String(last.orderNumber).padStart(4, "0")} · {last.shopName} ·{" "}
              {formatPrice(last.totalCents)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-500">Още нямаш поръчки.</p>
          )}
        </Link>
        <Link
          href="/account/favorites"
          className="rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600"
        >
          <p className="text-sm font-medium text-ink-900">Любими</p>
          <p className="mt-1 text-sm text-ink-500">Продукти и магазини, които следиш.</p>
        </Link>
        <Link
          href="/account/addresses"
          className="rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600"
        >
          <p className="text-sm font-medium text-ink-900">Адресна книга</p>
          <p className="mt-1 text-sm text-ink-500">Запазени адреси за бърз checkout.</p>
        </Link>
        <Link
          href="/account/settings"
          className="rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600"
        >
          <p className="text-sm font-medium text-ink-900">Настройки</p>
          <p className="mt-1 text-sm text-ink-500">Име, телефон, изтриване на акаунт.</p>
        </Link>
      </div>
    </div>
  );
}
