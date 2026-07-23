import { and, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  buyerAddresses,
  buyerFavorites,
  db,
  orders,
  products,
  type BuyerAddress,
  type Order,
  type Product,
} from "@/db";

/** Поръчките на купувача В ТОЗИ магазин (per-магазин по дизайн), най-новите първи. */
export async function getBuyerOrders(buyerId: string, shopId: string): Promise<Order[]> {
  return db.query.orders.findMany({
    where: and(eq(orders.buyerId, buyerId), eq(orders.shopId, shopId)),
    orderBy: [desc(orders.createdAt)],
    limit: 50,
  });
}

/** Адресната книга на купувача — default адресът първи. */
export async function getBuyerAddresses(buyerId: string): Promise<BuyerAddress[]> {
  return db.query.buyerAddresses.findMany({
    where: eq(buyerAddresses.buyerId, buyerId),
    orderBy: [desc(buyerAddresses.isDefault), desc(buyerAddresses.createdAt)],
  });
}

/** ID-тата на любимите продукти на купувача (за сърце състоянието). */
export async function getBuyerFavoriteIds(buyerId: string): Promise<string[]> {
  const rows = await db.query.buyerFavorites.findMany({
    where: eq(buyerFavorites.buyerId, buyerId),
    columns: { productId: true },
  });
  return rows.map((r) => r.productId);
}

/** Активните любими продукти на купувача В ТОЗИ магазин (данни за показване). */
export async function getBuyerFavoriteProducts(
  buyerId: string,
  shopId: string,
): Promise<Product[]> {
  const ids = await getBuyerFavoriteIds(buyerId);
  if (ids.length === 0) return [];
  return db.query.products.findMany({
    where: and(
      eq(products.shopId, shopId),
      eq(products.status, "active"),
      inArray(products.id, ids),
    ),
  });
}

/**
 * Брой гост-поръчки (без акаунт) с даден имейл — за „свържи минали поръчки".
 * Мачва по customerEmail (case-insensitive), защото имейлът на акаунта е ВЕРИФИЦИРАН от
 * Supabase — за разлика от телефона, който всеки може да въведе в профила си и да присвои
 * чужди поръчки (одит 2026-07-23 SEC-01). Празен имейл никога не мачва (гост без имейл).
 */
export async function countGuestOrdersByEmail(email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;
  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .where(
      and(
        isNull(orders.buyerId),
        ne(orders.customerEmail, ""),
        eq(sql`lower(${orders.customerEmail})`, normalized),
      ),
    );
  return row?.value ?? 0;
}
