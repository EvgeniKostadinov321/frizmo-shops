import "server-only";
import { eq } from "drizzle-orm";
import { db, feeInvoices } from "@/db";
import { getMerchantBillingDetails } from "@/db/queries/billing-details";
import { createInvBgInvoiceWithRetry, type InvBgBilling } from "@/lib/invbg";

/**
 * Издава официална inv.bg фактура за платена таксова фактура (fee_invoice).
 * Вика се от Stripe webhook-а при invoice.paid. Идемпотентно, устойчиво, prod-only.
 *
 * ⚠️ PROD-ONLY: реалните inv.bg фактури са НАП записи от ЕДНА номерационна серия.
 * Dev/preview НЕ бива да издава (би изгорил реални номера). Гардът пропуска тихо
 * извън production.
 */

/** Форматира UTC датата на периода като „2026-06" (за описанието на реда). */
function periodLabel(periodStart: Date): string {
  const y = periodStart.getUTCFullYear();
  const m = String(periodStart.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** true само на реалния production деплой (не dev, не preview). */
export function isProductionRuntime(): boolean {
  // VERCEL_ENV е "production" само за prod деплоя; локално/preview е друго/липсва.
  return process.env.VERCEL_ENV === "production" || process.env.INV_BG_FORCE === "1";
}

export interface IssueResult {
  status: "issued" | "skipped" | "failed";
  reason?: string;
}

/**
 * Издава фактурата за даден feeInvoiceId (ако е уместно). Никога не хвърля —
 * връща статус, за да не събори webhook-а (Stripe би retry-нал излишно).
 */
export async function issueInvBgForFeeInvoice(feeInvoiceId: string): Promise<IssueResult> {
  const invoice = await db.query.feeInvoices.findFirst({
    where: eq(feeInvoices.id, feeInvoiceId),
  });
  if (!invoice) return { status: "skipped", reason: "no-invoice" };

  // Идемпотентност: вече издадена → нищо.
  if (invoice.invBgId) return { status: "skipped", reason: "already-issued" };

  // Нищо за фактуриране (кредитен/нулев период).
  if (invoice.amountDueCents <= 0) return { status: "skipped", reason: "non-positive" };

  const details = await getMerchantBillingDetails(invoice.shopId);
  if (!details) return { status: "skipped", reason: "no-billing-details" };
  if (!details.wantsInvoice) return { status: "skipped", reason: "opted-out" };

  const billing: InvBgBilling = {
    clientType: details.clientType,
    companyName: details.companyName,
    eik: details.eik,
    mol: details.mol,
    vatNumber: details.vatNumber,
    egn: details.egn,
    address: details.address,
    city: details.city,
  };

  // Snapshot — замразяваме данните върху fee_invoice преди издаване (НАП запис).
  await db
    .update(feeInvoices)
    .set({
      billingClientType: details.clientType,
      billingCompanyName: details.companyName,
      billingEik: details.eik,
      billingMol: details.mol,
      billingVatNumber: details.vatNumber,
      billingEgn: details.egn,
      billingAddress: details.address,
      billingCity: details.city,
      invBgStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(feeInvoices.id, feeInvoiceId));

  // PROD-ONLY гард — dev/preview не издава реални НАП номера.
  if (!isProductionRuntime()) {
    return { status: "skipped", reason: "not-production" };
  }

  const result = await createInvBgInvoiceWithRetry(billing, {
    amountDueCents: invoice.amountDueCents,
    periodLabel: periodLabel(invoice.periodStart),
    paidAt: new Date(),
  });

  if (!result) {
    await db
      .update(feeInvoices)
      .set({ invBgStatus: "failed", updatedAt: new Date() })
      .where(eq(feeInvoices.id, feeInvoiceId));
    return { status: "failed", reason: "invbg-api" };
  }

  await db
    .update(feeInvoices)
    .set({
      invBgId: result.id,
      invBgNumber: result.number,
      invBgPdfLink: result.pdfLink,
      invBgStatus: "issued",
      updatedAt: new Date(),
    })
    .where(eq(feeInvoices.id, feeInvoiceId));

  return { status: "issued" };
}
