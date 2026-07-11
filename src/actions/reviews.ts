"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, products, reviews, shops } from "@/db";
import { clientIp } from "@/actions/cart";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseBgPhone } from "@/lib/phone";
import { hasPurchasedProduct } from "@/db/queries/reviews";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";

const submitSchema = z.object({
  productId: z.uuid(),
  authorName: z.string().trim().min(2, "Въведи име").max(60),
  rating: z.number().int().min(1, "Избери оценка").max(5),
  text: z.string().trim().max(1000).default(""),
  /** По избор: за verified бадж (не се съхранява — само проверка срещу поръчки). */
  phone: z.string().max(30).optional(),
  /** Honeypot: реален потребител никога не го попълва. */
  website: z.string().max(100).default(""),
});

/**
 * S1: публично подаване на ревю. Влиза като pending и НЕ се вижда, докато
 * търговецът не го одобри (предварителна модерация). Rate limit + honeypot.
 */
export async function submitReview(shopSlug: string, rawInput: unknown): Promise<ActionResult> {
  const parsed = submitSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  /* Honeypot: ботът получава „успех" и не научава нищо. */
  if (input.website !== "") return ok(null);

  const ip = await clientIp();
  if (!(await checkRateLimit(`review:${ip}`, 5, 3600))) {
    return fail("Твърде много ревюта за кратко време. Опитай по-късно.");
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail("Магазинът не съществува.");

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, input.productId), eq(products.shopId, shop.id)),
  });
  if (!product || product.status !== "active") return fail("Продуктът не съществува.");

  let verified = false;
  if (input.phone) {
    const parsedPhone = parseBgPhone(input.phone);
    if (parsedPhone.ok) {
      verified = await hasPurchasedProduct(shop.id, parsedPhone.e164, product.id);
    }
  }

  await db.insert(reviews).values({
    shopId: shop.id,
    productId: product.id,
    authorName: sanitizeText(input.authorName, 60),
    rating: input.rating,
    text: sanitizeMultiline(input.text, 1000),
    verified,
  });

  return ok(null);
}

/** Одобрение от търговеца — ревюто става публично. */
export async function approveReview(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалидно ревю.");

  const { shop } = await requireShop();
  const [row] = await db
    .update(reviews)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(reviews.id, parsed.data.id), eq(reviews.shopId, shop.id)))
    .returning({ id: reviews.id });
  if (!row) return fail("Ревюто не съществува.");

  revalidatePath("/dashboard/reviews");
  return ok(null);
}

/** Изтриване (отхвърляне) — pending или approved. */
export async function deleteReview(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалидно ревю.");

  const { shop } = await requireShop();
  const [row] = await db
    .delete(reviews)
    .where(and(eq(reviews.id, parsed.data.id), eq(reviews.shopId, shop.id)))
    .returning({ id: reviews.id });
  if (!row) return fail("Ревюто не съществува.");

  revalidatePath("/dashboard/reviews");
  return ok(null);
}
