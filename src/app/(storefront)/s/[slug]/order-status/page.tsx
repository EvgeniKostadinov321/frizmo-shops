import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderLookupForm } from "@/components/storefront/order-lookup-form";
import { getPublicShop } from "@/db/queries/storefront";

export const metadata: Metadata = { title: "Провери поръчка", robots: { index: false } };

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrderStatusPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] leading-tight text-(--sf-text)">
        Провери поръчка
      </h1>
      <p className="mt-2 text-(--sf-muted)">
        Въведи номера на поръчката и телефона, с който направи поръчката.
      </p>
      <div className="mt-8">
        <OrderLookupForm slug={slug} />
      </div>
    </div>
  );
}
