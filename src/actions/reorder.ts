"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, orderItems, orders, products, shops } from "@/db";
import { clientIp } from "@/actions/cart";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveReorderLine, type ReorderLine } from "@/lib/reorder-line";

const inputSchema = z.object({ orderId: z.uuid(), token: z.uuid() });

/**
 * Reorder: по publicToken зарежда наличните артикули на поръчка обратно като
 * cart редове. Скипва липсващи/неактивни/изчерпани. Цените НЕ идват от snapshot —
 * количката ги преизчислява от текущия продукт (сървърът е ценовият източник).
 */
export async function reorderToCart(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult<{ lines: ReorderLine[]; skipped: string[] }>> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Невалидна заявка.");
  const { orderId, token } = parsed.data;

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail("Магазинът не е достъпен.");

  const ip = await clientIp();
  if (!(await checkRateLimit(`reorder:${ip}`, 10, 3600))) {
    return fail("Твърде много опити. Опитай по-късно.");
  }

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.shopId, shop.id), eq(orders.publicToken, token)),
  });
  if (!order) return fail("Поръчката не е намерена.");

  const items = await db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) });

  /* Batch: един products.findMany вместо заявка на ред (беше N+1 — одит #3 PERF-01).
     House pattern (cart.ts/storefront.ts) — scope по shopId, резолв от Map в цикъла. */
  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => !!id))];
  const productRows = productIds.length
    ? await db.query.products.findMany({
        where: and(eq(products.shopId, shop.id), inArray(products.id, productIds)),
      })
    : [];
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  const lines: ReorderLine[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    if (!item.productId) {
      skipped.push(item.productName);
      continue;
    }
    const product = productMap.get(item.productId);
    /* Наличността се проверява на ниво продукт (product.stock). Вариантът се носи
       като snapshot variantKey — валидира се повторно от pricing-а на количката
       (priceCartAction). Reorder е удобство, не гаранция. */
    const line = resolveReorderLine({
      productId: item.productId,
      variantKey: item.variantKey || null,
      quantity: item.quantity,
      productExists: !!product,
      productActive: product?.status === "active",
      stock: product?.stock ?? null,
      madeToOrder: product?.madeToOrder ?? false,
    });
    if (line) lines.push(line);
    else skipped.push(item.productName);
  }

  if (lines.length === 0) return fail("Нито един артикул не е наличен вече.");
  return ok({ lines, skipped });
}
