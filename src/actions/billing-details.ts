"use server";

import { revalidatePath } from "next/cache";
import { db, merchantBillingDetails } from "@/db";
import { requireShop } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";
import { billingDetailsSchema } from "@/schemas/billing-details";

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
  const values = {
    shopId: shop.id,
    clientType: d.clientType,
    companyName: sanitizeText(d.companyName, 200),
    /* Само релевантните за типа полета се пазят — другите се нулират, за да не
       остане стар ЕГН при смяна фирма→ФЛ (или обратно). */
    eik: isCompany ? sanitizeText(d.eik, 20) : null,
    mol: isCompany ? sanitizeText(d.mol, 200) : null,
    vatNumber: isCompany && d.vatNumber ? sanitizeText(d.vatNumber, 20) : null,
    egn: isCompany ? null : sanitizeText(d.egn, 10),
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
