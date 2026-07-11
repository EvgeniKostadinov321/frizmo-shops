import { describe, expect, it } from "vitest";
import { buildProductFeed, escapeXml, type FeedProduct, type FeedShop } from "./product-feed";

const shop: FeedShop = { name: "Ателие „Роза“", slug: "atelie-roza" };
const BASE = "https://example.com";
const cats = new Map<string, string>([["cat-1", "Гривни"]]);

function product(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    id: "p-1",
    name: "Гривна",
    slug: "grivna",
    description: "Ръчна изработка",
    priceCents: 1250,
    promoPriceCents: null,
    stock: null,
    images: ["shops/s1/products/a.jpg"],
    weightGrams: null,
    categoryId: null,
    sku: null,
    gtin: null,
    brand: null,
    ...overrides,
  };
}

describe("escapeXml", () => {
  it("амперсанд първо", () => expect(escapeXml("a & b")).toBe("a &amp; b"));
  it("по-малко/по-голямо", () => expect(escapeXml("<b>")).toBe("&lt;b&gt;"));
  it("кавички", () => expect(escapeXml(`"x" 'y'`)).toBe("&quot;x&quot; &apos;y&apos;"));
  it("не двойно-escape-ва", () => expect(escapeXml("a & <b>")).toBe("a &amp; &lt;b&gt;"));
});

describe("buildProductFeed", () => {
  it("има XML пролог + rss + namespace + channel title", () => {
    const xml = buildProductFeed(shop, [product()], cats, BASE);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain("<title>Ателие „Роза“</title>");
  });

  it("продукт: id, title, цена в EUR, абсолютен link", () => {
    const xml = buildProductFeed(shop, [product()], cats, BASE);
    expect(xml).toContain("<g:id>p-1</g:id>");
    expect(xml).toContain("<g:title>Гривна</g:title>");
    expect(xml).toContain("<g:price>12.50 EUR</g:price>");
    expect(xml).toContain("<g:link>https://example.com/s/atelie-roza/p/grivna</g:link>");
  });

  it("sale_price само при промо", () => {
    expect(buildProductFeed(shop, [product({ promoPriceCents: 999 })], cats, BASE)).toContain(
      "<g:sale_price>9.99 EUR</g:sale_price>",
    );
    expect(buildProductFeed(shop, [product()], cats, BASE)).not.toContain("<g:sale_price>");
  });

  it("availability по наличност", () => {
    expect(buildProductFeed(shop, [product({ stock: 0 })], cats, BASE)).toContain(
      "<g:availability>out_of_stock</g:availability>",
    );
    expect(buildProductFeed(shop, [product({ stock: 5 })], cats, BASE)).toContain(
      "<g:availability>in_stock</g:availability>",
    );
    expect(buildProductFeed(shop, [product({ stock: null })], cats, BASE)).toContain(
      "<g:availability>in_stock</g:availability>",
    );
  });

  it("shipping_weight само при тегло", () => {
    expect(buildProductFeed(shop, [product({ weightGrams: 500 })], cats, BASE)).toContain(
      "<g:shipping_weight>500 g</g:shipping_weight>",
    );
    expect(buildProductFeed(shop, [product()], cats, BASE)).not.toContain("<g:shipping_weight>");
  });

  it("product_type само при категория", () => {
    expect(buildProductFeed(shop, [product({ categoryId: "cat-1" })], cats, BASE)).toContain(
      "<g:product_type>Гривни</g:product_type>",
    );
    expect(buildProductFeed(shop, [product()], cats, BASE)).not.toContain("<g:product_type>");
  });

  it("продукт без снимка се пропуска", () => {
    const xml = buildProductFeed(shop, [product({ id: "no-img", images: [] })], cats, BASE);
    expect(xml).not.toContain("<g:id>no-img</g:id>");
    expect(xml).not.toContain("<item>");
  });

  it("brand = име на магазина + identifier_exists=no + condition=new", () => {
    const xml = buildProductFeed(shop, [product()], cats, BASE);
    expect(xml).toContain("<g:brand>Ателие „Роза“</g:brand>");
    expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");
    expect(xml).toContain("<g:condition>new</g:condition>");
  });

  it("валиден GTIN → g:gtin + g:mpn + identifier_exists=yes", () => {
    const xml = buildProductFeed(
      shop,
      [product({ sku: "SKU1", gtin: "4006381333931" })],
      cats,
      BASE,
    );
    expect(xml).toContain("<g:gtin>4006381333931</g:gtin>");
    expect(xml).toContain("<g:mpn>SKU1</g:mpn>");
    expect(xml).toContain("<g:identifier_exists>yes</g:identifier_exists>");
  });

  it("без GTIN → identifier_exists=no, без g:gtin", () => {
    const xml = buildProductFeed(shop, [product({ sku: "SKU1" })], cats, BASE);
    expect(xml).toContain("<g:mpn>SKU1</g:mpn>");
    expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");
    expect(xml).not.toContain("<g:gtin>");
  });

  it("brand override побеждава името на магазина", () => {
    const xml = buildProductFeed(shop, [product({ brand: "Nike" })], cats, BASE);
    expect(xml).toContain("<g:brand>Nike</g:brand>");
    expect(xml).not.toContain("<g:brand>Ателие „Роза“</g:brand>");
  });

  it("без sku → без g:mpn", () => {
    const xml = buildProductFeed(shop, [product()], cats, BASE);
    expect(xml).not.toContain("<g:mpn>");
  });

  it("escape в title", () => {
    const xml = buildProductFeed(shop, [product({ name: "A & B <c>" })], cats, BASE);
    expect(xml).toContain("<g:title>A &amp; B &lt;c&gt;</g:title>");
  });

  it("допълнителни снимки", () => {
    const xml = buildProductFeed(shop, [product({ images: ["a.jpg", "b.jpg", "c.jpg"] })], cats, BASE);
    expect((xml.match(/<g:additional_image_link>/g) ?? []).length).toBe(2);
  });

  it("празен списък → валиден XML, 0 item", () => {
    const xml = buildProductFeed(shop, [], cats, BASE);
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});
