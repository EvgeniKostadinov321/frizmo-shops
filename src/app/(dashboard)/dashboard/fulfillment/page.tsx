import { FulfillmentManager } from "@/components/dashboard/fulfillment-manager";
import { OrderSettings } from "@/components/dashboard/order-settings";
import {
  ensureDefaultMethods,
  getPaymentMethods,
  getShippingMethods,
} from "@/db/queries/fulfillment";
import { getZonesForShop } from "@/db/queries/shipping-zones";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Плащане и доставка — Frizmo Shops" };

export default async function FulfillmentPage() {
  const { shop } = await requireShop();
  await ensureDefaultMethods(shop.id);

  const [shipping, payment, zones] = await Promise.all([
    getShippingMethods(shop.id),
    getPaymentMethods(shop.id),
    getZonesForShop(shop.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <FulfillmentManager shipping={shipping} payment={payment} zones={zones} />
      <OrderSettings
        giftWrapEnabled={shop.giftWrapEnabled}
        giftWrapFeeCents={shop.giftWrapFeeCents}
        giftCardEnabled={shop.giftCardEnabled}
        returnWindowDays={shop.returnWindowDays}
      />
    </div>
  );
}
