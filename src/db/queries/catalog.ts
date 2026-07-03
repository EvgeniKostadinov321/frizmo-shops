import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db, products, shops, type Product, type Shop } from "@/db";
import { publicImageUrl } from "@/lib/storage";

export const CATALOG_PAGE_SIZE = 12;

export const SHOP_SORTS = ["newest", "name", "city"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];

export interface ShopFilters {
  search?: string;
  category?: string;
  city?: string;
  page?: number;
  sort?: ShopSort;
}

/** Магазин + cover снимка (първи продукт) за каталожната карта. */
export type ShopWithCover = Shop & { coverImage: string | null };

const SHOP_ORDER: Record<ShopSort, SQL[]> = {
  newest: [desc(shops.createdAt)],
  name: [asc(shops.name)],
  city: [asc(shops.city), asc(shops.name)],
};

export async function searchShops(filters: ShopFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const sort: ShopSort = filters.sort && SHOP_SORTS.includes(filters.sort) ? filters.sort : "newest";
  const conditions: SQL[] = [
    eq(shops.status, "published"),
    /* Скрий тестови магазини от публичния каталог */
    not(ilike(shops.slug, "test-%")),
    not(ilike(shops.slug, "тест-%")),
  ];
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

  const [rawItems, [total]] = await Promise.all([
    db.query.shops.findMany({
      where,
      orderBy: SHOP_ORDER[sort],
      limit: CATALOG_PAGE_SIZE,
      offset: (page - 1) * CATALOG_PAGE_SIZE,
    }),
    db.select({ value: count() }).from(shops).where(where),
  ]);

  /* Cover снимки — една заявка за всички магазини на страницата */
  const coverByShopId = new Map<string, string>();
  if (rawItems.length) {
    const shopIds = rawItems.map((s) => s.id);
    const shopProducts = await db.query.products.findMany({
      where: and(inArray(products.shopId, shopIds), eq(products.status, "active")),
      orderBy: [asc(products.createdAt)],
    });
    for (const product of shopProducts) {
      const path = product.images[0];
      if (path && !coverByShopId.has(product.shopId)) {
        coverByShopId.set(product.shopId, publicImageUrl(path));
      }
    }
  }

  const items: ShopWithCover[] = rawItems.map((shop) => ({
    ...shop,
    coverImage: coverByShopId.get(shop.id) ?? null,
  }));

  return { items, total: total?.value ?? 0, page, pageSize: CATALOG_PAGE_SIZE, sort };
}

export interface CatalogProduct extends Product {
  shopName: string;
  shopSlug: string;
}

export const PRODUCT_SORTS = ["newest", "price-asc", "price-desc", "name"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface CatalogProductFilters {
  search?: string;
  category?: string;
  promoOnly?: boolean;
  page?: number;
  sort?: ProductSort;
}

/** Цена за подредба: промо цената, ако има, иначе редовната. */
const PRODUCT_EFFECTIVE_PRICE = sql<number>`coalesce(${products.promoPriceCents}, ${products.priceCents})`;

const PRODUCT_ORDER: Record<ProductSort, SQL[]> = {
  newest: [desc(products.createdAt)],
  "price-asc": [asc(PRODUCT_EFFECTIVE_PRICE)],
  "price-desc": [desc(PRODUCT_EFFECTIVE_PRICE)],
  name: [asc(products.name)],
};

export async function searchCatalogProducts(filters: CatalogProductFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const sort: ProductSort =
    filters.sort && PRODUCT_SORTS.includes(filters.sort) ? filters.sort : "newest";
  const conditions: SQL[] = [
    eq(shops.status, "published"),
    eq(products.status, "active"),
    /* Скрий продуктите на тестови магазини от публичния каталог */
    not(ilike(shops.slug, "test-%")),
    not(ilike(shops.slug, "тест-%")),
  ];
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
      .orderBy(...PRODUCT_ORDER[sort])
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

  return { items, total: total?.value ?? 0, page, pageSize: CATALOG_PAGE_SIZE, sort };
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
