import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { Icon } from "@/components/ui";
import { ReorderButton } from "@/components/storefront/reorder-button";
import { ReturnRequest } from "@/components/storefront/return-request";
import { db, orderItems, orders } from "@/db";
import { getPublicShop } from "@/db/queries/storefront";
import { formatPrice } from "@/lib/money";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ t?: string }>;
}

export const metadata: Metadata = { title: "Поръчката е приета", robots: { index: false } };

/** N12: в срока за връщане ли е поръчката (server render — времето е моментът на заявката). */
function withinReturnWindow(completedAt: Date, windowDays: number): boolean {
  return Date.now() - completedAt.getTime() <= windowDays * 86_400_000;
}

export default async function OrderConfirmationPage({ params, searchParams }: PageProps) {
  const { slug, orderId } = await params;
  const { t: token } = await searchParams;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;

  /* URL-ът трябва да носи валиден token — само id не стига (личните данни на
     клиента иначе биха били достъпни на всеки с познат orderId). */
  if (!z.uuid().safeParse(orderId).success || !token) notFound();
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.shopId, shop.id),
      eq(orders.publicToken, token),
    ),
  });
  if (!order) notFound();

  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, order.id),
  });
  const number = `#${String(order.orderNumber).padStart(4, "0")}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-full bg-(--sf-primary) text-(--sf-on-primary) shadow-(--sf-shadow)"
        >
          <Icon name="check" size={34} />
        </span>
        <h1 className="text-[clamp(2rem,5vw,2.75rem)] leading-[1.05] text-(--sf-text)">
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
                <span className="text-(--sf-accent)"> · {item.appliedDeal}</span>
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
        {order.giftWrap && (
          <div className="flex justify-between text-sm text-(--sf-muted)">
            <span>Подаръчна опаковка</span>
            <span>{order.giftWrapFeeCents > 0 ? formatPrice(order.giftWrapFeeCents) : "Безплатна"}</span>
          </div>
        )}
        {order.giftCard && (
          <div className="flex justify-between text-sm text-(--sf-muted)">
            <span>Подаръчна картичка</span>
            <span>Включена</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-(--sf-text)">
          <span>Общо</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
        <p className="text-sm text-(--sf-muted)">Плащане: {order.paymentName}</p>
      </div>

      {/* N12: заявка за връщане — само „завършена" и в срока на магазина */}
      {order.status === "completed" &&
        withinReturnWindow(order.updatedAt, shop.returnWindowDays) && (
          <ReturnRequest
            shopSlug={shop.slug}
            orderId={order.id}
            token={token}
            returnWindowDays={shop.returnWindowDays}
          />
        )}
      {order.status === "return_requested" && (
        <p className="mt-6 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 text-center text-sm text-(--sf-text)">
          Заявката ти за връщане чака преглед от магазина — ще получиш имейл.
        </p>
      )}
      {order.status === "returned" && (
        <p className="mt-6 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 text-center text-sm text-(--sf-text)">
          Връщането по тази поръчка е прието.
        </p>
      )}

      <ReorderButton shopSlug={shop.slug} shopId={shop.id} orderId={order.id} token={token} />

      <p className="mt-6 text-center text-sm text-(--sf-muted)">
        {shop.name} ще се свърже с теб при нужда на {order.customerPhone}.
      </p>
      <p className="mt-1.5 text-center text-sm text-(--sf-muted)">
        Запиши си номер <strong className="text-(--sf-text)">{number}</strong> — цитирай го при въпроси към магазина.
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
