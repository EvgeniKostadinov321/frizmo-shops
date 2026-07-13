import { and, desc, eq, inArray } from "drizzle-orm";
import {
  buyerFavoriteShops,
  buyerFavorites,
  db,
  orders,
  products,
  shops,
  type Order,
  type Product,
  type Shop,
} from "@/db";

/** ВСИЧКИ поръчки на купувача (всички магазини), най-новите първи, с име/slug на магазина. */
export async function getBuyerOrdersGlobal(
  buyerId: string,
): Promise<Array<Order & { shopName: string; shopSlug: string }>> {
  const rows = await db
    .select({ order: orders, shopName: shops.name, shopSlug: shops.slug })
    .from(orders)
    .innerJoin(shops, eq(orders.shopId, shops.id))
    .where(eq(orders.buyerId, buyerId))
    .orderBy(desc(orders.createdAt));
  return rows.map((r) => ({ ...r.order, shopName: r.shopName, shopSlug: r.shopSlug }));
}

/** Всички любими продукти (активни) с магазина им. */
export async function getBuyerFavoriteProductsGlobal(
  buyerId: string,
): Promise<Array<Product & { shopName: string; shopSlug: string }>> {
  const favs = await db.query.buyerFavorites.findMany({
    where: eq(buyerFavorites.buyerId, buyerId),
    columns: { productId: true },
  });
  const ids = favs.map((f) => f.productId);
  if (ids.length === 0) return [];
  const rows = await db
    .select({ product: products, shopName: shops.name, shopSlug: shops.slug })
    .from(products)
    .innerJoin(shops, eq(products.shopId, shops.id))
    .where(and(inArray(products.id, ids), eq(products.status, "active")));
  return rows.map((r) => ({ ...r.product, shopName: r.shopName, shopSlug: r.shopSlug }));
}

/** Любимите магазини на купувача (пълни редове). */
export async function getBuyerFavoriteShopsList(buyerId: string): Promise<Shop[]> {
  const rows = await db
    .select({ shop: shops })
    .from(buyerFavoriteShops)
    .innerJoin(shops, eq(buyerFavoriteShops.shopId, shops.id))
    .where(eq(buyerFavoriteShops.buyerId, buyerId))
    .orderBy(desc(buyerFavoriteShops.createdAt));
  return rows.map((r) => r.shop);
}

/** ID-тата на любимите магазини (за сърце състоянието). */
export async function getBuyerFavoriteShopIds(buyerId: string): Promise<string[]> {
  const rows = await db.query.buyerFavoriteShops.findMany({
    where: eq(buyerFavoriteShops.buyerId, buyerId),
    columns: { shopId: true },
  });
  return rows.map((r) => r.shopId);
}
