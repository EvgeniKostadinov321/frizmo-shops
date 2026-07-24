import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ShippingMethod } from "@/db";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { CheckoutTrustBadges } from "@/components/storefront/checkout-trust-badges";
import { PageHeader } from "@/components/storefront/page-header";
import { getBuyerAddresses } from "@/db/queries/buyer";
import { getActiveCourierDeliveryOptions } from "@/db/queries/couriers";
import { getPaymentMethods, getShippingMethods } from "@/db/queries/fulfillment";
import { getZonesForShop } from "@/db/queries/shipping-zones";
import { getPublicShop } from "@/db/queries/storefront";
import { canAcceptOrders } from "@/lib/selling-gate";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Синтетичен ключ на куриерски метод в checkout — courier:{provider}:{target}. */
function courierMethodId(provider: string, target: string) {
  return `courier:${provider}:${target}`;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  return { title: `Поръчка — ${result.shop.name}`, robots: { index: false } };
}

export default async function CheckoutPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;

  const [shipping, payment, zones, courierOptions, sellingAllowed] = await Promise.all([
    getShippingMethods(shop.id),
    getPaymentMethods(shop.id),
    getZonesForShop(shop.id),
    getActiveCourierDeliveryOptions(shop.id),
    canAcceptOrders(shop.id),
  ]);

  /* Куриерските опции стават синтетични методи за checkout (тип „courier"), с
     резервната цена като начална (placeholder) — реалната се изчислява live при
     избор на офис/град. Формата чете същите полета (courierProvider/deliveryTarget). */
  const now = new Date();
  const courierMethods: ShippingMethod[] = courierOptions.map((o) => ({
    id: courierMethodId(o.provider, o.deliveryTarget),
    shopId: shop.id,
    type: "courier",
    name: o.displayName || `Доставка с ${o.provider}`,
    priceCents: o.fallbackPriceCents,
    freeOverCents: o.freeOverCents,
    deliveryHours: null,
    courierProvider: o.provider,
    deliveryTarget: o.deliveryTarget,
    active: true,
    sortOrder: 100,
    createdAt: now,
    updatedAt: now,
  }));

  const activeShipping = [...shipping.filter((m) => m.active), ...courierMethods];
  const activePayment = payment.filter((m) => m.active);

  /* Логнат купувач → зареждаме адресната му книга за бърз autofill (гост → празно;
     checkout остава публичен, не изисква вход). */
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const savedAddresses = user ? await getBuyerAddresses(user.id) : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader kicker="Поръчка" title="Завършване на поръчката" />
      {!sellingAllowed ? (
        <p className="py-16 text-center text-(--sf-muted)">
          Магазинът временно не приема поръчки.
        </p>
      ) : activeShipping.length === 0 || activePayment.length === 0 ? (
        <p className="py-16 text-center text-(--sf-muted)">
          Магазинът все още не е настроил методи за доставка и плащане.
        </p>
      ) : (
        <>
          <CheckoutTrustBadges
            returnWindowDays={shop.returnWindowDays}
            hasCod={activePayment.some((m) => m.type === "cod")}
          />
          <CheckoutForm
            shopId={shop.id}
            slug={shop.slug}
            base={`/s/${shop.slug}`}
            shippingMethods={activeShipping}
            paymentMethods={activePayment}
            zones={zones}
            giftWrapEnabled={shop.giftWrapEnabled}
            giftWrapFeeCents={shop.giftWrapFeeCents}
            giftCardEnabled={shop.giftCardEnabled}
            savedAddresses={savedAddresses}
          />
        </>
      )}
    </div>
  );
}
