import { and, eq, lt } from "drizzle-orm";
import { db, orders, paymentIntents, shops } from "@/db";

/** pending_payment поръчки, чийто intent е по-стар от olderThanMs (за auto-cancel).
    slug се връща, за да инвалидира storefront feed кеша след връщане на наличности. */
export async function getExpiredPendingOrders(
  olderThanMs: number,
  limit: number,
): Promise<{ orderId: string; intentId: string; slug: string }[]> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const rows = await db
    .select({ orderId: orders.id, intentId: paymentIntents.id, slug: shops.slug })
    .from(paymentIntents)
    .innerJoin(orders, eq(paymentIntents.orderId, orders.id))
    .innerJoin(shops, eq(orders.shopId, shops.id))
    .where(
      and(
        eq(paymentIntents.status, "pending"),
        eq(orders.status, "pending_payment"),
        lt(paymentIntents.createdAt, cutoff),
      ),
    )
    .limit(limit);
  return rows;
}
