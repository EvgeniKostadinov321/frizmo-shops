import { and, count, desc, eq, ilike, isNotNull, or, type SQL } from "drizzle-orm";
import { db, products, shops, type Product, type Shop } from "@/db";

export const CATALOG_PAGE_SIZE = 12;

export interface ShopFilters {
  search?: string;
  category?: string;
  city?: string;
  page?: number;
}

export async function searchShops(filters: ShopFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [eq(shops.status, "published")];
  if (filters.search) {
    conditions.push(
      or(
        ilike(shops.name, `%${filters.search}%`),
        ilike(shops.description, `%${filters.search}%`),
      )!,
    );
  }
  if (filters.category) conditions.push(eq(shops.businessCategory, filters.category));
  if (filters.city) conditions.push(eq(shops.city, filters.city));
  const where = and(...conditions);

  const [items, [total]] = await Promise.all([
    db.query.shops.findMany({
      where,
      orderBy: [desc(shops.createdAt)],
      limit: CATALOG_PAGE_SIZE,
      offset: (page - 1) * CATALOG_PAGE_SIZE,
    }),
    db.select({ value: count() }).from(shops).where(where),
  ]);

  return { items, total: total?.value ?? 0, page, pageSize: CATALOG_PAGE_SIZE };
}

export interface CatalogProduct extends Product {
  shopName: string;
  shopSlug: string;
}

export interface CatalogProductFilters {
  search?: string;
  category?: string;
  promoOnly?: boolean;
  page?: number;
}

export async function searchCatalogProducts(filters: CatalogProductFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [eq(shops.status, "published"), eq(products.status, "active")];
  if (filters.search) conditions.push(ilike(products.name, `%${filters.search}%`));
  if (filters.category) conditions.push(eq(shops.businessCategory, filters.category));
  if (filters.promoOnly) conditions.push(isNotNull(products.promoPriceCents));
  const where = and(...conditions);

  const [rows, [total]] = await Promise.all([
    db
      .select({ product: products, shopName: shops.name, shopSlug: shops.slug })
      .from(products)
      .innerJoin(shops, eq(products.shopId, shops.id))
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(CATALOG_PAGE_SIZE)
      .offset((page - 1) * CATALOG_PAGE_SIZE),
    db
      .select({ value: count() })
      .from(products)
      .innerJoin(shops, eq(products.shopId, shops.id))
      .where(where),
  ]);

  const items: CatalogProduct[] = rows.map((r) => ({
    ...r.product,
    shopName: r.shopName,
    shopSlug: r.shopSlug,
  }));

  return { items, total: total?.value ?? 0, page, pageSize: CATALOG_PAGE_SIZE };
}

/** Градовете на публикуваните магазини — за филтъра. */
export async function getShopCities(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ city: shops.city })
    .from(shops)
    .where(and(eq(shops.status, "published"), isNotNull(shops.city)));
  return rows
    .map((r) => r.city)
    .filter((c): c is string => Boolean(c && c.trim()))
    .sort((a, b) => a.localeCompare(b, "bg"));
}

/** За landing витрината и sitemap-а. */
export async function getPublishedShops(limit = 100): Promise<Shop[]> {
  return db.query.shops.findMany({
    where: eq(shops.status, "published"),
    orderBy: [desc(shops.createdAt)],
    limit,
  });
}
