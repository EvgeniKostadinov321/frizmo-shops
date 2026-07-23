import { and, eq, lt } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron-auth";
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
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });

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
  let failed = 0;
  for (const order of stuck) {
    /* Per-order изолация (одит #3 ERR-02): провал за една поръчка (deadlock под конкурентен
       ръчен updateOrderStatus, DB blip) не бива да спира авто-completing-а на останалите —
       симетрично на другите cron-ове. */
    try {
      const now = new Date();
      const didComplete = await db.transaction(async (tx) => {
        /* CAS: само ако още е shipped (ръчен преход може да е изпреварил) → без двойна такса. */
        const updated = await tx
          .update(orders)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(and(eq(orders.id, order.id), eq(orders.status, "shipped")))
          .returning({ id: orders.id });
        if (updated.length === 0) return false;
        await recordFeeCharge(tx, { ...order, completedAt: now });
        return true;
      });
      if (didComplete) completed++;
    } catch (e) {
      failed++;
      console.error(
        JSON.stringify({ scope: "auto-complete", orderId: order.id, error: e instanceof Error ? e.message : String(e) }),
      );
    }
  }

  return Response.json({ completed, failed });
}
