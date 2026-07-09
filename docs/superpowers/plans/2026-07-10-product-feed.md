# Product feed (Google Merchant / Facebook) — план за имплементация

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (INLINE изпълнение — проектното правило забранява паралелни субагенти). Стъпките ползват checkbox (`- [ ]`) синтаксис за проследяване.

**Goal:** Всеки published магазин да има автоматично генериран XML product feed на `/s/{slug}/feed.xml` (Google Merchant + Facebook каталог), нула конфигурация, + ред с копирай бутон в настройките.

**Architecture:** Dynamic route handler с ISR кеш (`revalidate=3600`, инвалидира се при продуктова мутация чрез съществуващия `revalidateShop`). Чиста функция `buildProductFeed` строи RSS 2.0 + Google namespace XML от активните продукти. Нула нови колони/полета/cron.

**Tech Stack:** Next.js 16 (App Router, route handlers), Drizzle ORM + Supabase Postgres, Vitest, pnpm.

**Източник (спец):** `docs/superpowers/specs/2026-07-10-product-feed-design.md`

## Global Constraints

- **Нула конфиг:** без нови колони, без нови задължителни полета, без cron/Storage. Feed-ът е automation върху съществуващите данни.
- **`identifier_exists=no`**, **`g:brand` = името на магазина**, **`g:condition=new`**, един ред на продукт.
- **Само published магазини** имат feed; draft/suspended → `404`. Продукт без снимка се пропуска (Google иска `image_link`).
- **XML escape задължителен** на всички текстови стойности (`&` първо, после `<>"'`).
- **Пари:** цени от integer центове → `(cents/100).toFixed(2)` + `" EUR"`. Тегло → `"{weightGrams} g"`.
- **Base URL:** `process.env.NEXT_PUBLIC_SITE_URL || "https://frizmo-shops.vercel.app"` (както sitemap/email).
- **Строг TypeScript** (без `as any`); само `@/components/ui` компоненти в UI (без голи елементи, без емоджита, touch ≥44px).
- **UI текст на български**, типографски кавички „…“ (прав `"` чупи lint/JS).
- **Гейт преди commit:** `pnpm check` (lint + unit + build). Сканирай за контролни символи `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`.
- **Git:** работим на `dev` (= Vercel production). Push САМО след изрично разрешение. Всеки commit завършва с `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Без Playwright визуални тестове** — UI се проверява ръчно от потребителя; тестваме само логиката (Vitest).

---

### Task 1: XML билдър `escapeXml` + `buildProductFeed` (TDD)

**Files:**
- Create: `src/lib/product-feed.ts`
- Test: `src/lib/product-feed.test.ts`

**Interfaces:**
- Consumes: `publicImageUrl` от `@/lib/storage`.
- Produces:
  - `escapeXml(s: string): string`
  - `plainText(s: string): string` (маха HTML тагове + нормализира whitespace)
  - типове `FeedShop`, `FeedProduct`
  - `buildProductFeed(shop: FeedShop, products: FeedProduct[], categoryNames: Map<string,string>, baseUrl: string): string`

- [ ] **Стъпка 1: Напиши failing тестове**

Create `src/lib/product-feed.test.ts`:
```ts
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
```

- [ ] **Стъпка 2: Пусни — трябва да СЕ ПРОВАЛЯТ**

Run: `pnpm exec vitest run src/lib/product-feed.test.ts`
Expected: FAIL — `buildProductFeed is not a function`.

- [ ] **Стъпка 3: Имплементирай `src/lib/product-feed.ts`**

```ts
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
    lines.push(`<g:brand>${escapeXml(shop.name)}</g:brand>`);
    lines.push(`<g:condition>new</g:condition>`);
    lines.push(`<g:identifier_exists>no</g:identifier_exists>`);
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
```

- [ ] **Стъпка 4: Пусни тестовете — трябва да минат**

Run: `pnpm exec vitest run src/lib/product-feed.test.ts`
Expected: PASS — всичките.

- [ ] **Стъпка 5: Сканирай за контролни символи + commit**

Сканирай `src/lib/product-feed.ts` и `.test.ts` с Grep pattern `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` (0 очаквани).
```bash
git add src/lib/product-feed.ts src/lib/product-feed.test.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(feed): buildProductFeed + escapeXml (RSS 2.0 + Google namespace)

