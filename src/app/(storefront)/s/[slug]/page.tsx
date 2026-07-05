import { desc, eq, inArray, isNotNull, and } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, products, type Product } from "@/db";
import {
  getCategoryCovers,
  getPublicCategories,
  getPublicShop,
} from "@/db/queries/storefront";
import { renderSections, type SectionContext } from "@/components/storefront/sections";
import { publicImageUrl } from "@/lib/storage";
import type { Section } from "@/schemas/site-settings";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  const { shop } = result;
  return {
    title: `${shop.name} — онлайн магазин`,
    description: shop.description.slice(0, 160) || `Онлайн магазинът на ${shop.name}`,
    openGraph: {
      title: shop.name,
      description: shop.description.slice(0, 160),
      ...(shop.logoPath && { images: [publicImageUrl(shop.logoPath)] }),
    },
  };
}

/** Зарежда продуктите за всички featured-products секции наведнъж. */
async function loadSectionProducts(
  shopId: string,
  sections: Section[],
): Promise<Record<string, Product[]>> {
  const result: Record<string, Product[]> = {};
  for (const section of sections) {
    if (section.type !== "featured-products" || !section.enabled) continue;
    const { mode, productIds } = section.data;
    if (mode === "manual" && productIds.length > 0) {
      const items = await db.query.products.findMany({
        where: and(
          eq(products.shopId, shopId),
          eq(products.status, "active"),
          inArray(products.id, productIds),
        ),
      });
      /* пази реда от настройките */
      result[section.id] = productIds
        .map((id) => items.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p));
    } else {
      result[section.id] = await db.query.products.findMany({
        where: and(
          eq(products.shopId, shopId),
          eq(products.status, "active"),
          mode === "promo" ? isNotNull(products.promoPriceCents) : undefined,
        ),
        orderBy: [desc(products.createdAt)],
        limit: 8,
      });
    }
  }
  return result;
}

export default async function StorefrontHomePage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop, settings } = result;

  /* Кориците трябват само ако има активна category-grid секция. */
  const needsCovers = settings.sections.some(
    (s) => s.type === "category-grid" && s.enabled,
  );
  const [productsBySection, categories, categoryCovers] = await Promise.all([
    loadSectionProducts(shop.id, settings.sections),
    getPublicCategories(shop.id),
    needsCovers ? getCategoryCovers(shop.id) : Promise.resolve({}),
  ]);

  const ctx: SectionContext = {
    shop,
    base: `/s/${shop.slug}`,
    productsBySection,
    categories,
    categoryCovers,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: shop.name,
            description: shop.description,
            ...(shop.phone && { telephone: shop.phone }),
            ...(shop.address && {
              address: { "@type": "PostalAddress", streetAddress: shop.address, addressLocality: shop.city ?? "" },
            }),
          }),
        }}
      />
      {renderSections(settings.sections, ctx)}
    </>
  );
}
