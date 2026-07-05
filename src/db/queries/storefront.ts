import { and, asc, desc, eq, ilike, isNotNull, ne, type SQL } from "drizzle-orm";
import { cache } from "react";
import {
  categories,
  db,
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

/**
 * Публичен достъп до магазин: published → за всички; иначе само за
 * собственика (draft preview). cache() дедупира в рамките на заявката
 * (layout + page викат едно и също).
 */
export const getPublicShop = cache(async (slug: string) => {
  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, slug) });
  if (!shop) return null;

  let viewerIsOwner = false;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  viewerIsOwner = user?.id === shop.ownerId;

  if (shop.status !== "published" && !viewerIsOwner) return null;

  /* Собственикът вижда draft-а си (незапазените промени от редактора) на живо. */
  const row = await getSiteSettingsRow(shop.id);
  const useDraft = viewerIsOwner && row?.draft != null;
  const raw = useDraft ? row?.draft : row?.settings;
  const settings = raw != null ? parseSiteSettings(raw, shop.name) : defaultSiteSettings(shop.name);

  return { shop, settings, viewerIsOwner, viewingDraft: useDraft };
});

export type ProductSort = "new" | "price-asc" | "price-desc";

export async function getActiveProducts(
  shopId: string,
  filters: { search?: string; categoryId?: string; page?: number; sort?: ProductSort } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [eq(products.shopId, shopId), eq(products.status, "active")];
  if (filters.search) conditions.push(ilike(products.name, `%${filters.search}%`));
  if (filters.categoryId) conditions.push(eq(products.categoryId, filters.categoryId));
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
 * Корици за категорийните карти: две леки заявки (по 2–3 колони),
 * агрегирани в JS — без N+1 per категория. Продукт в подкатегория се брои
 * и към родителската категория (родителят се показва в category-grid).
 */
export async function getCategoryCovers(
  shopId: string,
): Promise<Record<string, CategoryCover>> {
  const [rows, cats] = await Promise.all([
    db.query.products.findMany({
      where: and(eq(products.shopId, shopId), eq(products.status, "active")),
      orderBy: [desc(products.createdAt)],
      columns: { categoryId: true, images: true },
    }),
    db.query.categories.findMany({
      where: eq(categories.shopId, shopId),
      columns: { id: true, parentId: true },
    }),
  ]);
  const parentOf = new Map(cats.map((c) => [c.id, c.parentId]));

  const covers: Record<string, CategoryCover> = {};
  function add(categoryId: string, imagePath: string | undefined) {
    const entry = (covers[categoryId] ??= { imagePath: null, productCount: 0 });
    entry.productCount += 1;
    /* редовете са от най-нов към най-стар → първата намерена снимка печели */
    if (!entry.imagePath && imagePath) entry.imagePath = imagePath;
  }

  for (const row of rows) {
    if (!row.categoryId) continue;
    add(row.categoryId, row.images[0]);
    const parent = parentOf.get(row.categoryId);
    if (parent) add(parent, row.images[0]);
  }
  return covers;
}
