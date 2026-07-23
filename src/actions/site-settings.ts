"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, shops } from "@/db";
import { countProducts } from "@/db/queries/products";
import {
  publishSiteSettings as publishSiteSettingsQuery,
  saveSiteSettingsDraft,
} from "@/db/queries/site-settings";
import { shopCacheTag } from "@/db/queries/storefront";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { sanitizeMultiline } from "@/lib/sanitize";
import { SHOP_MEDIA_BUCKET } from "@/lib/storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { siteSettingsSchema, type SiteSettings } from "@/schemas/site-settings";

/** Инвалидира ПУБЛИЧНИЯ кеш на магазина (използвай само при промяна на
 *  published данни — НЕ при draft/preview записи). */
function revalidateShop(slug: string) {
  revalidateTag(shopCacheTag(slug), "max");
  revalidatePath(`/s/${slug}`, "layout");
}

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

/** Всички "shops/..." пътища в настройките трябва да са на този магазин.
    Функцията минава рекурсивно ВСЕКИ string (settings смесва пътища и свободен текст), затова
    не може да е чист allowlist — но освен чужд „shops/" път (одит #4 STG-03) хващаме и path
    traversal / подозрителни storage-подобни стойности, които не са на този магазин. */
function findForeignImagePath(value: unknown, prefix: string): boolean {
  if (typeof value === "string") {
    /* Чужд shops/ път ИЛИ traversal, който би могъл да излезе извън магазина. */
    if (value.startsWith("shops/") && !value.startsWith(prefix)) return true;
    if (value.includes("../") || value.startsWith("/shops/") || value.startsWith("shops/..")) return true;
    return false;
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

/**
 * „Запази“ — записва промените като ЧЕРНОВА. Клиентите НЕ ги виждат още;
 * само собственикът ги вижда в preview-то. За публикуване към клиентите се
 * ползва `publishSiteSettings`.
 */
export async function saveSiteSettings(raw: unknown): Promise<ActionResult> {
  const { shop } = await requireShop();
  const result = parseSettings(raw, shop.id);
  if (!result.ok) return fail(result.error);

  await saveSiteSettingsDraft(shop.id, result.settings);
  revalidatePath(`/s/${shop.slug}`, "layout");
  revalidatePath("/dashboard/website");
  return ok(null);
}

/**
 * „Публикувай промените“ — прави черновата видима за клиентите
 * (draft → settings). Отделно от `publishShop`, който сменя видимостта на
 * целия магазин (status). Магазин може да е публикуван, но с чернова промени,
 * които клиентите още не виждат — това ги пуска на живо.
 */
export async function publishSiteSettings(raw: unknown): Promise<ActionResult> {
  const { shop } = await requireShop();
  const result = parseSettings(raw, shop.id);
  if (!result.ok) return fail(result.error);

  await publishSiteSettingsQuery(shop.id, result.settings);
  revalidateShop(shop.slug); // публикуване → инвалидира публичния кеш
  revalidatePath("/dashboard/website");
  return ok(null);
}

/** Лек запис за live preview между explicit save-ове — пише в черновата. */
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

  const oldLogo = shop.logoPath;
  await db
    .update(shops)
    .set({ logoPath: parsed.data.path, updatedAt: new Date() })
    .where(eq(shops.id, shop.id));

  /* Orphan cleanup (одит #4 STG-01): старото лого се трие, ако е сменено/премахнато. */
  if (oldLogo && oldLogo !== parsed.data.path && oldLogo.startsWith(`shops/${shop.id}/`)) {
    try {
      await createSupabaseAdmin().storage.from(SHOP_MEDIA_BUCKET).remove([oldLogo]);
    } catch (e) {
      console.error(JSON.stringify({ scope: "orphan-logo", shopId: shop.id, error: String(e) }));
    }
  }

  revalidateShop(shop.slug);
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

  /* ЗЗП чл. 47 + Закон за е-търговията чл. 4: клиентът трябва да може да
     идентифицира и да се свърже с търговеца. Изискваме поне един канал за връзка
     + адрес за кореспонденция, преди магазинът да продава публично. */
  const hasContact = Boolean(shop.phone?.trim() || shop.email?.trim());
  const hasAddress = Boolean(shop.address?.trim());
  if (!hasContact || !hasAddress) {
    const missing = [
      !hasContact && "телефон или имейл за връзка",
      !hasAddress && "адрес",
    ].filter(Boolean).join(" и ");
    return fail(`Попълни ${missing} в настройките на магазина, преди да публикуваш (законово изискване).`);
  }

  await db
    .update(shops)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(shops.id, shop.id));

  revalidateShop(shop.slug);
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

  revalidateShop(shop.slug);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/website");
  return ok(null);
}
