import Link from "next/link";
import { ManualOrderForm } from "@/components/dashboard/manual-order-form";
import { getAllPricingProducts } from "@/db/queries/cart";
import { getPaymentMethods, getShippingMethods } from "@/db/queries/fulfillment";
import { canAcceptOrders } from "@/lib/selling-gate";
import { requireShop } from "@/lib/auth";
import { Card, Icon, LinkButton } from "@/components/ui";

export const metadata = { title: "Нова поръчка — Frizmo Shops" };

/** Ръчна поръчка („каса") — телефонни/DM/офлайн продажби влизат в системата. */
export default async function NewOrderPage() {
  const { shop } = await requireShop();

  /* Card-gate: ръчната поръчка е нова продажба → същият гард като checkout.
     Показваме предупреждение ВМЕСТО формата (не toast след попълване) — по-бързо. */
  const canAccept = await canAcceptOrders(shop.id);

  const [products, shipping, payment] = await Promise.all([
    getAllPricingProducts(shop.id),
    getShippingMethods(shop.id),
    getPaymentMethods(shop.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          ← Всички поръчки
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink-900">
          Нова поръчка
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          За телефонни, лични или офлайн продажби — влиза в системата като нормална
          поръчка (наличности, номер, статистика).
        </p>
      </div>

      {!canAccept ? (
        <Card className="flex flex-col items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-danger-600/15 text-danger-700">
            <Icon name="wallet" size={20} />
          </span>
          <div>
            <h2 className="font-bold text-ink-900">Магазинът временно не приема поръчки</h2>
            <p className="mt-1 text-sm text-ink-700">
              Имаш първа продажба. Запази карта, за да продължиш да приемаш поръчки — таксата
              се тегли автоматично от нея.
            </p>
          </div>
          <LinkButton href="/dashboard/billing">Запази карта</LinkButton>
        </Card>
      ) : (
      <ManualOrderForm
        products={products}
        shippingMethods={shipping
          .filter((m) => m.active)
          .map((m) => ({ id: m.id, name: m.name, priceCents: m.priceCents, freeOverCents: m.freeOverCents }))}
        paymentMethods={payment.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }))}
        giftWrapEnabled={shop.giftWrapEnabled}
        giftWrapFeeCents={shop.giftWrapFeeCents}
        giftCardEnabled={shop.giftCardEnabled}
      />
      )}
    </div>
  );
}
