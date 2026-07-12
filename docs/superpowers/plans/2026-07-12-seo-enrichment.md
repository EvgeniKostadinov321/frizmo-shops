# SEO Enrichment Implementation Plan (Пакет A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Обогатяване на SEO метаданните — Twitter/OG cards глобално, Product JSON-LD (brand/sku/gtin/priceValidUntil), липсващи description/OG на 5 публични страници.

**Architecture:** Root layout получава OG/Twitter дефолти (мержват се надолу). Product schema логиката се изнася в тествана чиста функция `buildProductJsonLd`. Пет `generateMetadata`/`metadata` получават липсващите полета. Нула промяна в логика/данни/рендер.

**Tech Stack:** Next.js 16 Metadata API, JSON-LD (schema.org), Vitest, TypeScript.

## Global Constraints

- Нула хардкоднати домейни (ползвай `siteUrl()` ако трябва абсолютен URL).
- `new Date()` НЕ в тествани/helper модули (проектна конвенция) — датите се смятат в server page-а и се подават като параметри.
- JSON-LD през `jsonLdHtml()` от `src/lib/json-ld.ts` (XSS-safe сериализатор).
- Условни полета: добавяй schema поле САМО ако данните ги има (нула празни/грешни към Google).
- UI/текст на български; строг TypeScript. Гейт: `pnpm check`. Push към `dev` само с разрешение.

## File Structure

- `src/lib/product-json-ld.ts` (NEW) — `buildProductJsonLd()` чиста функция.
- `src/lib/product-json-ld.test.ts` (NEW) — Vitest тестове.
- `src/app/layout.tsx` (MODIFY) — OG/Twitter дефолти в root metadata.
- `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx` (MODIFY) — ползва buildProductJsonLd.
- `src/app/(storefront)/s/[slug]/products/page.tsx` (MODIFY) — description + OG.
- `src/app/(storefront)/s/[slug]/about/page.tsx` (MODIFY) — description + OG.
- `src/app/(storefront)/s/[slug]/contact/page.tsx` (MODIFY) — description + OG.
- `src/app/(catalog)/products/page.tsx` + `(catalog)/shops/page.tsx` (MODIFY) — openGraph.

---

### Task 1: `buildProductJsonLd` чиста функция

**Files:**
- Create: `src/lib/product-json-ld.ts`
- Create: `src/lib/product-json-ld.test.ts`

**Interfaces:**
- Produces:
  - `interface ProductJsonLdInput { name: string; description: string; image?: string; priceEur: string; availability: "InStock" | "OutOfStock"; brandName?: string; sku?: string; gtin?: string; ratingValue?: string; ratingCount?: number; weightGrams?: number; priceValidUntil?: string }`
  - `function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown>`
  - Всички опционални полета се включват само ако са truthy/подадени.

- [ ] **Step 1: Write the failing test**

Създай `src/lib/product-json-ld.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- product-json-ld`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

