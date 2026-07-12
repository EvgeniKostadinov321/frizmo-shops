import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBuyerOrders } from "@/db/queries/buyer";
import { getPublicShop } from "@/db/queries/storefront";
import { requireBuyer } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Моите поръчки", robots: { index: false } };

/** Купувачки статуси (кратки етикети, тон през --sf-*). */
const STATUS_LABELS: Record<string, string> = {
  new: "Приета",
  confirmed: "Потвърдена",
  shipped: "Изпратена",
  completed: "Завършена",
  cancelled: "Отказана",
  return_requested: "Заявено връщане",
  returned: "Върната",
};

const dateFmt = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" });

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AccountOrdersPage({ params }: PageProps) {
  const { slug } = await params;
  const [{ profile }, shopResult] = await Promise.all([requireBuyer(), getPublicShop(slug)]);
  if (!shopResult) notFound();
  const { shop } = shopResult;
  const base = `/s/${slug}`;
  const orders = await getBuyerOrders(profile.id, shop.id);

  if (orders.length === 0) {
    return (
      <div className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-8 text-center">
        <p className="text-sm text-(--sf-muted)">Още нямаш поръчки от този магазин.</p>
        <Link
          href={`${base}/products`}
          className="mt-3 inline-block text-sm font-medium text-(--sf-primary) hover:underline"
        >
          Разгледай продуктите
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`${base}/order/${o.id}?t=${o.publicToken}`}
            className="flex items-center justify-between gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 transition-colors hover:border-(--sf-primary)"
          >
            <div className="min-w-0">
              <p className="font-medium text-(--sf-text)">
                Поръчка №{String(o.orderNumber).padStart(4, "0")}
              </p>
              <p className="mt-0.5 text-sm text-(--sf-muted)">
                {dateFmt.format(o.createdAt)} · {STATUS_LABELS[o.status] ?? "Приета"}
              </p>
            </div>
            <span className="shrink-0 font-medium text-(--sf-text)">
              {formatPrice(o.totalCents)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
