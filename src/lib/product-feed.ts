import { publicImageUrl } from "@/lib/storage";

export interface FeedShop {
  name: string;
  slug: string;
}

export interface FeedProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  promoPriceCents: number | null;
  stock: number | null;
  images: string[];
  weightGrams: number | null;
  categoryId: string | null;
  sku: string | null;
  gtin: string | null;
  brand: string | null;
}

/** XML escape — редът е важен (& първо, иначе двойно-escape). */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Маха HTML тагове и нормализира whitespace (описанието трябва да е plain text). */
export function plainText(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const price = (cents: number) => `${(cents / 100).toFixed(2)} EUR`;

/** RSS 2.0 + Google namespace feed. Продукт без снимка се пропуска. Чиста функция. */
export function buildProductFeed(
  shop: FeedShop,
  products: FeedProduct[],
  categoryNames: Map<string, string>,
  baseUrl: string,
): string {
  const items: string[] = [];
  let skippedNoImage = 0;

  for (const p of products) {
    if (p.images.length === 0) {
      skippedNoImage++;
      continue;
    }
    const inStock = p.stock === null || p.stock > 0;
    const lines: string[] = [
      `<g:id>${escapeXml(p.id)}</g:id>`,
      `<g:title>${escapeXml(p.name)}</g:title>`,
      `<g:description>${escapeXml(plainText(p.description).slice(0, 5000))}</g:description>`,
      `<g:link>${baseUrl}/s/${shop.slug}/p/${p.slug}</g:link>`,
      `<g:image_link>${publicImageUrl(p.images[0]!)}</g:image_link>`,
    ];
    for (const img of p.images.slice(1, 11)) {
      lines.push(`<g:additional_image_link>${publicImageUrl(img)}</g:additional_image_link>`);
    }
    lines.push(`<g:availability>${inStock ? "in_stock" : "out_of_stock"}</g:availability>`);
    lines.push(`<g:price>${price(p.priceCents)}</g:price>`);
    if (p.promoPriceCents !== null) {
      lines.push(`<g:sale_price>${price(p.promoPriceCents)}</g:sale_price>`);
    }
    if (p.sku) lines.push(`<g:mpn>${escapeXml(p.sku)}</g:mpn>`);
    if (p.gtin) lines.push(`<g:gtin>${escapeXml(p.gtin)}</g:gtin>`);
    lines.push(`<g:brand>${escapeXml(p.brand ?? shop.name)}</g:brand>`);
    lines.push(`<g:condition>new</g:condition>`);
    lines.push(`<g:identifier_exists>${p.gtin ? "yes" : "no"}</g:identifier_exists>`);
    if (p.weightGrams !== null) {
      lines.push(`<g:shipping_weight>${p.weightGrams} g</g:shipping_weight>`);
    }
    if (p.categoryId) {
      const catName = categoryNames.get(p.categoryId);
      if (catName) lines.push(`<g:product_type>${escapeXml(catName)}</g:product_type>`);
    }
    items.push(`    <item>\n      ${lines.join("\n      ")}\n    </item>`);
  }

  if (skippedNoImage > 0) {
    console.warn(
      JSON.stringify({ event: "product_feed_skipped_no_image", shop: shop.slug, count: skippedNoImage }),
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(shop.name)}</title>
    <link>${baseUrl}/s/${shop.slug}</link>
    <description>Продукти от ${escapeXml(shop.name)}</description>
${items.join("\n")}
  </channel>
</rss>`;
}
