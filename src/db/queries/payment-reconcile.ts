import { and, eq, lt } from "drizzle-orm";
import { db, orders, paymentIntents } from "@/db";

/** pending_payment поръчки, чийто intent е по-стар от olderThanMs (за auto-cancel). */
export async function getExpiredPendingOrders(
  olderThanMs: number,
  limit: number,
): Promise<{ orderId: string; intentId: string }[]> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const rows = await db
    .select({ orderId: orders.id, intentId: paymentIntents.id })
    .from(paymentIntents)
    .innerJoin(orders, eq(paymentIntents.orderId, orders.id))
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
