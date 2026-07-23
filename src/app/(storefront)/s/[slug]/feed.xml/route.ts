import { getFeedProducts, getPublicShopCached, getShopCategoryNames } from "@/db/queries/storefront";
import { buildProductFeed } from "@/lib/product-feed";
import { siteUrl } from "@/lib/site-url";

/** ISR: feed-ът се кешира 1 час; инвалидира се при продуктова мутация чрез
    revalidateTag(shopCacheTag(slug)), който revalidateShop вече вика. */
export const revalidate = 3600;

/* Единствен източник на базовия URL + нормализира завършващ „/" (одит #4 SEO-04) — иначе
   продуктовите <g:link> в Google Merchant feed-а може да имат двоен слаш. */
const BASE_URL = siteUrl();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const result = await getPublicShopCached(slug);
  if (!result) {
    return new Response("Not found", { status: 404 });
  }
  const { shop } = result;

  const [products, categoryNames] = await Promise.all([
    getFeedProducts(shop.id),
    getShopCategoryNames(shop.id),
  ]);

  const xml = buildProductFeed(
    { name: shop.name, slug: shop.slug },
    products,
    categoryNames,
    BASE_URL,
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