Чиста функция строи product feed XML: id/title/цена(EUR)/link/снимки/
наличност/sale_price/brand(=магазин)/condition/identifier_exists=no/
shipping_weight/product_type. Продукт без снимка се пропуска. Пълни тестове.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 2: Query `getFeedProducts` + категорийни имена

**Files:**
- Modify: `src/db/queries/storefront.ts`

**Interfaces:**
- Consumes: `products`, `categories`, `db`, `and`, `eq`, `desc` (вече импортирани в файла).
- Produces: `getFeedProducts(shopId: string)` → активните продукти (само feed колоните); `getShopCategoryNames(shopId: string)` → `Map<string, string>`.

- [ ] **Стъпка 1: Добави заявките**

В `src/db/queries/storefront.ts` (в края или до другите продуктови заявки):
```ts
/** Активните продукти на магазина за product feed — само нужните колони, без пагинация. */
export async function getFeedProducts(shopId: string) {
  const rows = await db.query.products.findMany({
    where: and(eq(products.shopId, shopId), eq(products.status, "active")),
    orderBy: [desc(products.createdAt)],
    columns: {
      id: true,
      name: true,
      slug: true,
      description: true,
      priceCents: true,
      promoPriceCents: true,
      stock: true,
      images: true,
      weightGrams: true,
      categoryId: true,
    },
    limit: 10_000,
  });
  if (rows.length >= 10_000) {
    console.warn(JSON.stringify({ event: "product_feed_limit_hit", shopId }));
  }
  return rows;
}

/** Имена на категориите на магазина (за g:product_type). */
export async function getShopCategoryNames(shopId: string): Promise<Map<string, string>> {
  const rows = await db.query.categories.findMany({
    where: eq(categories.shopId, shopId),
    columns: { id: true, name: true },
  });
  return new Map(rows.map((c) => [c.id, c.name]));
}
```
Провери, че `desc` е импортиран (ред 1 го има). `categories` също (ред 5).

- [ ] **Стъпка 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без нови грешки в `storefront.ts`. (Игнорирай предшестващите `contrast.test.ts` грешки — те са несвързани и не влизат в `next build`.)

- [ ] **Стъпка 3: Commit**

```bash
git add src/db/queries/storefront.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(feed): getFeedProducts + getShopCategoryNames заявки

Активни продукти (feed колони, без пагинация, лимит-предпазител 10000) +
категорийни имена като Map за g:product_type.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 3: Route handler `/s/[slug]/feed.xml`

**Files:**
- Create: `src/app/(storefront)/s/[slug]/feed.xml/route.ts`

**Interfaces:**
- Consumes: `getPublicShopCached`, `getFeedProducts`, `getShopCategoryNames` от `@/db/queries/storefront`; `buildProductFeed`, `FeedProduct` от `@/lib/product-feed`.
- Produces: GET route, който връща `application/xml` feed или `404`.

- [ ] **Стъпка 1: Създай route handler-а**

Create `src/app/(storefront)/s/[slug]/feed.xml/route.ts`:
```ts
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
```
**Забележка:** `getPublicShopCached` връща `null` за draft/suspended → `404` автоматично. Типът на `products` от `getFeedProducts` съвпада с `FeedProduct[]` (същите колони) — ако tsc се оплаче за несъвпадение, приведи чрез явен `.map` към `FeedProduct` или увери се, че колоните точно съвпадат (name/slug/description/priceCents/promoPriceCents/stock/images/weightGrams/categoryId + id).

- [ ] **Стъпка 2: Провери, че `.xml` в сегмент билдва (Next 16)**

Run: `pnpm build 2>&1 | grep -iE "feed.xml|error" | head`
Expected: route-ът `/s/[slug]/feed.xml` се появява в билд листинга без грешка. Ако Next не приема `.xml` папка в динамичен сегмент → fallback: премести на `src/app/(storefront)/s/[slug]/feed/route.ts` (URL става `/s/{slug}/feed`) и обнови UI-а и спеца съответно.

- [ ] **Стъпка 3: Ръчна проверка (dev)**

Съобщи на потребителя да провери на `localhost:3000/s/{демо-slug}/feed.xml` — валиден XML с продукти; несъществуващ slug → 404. (Не Playwright — ръчно.)

- [ ] **Стъпка 4: Commit**

```bash
git add "src/app/(storefront)/s/[slug]/feed.xml/route.ts"
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(feed): route /s/[slug]/feed.xml (ISR кеш, published-only)

