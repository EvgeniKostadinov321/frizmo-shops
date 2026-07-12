"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { clientIp } from "@/actions/cart";
import { buyerAddresses, db } from "@/db";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireBuyer } from "@/lib/auth";
import { parseBgPhone } from "@/lib/phone";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { addressSchema } from "@/schemas/buyer";

/** Създава или обновява адрес на купувача (own only). Санитизира текста, нормализира телефона. */
export async function saveAddress(
  rawInput: unknown,
  addressId?: string,
): Promise<ActionResult<{ id: string }>> {
  const { profile } = await requireBuyer();
  const ip = await clientIp();
  if (!(await checkRateLimit(`buyer-addr:${ip}`, 20, 60))) {
    return fail("Твърде много заявки. Опитай след минута.");
  }
  const parsed = addressSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  const phone = parseBgPhone(d.receiverPhone);
  const values = {
    buyerId: profile.id,
    label: sanitizeText(d.label ?? "", 40),
    receiverName: sanitizeText(d.receiverName, 100),
    receiverPhone: phone.ok ? phone.e164 : sanitizeText(d.receiverPhone, 30),
    city: sanitizeText(d.city ?? "", 60),
    address: sanitizeText(d.address ?? "", 200),
    courierProvider: d.courierProvider ?? null,
    courierOfficeId: d.courierOfficeId || null,
    courierOfficeName: d.courierOfficeName ? sanitizeText(d.courierOfficeName, 200) : null,
    isDefault: d.isDefault ?? false,
    updatedAt: new Date(),
  };

  if (addressId) {
    const owned = await db.query.buyerAddresses.findFirst({
      where: eq(buyerAddresses.id, addressId),
    });
    if (!owned || owned.buyerId !== profile.id) return fail("Адресът не е намерен.");
    await db.update(buyerAddresses).set(values).where(eq(buyerAddresses.id, addressId));
    if (values.isDefault) await clearOtherDefaults(profile.id, addressId);
    return ok({ id: addressId });
  }

  const [row] = await db.insert(buyerAddresses).values(values).returning({ id: buyerAddresses.id });
  if (values.isDefault) await clearOtherDefaults(profile.id, row!.id);
  return ok({ id: row!.id });
}

async function clearOtherDefaults(buyerId: string, keepId: string) {
  await db
    .update(buyerAddresses)
    .set({ isDefault: false })
    .where(and(eq(buyerAddresses.buyerId, buyerId), ne(buyerAddresses.id, keepId)));
}

/** Трие адрес на купувача (own only). */
export async function deleteAddress(addressId: string): Promise<ActionResult> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(addressId).success) return fail("Невалидна заявка.");
  const owned = await db.query.buyerAddresses.findFirst({
    where: eq(buyerAddresses.id, addressId),
  });
  if (!owned || owned.buyerId !== profile.id) return fail("Адресът не е намерен.");
  await db.delete(buyerAddresses).where(eq(buyerAddresses.id, addressId));
  return ok(null);
}

/** Прави адрес default (маха флага от другите на купувача). */
export async function setDefaultAddress(addressId: string): Promise<ActionResult> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(addressId).success) return fail("Невалидна заявка.");
  const owned = await db.query.buyerAddresses.findFirst({
    where: eq(buyerAddresses.id, addressId),
  });
  if (!owned || owned.buyerId !== profile.id) return fail("Адресът не е намерен.");
  await db
    .update(buyerAddresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(buyerAddresses.id, addressId));
  await clearOtherDefaults(profile.id, addressId);
  return ok(null);
}
