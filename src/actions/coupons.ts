"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, coupons, shops } from "@/db";
import { clientIp } from "@/actions/cart";
import { getPricingProducts } from "@/db/queries/cart";
import { findValidCoupon, normalizeCouponCode } from "@/db/queries/coupons";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { priceCart, type PricedCart } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { couponSchema } from "@/schemas/coupon";

const linesSchema = z
  .array(
    z.object({
      productId: z.uuid(),
      variantKey: z.union([z.string().max(300), z.null()]),
      qty: z.number().int().min(1).max(999),
    }),
  )
  .max(50);

const REJECT_MESSAGES: Record<string, string> = {
  not_found: "Невалиден промо код.",
  expired: "Промо кодът е изтекъл.",
  inactive: "Промо кодът вече не е активен.",
  limit_reached: "Промо кодът е изчерпан.",
};

/**
 * Публична валидация на промо код при checkout: намира купона, преизчислява
 * количката с отстъпката и връща новата сума. Rate limit срещу брутфорс.
 */
export async function validateCoupon(
  shopSlug: string,
  rawCode: string,
  rawLines: unknown,
): Promise<ActionResult<{ cart: PricedCart }>> {
  const linesParsed = linesSchema.safeParse(rawLines);
  if (!linesParsed.success) return fail("Невалидна количка.");

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail("Магазинът не е достъпен.");

  const ip = await clientIp();
  if (!(await checkRateLimit(`coupon:${ip}:${shop.id}`, 20, 3600))) {
    return fail("Твърде много опити с промо код. Опитай по-късно.");
  }

  const check = await findValidCoupon(shop.id, rawCode);
  if (!check.ok || !check.coupon) {
    return fail(REJECT_MESSAGES[check.reason ?? "not_found"] ?? "Невалиден промо код.");
  }

  const productsMap = await getPricingProducts(
    shop.id,
    linesParsed.data.map((l) => l.productId),
  );
  const cart = priceCart(linesParsed.data, productsMap, undefined, check.coupon);

  /* Минималната сума не е достигната → купонът е валиден, но не се прилага. */
  if (cart.couponError === "min_not_met") {
    return fail(
      `Промо кодът важи за поръчки над ${(check.coupon.minSubtotalCents / 100).toFixed(2)} €.`,
    );
  }

  return ok({ cart });
}

/* ---------- Dashboard CRUD ---------- */

function parseCoupon(formData: FormData) {
  const rawExpires = formData.get("expiresAt");
  const rawMax = formData.get("maxUses");
  return couponSchema.safeParse({
    code: formData.get("code"),
    discountType: formData.get("discountType"),
    discountValue: Number(formData.get("discountValue") ?? 0),
    minSubtotalCents: Math.round(Number(formData.get("minSubtotal") ?? 0) * 100),
    maxUses: rawMax ? Number(rawMax) : null,
    expiresAt: rawExpires ? String(rawExpires) : null,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
}

/** discountValue → съхранена стойност: percent = процент; fixed = центове. */
function storedValue(type: "percent" | "fixed", value: number): number {
  return type === "fixed" ? Math.round(value * 100) : Math.round(value);
}

export interface CouponFormState {
  fieldErrors?: Record<string, string>;
  error?: string;
  ok?: boolean;
}

export async function saveCoupon(
  couponId: string | null,
  formData: FormData,
): Promise<CouponFormState> {
  const { shop } = await requireShop();
  const parsed = parseCoupon(formData);
  if (!parsed.success) {
    const r = zodFail(parsed.error);
    /* zodFail винаги връща fail branch — сигурно е, че има error/fieldErrors. */
    return r.ok ? {} : { fieldErrors: r.fieldErrors, error: r.error };
  }
  const input = parsed.data;
  const code = normalizeCouponCode(sanitizeText(input.code, 40));

  /* Unique код per магазин (различен ред със същия код → грешка). */
  const existing = await db.query.coupons.findFirst({
    where: and(eq(coupons.shopId, shop.id), eq(coupons.code, code)),
  });
  if (existing && existing.id !== couponId) {
    return { fieldErrors: { code: "Вече имаш купон с този код." } };
  }

  const values = {
    code,
    discountType: input.discountType,
    discountValue: storedValue(input.discountType, input.discountValue),
    minSubtotalCents: input.minSubtotalCents,
    maxUses: input.maxUses,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    active: input.active,
    updatedAt: new Date(),
  };

  if (couponId) {
    await db
      .update(coupons)
      .set(values)
      .where(and(eq(coupons.id, couponId), eq(coupons.shopId, shop.id)));
  } else {
    await db.insert(coupons).values({ ...values, shopId: shop.id });
  }
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}

export async function deleteCoupon(couponId: string): Promise<ActionResult> {
  const { shop } = await requireShop();
  await db.delete(coupons).where(and(eq(coupons.id, couponId), eq(coupons.shopId, shop.id)));
  revalidatePath("/dashboard/coupons");
  return ok(null);
}

export async function toggleCoupon(couponId: string, active: boolean): Promise<ActionResult> {
  const { shop } = await requireShop();
  await db
    .update(coupons)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(coupons.id, couponId), eq(coupons.shopId, shop.id)));
  revalidatePath("/dashboard/coupons");
  return ok(null);
}