GET връща application/xml feed от активните продукти; не-published → 404.
revalidate=3600 + инвалидация при продуктова мутация. Base URL от env.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 4: Copy бутон компонент

**Files:**
- Create: `src/components/dashboard/copy-button.tsx`

**Interfaces:**
- Consumes: `Button`, `Icon` от `@/components/ui`; `toast` от `sonner`.
- Produces: `<CopyButton value={string} label?={string} />` — копира value в клипборда, toast „Копирано“, временно check икона.

- [ ] **Стъпка 1: Създай компонента**

Create `src/components/dashboard/copy-button.tsx`:
```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Icon } from "@/components/ui";

interface CopyButtonProps {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = "Копирай" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Копирано");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Копирането не бе успешно");
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
      <Icon name={copied ? "check" : "link"} size={16} />
      {copied ? "Копирано" : label}
    </Button>
  );
}
```
Провери, че `variant="secondary"` и `size="sm"` съществуват (Button има `variant`/`size` props — потвърдено). `check` и `link` са валидни Icon имена (потвърдено). Ако `setTimeout` чупи react-compiler lint → обгради в `queueMicrotask` не е нужно (setTimeout е ок); ако lint се оплаче за неизползван, пусни `pnpm exec eslint`.

- [ ] **Стъпка 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit 2>&1 | grep copy-button || echo clean` и `pnpm exec eslint src/components/dashboard/copy-button.tsx`
Expected: clean.

- [ ] **Стъпка 3: Commit**

```bash
git add src/components/dashboard/copy-button.tsx
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(ui): CopyButton компонент (клипборд + toast „Копирано“)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 5: UI ред „Product feed за реклами“ в настройките

**Files:**
- Modify: `src/app/(dashboard)/dashboard/store/page.tsx`

**Interfaces:**
- Consumes: `CopyButton` от `@/components/dashboard/copy-button`; `Card` от `@/components/ui`.
- Produces: секция с feed URL + copy бутон, само за published магазин.

- [ ] **Стъпка 1: Добави import**

В `src/app/(dashboard)/dashboard/store/page.tsx`:
```ts
import { CopyButton } from "@/components/dashboard/copy-button";
```
И base URL константа (до другите top-level const-ове):
```ts
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://frizmo-shops.vercel.app";
```

- [ ] **Стъпка 2: Добави секцията след header Card-а**

Веднага след header Card-а (този с „Публичен адрес: /s/{slug}“ и Badge), само за published магазин:
```tsx
      {shop.status === "published" && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-ink-900">Product feed за реклами</h2>
            <p className="text-sm text-ink-500">
              Дай този линк на Google Merchant или Facebook каталог, за да рекламираш
              продуктите си.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-control border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-ink-700">
              {BASE_URL}/s/{shop.slug}/feed.xml
            </code>
            <CopyButton value={`${BASE_URL}/s/${shop.slug}/feed.xml`} label="Копирай линка" />
          </div>
        </Card>
      )}
```
Провери класовете спрямо съществуващите токени (`rounded-control`, `border-surface-200`, `bg-surface-50`, `text-ink-*` — всички са валидни токени в проекта). Ако URL-ът е дълъг на мобилно → `overflow-x-auto` пази без хоризонтален скрол на страницата.

