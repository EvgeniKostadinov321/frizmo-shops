import { FulfillmentManager } from "@/components/dashboard/fulfillment-manager";
import { OrderSettings } from "@/components/dashboard/order-settings";
import { Tabs, TabPanel } from "@/components/ui";
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
      <h1 className="text-2xl font-bold text-ink-900">Плащане и доставка</h1>
      <Tabs
        ariaLabel="Плащане и доставка"
        tabs={[
          { key: "shipping", label: "Доставка" },
          { key: "payment", label: "Плащане" },
          { key: "orders", label: "Поръчки и връщания" },
        ]}
      >
        <TabPanel tabKey="shipping">
          <FulfillmentManager only="shipping" shipping={shipping} payment={payment} zones={zones} />
        </TabPanel>
        <TabPanel tabKey="payment">
          <FulfillmentManager only="payment" shipping={shipping} payment={payment} zones={zones} />
        </TabPanel>
        <TabPanel tabKey="orders">
          <OrderSettings
            giftWrapEnabled={shop.giftWrapEnabled}
            giftWrapFeeCents={shop.giftWrapFeeCents}
            giftCardEnabled={shop.giftCardEnabled}
            returnWindowDays={shop.returnWindowDays}
          />
        </TabPanel>
      </Tabs>
    </div>
  );
}
