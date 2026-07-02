"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  categories,
  db,
  productAttributes,
  productOptions,
  products,
  productVariants,
} from "@/db";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { toCents } from "@/lib/money";
import { getShopPlan, PLAN_LIMITS } from "@/lib/plan";
import { generateUniqueProductSlug } from "@/lib/product-slug";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import { SHOP_MEDIA_BUCKET } from "@/lib/storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { countProducts } from "@/db/queries/products";
import { productSchema, type ProductInput } from "@/schemas/product";

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
) {
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
      await insertRelations(tx, created!.id, input);
      return created!.id;
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard");
    return ok({ id });
  }

  const product = await ownProduct(productId, shop.id);
  if (!product) return fail("Продуктът не съществува.");

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set(productValues(input, shop.id))
      .where(eq(products.id, product.id));
    await tx.delete(productAttributes).where(eq(productAttributes.productId, product.id));
    await tx.delete(productOptions).where(eq(productOptions.productId, product.id));
    await tx.delete(productVariants).where(eq(productVariants.productId, product.id));
    await insertRelations(tx, product.id, input);
  });

  revalidatePath("/dashboard/products");
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
  return ok(null);
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
  return ok(null);
}
