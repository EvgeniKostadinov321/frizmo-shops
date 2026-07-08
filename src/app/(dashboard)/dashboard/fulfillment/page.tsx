import { FulfillmentManager } from "@/components/dashboard/fulfillment-manager";
import { OrderSettings } from "@/components/dashboard/order-settings";
import {
  ensureDefaultMethods,
  getPaymentMethods,
  getShippingMethods,
} from "@/db/queries/fulfillment";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Плащане и доставка — Frizmo Shops" };

export default async function FulfillmentPage() {
  const { shop } = await requireShop();
  await ensureDefaultMethods(shop.id);

  const [shipping, payment] = await Promise.all([
    getShippingMethods(shop.id),
    getPaymentMethods(shop.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <FulfillmentManager shipping={shipping} payment={payment} />
      <OrderSettings
        giftWrapEnabled={shop.giftWrapEnabled}
        giftWrapFeeCents={shop.giftWrapFeeCents}
        returnWindowDays={shop.returnWindowDays}
      />
    </div>
  );
}
