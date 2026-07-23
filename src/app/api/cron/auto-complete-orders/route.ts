import { and, eq, lt } from "drizzle-orm";
import { db, orders } from "@/db";
import { recordFeeCharge } from "@/db/queries/fees";
import { AUTO_COMPLETE_DAYS } from "@/lib/fee";

export const dynamic = "force-dynamic";

/**
 * Anti-gaming: поръчки заседнали в `shipped` над AUTO_COMPLETE_DAYS → авто-completed
 * + charge. Иначе търговец би държал поръчки в shipped, за да избегне таксата.
 * Гарден с CRON_SECRET (Bearer). Идемпотентно: charge е onConflictDoNothing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - AUTO_COMPLETE_DAYS * 86_400_000);
  const stuck = await db
    .select({
      id: orders.id,
      shopId: orders.shopId,
      subtotalCents: orders.subtotalCents,
      discountCents: orders.discountCents,
    })
    .from(orders)
    .where(and(eq(orders.status, "shipped"), lt(orders.updatedAt, cutoff)));

  let completed = 0;
  for (const order of stuck) {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ status: "completed", completedAt: now, updatedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "shipped")));
      await recordFeeCharge(tx, { ...order, completedAt: now });
    });
    completed++;
  }

  return Response.json({ completed });
}
