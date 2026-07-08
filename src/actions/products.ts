"use server";

import { and, eq, inArray, sql as rawSql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import {
  categories,
  db,
  productAttributes,
  productOptions,
  products,
  productVariants,
  promotions,
} from "@/db";
import { shopCacheTag } from "@/db/queries/storefront";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { toCents } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { getShopPlan, PLAN_LIMITS } from "@/lib/plan";
import { generateUniqueProductSlug } from "@/lib/product-slug";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import { notifyStockAlerts } from "@/lib/stock-alerts";
import { SHOP_MEDIA_BUCKET } from "@/lib/storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { countProducts } from "@/db/queries/products";
import { productSchema, type ProductInput } from "@/schemas/product";

/** Инвалидира публичния кеш + layout пътя на магазина. */
function revalidateShop(slug: string) {
  revalidateTag(shopCacheTag(slug), "max");
  revalidatePath(`/s/${slug}`, "layout");
}

async function ownProduct(id: string, shopId: string) {
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  return product && product.shopId === shopId ? product : null;
}

/** Крос-валидации отвъд Zod схемата. Връща съобщение за грешка или null. */
function crossValidate(input: ProductInput, shopId: string): string | null {
  const priceCents = toCents(input.price)!;

  if (input.promoPrice) {
    const promo = toCents(input.promoPrice)!;
    if (promo >= priceCents) return "Промо цената трябва да е по-ниска от редовната.";
  }

  const prefix = `shops/${shopId}/`;
  if (input.images.some((p) => !p.startsWith(prefix))) {
    return "Невалиден път на снимка.";
  }

  if (input.deal) {
    const dealTotal = toCents(input.deal.totalPrice)!;
    if (dealTotal >= input.deal.quantity * priceCents) {
      return "Промоционалната обща цена трябва да е по-ниска от редовната за същия брой.";
    }
  }

  const optionNames = new Set(input.options.map((o) => o.name));
  const imageSet = new Set(input.images);
  for (const variant of input.variants) {
    const keys = Object.keys(variant.options);
    if (keys.length === 0 || keys.some((k) => !optionNames.has(k))) {
      return "Вариантите не съответстват на дефинираните опции.";
    }
    if (variant.imagePaths.some((p) => !imageSet.has(p))) {
      return "Снимка на вариант не е сред снимките на продукта.";
    }
  }
  if (input.variants.length > 0 && input.options.length === 0) {
    return "Вариантите изискват дефинирани опции.";
  }

  return null;
}

function productValues(input: ProductInput, shopId: string) {
  return {
    shopId,
    categoryId: input.categoryId || null,
    name: sanitizeText(input.name, 120),
    description: sanitizeMultiline(input.description, 10_000),
    priceCents: toCents(input.price)!,
    promoPriceCents: input.promoPrice ? toCents(input.promoPrice) : null,
    stock: input.stock === "" ? null : input.stock,
    status: input.status,
    images: input.images,
    updatedAt: new Date(),
  };
}

async function insertRelations(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  input: ProductInput,
  shopId: string,
) {
  await tx.delete(promotions).where(eq(promotions.productId, productId));
  if (input.deal) {
    await tx.insert(promotions).values({
      shopId,
      productId,
      quantity: input.deal.quantity,
      totalPriceCents: toCents(input.deal.totalPrice)!,
    });
  }
  if (input.attributes.length > 0) {
    await tx.insert(productAttributes).values(
      input.attributes.map((a, i) => ({
        productId,
        name: sanitizeText(a.name, 60),
        value: sanitizeText(a.value, 200),
        sortOrder: i,
      })),
    );
  }
  if (input.options.length > 0) {
    await tx.insert(productOptions).values(
      input.options.map((o, i) => ({
        productId,
        name: sanitizeText(o.name, 40),
        values: o.values.map((v) => sanitizeText(v, 60)),
        sortOrder: i,
      })),
    );
  }
  if (input.variants.length > 0) {
    await tx.insert(productVariants).values(
      input.variants.map((v) => ({
        productId,
        options: v.options,
        priceCents: v.price ? toCents(v.price) : null,
        stock: v.stock === "" ? null : v.stock,
        sku: v.sku ? sanitizeText(v.sku, 60) : null,
        imagePaths: v.imagePaths,
      })),
    );
  }
}

export async function saveProduct(
  productId: string | null,
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const { shop } = await requireShop();

  const crossError = crossValidate(input, shop.id);
  if (crossError) return fail(crossError);

  if (input.categoryId) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, input.categoryId),
    });
    if (!category || category.shopId !== shop.id) return fail("Невалидна категория.");
  }

  if (productId === null) {
    const plan = await getShopPlan(shop.id);
    const existing = await countProducts(shop.id);
    if (existing >= PLAN_LIMITS[plan].maxProducts) {
      return fail("Достигнат е лимитът продукти за твоя план.");
    }

    const slug = await generateUniqueProductSlug(shop.id, input.name);
    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(products)
        .values({ ...productValues(input, shop.id), slug })
        .returning({ id: products.id });
      await insertRelations(tx, created!.id, input, shop.id);
      return created!.id;
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard");
    revalidateShop(shop.slug);
    return ok({ id });
  }

  const product = await ownProduct(productId, shop.id);
  if (!product) return fail("Продуктът не съществува.");

  const values = productValues(input, shop.id);
  await db.transaction(async (tx) => {
    await tx.update(products).set(values).where(eq(products.id, product.id));
    await tx.delete(productAttributes).where(eq(productAttributes.productId, product.id));
    await tx.delete(productOptions).where(eq(productOptions.productId, product.id));
    await tx.delete(productVariants).where(eq(productVariants.productId, product.id));
    await insertRelations(tx, product.id, input, shop.id);
  });

  /* S14: наличност 0 → >0 → back-in-stock известия (неблокиращо). */
  if (product.stock === 0 && values.stock !== null && values.stock > 0) {
    void notifyStockAlerts(shop.id, [product.id]);
  }

  revalidatePath("/dashboard/products");
  revalidateShop(shop.slug);
  return ok({ id: product.id });
}