Създай `src/lib/product-json-ld.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- product-json-ld`
Expected: PASS (6 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/product-json-ld.ts src/lib/product-json-ld.test.ts
git commit -F - <<'EOF'
feat(seo): buildProductJsonLd чиста функция (brand/sku/gtin/priceValidUntil)

Изнесена schema логика, TDD. Опционалните полета условни; priceValidUntil
се подава готов (без Date в тестван модул).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Продуктовата страница ползва buildProductJsonLd

**Files:**
- Modify: `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx:89-118`

**Interfaces:**
- Consumes: `buildProductJsonLd` от `@/lib/product-json-ld`.

- [ ] **Step 1: Replace inline JSON-LD**

Импортирай: `import { buildProductJsonLd } from "@/lib/product-json-ld";`

Преди `return` (след `const inStock = ...`, ред 85), смятай priceValidUntil (server-side, ~1 година напред):
```tsx
  /* priceValidUntil ~1 година напред (Google предупреждава за offers без нея).
     Смята се тук (server), не в чистата функция (без new Date в тестван модул). */
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  const priceValidUntil = validUntil.toISOString().slice(0, 10);
```

Замени `<script type="application/ld+json" ...>` блока (редове 89-118) с:
```tsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            buildProductJsonLd({
              name: product.name,
              description: product.description,
              image: product.images[0] ? publicImageUrl(product.images[0]) : undefined,
              priceEur: (effectivePrice / 100).toFixed(2),
              availability: inStock ? "InStock" : "OutOfStock",
              brandName: product.brand || result.shop.name,
              sku: product.sku || undefined,
              gtin: product.gtin || undefined,
              ratingValue: rating ? rating.avg.toFixed(1) : undefined,
              ratingCount: rating ? rating.count : undefined,
              weightGrams: product.weightGrams ?? undefined,
              priceValidUntil,
            }),
          ),
        }}
      />
```

**Внимание:** провери имената на полетата в `product` обекта (`product.brand`, `product.sku`, `product.gtin`, `product.weightGrams`, `product.images`, `product.promoPriceCents`) — те са в query select-а (`storefront.ts:312-314` за sku/gtin/brand). `result.shop.name` е fallback за brand. Ако някое поле липсва в типа → добави го в query select или махни от input-а.

- [ ] **Step 2: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. Провери, че старият inline schema обект е премахнат (няма дублиране).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx"
git commit -F - <<'EOF'
feat(seo): продуктовата страница ползва buildProductJsonLd (brand/sku/gtin)

Product JSON-LD обогатена с марка/SKU/баркод + priceValidUntil.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Root OG/Twitter дефолти

**Files:**
- Modify: `src/app/layout.tsx:33`

**Interfaces:**
- Consumes: нищо ново.

- [ ] **Step 1: Add openGraph + twitter to root metadata**

В `src/app/layout.tsx`, в `export const metadata: Metadata = { ... }` (започва ред 33, има `metadataBase`, `title`, `description`, `applicationName`, `appleWebApp`), добави `openGraph` + `twitter` полета:

```ts
  openGraph: {
    type: "website",
    siteName: "Frizmo Shops",
    locale: "bg_BG",
  },
  twitter: {
    card: "summary_large_image",
  },
```

(Постави ги вътре в обекта, напр. след `description`. Не пипай съществуващите полета.)

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -F - <<'EOF'
feat(seo): глобални OpenGraph + Twitter card дефолти

Root metadata → всички страници наследяват OG type/siteName/locale +
twitter summary_large_image. Страниците със свой generateMetadata допълват.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Липсващи description/OG на 5 страници

**Files:**
- Modify: `src/app/(storefront)/s/[slug]/products/page.tsx:37`
- Modify: `src/app/(storefront)/s/[slug]/about/page.tsx:15`
- Modify: `src/app/(storefront)/s/[slug]/contact/page.tsx:16`
- Modify: `src/app/(catalog)/products/page.tsx:9`
- Modify: `src/app/(catalog)/shops/page.tsx:7`

**Interfaces:**
- Consumes: нищо ново.

- [ ] **Step 1: storefront products**

`s/[slug]/products/page.tsx` `generateMetadata` — добави `description` + `openGraph` (запази съществуващия canonical):
```ts
  return {
    title: `Продукти — ${result.shop.name}`,
    description: `Разгледай всички продукти от ${result.shop.name}.`,
    alternates: { canonical: `/s/${slug}/products` },
    openGraph: {
      title: `Продукти — ${result.shop.name}`,
      description: `Разгледай всички продукти от ${result.shop.name}.`,
    },
  };
```

- [ ] **Step 2: about**

`s/[slug]/about/page.tsx` `generateMetadata`:
```ts
  const desc = result.shop.description?.slice(0, 160) || `Научи повече за ${result.shop.name}.`;
  return {
    title: `За нас — ${result.shop.name}`,
    description: desc,
    openGraph: { title: `За нас — ${result.shop.name}`, description: desc },
  };
```
(Провери точното име: `result.shop.description` — от `getPublicShop`.)

- [ ] **Step 3: contact**

`s/[slug]/contact/page.tsx` `generateMetadata`:
```ts
  const desc = `Свържи се с ${result.shop.name} — телефон, имейл и адрес.`;
  return {
    title: `Контакти — ${result.shop.name}`,
    description: desc,
    openGraph: { title: `Контакти — ${result.shop.name}`, description: desc },
  };
```

- [ ] **Step 4: catalog products + shops**

`(catalog)/products/page.tsx` — добави `openGraph` към статичния `metadata` (title/description вече ги има):
```ts
export const metadata: Metadata = {
  title: "Продукти от малки български бизнеси — Frizmo Shops",
  description:
    "Разгледай продуктите на всички магазини във Frizmo Shops: храни, дрехи, ръчна изработка и още.",
  openGraph: {
    title: "Продукти от малки български бизнеси — Frizmo Shops",
    description:
      "Разгледай продуктите на всички магазини във Frizmo Shops: храни, дрехи, ръчна изработка и още.",
  },
};
```

`(catalog)/shops/page.tsx` — аналогично `openGraph` с неговите title/description.

- [ ] **Step 5: Full gate**

Run: `pnpm check`
Expected: PASS (lint + unit вкл. product-json-ld тестове + build).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(storefront)/s/[slug]/products/page.tsx" "src/app/(storefront)/s/[slug]/about/page.tsx" "src/app/(storefront)/s/[slug]/contact/page.tsx" "src/app/(catalog)/products/page.tsx" "src/app/(catalog)/shops/page.tsx"
git commit -F - <<'EOF'
feat(seo): липсващи description + OpenGraph на 5 публични страници

storefront products/about/contact + catalog products/shops получават
meta description и openGraph за по-добри Google резултати и споделяне.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

- [ ] **Step 7: Валидация (потребител)**

Съобщи на потребителя:
- Google Rich Results Test (продуктов прод URL) → Product schema минава с brand/sku/availability.
- OG preview на живо иска активен домейн/прод (соц. мрежите не виждат localhost).
- Meta description на about/contact/products в `<head>` (view source).

Push към `dev` (=prod) само след разрешение.

---

## Notes for the implementer

- Всички schema полета условни — нула празни/грешни към Google.
- `priceValidUntil` се смята в server page-а (не в helper-а — `new Date()` забрана).
- Метаданните се мержват надолу; root дефолтите не се дублират в под-страниците (само специфичното).
- Не пипай `availability` логиката — вече съществуваше и работи.
