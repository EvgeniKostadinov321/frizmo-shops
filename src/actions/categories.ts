"use server";

import { and, asc, eq, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categories, db } from "@/db";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";
import { categorySchema } from "@/schemas/category";

async function ownCategory(id: string, shopId: string) {
  const category = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  return category && category.shopId === shopId ? category : null;
}

function siblingFilter(shopId: string, parentId: string | null) {
  return and(
    eq(categories.shopId, shopId),
    parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId),
  );
}

export async function createCategory(input: {
  name: string;
  parentId: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const parentId = parsed.data.parentId || null;

  if (parentId) {
    const parent = await ownCategory(parentId, shop.id);
    if (!parent) return fail("Родителската категория не съществува.");
    if (parent.parentId) return fail("Подкатегория не може да има свои подкатегории.");
  }

  const [orderRow] = await db
    .select({ maxOrder: max(categories.sortOrder) })
    .from(categories)
    .where(siblingFilter(shop.id, parentId));
  const maxOrder = orderRow?.maxOrder ?? null;

  const [created] = await db
    .insert(categories)
    .values({
      shopId: shop.id,
      parentId,
      name: sanitizeText(parsed.data.name, 60),
      sortOrder: (maxOrder ?? 0) + 1,
    })
    .returning({ id: categories.id });

  revalidatePath("/dashboard/categories");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok({ id: created!.id });
}

export async function updateCategory(input: {
  id: string;
  name: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), name: categorySchema.shape.name })
    .safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const category = await ownCategory(parsed.data.id, shop.id);
  if (!category) return fail("Категорията не съществува.");

  await db
    .update(categories)
    .set({ name: sanitizeText(parsed.data.name, 60), updatedAt: new Date() })
    .where(eq(categories.id, category.id));

  revalidatePath("/dashboard/categories");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok(null);
}

export async function deleteCategory(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалидна категория.");

  const { shop } = await requireShop();
  const category = await ownCategory(parsed.data.id, shop.id);
  if (!category) return fail("Категорията не съществува.");

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ parentId: null })
      .where(eq(categories.parentId, category.id));
    await tx.delete(categories).where(eq(categories.id, category.id));
  });

  revalidatePath("/dashboard/categories");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok(null);
}

export async function moveCategory(input: {
  id: string;
  direction: "up" | "down";
}): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), direction: z.enum(["up", "down"]) })
    .safeParse(input);
  if (!parsed.success) return fail("Невалидна заявка.");

  const { shop } = await requireShop();
  const category = await ownCategory(parsed.data.id, shop.id);
  if (!category) return fail("Категорията не съществува.");

  const siblings = await db.query.categories.findMany({
    where: siblingFilter(shop.id, category.parentId),
    orderBy: [asc(categories.sortOrder), asc(categories.createdAt)],
  });

  const index = siblings.findIndex((s) => s.id === category.id);
  const targetIndex = parsed.data.direction === "up" ? index - 1 : index + 1;
  const neighbor = siblings[targetIndex];
  if (!neighbor) return ok(null); // вече е в края — нищо за местене

  /* Гарантирано различни стойности при разменени равни sortOrder-и */
  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ sortOrder: targetIndex + 1 })
      .where(eq(categories.id, category.id));
    await tx
      .update(categories)
      .set({ sortOrder: index + 1 })
      .where(eq(categories.id, neighbor.id));
  });

  revalidatePath("/dashboard/categories");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok(null);
}
