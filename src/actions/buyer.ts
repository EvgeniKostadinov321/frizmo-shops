"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { clientIp } from "@/actions/cart";
import {
  buyerAddresses,
  buyerFavoriteShops,
  buyerFavorites,
  db,
  orders,
  profiles,
  shops,
} from "@/db";
import { countGuestOrdersByPhone, getBuyerFavoriteIds } from "@/db/queries/buyer";
import { confirmDeleteWord } from "@/lib/account-deletion";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireBuyer } from "@/lib/auth";
import { parseBgPhone } from "@/lib/phone";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { addressSchema, buyerProfileSchema } from "@/schemas/buyer";

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

/** Добавя/маха продукт от любимите на купувача (сървърен синхрон). */
export async function toggleBuyerFavorite(
  productId: string,
): Promise<ActionResult<{ favorited: boolean }>> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(productId).success) return fail("Невалидна заявка.");
  const existing = await db.query.buyerFavorites.findFirst({
    where: and(eq(buyerFavorites.buyerId, profile.id), eq(buyerFavorites.productId, productId)),
  });
  if (existing) {
    await db
      .delete(buyerFavorites)
      .where(and(eq(buyerFavorites.buyerId, profile.id), eq(buyerFavorites.productId, productId)));
    return ok({ favorited: false });
  }
  await db.insert(buyerFavorites).values({ buyerId: profile.id, productId }).onConflictDoNothing();
  return ok({ favorited: true });
}

/** Влива localStorage любимите в акаунта при вход (upsert, uniqueIndex пази от дубли). */
export async function mergeFavoritesOnLogin(
  localIds: string[],
): Promise<ActionResult<{ ids: string[] }>> {
  const { profile } = await requireBuyer();
  const valid = z.array(z.uuid()).max(100).safeParse(localIds);
  if (!valid.success) return fail("Невалидна заявка.");
  if (valid.data.length > 0) {
    await db
      .insert(buyerFavorites)
      .values(valid.data.map((productId) => ({ buyerId: profile.id, productId })))
      .onConflictDoNothing();
  }
  const ids = await getBuyerFavoriteIds(profile.id);
  return ok({ ids });
}

/** Обновява име/телефон на купувача (own). */
export async function updateBuyerProfile(rawInput: unknown): Promise<ActionResult> {
  const { profile } = await requireBuyer();
  const parsed = buyerProfileSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const phone = parseBgPhone(parsed.data.phone);
  await db
    .update(profiles)
    .set({
      fullName: sanitizeText(parsed.data.fullName, 100),
      phone: phone.ok ? phone.e164 : sanitizeText(parsed.data.phone, 30),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));
  return ok(null);
}

/** Колко минали гост-поръчки могат да се свържат (по телефона на профила). */
export async function countLinkableGuestOrders(): Promise<ActionResult<{ count: number }>> {
  const { profile } = await requireBuyer();
  if (!profile.phone) return ok({ count: 0 });
  const phone = parseBgPhone(profile.phone);
  if (!phone.ok) return ok({ count: 0 });
  const n = await countGuestOrdersByPhone(phone.e164);
  return ok({ count: n });
}

/** Свързва миналите гост-поръчки с акаунта (по потвърден телефон). Вдига phoneVerified.
    Броим ПРЕДИ update-а (колко ще свържем) — точен резултат за toast-а. */
export async function linkGuestOrders(): Promise<ActionResult<{ linked: number }>> {
  const { profile } = await requireBuyer();
  if (!profile.phone) return fail("Добави телефон в профила, за да свържеш минали поръчки.");
  const phone = parseBgPhone(profile.phone);
  if (!phone.ok) return fail("Телефонът в профила е невалиден.");
  const toLink = await countGuestOrdersByPhone(phone.e164);
  await db
    .update(orders)
    .set({ buyerId: profile.id, updatedAt: new Date() })
    .where(and(isNull(orders.buyerId), eq(orders.customerPhone, phone.e164)));
  await db
    .update(profiles)
    .set({ phoneVerified: true, updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));
  return ok({ linked: toLink });
}

