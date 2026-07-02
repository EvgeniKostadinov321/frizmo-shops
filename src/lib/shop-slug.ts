import { eq } from "drizzle-orm";
import { db, shops } from "@/db";
import { slugify } from "@/lib/slug";

export const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "dashboard", "shops", "products",
  "blog", "pricing", "s", "www", "onboarding", "cart", "checkout",
]);

/** Чиста функция (тества се без база): следващ кандидат при колизия. */
export function nextSlugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

export async function generateUniqueShopSlug(name: string): Promise<string> {
  let base = slugify(name) || "magazin";
  if (RESERVED_SLUGS.has(base)) base = `${base}-shop`;
  for (let attempt = 0; ; attempt++) {
    const candidate = nextSlugCandidate(base, attempt);
    const existing = await db.query.shops.findFirst({ where: eq(shops.slug, candidate) });
    if (!existing) return candidate;
  }
}
