import { and, asc, desc, eq, ilike, inArray, isNotNull, ne, notInArray, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  categories,
  db,
  orderItems,
  orders,
  productAttributes,
  productOptions,
  products,
  productVariants,
  promotions,
  shops,
} from "@/db";
import { getSiteSettingsRow, parseSiteSettings } from "@/db/queries/site-settings";
import { defaultSiteSettings } from "@/lib/sections";
import { createSupabaseServer } from "@/lib/supabase/server";

export const STOREFRONT_PAGE_SIZE = 12;

/** Кеш таг на публичните данни на магазин — инвалидира се при мутация. */
export const shopCacheTag = (slug: string) => `shop:${slug}`;

/**
 * ПУБЛИЧЕН достъп до магазин — КЕШИРАН, само `published`, БЕЗ cookies/auth.
 * Това е, което storefront page-овете ползват → те стават статични/ISR за
 * анонимни посетители (нула SSR + нула DB заявка при кеш hit). Инвалидира се
 * on-demand с `revalidateTag(shopCacheTag(slug))` при всяка мутация.
 *
 * Понеже НЕ докосва `cookies()`, не opt-out-ва поддървото от статичен рендер.
 * Owner draft preview НЕ минава оттук — то живее в редактора (`?preview=1`,
 * виж `getShopForRender`).
 */
export function getPublicShopCached(slug: string) {
  return unstable_cache(
    async () => {
      const shop = await db.query.shops.findFirst({ where: eq(shops.slug, slug) });
      if (!shop || shop.status !== "published") return null;

      const row = await getSiteSettingsRow(shop.id);
      const settings =
        row?.settings != null ? parseSiteSettings(row.settings, shop.name) : defaultSiteSettings(shop.name);
      return { shop, settings };
    },
    ["public-shop", slug],
    { tags: [shopCacheTag(slug)] },
  )();
}

/**
 * ПЪЛЕН достъп до магазин (DYNAMIC — чете cookies): published за всички, draft
 * само за собственика. Ползва се от страниците, които и без това са dynamic
 * (searchParams / owner draft preview в редактора): about, contact, cart,
 * checkout, terms, products, order, newsletter. `cache()` дедупира в заявката.
 *
 * Началната и продуктовата страница НЕ ползват това — те са кеширани
 * (`getPublicShopCached`); owner ги гледа в редактора през preview iframe-а.
 */
export const getPublicShop = cache(async (slug: string) => {
  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, slug) });
  if (!shop) return null;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerIsOwner = user?.id === shop.ownerId;

  if (shop.status !== "published" && !viewerIsOwner) return null;

  const row = await getSiteSettingsRow(shop.id);
  const useDraft = viewerIsOwner && row?.draft != null;
  const raw = useDraft ? row?.draft : row?.settings;
  const settings = raw != null ? parseSiteSettings(raw, shop.name) : defaultSiteSettings(shop.name);

  return { shop, settings, viewerIsOwner, viewingDraft: useDraft };
});

export type ProductSort = "new" | "price-asc" | "price-desc";

/** Ефективна цена: промо цената, ако има, иначе редовната. */
const EFFECTIVE_PRICE = sql<number>`coalesce(${products.promoPriceCents}, ${products.priceCents})`;