/** Добавя/маха магазин от любимите на купувача (own синхрон). */
export async function toggleFavoriteShop(
  shopId: string,
): Promise<ActionResult<{ favorited: boolean }>> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(shopId).success) return fail("Невалидна заявка.");
  const existing = await db.query.buyerFavoriteShops.findFirst({
    where: and(eq(buyerFavoriteShops.buyerId, profile.id), eq(buyerFavoriteShops.shopId, shopId)),
  });
  if (existing) {
    await db
      .delete(buyerFavoriteShops)
      .where(and(eq(buyerFavoriteShops.buyerId, profile.id), eq(buyerFavoriteShops.shopId, shopId)));
    return ok({ favorited: false });
  }
  await db.insert(buyerFavoriteShops).values({ buyerId: profile.id, shopId }).onConflictDoNothing();
  return ok({ favorited: true });
}

/** Добавя/маха ПРОДУКТ от любимите на купувача (own синхрон — акаунт-базирано). */
export async function toggleFavoriteProduct(
  productId: string,
): Promise<ActionResult<{ favorited: boolean }>> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(productId).success) return fail("Невалидна заявка.");
  const existing = await db.query.buyerFavorites.findFirst({
    where: and(eq(buyerFavorites.buyerId, profile.id), eq(buyerFavorites.productId, productId)),
  });
  if (existing) {
    await db
      .delete(buyerFavorites)
      .where(and(eq(buyerFavorites.buyerId, profile.id), eq(buyerFavorites.productId, productId)));
    return ok({ favorited: false });
  }
  await db.insert(buyerFavorites).values({ buyerId: profile.id, productId }).onConflictDoNothing();
  return ok({ favorited: true });
}

/**
 * Изтрива купувачки акаунт: анонимизира поръчките (buyerId→null — търговецът ги пази),
 * трие адреси/любими/любими магазини + Supabase auth юзъра. Гард: акаунт с магазин
 * НЕ се трие оттук (иска триене на магазина първо). Потвърждение с думата „ИЗТРИЙ".
 */
export async function deleteBuyerAccount(rawInput: unknown): Promise<ActionResult<null>> {
  const { user, profile } = await requireBuyer();
  const parsed = z.object({ confirm: z.string().min(1).max(40) }).safeParse(rawInput);
  if (!parsed.success || !confirmDeleteWord(parsed.data.confirm)) {
    return fail("Напиши „ИЗТРИЙ“ за потвърждение.");
  }
  const ownShop = await db.query.shops.findFirst({
    where: eq(shops.ownerId, user.id),
    columns: { id: true },
  });
  if (ownShop) {
    return fail("Имаш магазин — изтрий първо него от настройките на магазина.");
  }
  try {
    /* P4-01: DB стъпките (анонимизация + триене) в ЕДНА транзакция — или всички,
       или нито една. Иначе грешка по средата оставя акаунта полуизтрит (GDPR чл.17
       обещава пълно изтриване). Supabase auth (стъпка 3) е извън DB → best-effort
       след commit. */
    await db.transaction(async (tx) => {
      /* 1) Анонимизирай поръчките (търговецът ги пази за счетоводство). */
      await tx
        .update(orders)
        .set({ buyerId: null, updatedAt: new Date() })
        .where(eq(orders.buyerId, profile.id));
      /* 2) Изтрий купувачките данни. */
      await tx.delete(buyerAddresses).where(eq(buyerAddresses.buyerId, profile.id));
      await tx.delete(buyerFavorites).where(eq(buyerFavorites.buyerId, profile.id));
      await tx.delete(buyerFavoriteShops).where(eq(buyerFavoriteShops.buyerId, profile.id));
      await tx.delete(profiles).where(eq(profiles.id, profile.id));
    });
    /* 3) Изтрий auth юзъра (best-effort, след DB commit). */
    const admin = createSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(JSON.stringify({ scope: "delete-buyer", userId: user.id, error: error.message }));
    }
    /* 4) Изчисти сесията. */
    try {
      const supabase = await createSupabaseServer();
      await supabase.auth.signOut();
    } catch {
      /* игнорирай */
    }
    return ok(null);
  } catch (e) {
    console.error(JSON.stringify({ scope: "delete-buyer", userId: user.id, error: String(e) }));
    return fail("Изтриването не бе успешно. Опитай пак.");
  }
}
