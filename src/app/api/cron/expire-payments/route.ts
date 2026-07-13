import { eq } from "drizzle-orm";
import { db, orders, paymentIntents } from "@/db";
import { restoreStock } from "@/actions/orders";
import { getExpiredPendingOrders } from "@/db/queries/payment-reconcile";

export const dynamic = "force-dynamic";

const EXP_MS = 2 * 60 * 60 * 1000; // 2 часа

/**
 * Vercel Cron: auto-cancel на неплатени онлайн поръчки (pending_payment >2ч) —
 * връща наличността + маркира intent-а expired. Гард с CRON_SECRET. Guard по
 * статус: заявката филтрира по pending_payment, така че вече потвърдена (от webhook)
 * поръчка не попада в списъка.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const due = await getExpiredPendingOrders(EXP_MS, 100);
  let cancelled = 0;
  for (const { orderId, intentId } of due) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(orders.id, orderId));
        await tx
          .update(paymentIntents)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(paymentIntents.id, intentId));
        await restoreStock(tx, orderId);
      });
      cancelled++;
    } catch (err) {
      console.error(JSON.stringify({ event: "expire_payment_failed", orderId, err: String(err) }));
    }
  }
  return Response.json({ cancelled });
}
