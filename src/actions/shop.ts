"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { db, shops } from "@/db";
import { getOwnShop, requireShop } from "@/lib/auth";
import { parseBgPhone } from "@/lib/phone";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import { insertShopWithUniqueSlug, previewShopSlug } from "@/lib/shop-slug";
import { shopSchema, type ShopInput } from "@/schemas/shop";

export type ShopFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function parseShopForm(formData: FormData) {
  /* Работното време пътува като JSON в скрито поле (структуриран редактор) */
  let workingHours: unknown = null;
  try {
    workingHours = JSON.parse(String(formData.get("workingHours") ?? "null"));
  } catch {
    workingHours = null;
  }

  return shopSchema.safeParse({
    name: formData.get("name"),
    businessCategory: formData.get("businessCategory"),
    description: formData.get("description") ?? "",
    city: formData.get("city") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    workingHours,
    facebook: formData.get("facebook") ?? "",
    instagram: formData.get("instagram") ?? "",
    tiktok: formData.get("tiktok") ?? "",
    youtube: formData.get("youtube") ?? "",
    viber: formData.get("viber") ?? "",
  });
}

function sanitizedValues(input: ShopInput) {
  /* Телефонът се съхранява нормализиран (E.164) — валидиран е от схемата */
  const phone = input.phone ? parseBgPhone(input.phone) : null;

  return {
    name: sanitizeText(input.name, 80),
    businessCategory: input.businessCategory,
    description: sanitizeMultiline(input.description, 2000),
    city: sanitizeText(input.city, 60),
    address: sanitizeText(input.address, 160),
    phone: phone?.ok ? phone.e164 : "",
    email: sanitizeText(input.email, 120),
    workingHours: input.workingHours,
    socialLinks: {
      facebook: sanitizeText(input.facebook, 200),
      instagram: sanitizeText(input.instagram, 200),
      tiktok: sanitizeText(input.tiktok, 200),
      youtube: sanitizeText(input.youtube, 200),
      viber: sanitizeText(input.viber, 200),
    },
  };
}

export async function createShop(
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  const parsed = parseShopForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { user, shop } = await getOwnShop();
  if (shop) return { error: "Вече имаш магазин." };

  const values = sanitizedValues(parsed.data);
  /* Retry при race: UNIQUE constraint-ът гарантира уникален slug, helper-ът го
     превръща в тихо `-2` вместо 500 при паралелно създаване. */
  await insertShopWithUniqueSlug(values.name, (slug) => ({
    ...values,
    slug,
    ownerId: user.id,
  }));

  /* Инвалидирай dashboard layout-а: той е рендериран с shop=null отпреди
     създаването (nav-ът е скрит). Без това soft navigation към /dashboard
     (напр. „Прескочи засега") показва празна странична навигация до презареждане. */
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/onboarding?step=2");
}

/**
 * Live preview на адреса при попълване на името (onboarding). Автентикиран
 * потребител без магазин; само чете. Връща предвидения slug + дали базовият е зает.
 */
export async function previewShopSlugAction(
  name: string,
): Promise<{ slug: string; taken: boolean } | null> {
  const trimmed = sanitizeText(String(name ?? ""), 80).trim();
  if (trimmed.length < 2) return null;
  /* Само логнат потребител (onboarding е зад auth) — без нужда от rate-limit. */
  await getOwnShop();
  return previewShopSlug(trimmed);
}

export async function updateShop(
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  const parsed = parseShopForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { shop } = await requireShop();
  await db
    .update(shops)
    .set({ ...sanitizedValues(parsed.data), updatedAt: new Date() })
    .where(eq(shops.id, shop.id));

  revalidatePath("/dashboard/store");
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return { ok: true };
}
