import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartView } from "@/components/storefront/cart-view";
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1
        className="mb-6 text-3xl text-(--sf-text)"
      >
        Количка
      </h1>
      <CartView shopId={shop.id} slug={shop.slug} base={`/s/${shop.slug}`} />
    </div>
  );
}
