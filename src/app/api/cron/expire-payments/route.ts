import { and, eq } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { revalidateTag } from "next/cache";
import { db, orders, paymentIntents } from "@/db";
import { restoreStock } from "@/actions/orders";
import { getExpiredPendingOrders } from "@/db/queries/payment-reconcile";
import { shopCacheTag } from "@/db/queries/storefront";
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
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });

  const due = await getExpiredPendingOrders(EXP_MS, 100);
  let cancelled = 0;
  const touchedSlugs = new Set<string>();
  for (const { orderId, intentId, slug } of due) {
    try {
      const didCancel = await db.transaction(async (tx) => {
        /* CAS: отменяме само ако поръчката е ВСЕ ОЩЕ pending_payment. Ако междувременно
           закъсняла PAID нотификация я е сменила на „new" (webhook мина пръв), празният
           RETURNING прекратява БЕЗ restoreStock/intent-expire — иначе отменяме платена
           поръчка и връщаме фалшив склад (одит #2 CONC-01). CANCEL_GRACE_MS само стеснява
           прозореца; CAS-ът го затваря наистина. */
        const updated = await tx
          .update(orders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment")))
          .returning({ id: orders.id });
        if (updated.length === 0) return false;
        await tx
          .update(paymentIntents)
          .set({ status: "expired", updatedAt: new Date() })
          .where(and(eq(paymentIntents.id, intentId), eq(paymentIntents.status, "pending")));
        await restoreStock(tx, orderId);
        return true;
      });
      if (didCancel) {
        cancelled++;
        touchedSlugs.add(slug); // наличности върнати → feed трябва да се инвалидира
      }
    } catch (err) {
      console.error(JSON.stringify({ event: "expire_payment_failed", orderId, err: String(err) }));
    }
  }
  /* Върнат склад → инвалидирай storefront feed кеша (feed.xml е ISR, не се самообновява
     от server-to-server cron). Дедуп по slug (одит #2 CACHE-02). */
  for (const slug of touchedSlugs) revalidateTag(shopCacheTag(slug), "max");
  return Response.json({ cancelled });
}
