import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { db, feeInvoices } from "@/db";
import { issueInvBgForFeeInvoice, isProductionRuntime } from "@/lib/invbg-issue";

export const dynamic = "force-dynamic";

/**
 * Retry cron за inv.bg фактури, чието издаване се е провалило (C1). Без него всеки
 * краткотраен API отказ на inv.bg = такса без официална фактура ЗАВИНАГИ (парите вече
 * изтеглени). Взима платени такси с invBgStatus IN ('failed','pending') и invBgId IS NULL,
 * по-стари от 10 мин (да не се състезава с webhook-а) но по-нови от 7 дни, и пробва пак.
 *
 * НЕ пипа 'skipped' (няма данъчни данни/opt-out) — то се наваксва, когато търговецът
 * попълни данните, не автоматично. Гарден с CRON_SECRET + prod-only (реални НАП номера).
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });

  // Prod-only — извън production не издаваме реални НАП номера (и retry job не бива).
  if (!isProductionRuntime()) {
    return Response.json({ skipped: "not-production" });
  }

  const now = Date.now();
  const tenMinAgo = new Date(now - 10 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const stuck = await db
    .select({ id: feeInvoices.id })
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.status, "paid"),
        inArray(feeInvoices.invBgStatus, ["failed", "pending"]),
        isNull(feeInvoices.invBgId),
        lt(feeInvoices.updatedAt, tenMinAgo),
        gte(feeInvoices.updatedAt, sevenDaysAgo),
      ),
    );

  let issued = 0;
  let failed = 0;
  let skipped = 0;

  for (const inv of stuck) {
    /* За retry на 'pending'/'failed' нулираме invBgStatus обратно на null, за да мине
       атомарния claim в issueInvBgForFeeInvoice (той иска invBgStatus IS NULL). Безопасно:
       invBgId е null (гардът горе), значи реален POST още не е успял. */
    await db
      .update(feeInvoices)
      .set({ invBgStatus: null, updatedAt: new Date() })
      .where(and(eq(feeInvoices.id, inv.id), isNull(feeInvoices.invBgId)));

    try {
      const r = await issueInvBgForFeeInvoice(inv.id);
      if (r.status === "issued") issued++;
      else if (r.status === "failed") failed++;
      else skipped++;
    } catch (e) {
      failed++;
      console.error(
        JSON.stringify({
          scope: "retry-invbg",
          feeInvoiceId: inv.id,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  return Response.json({ processed: stuck.length, issued, failed, skipped });
}