export async function deleteProduct(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалиден продукт.");

  const { shop } = await requireShop();
  const product = await ownProduct(parsed.data.id, shop.id);
  if (!product) return fail("Продуктът не съществува.");

  await db.delete(products).where(eq(products.id, product.id));

  if (product.images.length > 0) {
    const admin = createSupabaseAdmin();
    await admin.storage.from(SHOP_MEDIA_BUCKET).remove(product.images);
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  revalidateShop(shop.slug);
  return ok(null);
}

const bulkSchema = z.object({
  ids: z.array(z.uuid()).min(1, "Избери поне един продукт.").max(100),
  op: z.discriminatedUnion("type", [
    z.object({ type: z.literal("activate") }),
    z.object({ type: z.literal("deactivate") }),
    z.object({ type: z.literal("delete") }),
    z.object({
      type: z.literal("price"),
      mode: z.enum(["percent", "fixed"]),
      /** percent: цели проценти −90..500 · fixed: центове −100000..100000. */
      value: z.number().int().min(-100_000).max(100_000),
    }),
  ]),
});

/**
 * Bulk операции върху продукти (S7). Tenant изолация: всяка операция е с
 * WHERE shop_id — чужди id-та тихо се игнорират. Връща броя засегнати.
 */
export async function bulkProductAction(
  rawInput: unknown,
): Promise<ActionResult<{ affected: number }>> {
  const parsed = bulkSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const { ids, op } = parsed.data;

  const { shop } = await requireShop();
  const owned = and(eq(products.shopId, shop.id), inArray(products.id, ids));

  let affected = 0;

  if (op.type === "activate" || op.type === "deactivate") {
    const rows = await db
      .update(products)
      .set({ status: op.type === "activate" ? "active" : "inactive", updatedAt: new Date() })
      .where(owned)
      .returning({ id: products.id });
    affected = rows.length;
  } else if (op.type === "delete") {
    /* Първо снимките (нужни са пътищата), после реда — както единичното изтриване. */
    const rows = await db.query.products.findMany({ where: owned, columns: { id: true, images: true } });
    if (rows.length > 0) {
      await db.delete(products).where(inArray(products.id, rows.map((r) => r.id)));
      const images = rows.flatMap((r) => r.images);
      if (images.length > 0) {
        const admin = createSupabaseAdmin();
        await admin.storage.from(SHOP_MEDIA_BUCKET).remove(images);
      }
    }
    affected = rows.length;
  } else {
    if (op.mode === "percent" && (op.value < -90 || op.value > 500)) {
      return fail("Процентът трябва да е между −90 и +500.");
    }
    /* Върху РЕДОВНАТА цена; минимум 1 цент. Промото не се пипа, но ако новата
       цена падне до/под промото, промото се маха (иначе промо ≥ редовна). */
    const newPrice =
      op.mode === "percent"
        ? rawSql`greatest(1, round(${products.priceCents} * ${100 + op.value} / 100.0)::int)`
        : rawSql`greatest(1, ${products.priceCents} + ${op.value})`;
    const rows = await db
      .update(products)
      .set({ priceCents: newPrice as unknown as number, updatedAt: new Date() })
      .where(owned)
      .returning({ id: products.id });
    await db
      .update(products)
      .set({ promoPriceCents: null })
      .where(and(owned, rawSql`${products.promoPriceCents} >= ${products.priceCents}`));
    affected = rows.length;
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  revalidateShop(shop.slug);
  return ok({ affected });
}

const CSV_HEADER = ["name", "slug", "description", "price", "promo_price", "stock", "category", "status"] as const;
const CSV_MAX_ROWS = 500;

export interface CsvImportResult {
  created: number;
  updated: number;
  /** Съобщения за пропуснатите редове (напр. „ред 5: невалидна цена"). */
  skipped: string[];
}

/**
 * S8: импорт на продукти от CSV (форматът на експорта). Match по slug:
 * съществуващ → update, нов → create. Невалидните редове се пропускат и
 * докладват; системна грешка → нищо не се записва (една транзакция).
 * Снимки/варианти НЕ участват.
 */
export async function importProductsCsv(rawInput: unknown): Promise<ActionResult<CsvImportResult>> {
  const parsed = z.object({ csv: z.string().min(1).max(1_000_000) }).safeParse(rawInput);
  if (!parsed.success) return fail("Невалиден файл (до 1MB).");

  const { shop } = await requireShop();

  const rows = parseCsv(parsed.data.csv);
  if (rows.length < 2) return fail("Файлът няма редове с данни.");
  if (rows.length - 1 > CSV_MAX_ROWS) return fail(`До ${CSV_MAX_ROWS} реда на импорт.`);

  /* Колоните се откриват по header имената (редът им е без значение). */
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col: Partial<Record<(typeof CSV_HEADER)[number], number>> = {};
  for (const name of CSV_HEADER) {
    const idx = header.indexOf(name);
    if (idx >= 0) col[name] = idx;
  }
  if (col.name === undefined || col.price === undefined) {
    return fail("Липсват задължителните колони „name“ и „price“ (виж експорта за формата).");
  }
  const cell = (row: string[], key: (typeof CSV_HEADER)[number]) =>
    col[key] === undefined ? "" : (row[col[key]!] ?? "").trim();

  const [existing, cats] = await Promise.all([
    db.query.products.findMany({
      where: eq(products.shopId, shop.id),
      columns: { id: true, slug: true, stock: true },
    }),
    db.query.categories.findMany({ where: eq(categories.shopId, shop.id) }),
  ]);
  const bySlug = new Map(existing.map((p) => [p.slug, p.id]));
  const oldStockById = new Map(existing.map((p) => [p.id, p.stock]));
  const categoryByName = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));
  /* S14: продукти с преход на наличността 0 → >0 (известия след транзакцията). */
  const restockedIds: string[] = [];

  /* Плановият лимит важи и за импорта (скрит бутон не е защита). */
  const plan = await getShopPlan(shop.id);
  const maxProducts = PLAN_LIMITS[plan].maxProducts;
  let productCount = existing.length;

  const result: CsvImportResult = { created: 0, updated: 0, skipped: [] };

  await db.transaction(async (tx) => {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const lineNo = i + 1;

      const name = sanitizeText(cell(row, "name"), 120);
      if (name.length < 2) {
        result.skipped.push(`ред ${lineNo}: липсва име`);
        continue;
      }
      const priceCents = toCents(cell(row, "price").replace(",", "."));
      if (priceCents === null || priceCents < 1) {
        result.skipped.push(`ред ${lineNo}: невалидна цена „${cell(row, "price")}“`);
        continue;
      }
      const promoRaw = cell(row, "promo_price");
      const promoPriceCents = promoRaw ? toCents(promoRaw.replace(",", ".")) : null;
      if (promoRaw && (promoPriceCents === null || promoPriceCents >= priceCents)) {
        result.skipped.push(`ред ${lineNo}: невалидна промо цена „${promoRaw}“`);
        continue;
      }
      const stockRaw = cell(row, "stock");
      const stock = stockRaw === "" ? null : Number(stockRaw);
      if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000)) {
        result.skipped.push(`ред ${lineNo}: невалидна наличност „${stockRaw}“`);
        continue;
      }
      const statusRaw = cell(row, "status").toLowerCase();
      if (statusRaw && statusRaw !== "active" && statusRaw !== "inactive") {
        result.skipped.push(`ред ${lineNo}: невалиден статус „${cell(row, "status")}“`);
        continue;
      }
      const status = (statusRaw || "active") as "active" | "inactive";

      /* Категория по име: съществуваща се закача, нова → създава се (корен). */
      let categoryId: string | null = null;
      const categoryName = sanitizeText(cell(row, "category"), 60);
      if (categoryName) {
        const found = categoryByName.get(categoryName.toLowerCase());
        if (found) {
          categoryId = found;
        } else {
          const [created] = await tx
            .insert(categories)
            .values({ shopId: shop.id, name: categoryName })
            .returning({ id: categories.id });
          categoryId = created!.id;
          categoryByName.set(categoryName.toLowerCase(), created!.id);
        }
      }

      const values = {
        name,
        description: sanitizeMultiline(cell(row, "description"), 10_000),
        priceCents,
        promoPriceCents,
        stock,
        status,
        categoryId,
        updatedAt: new Date(),
      };

      const slug = slugify(cell(row, "slug")) || slugify(name) || "produkt";
      const existingId = bySlug.get(slug);
      if (existingId) {
        await tx.update(products).set(values).where(eq(products.id, existingId));
        if (oldStockById.get(existingId) === 0 && stock !== null && stock > 0) {
          restockedIds.push(existingId);
        }
        result.updated++;
      } else {
        if (productCount >= maxProducts) {
          result.skipped.push(`ред ${lineNo}: достигнат лимит продукти за плана`);
          continue;
        }
        const [created] = await tx
          .insert(products)
          .values({ ...values, shopId: shop.id, slug })
          .returning({ id: products.id });
        bySlug.set(slug, created!.id); /* дубликат по-надолу във файла → update */
        productCount++;
        result.created++;
      }
    }
  });

  /* S14: back-in-stock известия за върналите се в наличност (неблокиращо). */
  if (restockedIds.length > 0) void notifyStockAlerts(shop.id, restockedIds);

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  revalidateShop(shop.slug);
  return ok(result);
}

export async function toggleProductStatus(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалиден продукт.");

  const { shop } = await requireShop();
  const product = await ownProduct(parsed.data.id, shop.id);
  if (!product) return fail("Продуктът не съществува.");

  await db
    .update(products)
    .set({ status: product.status === "active" ? "inactive" : "active", updatedAt: new Date() })
    .where(eq(products.id, product.id));

  revalidatePath("/dashboard/products");
  revalidateShop(shop.slug);
  return ok(null);
}
