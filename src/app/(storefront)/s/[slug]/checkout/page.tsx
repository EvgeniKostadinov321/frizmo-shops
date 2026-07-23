import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { CheckoutTrustBadges } from "@/components/storefront/checkout-trust-badges";
import { PageHeader } from "@/components/storefront/page-header";
import { getBuyerAddresses } from "@/db/queries/buyer";
import { getPaymentMethods, getShippingMethods } from "@/db/queries/fulfillment";
import { getZonesForShop } from "@/db/queries/shipping-zones";
import { getPublicShop } from "@/db/queries/storefront";
import { canAcceptOrders } from "@/lib/selling-gate";
import { createSupabaseServer } from "@/lib/supabase/server";

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

  const [shipping, payment, zones, sellingAllowed] = await Promise.all([
    getShippingMethods(shop.id),
    getPaymentMethods(shop.id),
    getZonesForShop(shop.id),
    canAcceptOrders(shop.id),
  ]);
  const activeShipping = shipping.filter((m) => m.active);
  const activePayment = payment.filter((m) => m.active);

  /* Логнат купувач → зареждаме адресната му книга за бърз autofill (гост → празно;
     checkout остава публичен, не изисква вход). */
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const savedAddresses = user ? await getBuyerAddresses(user.id) : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
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