- [ ] **Стъпка 3: Typecheck + сканирай контролни символи**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "store/page" || echo clean`
Grep `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` върху `store/page.tsx` → 0.

- [ ] **Стъпка 4: Ръчна проверка (потребителят)**

Съобщи да провери: настройки на published магазин → секцията се вижда; копирай бутон работи (toast); на draft магазин секцията липсва; мобилно 375px без overflow.

- [ ] **Стъпка 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/store/page.tsx"
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(dashboard): ред „Product feed за реклами“ + копирай линка

Само за published магазин: feed URL + CopyButton в настройките.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 6: Финален гейт + ръчна проверка

**Files:** няма промени по код.

- [ ] **Стъпка 1: Сканирай всички пипнати файлове за контролни символи**

Grep pattern `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` върху: `product-feed.ts`, `product-feed.test.ts`, `storefront.ts`, `feed.xml/route.ts`, `copy-button.tsx`, `store/page.tsx`.
Expected: 0.

- [ ] **Стъпка 2: Пълен гейт**

Run: `pnpm check`
Expected: lint + unit + build минават.

- [ ] **Стъпка 3: Ръчна проверка (потребителят, не Playwright)**

- `localhost:3000/s/{демо-slug}/feed.xml` → валиден XML, продукти с цени/снимки/наличност
- Продукт с промо → `sale_price`; без снимка → липсва във feed-а
- Несъществуващ/draft магазин → 404
- Настройки на published магазин → секция „Product feed“ + копирай бутон работи
- Валидатор (по избор): пусни XML-а през Google Merchant „Diagnostics“ или онлайн feed validator

- [ ] **Стъпка 4: Питай за push**

Съобщи, че всичко е готово и `pnpm check` минава. **Питай потребителя за разрешение** преди push към `dev` (= production). Push САМО при изрично „да“.

- [ ] **Стъпка 5: Обнови WORKLOG + памет**

Нов ред в „Дневник“ на `docs/WORKLOG.md` + текущ commit. Обнови memory (`product-feed` статус: код готов, чака проверка/push).

---

## Self-Review (проверено спрямо спеца)

- **Секция 2 (архитектура/route)** → Task 3 ✅ (dynamic route, ISR, published-only 404).
- **Секция 3 (query)** → Task 2 ✅ (`getFeedProducts` + `getShopCategoryNames`, лимит-предпазител).
- **Секция 4 (XML билдър)** → Task 1 ✅ (`escapeXml`/`plainText`/`buildProductFeed` + пълни тестове).
- **Секция 5 (Discovery UI)** → Task 4 (CopyButton) + Task 5 (ред в store) ✅ (само published).
- **Секция 6 (грешки)** → 404 (Task 3), продукт без снимка пропуснат + warn (Task 1), празен каталог валиден (Task 1 тест).
- **Секция 7 (тестове)** → Task 1 покрива всички изброени случаи; UI ръчно (Task 5/6).

**Type consistency:** `FeedProduct` полетата = колоните на `getFeedProducts` (id, name, slug, description, priceCents, promoPriceCents, stock, images, weightGrams, categoryId). `buildProductFeed` сигнатурата е една и съща в Task 1 (дефиниция), Task 3 (извикване). `CopyButton` props (`value`, `label`) съвпадат между Task 4 (дефиниция) и Task 5 (употреба). `getPublicShopCached` връща `{shop, settings} | null` — route-ът ползва `.shop`.

**Риск, отбелязан в плана:** ако Next 16 не приема `.xml` в динамична папка (Task 3 стъпка 2) → fallback на `/s/[slug]/feed` route; обновяват се UI-ът (Task 5) и спецът. Проверява се при билд, преди commit.
