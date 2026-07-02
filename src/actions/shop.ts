"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { db, shops } from "@/db";
import { getOwnShop, requireShop } from "@/lib/auth";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import { generateUniqueShopSlug } from "@/lib/shop-slug";
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
  return shopSchema.safeParse({
    name: formData.get("name"),
    businessCategory: formData.get("businessCategory"),
    description: formData.get("description") ?? "",
    city: formData.get("city") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    workingHoursText: formData.get("workingHoursText") ?? "",
    facebook: formData.get("facebook") ?? "",
    instagram: formData.get("instagram") ?? "",
  });
}

function sanitizedValues(input: ShopInput) {
  return {
    name: sanitizeText(input.name, 80),
    businessCategory: input.businessCategory,
    description: sanitizeMultiline(input.description, 2000),
    city: sanitizeText(input.city, 60),
    address: sanitizeText(input.address, 160),
    phone: sanitizeText(input.phone, 30),
    email: sanitizeText(input.email, 120),
    workingHours: { text: sanitizeText(input.workingHoursText, 300) },
    socialLinks: {
      facebook: sanitizeText(input.facebook, 200),
      instagram: sanitizeText(input.instagram, 200),
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
  const slug = await generateUniqueShopSlug(values.name);
  await db.insert(shops).values({ ...values, slug, ownerId: user.id });

  redirect("/dashboard/onboarding?step=2");
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
  return { ok: true };
}
