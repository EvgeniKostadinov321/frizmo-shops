"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, sizeGuides } from "@/db";
import { shopCacheTag } from "@/db/queries/storefront";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";
import { sizeGuideSchema } from "@/schemas/size-guide";

function revalidate(slug: string) {
  revalidateTag(shopCacheTag(slug), "max");
  revalidatePath("/dashboard/size-guides");
  revalidatePath(`/s/${slug}`, "layout");
}

export async function saveSizeGuide(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = sizeGuideSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const values = {
    name: sanitizeText(parsed.data.name, 60),
    columns: parsed.data.columns.map((c) => sanitizeText(c, 40)),
    rows: parsed.data.rows.map((r) => r.map((cell) => sanitizeText(cell, 40))),
    updatedAt: new Date(),
  };

  if (id === null) {
    await db.insert(sizeGuides).values({ ...values, shopId: shop.id });
  } else {
    const guide = await db.query.sizeGuides.findFirst({ where: eq(sizeGuides.id, id) });
    if (!guide || guide.shopId !== shop.id) return fail("Таблицата не съществува.");
    await db
      .update(sizeGuides)
      .set(values)
      .where(and(eq(sizeGuides.id, id), eq(sizeGuides.shopId, shop.id)));
  }

  revalidate(shop.slug);
  return ok(null);
}

export async function deleteSizeGuide(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалидна таблица.");
  const { shop } = await requireShop();
  const guide = await db.query.sizeGuides.findFirst({ where: eq(sizeGuides.id, parsed.data.id) });
  if (!guide || guide.shopId !== shop.id) return fail("Таблицата не съществува.");
  await db
    .delete(sizeGuides)
    .where(and(eq(sizeGuides.id, guide.id), eq(sizeGuides.shopId, shop.id)));
  revalidate(shop.slug);
  return ok(null);
}
