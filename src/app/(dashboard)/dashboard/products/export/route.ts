import { asc, eq } from "drizzle-orm";
import { categories, db, products } from "@/db";
import { requireShop } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { scaledToInput } from "@/lib/money";

/** Центове → "12.50" (точка — стабилен формат за re-импорт). */
const centsToCsv = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));

/** Мащабиран integer → машинен стринг (точка), празно при null. */
const scaledToCsv = (value: number | null, factor: number) =>
  value === null ? "" : scaledToInput(value, factor);

/** S8: експорт на всички продукти на магазина като CSV (Excel-съвместим, BOM). */
export async function GET() {
  const { shop } = await requireShop();

  const [rows, cats] = await Promise.all([
    db.query.products.findMany({
      where: eq(products.shopId, shop.id),
      orderBy: [asc(products.name)],
    }),
    db.query.categories.findMany({ where: eq(categories.shopId, shop.id) }),
  ]);
  const categoryName = new Map(cats.map((c) => [c.id, c.name]));

  const csv = toCsv([
    [
      "name",
      "slug",
      "description",
      "price",
      "promo_price",
      "stock",
      "category",
      "status",
      "weight_grams",
      "length_cm",
      "width_cm",
      "height_cm",
      "net_quantity",
      "net_quantity_unit",
      "sku",
      "gtin",
      "brand",
      "cost",
    ],
    ...rows.map((p) => [
      p.name,
      p.slug,
      p.description,
      centsToCsv(p.priceCents),
      centsToCsv(p.promoPriceCents),
      p.stock === null ? "" : String(p.stock),
      p.categoryId ? (categoryName.get(p.categoryId) ?? "") : "",
      p.status,
      p.weightGrams === null ? "" : String(p.weightGrams),
      scaledToCsv(p.lengthMm, 10),
      scaledToCsv(p.widthMm, 10),
      scaledToCsv(p.heightMm, 10),
      scaledToCsv(p.netQuantityValue, 1000),
      p.netQuantityUnit ?? "",
      p.sku ?? "",
      p.gtin ?? "",
      p.brand ?? "",
      centsToCsv(p.costCents),
    ]),
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${shop.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
