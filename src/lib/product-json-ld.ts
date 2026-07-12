/**
 * Строи Product JSON-LD (schema.org) от вече-изчислени стойности. Чист —
 * без Date/IO (priceValidUntil се подава готов от server page-а, за да не
 * ползваме `new Date()` в тестван модул). Опционалните полета се включват
 * само ако са подадени.
 */

export interface ProductJsonLdInput {
  name: string;
  description: string;
  image?: string;
  priceEur: string;
  availability: "InStock" | "OutOfStock";
  brandName?: string;
  sku?: string;
  gtin?: string;
  ratingValue?: string;
  ratingCount?: number;
  weightGrams?: number;
  priceValidUntil?: string;
}

export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    priceCurrency: "EUR",
    price: input.priceEur,
    availability: `https://schema.org/${input.availability}`,
  };
  if (input.priceValidUntil) offers.priceValidUntil = input.priceValidUntil;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description.slice(0, 500),
    ...(input.image && { image: input.image }),
    ...(input.brandName && { brand: { "@type": "Brand", name: input.brandName } }),
    ...(input.sku && { sku: input.sku }),
    ...(input.gtin && { gtin13: input.gtin }),
    offers,
    ...(input.ratingValue &&
      input.ratingCount && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: input.ratingValue,
          reviewCount: input.ratingCount,
        },
      }),
    ...(input.weightGrams != null && {
      weight: { "@type": "QuantitativeValue", value: input.weightGrams, unitCode: "GRM" },
    }),
  };
}
