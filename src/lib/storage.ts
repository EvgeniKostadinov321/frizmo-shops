/** Работи и на сървъра, и в клиента (чете само NEXT_PUBLIC_ променлива). */

export const SHOP_MEDIA_BUCKET = "shop-media";
export const MAX_PRODUCT_IMAGES = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "avif"] as const;

export function publicImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${SHOP_MEDIA_BUCKET}/${path}`;
}

export function fileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}
