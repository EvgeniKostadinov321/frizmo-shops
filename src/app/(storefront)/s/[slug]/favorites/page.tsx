import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FavoritesView } from "@/components/storefront/favorites-view";
import { PageHeader } from "@/components/storefront/page-header";
import { getBuyerFavoriteProducts } from "@/db/queries/buyer";
import { getPublicShop } from "@/db/queries/storefront";
import { createSupabaseServer } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  return { title: `Любими — ${result.shop.name}`, robots: { index: false } };
}

/** S10/S3: любими продукти. Логнат купувач → от акаунта (сървър); гост → localStorage. */
export default async function FavoritesPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;
  const base = `/s/${shop.slug}`;

  const {
    data: { user },
  } = await (await createSupabaseServer()).auth.getUser();
  /* Логнат: любимите за ТОЗИ магазин идват от акаунта (не localStorage). */
  const accountProducts = user ? await getBuyerFavoriteProducts(user.id, shop.id) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader kicker="Магазин" title="Любими" intro="Продуктите, които запази за после." />
      <FavoritesView
        shopId={shop.id}
        slug={shop.slug}
        base={base}
        logoPath={shop.logoPath}
        loggedIn={Boolean(user)}
        accountProducts={accountProducts}
      />
    </div>
  );
}
