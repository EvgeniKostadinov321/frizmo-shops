"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db, shops } from "@/db";
import { getPricingProducts } from "@/db/queries/cart";
import { getCrossSellProducts } from "@/db/queries/storefront";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { priceCart, type PricedCart } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit";

const linesSchema = z
  .array(
    z.object({
      productId: z.uuid(),
      variantKey: z.union([z.string().max(300), z.null()]),
      qty: z.number().int().min(1).max(999),
    }),
  )
  .max(50);

export interface CartLineView {
  imagePath: string | null;
  productSlug: string;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export interface SuggestionCard {
  id: string;
  name: string;
  slug: string;
  imagePath: string | null;
  priceCents: number;
  promoPriceCents: number | null;
}

/** Cross-sell предложения за количката (публично; лек rate limit; празно при нищо). */
export async function getCartSuggestions(
  slug: string,
  rawIds: unknown,
): Promise<SuggestionCard[]> {
  const parsed = z.array(z.uuid()).max(50).safeParse(rawIds);
  if (!parsed.success || parsed.data.length === 0) return [];
  const ip = await clientIp();
  if (!(await checkRateLimit(`cart-suggest:${ip}`, 30, 60))) return [];
  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, slug) });
  if (!shop || shop.status !== "published") return [];
  const rows = await getCrossSellProducts(shop.id, parsed.data);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    imagePath: p.images[0] ?? null,
    priceCents: p.priceCents,
    promoPriceCents: p.promoPriceCents,
  }));
}

/** Публично ценообразуване на количката — сървърът е източникът на истината. */
export async function priceCartAction(
  shopSlug: string,
  rawLines: unknown,
): Promise<ActionResult<{ cart: PricedCart; views: CartLineView[] }>> {
  const parsed = linesSchema.safeParse(rawLines);
  if (!parsed.success) return fail("Невалидна количка.");

  const ip = await clientIp();
  if (!(await checkRateLimit(`cart:${ip}`, 60, 60))) {
    return fail("Твърде много заявки. Опитай след минута.");
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop) return fail("Магазинът не съществува.");

  const productsMap = await getPricingProducts(
    shop.id,
    parsed.data.map((l) => l.productId),
  );
  const cart = priceCart(parsed.data, productsMap);

  const views: CartLineView[] = parsed.data.map((line) => {
    const product = productsMap.get(line.productId);
    return { imagePath: product?.imagePath ?? null, productSlug: product?.slug ?? "" };
  });

  return ok({ cart, views });
}
