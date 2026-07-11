"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, products, productQuestions, shops } from "@/db";
import { clientIp } from "@/actions/cart";
import { shopCacheTag } from "@/db/queries/storefront";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import { answerQuestionSchema, submitQuestionSchema } from "@/schemas/question";

/** Публично подаване на въпрос — влиза pending (невидим до отговор). Rate limit + honeypot. */
export async function submitQuestion(shopSlug: string, rawInput: unknown): Promise<ActionResult> {
  const parsed = submitQuestionSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  /* Honeypot: ботът получава „успех" и не научава нищо. */
  if (input.website !== "") return ok(null);

  const ip = await clientIp();
  if (!(await checkRateLimit(`question:${ip}`, 5, 3600))) {
    return fail("Твърде много въпроси за кратко време. Опитай по-късно.");
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail("Магазинът не съществува.");

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, input.productId), eq(products.shopId, shop.id)),
  });
  if (!product || product.status !== "active") return fail("Продуктът не съществува.");

  await db.insert(productQuestions).values({
    shopId: shop.id,
    productId: product.id,
    askerName: sanitizeText(input.askerName, 60),
    question: sanitizeMultiline(input.question, 500),
  });

  return ok(null);
}

/** Търговец отговаря и публикува (или редактира отговор) → status='answered'. */
export async function answerQuestion(rawInput: unknown): Promise<ActionResult> {
  const parsed = answerQuestionSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const [row] = await db
    .update(productQuestions)
    .set({
      answer: sanitizeMultiline(parsed.data.answer, 1000),
      status: "answered",
      updatedAt: new Date(),
    })
    .where(and(eq(productQuestions.id, parsed.data.id), eq(productQuestions.shopId, shop.id)))
    .returning({ id: productQuestions.id });
  if (!row) return fail("Въпросът не съществува.");

  revalidatePath("/dashboard/questions");
  revalidateTag(shopCacheTag(shop.slug), "max");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok(null);
}

/** Изтриване на въпрос (pending или answered). */
export async function deleteQuestion(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалиден въпрос.");

  const { shop } = await requireShop();
  const [row] = await db
    .delete(productQuestions)
    .where(and(eq(productQuestions.id, parsed.data.id), eq(productQuestions.shopId, shop.id)))
    .returning({ id: productQuestions.id });
  if (!row) return fail("Въпросът не съществува.");

  revalidatePath("/dashboard/questions");
  revalidateTag(shopCacheTag(shop.slug), "max");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok(null);
}
