import { eq } from "drizzle-orm";
import { db, shops } from "@/db";
import { slugify } from "@/lib/slug";

export const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "dashboard", "shops", "products",
  "blog", "pricing", "s", "www", "onboarding", "cart", "checkout",
]);

/** Postgres код за нарушен UNIQUE constraint. */
const PG_UNIQUE_VIOLATION = "23505";

/** Базовият slug от името (с резервни/резервирани случаи), без обръщение към базата. */
export function shopSlugBase(name: string): string {
  const base = slugify(name) || "magazin";
  return RESERVED_SLUGS.has(base) ? `${base}-shop` : base;
}

/** Чиста функция (тества се без база): следващ кандидат при колизия. */
export function nextSlugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

/** Дали грешката е нарушение на UNIQUE constraint (race при паралелен insert). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

export async function generateUniqueShopSlug(name: string): Promise<string> {
  const base = shopSlugBase(name);
  for (let attempt = 0; ; attempt++) {
    const candidate = nextSlugCandidate(base, attempt);
    const existing = await db.query.shops.findFirst({ where: eq(shops.slug, candidate) });
    if (!existing) return candidate;
  }
}

/**
 * Slug-ът, който БИ бил присвоен на магазин с това име в момента — за live
 * preview в onboarding-а. Само чете; финалната гаранция е UNIQUE constraint-ът
 * + retry-ът при insert (виж `insertShopWithUniqueSlug`).
 */
export async function previewShopSlug(name: string): Promise<{ slug: string; taken: boolean }> {
  const base = shopSlugBase(name);
  const slug = await generateUniqueShopSlug(name);
  return { slug, taken: slug !== base };
}

/**
 * Вмъква магазин с уникален slug, устойчиво на race: ако друг insert грабне
 * slug-а между проверката и записа, UNIQUE constraint-ът гърми (23505) и опитваме
 * следващия кандидат. Без това вторият паралелен create получава 500 вместо `-2`.
 */
export async function insertShopWithUniqueSlug(
  name: string,
  build: (slug: string) => typeof shops.$inferInsert,
  maxAttempts = 5,
): Promise<string> {
  const base = shopSlugBase(name);
  /* Стартираме от текущо свободния кандидат (по-малко колизии), после при
     race преминаваме към следващите номера. */
  const firstSlug = await generateUniqueShopSlug(name);
  let candidate = firstSlug;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await db.insert(shops).values(build(candidate));
      return candidate;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === maxAttempts - 1) throw error;
      /* Race: slug-ът е зает между проверката и записа → следващ номер. */
      const usedIndex = candidate === base ? 0 : Number(candidate.slice(base.length + 1)) - 1;
      candidate = nextSlugCandidate(base, usedIndex + 1);
    }
  }
  /* Недостижимо (loop-ът или връща, или хвърля), но задоволява типа. */
  throw new Error("Неуспешно създаване на уникален адрес на магазина.");
}
