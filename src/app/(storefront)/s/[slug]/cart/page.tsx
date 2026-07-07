import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CartView } from "@/components/storefront/cart-view";
import { PageHeader } from "@/components/storefront/page-header";
import { getShippingMethods } from "@/db/queries/fulfillment";
import { getPublicShop } from "@/db/queries/storefront";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  return { title: `Количка — ${result.shop.name}`, robots: { index: false } };
}

export default async function CartPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;

  /* Най-ниският праг за безплатна доставка — за прогрес-лентата в количката. */
  const shipping = await getShippingMethods(shop.id);
  const thresholds = shipping
    .filter((m) => m.active && m.freeOverCents !== null)
    .map((m) => m.freeOverCents!);
  const freeShippingOverCents = thresholds.length > 0 ? Math.min(...thresholds) : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <PageHeader
        kicker="Поръчка"
        title="Количка"
        action={
          <Link
            href={`/s/${shop.slug}/products`}
            className="text-sm font-medium text-(--sf-primary) hover:underline"
          >
            ← Продължи пазаруването
          </Link>
        }
      />
      <CartView
        shopId={shop.id}
        slug={shop.slug}
        base={`/s/${shop.slug}`}
        logoPath={shop.logoPath}
        freeShippingOverCents={freeShippingOverCents}
      />
    </div>
  );
}
