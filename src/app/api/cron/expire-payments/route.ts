import { eq } from "drizzle-orm";
import { db, orders, paymentIntents } from "@/db";
import { restoreStock } from "@/actions/orders";
import { getExpiredPendingOrders } from "@/db/queries/payment-reconcile";
import { EPAY_EXP_SECONDS } from "@/lib/payments/build-order-package";

export const dynamic = "force-dynamic";

/* S3-02: cron границата е СЛЕД ePay-валидността (+30 мин grace), за да отменяме
   поръчка едва след като ePay гарантирано вече е отказал плащането — това затваря
   race прозореца „cron отменя точно преди закъсняла PAID нотификация". */
const CANCEL_GRACE_MS = 30 * 60 * 1000; // 30 мин буфер над ePay EXP_TIME
const EXP_MS = EPAY_EXP_SECONDS * 1000 + CANCEL_GRACE_MS; // 2ч30мин

/**
 * Vercel Cron: auto-cancel на неплатени онлайн поръчки (pending_payment над
 * ePay-валидността + grace) — връща наличността + маркира intent-а expired. Гард с
 * CRON_SECRET. Guard по статус: заявката филтрира по pending_payment, така че вече
 * потвърдена (от webhook) поръчка не попада в списъка.
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
