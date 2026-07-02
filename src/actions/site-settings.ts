"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, shops } from "@/db";
import { countProducts } from "@/db/queries/products";
import {
  saveSiteSettingsDraft,
  upsertSiteSettings,
} from "@/db/queries/site-settings";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { sanitizeMultiline } from "@/lib/sanitize";
import { siteSettingsSchema, type SiteSettings } from "@/schemas/site-settings";

/** Дълбока санитизация: всички string стойности минават през sanitizeMultiline. */
function deepSanitize<T>(value: T): T {
  if (typeof value === "string") return sanitizeMultiline(value, 10_000) as T;
  if (Array.isArray(value)) return value.map(deepSanitize) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepSanitize(v)]),
    ) as T;
  }
  return value;
}

/** Всички "shops/..." пътища в настройките трябва да са на този магазин. */
function findForeignImagePath(value: unknown, prefix: string): boolean {
  if (typeof value === "string") {
    return value.startsWith("shops/") && !value.startsWith(prefix);
  }
  if (Array.isArray(value)) return value.some((v) => findForeignImagePath(v, prefix));
  if (value && typeof value === "object") {
    return Object.values(value).some((v) => findForeignImagePath(v, prefix));
  }
  return false;
}

function parseSettings(raw: unknown, shopId: string):
  | { ok: true; settings: SiteSettings }
  | { ok: false; error: string } {
  const parsed = siteSettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Невалидни настройки. Опитай отново." };
  const settings = deepSanitize(parsed.data);
  if (findForeignImagePath(settings, `shops/${shopId}/`)) {
    return { ok: false, error: "Невалиден път на снимка." };
  }
  return { ok: true, settings };
}

export async function saveSiteSettings(raw: unknown): Promise<ActionResult> {
  const { shop } = await requireShop();
  const result = parseSettings(raw, shop.id);
  if (!result.ok) return fail(result.error);

  await upsertSiteSettings(shop.id, result.settings);
  revalidatePath(`/s/${shop.slug}`, "layout");
  revalidatePath("/dashboard/website");
  return ok(null);
}

/** Лек запис за live preview — не пипа официалните настройки. */
export async function savePreviewDraft(raw: unknown): Promise<ActionResult> {
  const { shop } = await requireShop();
  const result = parseSettings(raw, shop.id);
  if (!result.ok) return fail(result.error);

  await saveSiteSettingsDraft(shop.id, result.settings);
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok(null);
}

export async function setShopLogo(input: { path: string | null }): Promise<ActionResult> {
  const parsed = z.object({ path: z.union([z.string().max(300), z.null()]) }).safeParse(input);
  if (!parsed.success) return fail("Невалидно лого.");

  const { shop } = await requireShop();
  if (parsed.data.path && !parsed.data.path.startsWith(`shops/${shop.id}/`)) {
    return fail("Невалиден път на снимка.");
  }

  await db
    .update(shops)
    .set({ logoPath: parsed.data.path, updatedAt: new Date() })
    .where(eq(shops.id, shop.id));

  revalidatePath(`/s/${shop.slug}`, "layout");
  revalidatePath("/dashboard/website");
  return ok(null);
}

export async function publishShop(): Promise<ActionResult> {
  const { shop } = await requireShop();
  if (shop.status === "blocked") return fail("Магазинът е блокиран.");

  const productCount = await countProducts(shop.id);
  if (productCount === 0) {
    return fail("Добави поне един продукт, преди да публикуваш магазина.");
  }

  await db
    .update(shops)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(shops.id, shop.id));

  revalidatePath(`/s/${shop.slug}`, "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/website");
  return ok(null);
}

export async function unpublishShop(): Promise<ActionResult> {
  const { shop } = await requireShop();
  if (shop.status !== "published") return fail("Магазинът не е публикуван.");

  await db
    .update(shops)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(shops.id, shop.id));

  revalidatePath(`/s/${shop.slug}`, "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/website");
  return ok(null);
}