export async function getActiveProducts(
  shopId: string,
  filters: {
    search?: string;
    categoryId?: string;
    /** Долна/горна граница на ефективната цена (центове). */
    minPrice?: number;
    maxPrice?: number;
    /** Само в наличност: stock IS NULL (не следи) или stock > 0. */
    inStock?: boolean;
    page?: number;
    sort?: ProductSort;
  } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [eq(products.shopId, shopId), eq(products.status, "active")];
  if (filters.search) conditions.push(ilike(products.name, `%${filters.search}%`));
  if (filters.categoryId) conditions.push(eq(products.categoryId, filters.categoryId));
  if (filters.minPrice !== undefined) conditions.push(sql`${EFFECTIVE_PRICE} >= ${filters.minPrice}`);
  if (filters.maxPrice !== undefined) conditions.push(sql`${EFFECTIVE_PRICE} <= ${filters.maxPrice}`);
  if (filters.inStock) conditions.push(sql`(${products.stock} is null or ${products.stock} > 0)`);
  const where = and(...conditions);

  /* Сортиране по обявената цена (промо не участва — колонна заявка, без CASE). */
  const orderBy =
    filters.sort === "price-asc"
      ? [asc(products.priceCents), desc(products.createdAt)]
      : filters.sort === "price-desc"
        ? [desc(products.priceCents), desc(products.createdAt)]
        : [desc(products.createdAt)];

  const [items, total] = await Promise.all([
    db.query.products.findMany({
      where,
      orderBy,
      limit: STOREFRONT_PAGE_SIZE + 1, // +1 → има ли следваща страница
      offset: (page - 1) * STOREFRONT_PAGE_SIZE,
    }),
    db.$count(products, where),
  ]);

  return {
    items: items.slice(0, STOREFRONT_PAGE_SIZE),
    hasMore: items.length > STOREFRONT_PAGE_SIZE,
    total,
    page,
  };
}

export async function getActiveProduct(shopId: string, productSlug: string) {
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.shopId, shopId),
      eq(products.slug, productSlug),
      eq(products.status, "active"),
    ),
  });
  if (!product) return null;

  const [attributes, options, variants, promotion] = await Promise.all([
    db.query.productAttributes.findMany({
      where: eq(productAttributes.productId, product.id),
      orderBy: [asc(productAttributes.sortOrder)],
    }),
    db.query.productOptions.findMany({
      where: eq(productOptions.productId, product.id),
      orderBy: [asc(productOptions.sortOrder)],
    }),
    db.query.productVariants.findMany({
      where: eq(productVariants.productId, product.id),
      orderBy: [asc(productVariants.createdAt)],
    }),
    db.query.promotions.findFirst({
      where: and(eq(promotions.productId, product.id), eq(promotions.active, true)),
    }),
  ]);

  return { ...product, attributes, options, variants, promotion: promotion ?? null };
}

/** Сума продадени бройки за продукт (поръчки confirmed/shipped/completed, не new/cancelled).
    Tenant: филтър по orders.shopId. 0 ако няма. */
export async function getSoldCount(shopId: string, productId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orderItems.productId, productId),
        eq(orders.shopId, shopId),
        inArray(orders.status, ["confirmed", "shipped", "completed"]),
      ),
    );
  return row?.total ?? 0;
}

export async function getRelatedProducts(shopId: string, productId: string, categoryId: string | null) {
  return db.query.products.findMany({
    where: and(
      eq(products.shopId, shopId),
      eq(products.status, "active"),
      ne(products.id, productId),
      categoryId ? eq(products.categoryId, categoryId) : isNotNull(products.id),
    ),
    orderBy: [desc(products.createdAt)],
    limit: 4,
  });
}

/** Cross-sell: активни продукти от категориите на количката, извън нея (до 4, най-нови). */
export async function getCrossSellProducts(shopId: string, productIds: string[]) {
  if (productIds.length === 0) return [];
  const inCart = await db.query.products.findMany({
    where: and(eq(products.shopId, shopId), inArray(products.id, productIds)),
    columns: { categoryId: true },
  });
  const categoryIds = [
    ...new Set(inCart.map((p) => p.categoryId).filter((c): c is string => c !== null)),
  ];
  if (categoryIds.length === 0) return [];
  return db.query.products.findMany({
    where: and(
      eq(products.shopId, shopId),
      eq(products.status, "active"),
      inArray(products.categoryId, categoryIds),
      notInArray(products.id, productIds),
    ),
    orderBy: [desc(products.createdAt)],
    limit: 4,
  });
}

export async function getPublicCategories(shopId: string) {
  return db.query.categories.findMany({
    where: eq(categories.shopId, shopId),
    orderBy: [asc(categories.sortOrder), asc(categories.createdAt)],
  });
}

