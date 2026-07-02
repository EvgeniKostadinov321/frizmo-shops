import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderActions } from "@/components/dashboard/order-actions";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Card } from "@/components/ui";
import { getOrderWithItems } from "@/db/queries/orders";
import { requireShop } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Поръчка — Frizmo Shops" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" });

export default async function OrderDetailPage({ params }: PageProps) {
  const { shop } = await requireShop();
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await getOrderWithItems(id);
  if (!order || order.shopId !== shop.id) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink-900">
            Поръчка #{String(order.orderNumber).padStart(4, "0")}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <Link href="/dashboard/orders" className="text-sm text-brand-600 hover:underline">
          ← Всички поръчки
        </Link>
      </div>

      <p className="text-sm text-ink-500">{dateFormat.format(order.createdAt)}</p>

      <OrderActions orderId={order.id} status={order.status} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-1 text-sm">
          <h2 className="mb-2 font-bold text-ink-900">Клиент</h2>
          <p className="font-medium text-ink-900">{order.customerName}</p>
          <p>
            <a href={`tel:${order.customerPhone}`} className="text-brand-600 hover:underline">
              {order.customerPhone}
            </a>
          </p>
          {order.customerEmail && (
            <p>
              <a href={`mailto:${order.customerEmail}`} className="text-brand-600 hover:underline">
                {order.customerEmail}
              </a>
            </p>
          )}
          {(order.address || order.city) && (
            <p className="text-ink-700">{[order.address, order.city].filter(Boolean).join(", ")}</p>
          )}
          {order.note && (
            <p className="mt-2 rounded-control bg-surface-50 p-2 text-ink-700">
              💬 {order.note}
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-1 text-sm">
          <h2 className="mb-2 font-bold text-ink-900">Доставка и плащане</h2>
          <p className="text-ink-700">
            🚚 {order.shippingName} — {order.shippingPriceCents === 0 ? "безплатна" : formatPrice(order.shippingPriceCents)}
          </p>
          <p className="text-ink-700">💳 {order.paymentName}</p>
        </Card>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="mb-1 font-bold text-ink-900">Артикули</h2>
        {order.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 border-b border-surface-100 pb-2 text-sm last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-900">
                {item.productId ? (
                  <Link href={`/dashboard/products/${item.productId}`} className="hover:text-brand-600">
                    {item.productName}
                  </Link>
                ) : (
                  item.productName
                )}
                {item.variantLabel && <span className="text-ink-500"> ({item.variantLabel})</span>}
              </p>
              <p className="text-xs text-ink-500">
                {item.quantity} × {formatPrice(item.unitPriceCents)}
                {item.appliedDeal && <span className="text-warning-600"> · 🏷 {item.appliedDeal}</span>}
              </p>
            </div>
            <span className="shrink-0 font-medium text-ink-900">
              {formatPrice(item.lineTotalCents)}
            </span>
          </div>
        ))}
        <div className="flex justify-between pt-1 text-sm text-ink-500">
          <span>Доставка</span>
          <span>{formatPrice(order.shippingPriceCents)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-ink-900">
          <span>Общо</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
      </Card>
    </div>
  );
}
