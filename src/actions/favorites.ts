"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, products, shops, type Product } from "@/db";
import { clientIp } from "@/actions/cart";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * S10: актуалните данни за любимите продукти (id-тата живеят в localStorage).
 * Връща само АКТИВНИ продукти на този магазин — изтрити/скрити тихо изчезват.
 */
export async function getFavoriteProducts(
  shopSlug: string,
  rawIds: unknown,
): Promise<ActionResult<{ products: Product[] }>> {
  const parsed = z.array(z.uuid()).max(100).safeParse(rawIds);
  if (!parsed.success) return fail("Невалидна заявка.");
  if (parsed.data.length === 0) return ok({ products: [] });

  const ip = await clientIp();
  if (!(await checkRateLimit(`favorites:${ip}`, 30, 60))) {
    return fail("Твърде много заявки. Опитай след минута.");
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop) return fail("Магазинът не съществува.");

  const rows = await db.query.products.findMany({
    where: and(
      eq(products.shopId, shop.id),
      eq(products.status, "active"),
      inArray(products.id, parsed.data),
    ),
  });

  /* Подредба както в localStorage (реда на добавяне). */
  const order = new Map(parsed.data.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return ok({ products: rows });
}
