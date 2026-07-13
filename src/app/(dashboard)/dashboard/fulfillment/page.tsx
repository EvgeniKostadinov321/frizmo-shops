import { CourierAccounts } from "@/components/dashboard/courier-accounts";
import { FulfillmentManager } from "@/components/dashboard/fulfillment-manager";
import { OrderSettings } from "@/components/dashboard/order-settings";
import { PaymentAccounts } from "@/components/dashboard/payment-accounts";
import { Tabs, TabPanel } from "@/components/ui";
import { getCourierAccounts } from "@/db/queries/couriers";
import {
  ensureDefaultMethods,
  getPaymentMethods,
  getShippingMethods,
} from "@/db/queries/fulfillment";
import { getShopPaymentAccount } from "@/db/queries/payment-accounts";
import { getZonesForShop } from "@/db/queries/shipping-zones";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Плащане и доставка — Frizmo Shops" };

export default async function FulfillmentPage() {
  const { shop } = await requireShop();
  await ensureDefaultMethods(shop.id);

  const [shipping, payment, zones, courierAccounts, paymentAccount] = await Promise.all([
    getShippingMethods(shop.id),
    getPaymentMethods(shop.id),
    getZonesForShop(shop.id),
    getCourierAccounts(shop.id),
    getShopPaymentAccount(shop.id, "epay"),
  ]);
  const hasCourier = courierAccounts.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink-900">Плащане и доставка</h1>
      <Tabs
        ariaLabel="Плащане и доставка"
        tabs={[
          { key: "shipping", label: "Доставка" },
          { key: "payment", label: "Плащане" },
          { key: "couriers", label: "Куриери" },
          { key: "orders", label: "Поръчки и връщания" },
        ]}
      >
        <TabPanel tabKey="shipping">
          <FulfillmentManager
            only="shipping"
            shipping={shipping}
            payment={payment}
            zones={zones}
            hasCourier={hasCourier}
          />
        </TabPanel>
        <TabPanel tabKey="payment">
          <div className="flex flex-col gap-6">
            <FulfillmentManager only="payment" shipping={shipping} payment={payment} zones={zones} />
            <PaymentAccounts account={paymentAccount ?? null} />
          </div>
        </TabPanel>
        <TabPanel tabKey="couriers">
          <CourierAccounts accounts={courierAccounts} />
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
