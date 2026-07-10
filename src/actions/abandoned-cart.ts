"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { clientIp } from "@/actions/cart";
import { db, shops, type AbandonedLine } from "@/db";
import { deleteAbandonedCart, upsertAbandonedCart } from "@/db/queries/abandoned-cart";
import { getPricingProducts } from "@/db/queries/cart";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { priceCart } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

const schema = z.object({
  shopSlug: z.string().min(1).max(120),
  email: z.string().trim().email().max(120),
  remind: z.boolean(),
  lines: z
    .array(
      z.object({
        productId: z.uuid(),
        variantKey: z.union([z.string().max(300), z.null()]),
        qty: z.number().int().min(1).max(999),
      }),
    )
    .max(50),
});

/**
 * Улавя изоставена количка на checkout (opt-in). Публичен endpoint: rate limit +
 * Zod + sanitize. remind=false трие; иначе snapshot през priceCart (сървърни цени,
 * никакво доверие на клиента) + upsert. Празна/невалидна количка → тихо ok.
 */
export async function saveAbandonedCart(rawInput: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return fail("Невалидни данни.");
  const { shopSlug, email: rawEmail, remind, lines } = parsed.data;

  const ip = await clientIp();
  if (!(await checkRateLimit(`abandoned:${ip}`, 30, 60))) {
    return ok(null); // тихо — не чупи checkout при rate limit
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return ok(null);

  const email = sanitizeText(rawEmail, 120).toLowerCase();

  if (!remind) {
    await deleteAbandonedCart(shop.id, email);
    return ok(null);
  }

  if (lines.length === 0) return ok(null);

  /* Snapshot: цените се преизчисляват на сървъра (никакво доверие на клиента). */
  const products = await getPricingProducts(
    shop.id,
    lines.map((l) => l.productId),
  );
  const priced = priceCart(lines, products);
  const snapshot: AbandonedLine[] = priced.lines
    .filter((l) => products.has(l.productId))
    .map((l) => {
      const view = products.get(l.productId)!;
      return {
        productId: l.productId,
        variantKey: l.variantKey,
        qty: l.qty,
        name: l.productName,
        priceCents: l.unitPriceCents,
        imagePath: view.imagePath,
        productSlug: view.slug,
      };
    });

  if (snapshot.length === 0) return ok(null);

  await upsertAbandonedCart(shop.id, email, snapshot, priced.subtotalCents);
  return ok(null);
}
