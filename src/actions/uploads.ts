"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { ALLOWED_IMAGE_EXT, SHOP_MEDIA_BUCKET } from "@/lib/storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const requestSchema = z.object({ ext: z.enum(ALLOWED_IMAGE_EXT) });

export async function requestProductImageUpload(input: {
  ext: string;
}): Promise<ActionResult<{ path: string; token: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail("Неподдържан формат на файла.");

  const { shop } = await requireShop();
  const path = `shops/${shop.id}/products/${randomUUID()}.${parsed.data.ext}`;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(SHOP_MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return fail("Качването е недостъпно в момента. Опитай пак.");

  return ok({ path: data.path, token: data.token });
}

export async function deleteProductImage(path: string): Promise<ActionResult> {
  const { shop } = await requireShop();
  if (!path.startsWith(`shops/${shop.id}/`)) return fail("Нямаш достъп до този файл.");

  const admin = createSupabaseAdmin();
  await admin.storage.from(SHOP_MEDIA_BUCKET).remove([path]);
  return ok(null);
}
