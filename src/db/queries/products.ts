import { and, asc, count, desc, eq, ilike, isNotNull, lte, type SQL } from "drizzle-orm";
import {
  db,
  productAttributes,
  productOptions,
  products,
  productVariants,
  promotions,
} from "@/db";

export const PRODUCTS_PAGE_SIZE = 20;

/** Праг за „нисък склад" аларма (включва 0 = изчерпан). */
export const LOW_STOCK_THRESHOLD = 3;

/** Условие „нисък/нулев склад": следи наличност (не null) и е ≤ прага. */
const lowStockCondition = () =>
  and(isNotNull(products.stock), lte(products.stock, LOW_STOCK_THRESHOLD))!;

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  status?: "active" | "inactive";
  /** "low" → само продукти с нисък/нулев склад. */
  stock?: "low";
  page?: number;
}

export async function getProducts(shopId: string, filters: ProductFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [eq(products.shopId, shopId)];
  if (filters.search) conditions.push(ilike(products.name, `%${filters.search}%`));
  if (filters.categoryId) conditions.push(eq(products.categoryId, filters.categoryId));
  if (filters.status) conditions.push(eq(products.status, filters.status));
  if (filters.stock === "low") conditions.push(lowStockCondition());
  const where = and(...conditions);

  const [items, [total]] = await Promise.all([
    db.query.products.findMany({
      where,
      orderBy: [desc(products.createdAt)],
      limit: PRODUCTS_PAGE_SIZE,
      offset: (page - 1) * PRODUCTS_PAGE_SIZE,
    }),
    db.select({ value: count() }).from(products).where(where),
  ]);

  return { items, total: total?.value ?? 0, page, pageSize: PRODUCTS_PAGE_SIZE };
}

export async function countProducts(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(products)
    .where(eq(products.shopId, shopId));
  return row?.value ?? 0;
}

/** Брой активни продукти с нисък/нулев склад (за таблото аларма). */
export async function countLowStock(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(products)
    .where(and(eq(products.shopId, shopId), eq(products.status, "active"), lowStockCondition()));
  return row?.value ?? 0;
}

export async function getProductWithRelations(productId: string) {
  const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product) return null;

  const [attributes, options, variants, promotion] = await Promise.all([
    db.query.productAttributes.findMany({
      where: eq(productAttributes.productId, productId),
      orderBy: [asc(productAttributes.sortOrder)],
    }),
    db.query.productOptions.findMany({
      where: eq(productOptions.productId, productId),
      orderBy: [asc(productOptions.sortOrder)],
    }),
    db.query.productVariants.findMany({
      where: eq(productVariants.productId, productId),
      orderBy: [asc(productVariants.createdAt)],
    }),
    db.query.promotions.findFirst({ where: eq(promotions.productId, productId) }),
  ]);

  return { ...product, attributes, options, variants, promotion: promotion ?? null };
}
