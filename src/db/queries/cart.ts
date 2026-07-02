import { and, eq, inArray } from "drizzle-orm";
import { db, products, productVariants, promotions } from "@/db";
import type { PricingProduct } from "@/lib/pricing";
import { variantKey } from "@/lib/variants";

export interface CartProductView extends PricingProduct {
  slug: string;
  imagePath: string | null;
}

/** Зарежда продуктите на магазина във формата на pricing engine-а. */
export async function getPricingProducts(
  shopId: string,
  productIds: string[],
): Promise<Map<string, CartProductView>> {
  if (productIds.length === 0) return new Map();

  const rows = await db.query.products.findMany({
    where: and(eq(products.shopId, shopId), inArray(products.id, productIds)),
  });
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return new Map();

  const [variants, deals] = await Promise.all([
    db.query.productVariants.findMany({ where: inArray(productVariants.productId, ids) }),
    db.query.promotions.findMany({
      where: and(inArray(promotions.productId, ids), eq(promotions.active, true)),
    }),
  ]);

  return new Map(
    rows.map((p) => {
      const deal = deals.find((d) => d.productId === p.id) ?? null;
      return [
        p.id,
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          imagePath: p.images[0] ?? null,
          status: p.status,
          priceCents: p.priceCents,
          promoPriceCents: p.promoPriceCents,
          stock: p.stock,
          variants: variants
            .filter((v) => v.productId === p.id)
            .map((v) => ({
              key: variantKey(v.options),
              label: Object.values(v.options).join(" / "),
              priceCents: v.priceCents,
              stock: v.stock,
            })),
          deal: deal ? { quantity: deal.quantity, totalPriceCents: deal.totalPriceCents } : null,
        },
      ];
    }),
  );
}
