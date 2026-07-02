import { and, eq } from "drizzle-orm";
import { db, products } from "@/db";
import { nextSlugCandidate } from "@/lib/shop-slug";
import { slugify } from "@/lib/slug";

/** Продуктовите slug-ове са уникални в рамките на магазина. */
export async function generateUniqueProductSlug(
  shopId: string,
  name: string,
): Promise<string> {
  const base = slugify(name) || "produkt";
  for (let attempt = 0; ; attempt++) {
    const candidate = nextSlugCandidate(base, attempt);
    const existing = await db.query.products.findFirst({
      where: and(eq(products.shopId, shopId), eq(products.slug, candidate)),
    });
    if (!existing) return candidate;
  }
}
