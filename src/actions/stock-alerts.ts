"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, products, shops, stockAlerts } from "@/db";
import { clientIp } from "@/actions/cart";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { checkRateLimit } from "@/lib/rate-limit";

const subscribeSchema = z.object({
  productId: z.uuid(),
  email: z.email("Невалиден имейл"),
  /** Honeypot: реален потребител никога не го попълва. */
  website: z.string().max(100).default(""),
});

/**
 * S14: публичен запис „извести ме при наличност". Повторен запис = тих успех
 * (не издава дали имейлът вече чака). Rate limit + honeypot като checkout-а.
 */
export async function subscribeStockAlert(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult> {
  const parsed = subscribeSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  /* Honeypot: ботът получава „успех" и не научава нищо. */
  if (input.website !== "") return ok(null);

  const ip = await clientIp();
  if (!(await checkRateLimit(`stock-alert:${ip}`, 10, 3600))) {
    return fail("Твърде много заявки. Опитай по-късно.");
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail("Магазинът не съществува.");

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, input.productId), eq(products.shopId, shop.id)),
  });
  if (!product || product.status !== "active") return fail("Продуктът не съществува.");

  const email = input.email.trim().toLowerCase();
  /* Повторен запис за същия продукт+имейл → рестартира чакането (notifiedAt
     се нулира; unique индексът пази дублирането). */
  await db
    .insert(stockAlerts)
    .values({ shopId: shop.id, productId: product.id, email })
    .onConflictDoUpdate({
      target: [stockAlerts.productId, stockAlerts.email],
      set: { notifiedAt: null, updatedAt: new Date() },
    });

  return ok(null);
}
