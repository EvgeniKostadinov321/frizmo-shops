"use server";

import { eq } from "drizzle-orm";
import { db, shops } from "@/db";
import { clientIp } from "@/actions/cart";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { sendContactEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import { contactSchema } from "@/schemas/contact";

/**
 * Публична контактна форма: изпраща съобщение като имейл до търговеца (без
 * запис в базата). Rate limit + honeypot + Zod + санитизация.
 */
export async function sendContactMessage(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  /* Honeypot: ботът получава „успех" и не научава нищо. */
  if (input.website !== "") return ok(null);

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") {
    return fail("Магазинът не е достъпен в момента.");
  }
  if (!shop.email) {
    return fail("Този магазин не приема съобщения през сайта.");
  }

  const ip = await clientIp();
  if (!(await checkRateLimit(`contact:${ip}:${shop.id}`, 3, 3600))) {
    return fail("Твърде много съобщения за кратко време. Опитай по-късно.");
  }

  const sent = await sendContactEmail({
    toShopEmail: shop.email,
    shopName: shop.name,
    fromName: sanitizeText(input.name, 80),
    fromEmail: sanitizeText(input.email, 120),
    message: sanitizeMultiline(input.message, 2000),
  });
  if (!sent) return fail("Изпращането е недостъпно в момента. Опитай по-късно.");

  return ok(null);
}
