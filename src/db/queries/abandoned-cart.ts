import { and, eq, lt } from "drizzle-orm";
import { abandonedCarts, db, shops, type AbandonedLine } from "@/db";

/** Upsert по (shopId, email): нова активност презаписва редовете и връща pending. */
export async function upsertAbandonedCart(
  shopId: string,
  email: string,
  lines: AbandonedLine[],
  subtotalCents: number,
): Promise<void> {
  await db
    .insert(abandonedCarts)
    .values({ shopId, email, lines, subtotalCents, status: "pending" })
    .onConflictDoUpdate({
      target: [abandonedCarts.shopId, abandonedCarts.email],
      set: {
        lines,
        subtotalCents,
        status: "pending",
        remindedAt: null,
        updatedAt: new Date(),
      },
    });
}

/** Трие изоставена количка (при махнат checkbox). */
export async function deleteAbandonedCart(shopId: string, email: string): Promise<void> {
  await db
    .delete(abandonedCarts)
    .where(and(eq(abandonedCarts.shopId, shopId), eq(abandonedCarts.email, email)));
}

/** Зрелите pending (изоставени преди thresholdMs) + данни за магазина. */
export async function getDueAbandonedCarts(thresholdMs: number, limit: number) {
  const cutoff = new Date(Date.now() - thresholdMs);
  return db
    .select({
      id: abandonedCarts.id,
      email: abandonedCarts.email,
      lines: abandonedCarts.lines,
      subtotalCents: abandonedCarts.subtotalCents,
      shopName: shops.name,
      shopSlug: shops.slug,
    })
    .from(abandonedCarts)
    .innerJoin(shops, eq(shops.id, abandonedCarts.shopId))
    .where(and(eq(abandonedCarts.status, "pending"), lt(abandonedCarts.updatedAt, cutoff)))
    .limit(limit);
}

export async function markAbandonedCartSent(id: string): Promise<void> {
  await db
    .update(abandonedCarts)
    .set({ status: "sent", remindedAt: new Date(), updatedAt: new Date() })
    .where(eq(abandonedCarts.id, id));
}

/** При завършена поръчка: маркира изоставената количка на купувача като converted. */
export async function markConvertedByEmail(shopId: string, email: string): Promise<void> {
  await db
    .update(abandonedCarts)
    .set({ status: "converted", updatedAt: new Date() })
    .where(and(eq(abandonedCarts.shopId, shopId), eq(abandonedCarts.email, email)));
}
