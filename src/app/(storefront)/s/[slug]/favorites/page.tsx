import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FavoritesView } from "@/components/storefront/favorites-view";
import { PageHeader } from "@/components/storefront/page-header";
import { ShopFavoriteButton } from "@/components/storefront/shop-favorite-button";
import { getBuyerFavoriteProducts } from "@/db/queries/buyer";
import { getBuyerFavoriteShopIds } from "@/db/queries/buyer-global";
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
  /* „Любим магазин" живее тук (не в хедъра — там беше втора икона до сърцето). */
  const favShopIds = user ? await getBuyerFavoriteShopIds(user.id) : [];
  const shopFavorited = favShopIds.includes(shop.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader kicker="Магазин" title="Любими" intro="Продуктите, които запази за после." />

      {/* Любим магазин — toggle тук, за да не претрупваме хедъра с втора икона. */}
      <div className="mb-6 flex items-center justify-between gap-3 rounded-(--sf-radius) border border-(--sf-border) px-4 py-3">
        <span className="text-sm text-(--sf-text)">
          {shopFavorited
            ? `${shop.name} е в любимите ти магазини.`
            : `Харесай ${shop.name}, за да го следиш от профила си.`}
        </span>
        <ShopFavoriteButton
          shopId={shop.id}
          initialFavorited={shopFavorited}
          loggedIn={Boolean(user)}
        />
      </div>

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