export interface CategoryCover {
  /** Снимка от най-новия активен продукт със снимка в категорията (или null). */
  imagePath: string | null;
  /** Брой активни продукти в категорията. */
  productCount: number;
}

/**
 * Корици за категорийните карти. SQL агрегира per категория (брой + cover от
 * най-новия продукт със снимка) — вместо да тегли ВСЕКИ активен продукт и да
 * брои в JS. После rollup-ва към родителската категория (родителят се показва в
 * category-grid), избирайки по-новата снимка при merge.
 */
export async function getCategoryCovers(
  shopId: string,
): Promise<Record<string, CategoryCover>> {
  const [agg, cats] = await Promise.all([
    /* Per категория: count + снимка на най-новия продукт, който има снимка
       (DISTINCT ON + подредба по created_at desc). latestAt се връща, за да
       изберем по-новия cover при rollup към родителя. */
    db.execute(sql`
      select
        p.category_id as category_id,
        count(*)::int as product_count,
        (array_agg(p.images ->> 0 order by p.created_at desc)
           filter (where jsonb_array_length(p.images) > 0))[1] as cover,
        max(p.created_at) filter (where jsonb_array_length(p.images) > 0) as cover_at
      from ${products} p
      where p.shop_id = ${shopId} and p.status = 'active' and p.category_id is not null
      group by p.category_id
    `) as unknown as Promise<
      { category_id: string; product_count: number; cover: string | null; cover_at: string | null }[]
    >,
    db.query.categories.findMany({
      where: eq(categories.shopId, shopId),
      columns: { id: true, parentId: true },
    }),
  ]);
  const parentOf = new Map(cats.map((c) => [c.id, c.parentId]));

  /* Вътрешен акумулатор с cover_at, за да изберем по-новата снимка при merge. */
  const acc: Record<string, { imagePath: string | null; productCount: number; coverAt: number }> = {};
  function add(categoryId: string, count: number, cover: string | null, coverAt: string | null) {
    const entry = (acc[categoryId] ??= { imagePath: null, productCount: 0, coverAt: 0 });
    entry.productCount += count;
    const at = coverAt ? new Date(coverAt).getTime() : 0;
    if (cover && at >= entry.coverAt) {
      entry.imagePath = cover;
      entry.coverAt = at;
    }
  }

  for (const row of agg) {
    add(row.category_id, row.product_count, row.cover, row.cover_at);
    const parent = parentOf.get(row.category_id);
    if (parent) add(parent, row.product_count, row.cover, row.cover_at);
  }

  const covers: Record<string, CategoryCover> = {};
  for (const [id, e] of Object.entries(acc)) {
    covers[id] = { imagePath: e.imagePath, productCount: e.productCount };
  }
  return covers;
}

/** Активните продукти на магазина за product feed — само нужните колони, без пагинация. */
export async function getFeedProducts(shopId: string) {
  const rows = await db.query.products.findMany({
    where: and(eq(products.shopId, shopId), eq(products.status, "active")),
    orderBy: [desc(products.createdAt)],
    columns: {
      id: true,
      name: true,
      slug: true,
      description: true,
      priceCents: true,
      promoPriceCents: true,
      stock: true,
      images: true,
      weightGrams: true,
      categoryId: true,
      sku: true,
      gtin: true,
      brand: true,
    },
    limit: 10_000,
  });
  if (rows.length >= 10_000) {
    console.warn(JSON.stringify({ event: "product_feed_limit_hit", shopId }));
  }
  return rows;
}

/** Имена на категориите на магазина (за g:product_type). */
export async function getShopCategoryNames(shopId: string): Promise<Map<string, string>> {
  const rows = await db.query.categories.findMany({
    where: eq(categories.shopId, shopId),
    columns: { id: true, name: true },
  });
  return new Map(rows.map((c) => [c.id, c.name]));
}
