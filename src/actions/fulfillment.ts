"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, paymentMethods, shippingMethods, shippingZones, shops } from "@/db";
import { max } from "drizzle-orm";
import { shopCacheTag } from "@/db/queries/storefront";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { toCents } from "@/lib/money";
import { sanitizeText } from "@/lib/sanitize";
import { paymentMethodSchema, shippingMethodSchema, zoneSchema } from "@/schemas/fulfillment";

function revalidate(slug: string) {
  revalidateTag(shopCacheTag(slug), "max");
  revalidatePath("/dashboard/fulfillment");
  revalidatePath(`/s/${slug}`, "layout");
}

const orderSettingsSchema = z.object({
  giftWrapEnabled: z.boolean(),
  /** EUR текст ("2,50"); празно при изключена опаковка = 0. */
  giftWrapFee: z.string().trim().max(10).default(""),
  giftCardEnabled: z.boolean(),
  returnWindowDays: z.union([z.literal(14), z.literal(30), z.literal(45)]),
});

/** N9+N12: настройки на поръчките — подаръчна опаковка + срок за връщане. */
export async function saveOrderSettings(input: unknown): Promise<ActionResult> {
  const parsed = orderSettingsSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const feeCents = parsed.data.giftWrapFee ? toCents(parsed.data.giftWrapFee) : 0;
  if (feeCents === null) return fail("Невалидна такса за опаковка.");

  await db
    .update(shops)
    .set({
      giftWrapEnabled: parsed.data.giftWrapEnabled,
      giftWrapFeeCents: parsed.data.giftWrapEnabled ? feeCents : 0,
      giftCardEnabled: parsed.data.giftCardEnabled,
      returnWindowDays: parsed.data.returnWindowDays,
      updatedAt: new Date(),
    })
    .where(eq(shops.id, shop.id));

  revalidate(shop.slug);
  return ok(null);
}

export async function saveShippingMethod(
  id: string | null,
  input: unknown,
): Promise<ActionResult> {
  const parsed = shippingMethodSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const values = {
    type: parsed.data.type,
    name: sanitizeText(parsed.data.name, 60),
    priceCents: toCents(parsed.data.price)!,
    freeOverCents: parsed.data.freeOver ? toCents(parsed.data.freeOver) : null,
    deliveryHours: parsed.data.deliveryHours,
    updatedAt: new Date(),
  };

  if (id === null) {
    await db.insert(shippingMethods).values({ ...values, shopId: shop.id });
  } else {
    const method = await db.query.shippingMethods.findFirst({
      where: eq(shippingMethods.id, id),
    });
    if (!method || method.shopId !== shop.id) return fail("Методът не съществува.");
    await db
      .update(shippingMethods)
      .set(values)
      .where(and(eq(shippingMethods.id, id), eq(shippingMethods.shopId, shop.id)));
  }

  revalidate(shop.slug);
  return ok(null);
}

export async function savePaymentMethod(
  id: string | null,
  input: unknown,
): Promise<ActionResult> {
  const parsed = paymentMethodSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const values = {
    type: parsed.data.type,
    name: sanitizeText(parsed.data.name, 60),
    details: sanitizeText(parsed.data.details, 300),
    updatedAt: new Date(),
  };

  if (id === null) {
    await db.insert(paymentMethods).values({ ...values, shopId: shop.id });
  } else {
    const method = await db.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, id),
    });
    if (!method || method.shopId !== shop.id) return fail("Методът не съществува.");
    await db
      .update(paymentMethods)
      .set(values)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.shopId, shop.id)));
  }

  revalidate(shop.slug);
  return ok(null);
}

const idSchema = z.object({ id: z.uuid() });

export async function toggleShippingMethod(input: { id: string }): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Невалиден метод.");
  const { shop } = await requireShop();
  const method = await db.query.shippingMethods.findFirst({
    where: eq(shippingMethods.id, parsed.data.id),
  });
  if (!method || method.shopId !== shop.id) return fail("Методът не съществува.");
  await db
    .update(shippingMethods)
    .set({ active: !method.active, updatedAt: new Date() })
    .where(and(eq(shippingMethods.id, method.id), eq(shippingMethods.shopId, shop.id)));
  revalidate(shop.slug);
  return ok(null);
}

export async function togglePaymentMethod(input: { id: string }): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Невалиден метод.");
  const { shop } = await requireShop();
  const method = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.id, parsed.data.id),
  });
  if (!method || method.shopId !== shop.id) return fail("Методът не съществува.");
  await db
    .update(paymentMethods)
    .set({ active: !method.active, updatedAt: new Date() })
    .where(and(eq(paymentMethods.id, method.id), eq(paymentMethods.shopId, shop.id)));
  revalidate(shop.slug);
  return ok(null);
}

export async function deleteShippingMethod(input: { id: string }): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Невалиден метод.");
  const { shop } = await requireShop();
  const method = await db.query.shippingMethods.findFirst({
    where: eq(shippingMethods.id, parsed.data.id),
  });
  if (!method || method.shopId !== shop.id) return fail("Методът не съществува.");
  await db
    .delete(shippingMethods)
    .where(and(eq(shippingMethods.id, method.id), eq(shippingMethods.shopId, shop.id)));
  revalidate(shop.slug);
  return ok(null);
}

export async function deletePaymentMethod(input: { id: string }): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Невалиден метод.");
  const { shop } = await requireShop();
  const method = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.id, parsed.data.id),
  });
  if (!method || method.shopId !== shop.id) return fail("Методът не съществува.");
  await db
    .delete(paymentMethods)
    .where(and(eq(paymentMethods.id, method.id), eq(paymentMethods.shopId, shop.id)));
  revalidate(shop.slug);
  return ok(null);
}

/** Д3: добавя ценова зона към courier метод (проверява собственост на метода). */
export async function saveShippingZone(input: unknown): Promise<ActionResult> {
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const method = await db.query.shippingMethods.findFirst({
    where: eq(shippingMethods.id, parsed.data.shippingMethodId),
  });
  if (!method || method.shopId !== shop.id) return fail("Методът не съществува.");
  if (method.type !== "courier") return fail("Зони се добавят само към куриерски метод.");

  const [orderRow] = await db
    .select({ maxOrder: max(shippingZones.sortOrder) })
    .from(shippingZones)
    .where(eq(shippingZones.shippingMethodId, method.id));

  await db.insert(shippingZones).values({
    shopId: shop.id,
    shippingMethodId: method.id,
    name: sanitizeText(parsed.data.name, 60),
    priceCents: toCents(parsed.data.price)!,
    cities: sanitizeText(parsed.data.cities, 500),
    isFallback: parsed.data.isFallback,
    sortOrder: (orderRow?.maxOrder ?? 0) + 1,
  });

  revalidate(shop.slug);
  return ok(null);
}

/** Д3: трие ценова зона (проверява собственост по магазина). */
export async function deleteShippingZone(input: { id: string }): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Невалидна зона.");
  const { shop } = await requireShop();
  const zone = await db.query.shippingZones.findFirst({
    where: eq(shippingZones.id, parsed.data.id),
  });
  if (!zone || zone.shopId !== shop.id) return fail("Зоната не съществува.");
  await db
    .delete(shippingZones)
    .where(and(eq(shippingZones.id, zone.id), eq(shippingZones.shopId, shop.id)));
  revalidate(shop.slug);
  return ok(null);
}
