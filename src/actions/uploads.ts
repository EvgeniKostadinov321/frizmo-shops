"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import {
  ALLOWED_IMAGE_EXT,
  ALLOWED_VIDEO_EXT,
  SHOP_MEDIA_BUCKET,
} from "@/lib/storage";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/* Разрешените разширения зависят от kind: video приема mp4/webm, останалите —
   снимкови формати. */
const requestSchema = z
  .object({
    ext: z.string(),
    kind: z.enum(["product", "branding", "site", "video"]).default("product"),
  })
  .refine(
    (v) =>
      v.kind === "video"
        ? (ALLOWED_VIDEO_EXT as readonly string[]).includes(v.ext)
        : (ALLOWED_IMAGE_EXT as readonly string[]).includes(v.ext),
    { message: "Неподдържан формат на файла." },
  );

/** Подписан upload URL след ownership проверка. kind определя папката. */
export async function requestImageUpload(input: {
  ext: string;
  kind?: string;
}): Promise<ActionResult<{ path: string; token: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail("Неподдържан формат на файла.");

  const { shop } = await requireShop();
  const folder = {
    product: "products",
    branding: "branding",
    site: "site",
    video: "video",
  }[parsed.data.kind];
  const path = `shops/${shop.id}/${folder}/${randomUUID()}.${parsed.data.ext}`;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(SHOP_MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return fail("Качването е недостъпно в момента. Опитай пак.");

  return ok({ path: data.path, token: data.token });
}

/** Съвместимост със съществуващите форми (продуктови снимки). */
export async function requestProductImageUpload(input: {
  ext: string;
}): Promise<ActionResult<{ path: string; token: string }>> {
  return requestImageUpload({ ...input, kind: "product" });
}

export async function deleteProductImage(path: string): Promise<ActionResult> {
  const { shop } = await requireShop();
  if (!path.startsWith(`shops/${shop.id}/`)) return fail("Нямаш достъп до този файл.");

  const admin = createSupabaseAdmin();
  await admin.storage.from(SHOP_MEDIA_BUCKET).remove([path]);
  return ok(null);
}
