import type { Metadata } from "next";
import { FavoritesTabs } from "@/components/account/favorites-tabs";
import {
  getBuyerFavoriteProductsGlobal,
  getBuyerFavoriteShopsList,
} from "@/db/queries/buyer-global";
import { requireBuyer } from "@/lib/auth";

export const metadata: Metadata = { title: "Моите любими — Frizmo Shops", robots: { index: false } };

export default async function AccountFavoritesPage() {
  const { profile } = await requireBuyer();
  const [products, shops] = await Promise.all([
    getBuyerFavoriteProductsGlobal(profile.id),
    getBuyerFavoriteShopsList(profile.id),
  ]);
  return <FavoritesTabs products={products} shops={shops} />;
}
