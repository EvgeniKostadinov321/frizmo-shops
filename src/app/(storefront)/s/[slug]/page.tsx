import { desc, eq, and } from "drizzle-orm";
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
import { jsonLdHtml } from "@/lib/json-ld";
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

/**
 * Зарежда продуктите за всички featured-products секции с ЕДНА заявка (без
 * N+1 per секция): тегли активните продукти веднъж — най-новите + изрично
 * посочените в manual секции — и ги разпределя по секция в JS.
 */
async function loadSectionProducts(
  shopId: string,
  sections: Section[],
): Promise<Record<string, Product[]>> {
  const featured = sections.filter(
    (s): s is Extract<Section, { type: "featured-products" }> =>
      s.type === "featured-products" && s.enabled,
  );
  if (featured.length === 0) return {};

  /* Обединяваме нуждите: всички manual id-та + достатъчно най-нови за auto
     секциите (всяка auto секция показва до 8). Една заявка ги покрива всички. */
  const manualIds = new Set<string>();
  let autoNeeded = 0;
  for (const s of featured) {
    if (s.data.mode === "manual") s.data.productIds.forEach((id) => manualIds.add(id));
    else autoNeeded = Math.max(autoNeeded, 8);
  }

  const rows = await db.query.products.findMany({
    where: and(eq(products.shopId, shopId), eq(products.status, "active")),
    orderBy: [desc(products.createdAt)],
    /* Достатъчно за най-голямата auto секция + всички ръчно посочени. */
    limit: Math.max(autoNeeded, manualIds.size) + manualIds.size,
  });
  const byId = new Map(rows.map((p) => [p.id, p]));

  const result: Record<string, Product[]> = {};
  for (const section of featured) {
    const { mode, productIds } = section.data;
    if (mode === "manual") {
      result[section.id] = productIds
        .map((id) => byId.get(id))
        .filter((p): p is Product => Boolean(p));
    } else {
      const pool = mode === "promo" ? rows.filter((p) => p.promoPriceCents !== null) : rows;
      result[section.id] = pool.slice(0, 8);
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
          __html: jsonLdHtml({
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
