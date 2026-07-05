"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, products, shops, type Product } from "@/db";
import { clientIp } from "@/actions/cart";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { checkRateLimit } from "@/lib/rate-limit";

const idsSchema = z.array(z.uuid()).max(8);

/**
 * Публично четене на активни продукти по id-та (за „Последно разглеждани" —
 * клиентът пази само id-та в localStorage). Връща ги в подадения ред.
 */
export async function getProductsByIdsAction(
  shopSlug: string,
  rawIds: unknown,
): Promise<ActionResult<Product[]>> {
  const parsed = idsSchema.safeParse(rawIds);
  if (!parsed.success) return fail("Невалидна заявка.");
  if (parsed.data.length === 0) return ok([]);

  const ip = await clientIp();
  if (!(await checkRateLimit(`viewed:${ip}`, 30, 60))) {
    return fail("Твърде много заявки.");
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
  const order = new Map(parsed.data.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  return ok(rows);
}
