import { and, asc, desc, eq, ilike, isNotNull, ne, type SQL } from "drizzle-orm";
import { cache } from "react";
import {
  categories,
  db,
  productAttributes,
  productOptions,
  products,
  productVariants,
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

export async function getActiveProducts(
  shopId: string,
  filters: { search?: string; categoryId?: string; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [eq(products.shopId, shopId), eq(products.status, "active")];
  if (filters.search) conditions.push(ilike(products.name, `%${filters.search}%`));
  if (filters.categoryId) conditions.push(eq(products.categoryId, filters.categoryId));

  const items = await db.query.products.findMany({
    where: and(...conditions),
    orderBy: [desc(products.createdAt)],
    limit: STOREFRONT_PAGE_SIZE + 1, // +1 → има ли следваща страница
    offset: (page - 1) * STOREFRONT_PAGE_SIZE,
  });

  return {
    items: items.slice(0, STOREFRONT_PAGE_SIZE),
    hasMore: items.length > STOREFRONT_PAGE_SIZE,
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

  const [attributes, options, variants] = await Promise.all([
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
  ]);

  return { ...product, attributes, options, variants };
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
