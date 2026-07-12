import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkOrdersBanner } from "@/components/storefront/account/link-orders-banner";
import { countLinkableGuestOrders } from "@/actions/buyer";
import { getBuyerOrders } from "@/db/queries/buyer";
import { getPublicShop } from "@/db/queries/storefront";
import { requireBuyer } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Моят профил", robots: { index: false } };

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AccountHomePage({ params }: PageProps) {
  const { slug } = await params;
  const [{ profile }, shopResult] = await Promise.all([requireBuyer(), getPublicShop(slug)]);
  if (!shopResult) notFound();
  const { shop } = shopResult;
  const base = `/s/${slug}`;

  const [orders, linkable] = await Promise.all([
    getBuyerOrders(profile.id, shop.id),
    countLinkableGuestOrders(),
  ]);
  const lastOrder = orders[0];
  const pending = linkable.ok ? linkable.data.count : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-(family-name:--sf-font-heading) text-2xl font-bold text-(--sf-text)">
          Здравей{profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}!
        </h1>
        <p className="mt-1 text-sm text-(--sf-muted)">
          Тук следиш поръчките, адресите и любимите си.
        </p>
      </div>

      <LinkOrdersBanner pending={pending} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`${base}/account/orders`}
          className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 transition-colors hover:border-(--sf-primary)"
        >
          <p className="text-sm font-medium text-(--sf-text)">Моите поръчки</p>
          {lastOrder ? (
            <p className="mt-1 text-sm text-(--sf-muted)">
              Последна: №{String(lastOrder.orderNumber).padStart(4, "0")} ·{" "}
              {formatPrice(lastOrder.totalCents)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-(--sf-muted)">Още нямаш поръчки.</p>
          )}
        </Link>
        <Link
          href={`${base}/account/addresses`}
          className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 transition-colors hover:border-(--sf-primary)"
        >
          <p className="text-sm font-medium text-(--sf-text)">Адресна книга</p>
          <p className="mt-1 text-sm text-(--sf-muted)">Запази адреси за бърз checkout.</p>
        </Link>
        <Link
          href={`${base}/favorites`}
          className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 transition-colors hover:border-(--sf-primary)"
        >
          <p className="text-sm font-medium text-(--sf-text)">Любими</p>
          <p className="mt-1 text-sm text-(--sf-muted)">Продуктите, които следиш.</p>
        </Link>
        <Link
          href={`${base}/account/settings`}
          className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 transition-colors hover:border-(--sf-primary)"
        >
          <p className="text-sm font-medium text-(--sf-text)">Настройки</p>
          <p className="mt-1 text-sm text-(--sf-muted)">Име, телефон, изход.</p>
        </Link>
      </div>
    </div>
  );
}
