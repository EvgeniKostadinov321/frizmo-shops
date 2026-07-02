import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, orderItems, orders } from "@/db";
import { getPublicShop } from "@/db/queries/storefront";
import { formatPrice } from "@/lib/money";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export const metadata: Metadata = { title: "Поръчката е приета", robots: { index: false } };

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { slug, orderId } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;

  if (!/^[0-9a-f-]{36}$/.test(orderId)) notFound();
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.shopId, shop.id)),
  });
  if (!order) notFound();

  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, order.id),
  });
  const number = `#${String(order.orderNumber).padStart(4, "0")}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="text-6xl">
          ✅
        </span>
        <h1
          className="text-3xl text-(--sf-text)"
        >
          Поръчката е приета!
        </h1>
        <p className="text-(--sf-muted)">
          Номер на поръчката: <strong className="text-(--sf-text)">{number}</strong>
          {order.customerEmail && " · Изпратихме ти потвърждение по имейл."}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between gap-2 text-sm">
            <span className="text-(--sf-muted)">
              {item.productName}
              {item.variantLabel && ` (${item.variantLabel})`} ×{item.quantity}
              {item.appliedDeal && (
                <span className="text-(--sf-accent)"> · 🏷 {item.appliedDeal}</span>
              )}
            </span>
            <span className="shrink-0 text-(--sf-text)">{formatPrice(item.lineTotalCents)}</span>
          </div>
        ))}
        <hr className="border-(--sf-border)" />
        <div className="flex justify-between text-sm text-(--sf-muted)">
          <span>Доставка ({order.shippingName})</span>
          <span>{formatPrice(order.shippingPriceCents)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-(--sf-text)">
          <span>Общо</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
        <p className="text-sm text-(--sf-muted)">Плащане: {order.paymentName}</p>
      </div>

      <p className="mt-6 text-center text-sm text-(--sf-muted)">
        {shop.name} ще се свърже с теб при нужда на {order.customerPhone}.
      </p>
      <p className="mt-4 text-center">
        <Link
          href={`/s/${shop.slug}`}
          className="text-(--sf-primary) underline hover:opacity-70"
        >
          Обратно към магазина
        </Link>
      </p>
    </div>
  );
}
