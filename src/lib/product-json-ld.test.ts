import { describe, expect, it } from "vitest";
import { buildProductJsonLd } from "./product-json-ld";

const base = {
  name: "Краве сирене",
  description: "Прясно краве сирене от ферма.",
  priceEur: "12.50",
  availability: "InStock" as const,
};

describe("buildProductJsonLd", () => {
  it("строи минимален валиден Product", () => {
    const r = buildProductJsonLd(base);
    expect(r["@type"]).toBe("Product");
    expect(r.name).toBe("Краве сирене");
    const offers = r.offers as Record<string, unknown>;
    expect(offers.price).toBe("12.50");
    expect(offers.availability).toBe("https://schema.org/InStock");
  });

  it("добавя brand само ако е подаден", () => {
    expect("brand" in buildProductJsonLd(base)).toBe(false);
    const r = buildProductJsonLd({ ...base, brandName: "Моята марка" });
    expect(r.brand).toEqual({ "@type": "Brand", name: "Моята марка" });
  });

  it("добавя sku и gtin13 само ако са подадени", () => {
    const r = buildProductJsonLd({ ...base, sku: "ABC-1", gtin: "5901234123457" });
    expect(r.sku).toBe("ABC-1");
    expect(r.gtin13).toBe("5901234123457");
    expect("sku" in buildProductJsonLd(base)).toBe(false);
    expect("gtin13" in buildProductJsonLd(base)).toBe(false);
  });

  it("OutOfStock се отразява", () => {
    const r = buildProductJsonLd({ ...base, availability: "OutOfStock" });
    const offers = r.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("priceValidUntil се включва само ако е подаден (без Date в helper-а)", () => {
    expect("priceValidUntil" in (buildProductJsonLd(base).offers as object)).toBe(false);
    const r = buildProductJsonLd({ ...base, priceValidUntil: "2027-07-12" });
    expect((r.offers as Record<string, unknown>).priceValidUntil).toBe("2027-07-12");
  });

  it("aggregateRating + weight условно", () => {
    expect("aggregateRating" in buildProductJsonLd(base)).toBe(false);
    const r = buildProductJsonLd({ ...base, ratingValue: "4.5", ratingCount: 8, weightGrams: 500 });
    expect(r.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "4.5",
      reviewCount: 8,
    });
    expect(r.weight).toEqual({ "@type": "QuantitativeValue", value: 500, unitCode: "GRM" });
  });
});
