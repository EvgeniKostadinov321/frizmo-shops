import { getFeedProducts, getPublicShopCached, getShopCategoryNames } from "@/db/queries/storefront";
import { buildProductFeed } from "@/lib/product-feed";

/** ISR: feed-ът се кешира 1 час; инвалидира се при продуктова мутация чрез
    revalidateTag(shopCacheTag(slug)), който revalidateShop вече вика. */
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://frizmo-shops.vercel.app";

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
