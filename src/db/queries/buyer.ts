import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
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

/** Брой гост-поръчки (без акаунт) с даден E.164 телефон — за „свържи минали поръчки". */
export async function countGuestOrdersByPhone(phoneE164: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .where(and(isNull(orders.buyerId), eq(orders.customerPhone, phoneE164)));
  return row?.value ?? 0;
}
