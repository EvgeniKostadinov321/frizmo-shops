import { notFound } from "next/navigation";
import { NewsletterConfirm } from "@/components/storefront/newsletter-confirm";
import { getPublicShop } from "@/db/queries/storefront";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; action?: string }>;
}

export const metadata = { robots: { index: false } };

export default async function NewsletterConfirmPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { token, action } = await searchParams;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;

  /* Самата мутация (потвърждение/отписване) става при клик на бутон в клиента —
     не при рендиране — за да не я задейства prefetch/preview на линка. */
  return (
    <NewsletterConfirm
      shopSlug={shop.slug}
      shopHref={`/s/${shop.slug}`}
      token={token ?? ""}
      action={action === "unsubscribe" ? "unsubscribe" : "confirm"}
    />
  );
}
