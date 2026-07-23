import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, products, shops, stockAlerts } from "@/db";
import { sendBackInStockEmail } from "@/lib/email";

/**
 * S14: праща чакащите back-in-stock имейли за продукт, върнал се в наличност
 * (преход 0 → >0). Маркира notifiedAt ПРЕДИ пращането — при повторно викане
 * никой не получава втори имейл (по-добре пропуснат при рядка грешка, отколкото
 * дублиран). Вика се неблокиращо (void/allSettled) от saveProduct и CSV импорта.
 */
export async function notifyStockAlerts(shopId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  /* Викa се неблокиращо през голо `void` от saveProduct/bulk-restock. Собствените DB
     заявки тук (findFirst/findMany/update) са ПРЕДИ allSettled → техен reject би изтекъл
     като unhandledRejection (одит #3 ERR-01). Обвиваме цялото тяло: провал на страничното
     известие никога не бива да сваля процеса — само структуриран лог. */
  try {
    const [shop, productRows] = await Promise.all([
      db.query.shops.findFirst({ where: eq(shops.id, shopId) }),
      db.query.products.findMany({
        where: and(eq(products.shopId, shopId), inArray(products.id, productIds)),
        columns: { id: true, name: true, slug: true },
      }),
    ]);
    if (!shop || productRows.length === 0) return;
    const productById = new Map(productRows.map((p) => [p.id, p]));

    /* Взимаме чакащите и ги маркираме атомарно (returning) — race-safe. */
    const pending = await db
      .update(stockAlerts)
      .set({ notifiedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(stockAlerts.shopId, shopId),
          inArray(stockAlerts.productId, productIds),
          isNull(stockAlerts.notifiedAt),
        ),
      )
      .returning({ email: stockAlerts.email, productId: stockAlerts.productId });

    await Promise.allSettled(
      pending.map((alert) => {
        const product = productById.get(alert.productId);
        if (!product) return Promise.resolve();
        return sendBackInStockEmail({
          toEmail: alert.email,
          shopName: shop.name,
          shopSlug: shop.slug,
          productName: product.name,
          productSlug: product.slug,
        });
      }),
    );
  } catch (e) {
    console.error(
      JSON.stringify({ scope: "notifyStockAlerts", shopId, error: e instanceof Error ? e.message : String(e) }),
    );
  }
}
