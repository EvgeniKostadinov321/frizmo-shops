import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, feeInvoices, shops } from "@/db";
import { getMerchantBillingDetails } from "@/db/queries/billing-details";
import { createInvBgInvoiceWithRetry, type InvBgBilling } from "@/lib/invbg";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendFeeInvoicePaidEmail } from "@/lib/email";

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

/**
 * true САМО на реалния production деплой (не dev, не preview). Издаването на inv.bg
 * фактури е реален НАП запис от една номерационна серия — двойна защита:
 *  - VERCEL_ENV==="production": само истинският прод деплой (Preview е "preview").
 *  - NODE_ENV==="production": production билд (пази при не-Vercel хостинг).
 * Няма env escape hatch (INV_BG_FORCE махнат) — тестовете инжектират override параметър.
 */
export function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" && process.env.NODE_ENV === "production";
}

export interface IssueResult {
  status: "issued" | "skipped" | "failed";
  reason?: string;
  /** При status==="issued" — данни за известителния имейл до търговеца. */
  issued?: { shopId: string; amountCents: number; periodLabel: string; number: string; pdfLink: string };
}

/** Тестова инжекция — override на prod-гарда без env escape hatch (H3). */
export interface IssueOpts {
  /** Форсира prod runtime (само за тестове/жив тест; по подразбиране реалната проверка). */
  forceProduction?: boolean;
}

/**
 * Издава фактурата за даден feeInvoiceId (ако е уместно). Никога не хвърля —
 * връща статус, за да не събори webhook-а (Stripe би retry-нал излишно).
 *
 * Състояния на invBgStatus:
 *  null → недокоснато · "pending" → атомарно заявено (POST предстои) · "issued" → успех
 *  "failed" → API провал (retry cron го поема) · "skipped" → няма данни/opt-out (НЕ се retry-ва).
 */
export async function issueInvBgForFeeInvoice(
  feeInvoiceId: string,
  opts: IssueOpts = {},
): Promise<IssueResult> {
  const invoice = await db.query.feeInvoices.findFirst({
    where: eq(feeInvoices.id, feeInvoiceId),
  });
  if (!invoice) return { status: "skipped", reason: "no-invoice" };

  // Идемпотентност (бърз изход): вече издадена → нищо. Реалната защита е atomic claim-ът долу.
  if (invoice.invBgId) return { status: "skipped", reason: "already-issued" };

  // Нищо за фактуриране (кредитен/нулев период).
  if (invoice.amountDueCents <= 0) return { status: "skipped", reason: "non-positive" };

  // Архивирана фактура (магазинът е изтрит, shopId=null) — не се преиздава.
  if (!invoice.shopId) return { status: "skipped", reason: "no-shop" };

  const details = await getMerchantBillingDetails(invoice.shopId);
  // "skipped" статус (различен от "failed") — retry cron-ът НЕ го пробва пак автоматично;
  // наваксва се, когато търговецът попълни данните (или през admin ръчно преиздаване).
  if (!details) {
    await markSkipped(feeInvoiceId);
    return { status: "skipped", reason: "no-billing-details" };
  }
  if (!details.wantsInvoice) {
    await markSkipped(feeInvoiceId);
    return { status: "skipped", reason: "opted-out" };
  }

  // PROD-ONLY гард ПРЕДИ да пипаме статуса (H2) — на dev/preview не оставяме „pending" призрак.
  if (!(opts.forceProduction ?? isProductionRuntime())) {
    return { status: "skipped", reason: "not-production" };
  }

  /* ATOMIC CLAIM (H1) — само един конкурентен event печели правото да POST-не.
     Conditional update: успява само ако още никой не е заявил (invBgId И invBgStatus са null).
     Едновременно замразява snapshot-а (НАП запис). .returning() казва кой е спечелил. */
  const claimed = await db
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
    .where(
      and(
        eq(feeInvoices.id, feeInvoiceId),
        isNull(feeInvoices.invBgId),
        isNull(feeInvoices.invBgStatus),
      ),
    )
    .returning({ id: feeInvoices.id });

  // Друг event вече е заявил (или retry на вече-„failed"/"skipped") → не POST-ваме отново.
  if (claimed.length === 0) return { status: "skipped", reason: "already-claimed" };

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

  return {
    status: "issued",
    issued: {
      shopId: invoice.shopId,
      amountCents: invoice.amountDueCents,
      periodLabel: periodLabel(invoice.periodStart),
      number: result.number,
      pdfLink: result.pdfLink,
    },
  };
}

/** Маркира фактурата „skipped" (няма данни/opt-out) — не се retry-ва автоматично. */
async function markSkipped(feeInvoiceId: string): Promise<void> {
  await db
    .update(feeInvoices)
    .set({ invBgStatus: "skipped", updatedAt: new Date() })
    .where(and(eq(feeInvoices.id, feeInvoiceId), isNull(feeInvoices.invBgId)));
}

/**
 * Известява търговеца, че фактурата е готова (т.3). Взима имейла на собственика от
 * Supabase auth (не е в profiles). Best-effort — извикващият хваща грешката.
 */
export async function notifyMerchantInvoicePaid(issued: {
  shopId: string;
  amountCents: number;
  periodLabel: string;
  number: string;
  pdfLink: string;
}): Promise<void> {
  const shop = await db.query.shops.findFirst({
    where: eq(shops.id, issued.shopId),
    columns: { ownerId: true },
  });
  if (!shop) return;

  const admin = createSupabaseAdmin();
  const { data: authUser } = await admin.auth.admin.getUserById(shop.ownerId);
  const email = authUser?.user?.email;
  if (!email) return;

  await sendFeeInvoicePaidEmail({
    toEmail: email,
    periodLabel: issued.periodLabel,
    amountCents: issued.amountCents,
    invBgNumber: issued.number,
    pdfLink: issued.pdfLink,
  });
}
