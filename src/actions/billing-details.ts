"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, feeInvoices, merchantBillingDetails } from "@/db";
import { requireShop } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";
import { billingDetailsSchema } from "@/schemas/billing-details";
import { shareInvoicePdf, lookupCompanyByEik, type CompanyLookup } from "@/lib/invbg";

export type BillingDetailsState = { error?: string; ok?: boolean };

/**
 * Записва/обновява данъчните данни на търговеца за официалната фактура (upsert по shop).
 * Toggle фирма/физическо лице; валидацията е в billingDetailsSchema (клиент+сървър).
 */
export async function saveBillingDetails(
  _prev: BillingDetailsState,
  formData: FormData,
): Promise<BillingDetailsState> {
  const { shop } = await requireShop();

  const parsed = billingDetailsSchema.safeParse({
    clientType: formData.get("clientType"),
    companyName: formData.get("companyName"),
    eik: formData.get("eik"),
    mol: formData.get("mol"),
    vatNumber: formData.get("vatNumber"),
    egn: formData.get("egn"),
    address: formData.get("address"),
    city: formData.get("city"),
    /* Native checkbox: неотметнат → липсва във FormData (null). Наличието на "true"
       = отметнат; всичко друго (вкл. null) = неотметнат. */
    wantsInvoice: formData.get("wantsInvoice") === "true",
  });
  if (!parsed.success) return { error: "Провери въведените данни." };
  const d = parsed.data;

  const isCompany = d.clientType === "company";
  /* ЕИК/ЕГН → само цифри (M2): sanitizeText свива интервали, но не гарантира числов
     формат ако regex-ът се разхлаби; в НАП фактурата трябва да влязат само цифри. */
  const digitsOnly = (s: string) => s.replace(/\D/g, "");
  const values = {
    shopId: shop.id,
    clientType: d.clientType,
    companyName: sanitizeText(d.companyName, 200),
    /* Само релевантните за типа полета се пазят — другите се нулират, за да не
       остане стар ЕГН при смяна фирма→ФЛ (или обратно). */
    eik: isCompany ? digitsOnly(d.eik) : null,
    mol: isCompany ? sanitizeText(d.mol, 200) : null,
    vatNumber: isCompany && d.vatNumber ? sanitizeText(d.vatNumber, 20).toUpperCase() : null,
    egn: isCompany ? null : digitsOnly(d.egn),
    address: sanitizeText(d.address, 300),
    city: sanitizeText(d.city, 100),
    wantsInvoice: d.wantsInvoice,
  };

  await db
    .insert(merchantBillingDetails)
    .values(values)
    .onConflictDoUpdate({
      target: merchantBillingDetails.shopId,
      set: { ...values, updatedAt: new Date() },
    });

  revalidatePath("/dashboard/billing");
  return { ok: true };
}

/**
 * Авто-попълване по ЕИК от Търговския регистър (т.5). requireShop за да не е публичен
 * (rate-косвено през auth). Връща null-полета при ненамерена фирма — UX бонус.
 */
export async function lookupCompany(eik: string): Promise<CompanyLookup | null> {
  await requireShop();
  return lookupCompanyByEik(eik.replace(/\D/g, ""));
}

/**
 * Връща свеж PDF линк за фактура (L3 — замразеният в базата линк умира след 30 дни).
 * Tenant-изолиран: само фактури на СВОЯ магазин. Dashboard бутонът го вика при клик.
 */
export async function getFreshInvoicePdfUrl(
  feeInvoiceId: string,
): Promise<{ url?: string; error?: string }> {
  const { shop } = await requireShop();
  const invoice = await db.query.feeInvoices.findFirst({
    where: and(eq(feeInvoices.id, feeInvoiceId), eq(feeInvoices.shopId, shop.id)),
    columns: { invBgId: true },
  });
  if (!invoice?.invBgId) return { error: "Фактурата няма официален документ." };
  try {
    const url = await shareInvoicePdf(invoice.invBgId);
    return { url };
  } catch {
    return { error: "Линкът към фактурата не можа да се генерира. Опитай пак." };
  }
}
