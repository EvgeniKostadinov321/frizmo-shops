import { FulfillmentManager } from "@/components/dashboard/fulfillment-manager";
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

  return <FulfillmentManager shipping={shipping} payment={payment} />;
}
