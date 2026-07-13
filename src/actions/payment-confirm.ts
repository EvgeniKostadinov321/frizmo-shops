"use server";

import { eq } from "drizzle-orm";
import { db, orders, paymentIntents } from "@/db";
import { restoreStock } from "@/actions/orders";
import { getShopPaymentAccount } from "@/db/queries/payment-accounts";
import { getPaymentProvider, type PaymentCreds } from "@/lib/payments";

type ConfirmResult = { invoice: string; result: "ok" | "ignored" | "invalid" };

/**
 * Обработва ePay нотификация (сървър-към-сървър). Намира intent-а по INVOICE,
 * валидира подписа със secret-а на неговия магазин, сверява сумата, идемпотентно
 * потвърждава (pending_payment→new) или отменя (→cancelled + restock). Никакво
 * доверие на клиентски данни; повторна нотификация → ignored.
 */
export async function confirmEpayPayment(body: {
  encoded: string;
  checksum: string;
}): Promise<ConfirmResult> {
  const provider = getPaymentProvider("epay");

  /* INVOICE = orderNumber (per-shop, не глобално уникален) → може да има >1 intent.
     Правилният е този, чийто shop secret верифицира подписа. */
  const decoded = tryDecodeInvoice(body.encoded);
  if (!decoded) return { invoice: "", result: "invalid" };

  const candidates = await db.query.paymentIntents.findMany({
    where: eq(paymentIntents.providerRef, decoded),
  });

  for (const intent of candidates) {
    const acct = await getShopPaymentAccount(intent.shopId, "epay");
    if (!acct) continue;
    const creds = acct.credentials as PaymentCreds;
    const note = provider.parseNotification(body, creds);
    if (!note) continue; // подписът не пасва на този магазин

    /* Идемпотентност: вече обработен. */
    if (intent.status !== "pending") return { invoice: decoded, result: "ignored" };

    /* Сверка на сумата (защита срещу подправяне). */
    if (note.amountCents !== null && note.amountCents !== intent.amountCents) {
      console.error(
        JSON.stringify({
          scope: "epay-amount-mismatch",
          invoice: decoded,
          expected: intent.amountCents,
          got: note.amountCents,
        }),
      );
      return { invoice: decoded, result: "invalid" };
    }

    if (note.status === "paid") {
      await db.transaction(async (tx) => {
        await tx
          .update(paymentIntents)
          .set({ status: "paid", paidAt: new Date(), rawNotification: note.raw, updatedAt: new Date() })
          .where(eq(paymentIntents.id, intent.id));
        /* Потвърждаваме поръчката. (Guard: cron auto-cancel държи различен статус →
           безопасно е да сетнем „new" само при още pending — но intent-status guard
           горе вече покрива повторните нотификации.) */
        await tx
          .update(orders)
          .set({ status: "new", updatedAt: new Date() })
          .where(eq(orders.id, intent.orderId));
      });
      return { invoice: decoded, result: "ok" };
    }

    if (note.status === "denied" || note.status === "expired") {
      const failedStatus: "denied" | "expired" = note.status;
      await db.transaction(async (tx) => {
        await tx
          .update(paymentIntents)
          .set({ status: failedStatus, rawNotification: note.raw, updatedAt: new Date() })
          .where(eq(paymentIntents.id, intent.id));
        await tx
          .update(orders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(orders.id, intent.orderId));
        await restoreStock(tx, intent.orderId);
      });
      return { invoice: decoded, result: "ok" };
    }

    return { invoice: decoded, result: "invalid" };
  }

  return { invoice: decoded, result: "invalid" };
}

/** Вади INVOICE от ENCODED без да валидира подпис (за да намерим кандидатите). */
function tryDecodeInvoice(encoded: string): string | null {
  try {
    const data = Buffer.from(encoded, "base64").toString("utf8");
    for (const line of data.split("\n")) {
      const trimmed = line.trim();
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      if (trimmed.slice(0, eq) === "INVOICE") return trimmed.slice(eq + 1);
    }
  } catch {
    /* игнорирай */
  }
  return null;
}
