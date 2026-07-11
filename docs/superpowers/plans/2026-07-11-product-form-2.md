# Пакет A „Продуктова форма 2.0" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавя product identifiers (SKU/GTIN/марка/доставна цена), SEO override, size guides (per магазин) и „Бързо/Детайлно" тогъл към продуктовата форма и продуктовата страница.

**Architecture:** Нови nullable колони в `products` + нова таблица `size_guides`, приложени с `pnpm db:push`. Всичко минава през съществуващите слоеве: Zod (`src/schemas/`) → action (`src/actions/`) → `requireShop()` wrapper. Feed-ът (`src/lib/product-feed.ts`) чете новите identifier колони. Тогълът е чисто визуален (localStorage през `useSyncExternalStore`), не изтрива данни.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + Supabase Postgres, Zod, Tailwind 4, Vitest, pnpm.

**Спец:** `docs/superpowers/specs/2026-07-11-product-form-2-design.md`

## Global Constraints

- **Tenant изолация:** всяка мутация през `requireShop()`; всяка заявка филтрирана по `shopId`. Кросс-tenant = критичен бъг.
- **Пари:** integer евроцентове (EUR). `toCents()` парсва, `formatPrice()`/`centsToInput()` показва (`src/lib/money.ts`). Никакъв float.
- **DB deploy:** `pnpm db:push` (drizzle-kit push, БЕЗ migration файлове). `src/db/schema.ts` е каноничният източник. Новите колони са nullable.
- **db:push env:** drizzle.config.ts чете `DATABASE_URL_MIGRATIONS` директно — зареди го в shell-а от `.env.local` БЕЗ да принтираш стойността, после `pnpm db:push`.
- **Валидация/санитизация:** Zod в `src/schemas/`; `sanitizeText()` (едноредов) / `sanitizeMultiline()` (многоредов) от `src/lib/sanitize.ts` преди запис.
- **UI:** само `ui/` примитиви (`Button`/`Input`/`Textarea`/`Select`/`PriceInput`/`Checkbox`/`Modal`/`Drawer`/`Card`/`Icon`/`Table`/`EmptyState`/`ConfirmDialog`/`LinkButton`). Touch ≥44px (`h-11`). Mobile-first 375px. Без емоджита (използвай `Icon`). Платформен UI → `brand-*`/`ink-*`/`surface-*` токени; storefront → само `--sf-*`. Нула хардкоднати hex/px.
- **BG текст:** типографски кавички „…“ (прав `"` чупи JS стринг/lint). Валута EUR.
- **Gate:** `pnpm check` (lint + unit + build) минава преди всеки commit.
- **Push:** само след изрично разрешение от потребителя (dev = Vercel production).
- **Контролни символи:** скан за `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` преди commit.

---

## File Structure

**Създава:**
- `src/lib/gtin.ts` — `isValidGtin()` чиста функция.
- `src/lib/gtin.test.ts` — unit тестове.
- `src/schemas/size-guide.ts` — `sizeGuideSchema`.
- `src/db/queries/size-guides.ts` — `getSizeGuides`, `getSizeGuide`.
- `src/actions/size-guides.ts` — `saveSizeGuide`, `deleteSizeGuide`.
- `src/app/(dashboard)/dashboard/size-guides/page.tsx` — dashboard страница.
- `src/components/dashboard/size-guides-manager.tsx` — списък + drawer.
- `src/components/dashboard/size-guide-editor.tsx` — динамична таблица (client).
- `src/components/storefront/size-guide-modal.tsx` — публичен изглед (client, отваря Modal/Drawer).
- `src/lib/product-form-mode.ts` — localStorage store за тогъла.

**Модифицира:**
- `src/db/schema.ts` — нови колони в `products` + таблица `sizeGuides` + relations.
- `src/schemas/product.ts` — identifier/SEO/sizeGuideId полета.
- `src/actions/product-values.ts` — мап на новите колони.
- `src/actions/products.ts` — sanitize на новите текстови полета в `insertRelations` не е нужно (те са в `productValues`); CSV header + импорт.
- `src/app/(dashboard)/dashboard/products/export/route.ts` — нови CSV колони.
- `src/lib/product-feed.ts` — `FeedProduct` + mpn/gtin/brand/identifier_exists.
- `src/lib/product-feed.test.ts` — тестове за новите редове.
- `src/db/queries/storefront.ts` — `getFeedProducts` добавя sku/gtin/brand колони.
- `src/components/dashboard/product-form.tsx` — нови карти + тогъл.
- `src/app/(dashboard)/dashboard/products/[id]/page.tsx` — подава новите initial стойности + size guides.
- `src/app/(dashboard)/dashboard/products/new/page.tsx` — подава size guides.
- `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx` — SEO metadata + марка + size guide бутон.
- `src/components/ui/icon.tsx` — нова икона `ruler`.
- `src/components/dashboard/nav-items.ts` — nav линк.
- `src/components/dashboard/product-list.tsx` — марж колона (ако е лесно) ИЛИ на детайла.

---

## Task 1: Схема + GTIN util + db:push

**Files:**
- Create: `src/lib/gtin.ts`, `src/lib/gtin.test.ts`
- Modify: `src/db/schema.ts` (products колони ~145-159; нова таблица след `shippingMethods` ~268)

**Interfaces:**
- Produces: `isValidGtin(raw: string): boolean`. Нови колони `products.sku/gtin/brand/costCents/seoTitle/seoDescription/sizeGuideId`. Нова таблица `sizeGuides` с `{ id, shopId, name, columns: string[], rows: string[][], sortOrder, createdAt, updatedAt }` + `db.query.sizeGuides`.

- [ ] **Step 1: Failing test за GTIN**

Create `src/lib/gtin.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isValidGtin } from "./gtin";

describe("isValidGtin", () => {
  it("приема валиден EAN-13", () => expect(isValidGtin("4006381333931")).toBe(true));
  it("приема валиден UPC-A (12)", () => expect(isValidGtin("036000291452")).toBe(true));
  it("приема валиден EAN-8", () => expect(isValidGtin("73513537")).toBe(true));
  it("приема валиден GTIN-14", () => expect(isValidGtin("10614141000415")).toBe(true));
  it("отхвърля грешна чексума", () => expect(isValidGtin("4006381333930")).toBe(false));
  it("отхвърля нецифри", () => expect(isValidGtin("abc")).toBe(false));
  it("отхвърля 7 цифри (грешна дължина)", () => expect(isValidGtin("1234567")).toBe(false));
  it("отхвърля празно", () => expect(isValidGtin("")).toBe(false));
  it("тримва интервали", () => expect(isValidGtin("  4006381333931  ")).toBe(true));
});
```

- [ ] **Step 2: Run — очаквай FAIL**

Run: `pnpm test src/lib/gtin.test.ts`
Expected: FAIL — "Cannot find module './gtin'".

- [ ] **Step 3: Имплементирай `src/lib/gtin.ts`**

```ts
/**
 * Валиден GTIN: точно 8/12/13/14 цифри + коректна GS1 mod-10 контролна цифра.
 * Празен/невалиден вход → false. Използва се във feed-а (g:gtin) и Zod валидацията.
 */
export function isValidGtin(raw: string): boolean {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return false;
  if (![8, 12, 13, 14].includes(s.length)) return false;
  const digits = s.split("").map(Number);
  const check = digits.pop()!;
  /* GS1 mod-10: отдясно наляво без последната цифра — тегла 3,1,3,1… */
  let sum = 0;
  for (let i = digits.length - 1, pos = 0; i >= 0; i--, pos++) {
    sum += digits[i]! * (pos % 2 === 0 ? 3 : 1);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}
```

- [ ] **Step 4: Run — очаквай PASS**

Run: `pnpm test src/lib/gtin.test.ts`
Expected: PASS (9 теста).

- [ ] **Step 5: Добави колони в `products` (schema.ts)**

В `src/db/schema.ts`, в дефиницията на `products` (след `netQuantityUnit`, преди `createdAt` ~ред 159), добави:
```ts
    /** Вътрешен артикулен код на търговеца (g:mpn във feed). null = няма. */
    sku: text("sku"),
    /** EAN/UPC баркод — валиден GTIN (g:gtin, превключва identifier_exists). null = няма. */
    gtin: text("gtin"),
    /** Марка override; null → името на магазина (сегашният feed fallback). */
    brand: text("brand"),
    /** Доставна цена в евроцентове — само за търговеца (марж). Никога публично. */
    costCents: integer("cost_cents"),
    /** SEO override; null → продуктовото име. */
    seoTitle: text("seo_title"),
    /** SEO meta description override; null → началото на описанието. */
    seoDescription: text("seo_description"),
    /** Закачена размерна таблица; null = няма. FK set null при триене на таблицата. */
    sizeGuideId: uuid("size_guide_id"),
```
(FK-ът към `sizeGuides` се добавя в Step 6 след дефиницията на таблицата — за да няма проблем с реда на деклариране, използваме `.references()` с callback, което е lazy.)

Замени реда за `sizeGuideId` горе с версия с референция:
```ts
    sizeGuideId: uuid("size_guide_id").references((): AnyPgColumn => sizeGuides.id, {
      onDelete: "set null",
    }),
```
Добави импорта горе в schema.ts, ако липсва: `import { ... , type AnyPgColumn } from "drizzle-orm/pg-core";` (провери съществуващия import ред от `drizzle-orm/pg-core`).

- [ ] **Step 6: Добави таблицата `sizeGuides` (schema.ts)**

След дефиницията на `shippingMethods` (~ред 268) добави:
```ts
export const sizeGuides = pgTable(
  "size_guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Заглавия на колоните, напр. ["Размер","Гръдна обиколка"]. */
    columns: jsonb("columns").$type<string[]>().notNull().default([]),
    /** Редове: всеки е масив с дължина = columns.length. */
    rows: jsonb("rows").$type<string[][]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("size_guides_shop_idx").on(t.shopId)],
).enableRLS();
```
Забележка: `sizeGuides` трябва да е деклариран в модула, за да е достъпен от `products.sizeGuideId` callback-а (Drizzle резолвва callback-ите lazy, така че редът на export-ите не пречи — работи и когато таблицата е под products в файла).

- [ ] **Step 7: `pnpm db:push`**

В PowerShell зареди migration URL-а от `.env.local` без да го принтираш:
```powershell
$line = Get-Content .env.local | Where-Object { $_ -match '^\s*DATABASE_URL_MIGRATIONS\s*=' }
$env:DATABASE_URL_MIGRATIONS = ($line -replace '^\s*DATABASE_URL_MIGRATIONS\s*=\s*', '').Trim('"')
pnpm db:push
```
Expected: „Changes applied" (нова таблица `size_guides` + 7 нови колони в `products`), exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/gtin.ts src/lib/gtin.test.ts src/db/schema.ts
git commit -F - <<'EOF'
feat(product-form-2): схема — identifiers/SEO/size guide колони + GTIN util

- products: sku/gtin/brand/cost_cents/seo_title/seo_description/size_guide_id
- нова таблица size_guides (per магазин, columns/rows jsonb)
- isValidGtin() (GS1 mod-10) + тестове; db:push приложен

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 2: Product identifiers (Zod + action + форма + feed + публична + CSV + марж)

**Files:**
- Modify: `src/schemas/product.ts`, `src/actions/product-values.ts`, `src/components/dashboard/product-form.tsx`, `src/lib/product-feed.ts`, `src/lib/product-feed.test.ts`, `src/db/queries/storefront.ts` (getFeedProducts), `src/app/(dashboard)/dashboard/products/export/route.ts`, `src/actions/products.ts` (CSV header+импорт), `src/app/(dashboard)/dashboard/products/[id]/page.tsx`, `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx` (марка), `src/components/dashboard/product-list.tsx` (марж)

**Interfaces:**
- Consumes: `isValidGtin` от Task 1; колоните `sku/gtin/brand/costCents`.
- Produces: `productSchema` полета `sku/gtin/brand/cost`; `FeedProduct` с `sku/gtin/brand`.

- [ ] **Step 1: Тест за feed промените**

В `src/lib/product-feed.test.ts` добави тестове (провери съществуващата структура на теста — `buildProductFeed(shop, products, cats, base)`; продуктите ТРЯБВА да имат ≥1 снимка, иначе се пропускат). Добави нови полета `sku/gtin/brand` към тестовите продукти и увери се, че всеки тест-продукт има `images: ["shops/x/products/a.jpg"]`:
```ts
it("валиден GTIN → g:gtin + identifier_exists yes", () => {
  const xml = buildProductFeed(
    { name: "Магазин", slug: "shop" },
    [{ id: "1", name: "П", slug: "p", description: "", priceCents: 1000, promoPriceCents: null, stock: 5, images: ["shops/s/products/a.jpg"], weightGrams: null, categoryId: null, sku: "SKU1", gtin: "4006381333931", brand: null }],
    new Map(),
    "https://x",
  );
  expect(xml).toContain("<g:gtin>4006381333931</g:gtin>");
  expect(xml).toContain("<g:mpn>SKU1</g:mpn>");
  expect(xml).toContain("<g:identifier_exists>yes</g:identifier_exists>");
});
it("без GTIN → identifier_exists no, без g:gtin", () => {
  const xml = buildProductFeed(
    { name: "Магазин", slug: "shop" },
    [{ id: "1", name: "П", slug: "p", description: "", priceCents: 1000, promoPriceCents: null, stock: 5, images: ["shops/s/products/a.jpg"], weightGrams: null, categoryId: null, sku: null, gtin: null, brand: null }],
    new Map(),
    "https://x",
  );
  expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");
  expect(xml).not.toContain("<g:gtin>");
});
it("brand override побеждава името на магазина", () => {
  const xml = buildProductFeed(
    { name: "Магазин", slug: "shop" },
    [{ id: "1", name: "П", slug: "p", description: "", priceCents: 1000, promoPriceCents: null, stock: 5, images: ["shops/s/products/a.jpg"], weightGrams: null, categoryId: null, sku: null, gtin: null, brand: "Nike" }],
    new Map(),
    "https://x",
  );
  expect(xml).toContain("<g:brand>Nike</g:brand>");
});
```
Ако съществуващите тестове в файла подават продукти без новите полета, добави `sku: null, gtin: null, brand: null` към тях (TS ще ги изисква).

- [ ] **Step 2: Run — очаквай FAIL**

Run: `pnpm test src/lib/product-feed.test.ts`
Expected: FAIL — типова грешка (липсват полета) и/или несъответстващ XML.

- [ ] **Step 3: Разшири `FeedProduct` + `buildProductFeed`**

В `src/lib/product-feed.ts`:
```ts
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
```
Замени редовете за brand/condition/identifier_exists (~69-71) с:
```ts
    if (p.sku) lines.push(`<g:mpn>${escapeXml(p.sku)}</g:mpn>`);
    if (p.gtin) lines.push(`<g:gtin>${escapeXml(p.gtin)}</g:gtin>`);
    lines.push(`<g:brand>${escapeXml(p.brand ?? shop.name)}</g:brand>`);
    lines.push(`<g:condition>new</g:condition>`);
    lines.push(`<g:identifier_exists>${p.gtin ? "yes" : "no"}</g:identifier_exists>`);
```

- [ ] **Step 4: Run — очаквай PASS**

Run: `pnpm test src/lib/product-feed.test.ts`
Expected: PASS.

- [ ] **Step 5: `getFeedProducts` добавя колоните**

В `src/db/queries/storefront.ts`, в `columns` обекта на `getFeedProducts` (~276-287) добави:
```ts
      sku: true,
      gtin: true,
      brand: true,
```

- [ ] **Step 6: Zod полета**

В `src/schemas/product.ts`: горе `import { isValidGtin } from "@/lib/gtin";`. В `productSchema` (след `netQuantity`) добави:
```ts
  sku: z.string().trim().max(60).default(""),
  gtin: z
    .union([
      z.string().trim().refine((s) => isValidGtin(s), "Невалиден баркод (8–14 цифри с контролна цифра)"),
      z.literal(""),
    ])
    .default(""),
  brand: z.string().trim().max(60).default(""),
  cost: optionalPriceString.default(""),
```

- [ ] **Step 7: Мап в `productValues`**

В `src/actions/product-values.ts`, в върнатия обект (преди `updatedAt`) добави:
```ts
    sku: input.sku ? sanitizeText(input.sku, 60) : null,
    gtin: input.gtin || null,
    brand: input.brand ? sanitizeText(input.brand, 60) : null,
    costCents: input.cost ? toCents(input.cost) : null,
```

- [ ] **Step 8: Форма — карта „Продуктови кодове"**

В `src/components/dashboard/product-form.tsx`:
- Добави state: `const [sku, setSku] = useState(initial.sku); const [gtin, setGtin] = useState(initial.gtin); const [brand, setBrand] = useState(initial.brand); const [cost, setCost] = useState(initial.cost);`
- Разшири `ProductFormInitial` с `sku: string; gtin: string; brand: string; cost: string;` и `emptyInitial` (`sku:"",gtin:"",brand:"",cost:""`).
- В `handleSubmit` подай `sku, gtin, brand, cost` към `saveProduct`.
- Добави нова `Card` вътре в детайлния блок (виж Task 5 за `showDetailed`; засега я сложи в `{!simple && (<> … </>)}` блока, след „Тегло и размер"):
```tsx
          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-ink-900">Продуктови кодове</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="SKU"
                hint="Твой вътрешен код (напр. BLU-M-01). Клиентът не го вижда."
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                error={fieldErrors.sku}
              />
              <Input
                label="Баркод (GTIN / EAN)"
                hint="Баркод на артикула. Подобрява рекламите в Google."
                inputMode="numeric"
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                error={fieldErrors.gtin}
              />
              <Input
                label="Марка"
                hint="Реалната марка. Празно → името на магазина."
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                error={fieldErrors.brand}
              />
              <PriceInput
                label="Доставна цена"
                hint="Само за теб — смятаме печалба. Не се вижда публично."
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                error={fieldErrors.cost}
              />
            </div>
          </Card>
```

- [ ] **Step 9: Edit страница подава новите initial стойности**

В `src/app/(dashboard)/dashboard/products/[id]/page.tsx`, в `initial={{…}}` добави:
```tsx
          sku: product.sku ?? "",
          gtin: product.gtin ?? "",
          brand: product.brand ?? "",
          cost: centsToInput(product.costCents),
```
(`getProductWithRelations` връща целия ред — новите колони идват автоматично; ако е с явен `columns`, добави ги там.)

- [ ] **Step 10: Публична марка**

В `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`, под `<VariantPicker …/>` (или в breadcrumb-а под името), покажи марката ако е зададена:
```tsx
      {product.brand && (
        <p className="mt-1 text-sm text-(--sf-muted)">Марка: {product.brand}</p>
      )}
```
(Постави го на смислено място спрямо VariantPicker — под него е безопасно.)

- [ ] **Step 11: CSV експорт колони**

В `src/app/(dashboard)/dashboard/products/export/route.ts`: добави `"sku","gtin","brand","cost"` към header масива и съответните стойности към всеки ред:
```ts
      p.sku ?? "",
      p.gtin ?? "",
      p.brand ?? "",
      centsToCsv(p.costCents),
```
(`findMany` без `columns` връща всичко — колоните са налични.)

- [ ] **Step 12: CSV импорт колони**

В `src/actions/products.ts`: добави `"sku","gtin","brand","cost"` към `CSV_HEADER`. В цикъла на импорта, преди `const values = {…}`, извлечи и валидирай:
```ts
      const skuRaw = sanitizeText(cell(row, "sku"), 60);
      const gtinRaw = cell(row, "gtin");
      if (gtinRaw && !isValidGtin(gtinRaw)) {
        result.skipped.push(`ред ${lineNo}: невалиден баркод „${gtinRaw}“`);
        continue;
      }
      const brandRaw = sanitizeText(cell(row, "brand"), 60);
      const costRaw = cell(row, "cost");
      const costCents = costRaw ? toCents(costRaw.replace(",", ".")) : null;
      if (costRaw && costCents === null) {
        result.skipped.push(`ред ${lineNo}: невалидна доставна цена „${costRaw}“`);
        continue;
      }
```
Добави в `values` обекта: `sku: skuRaw || null, gtin: gtinRaw || null, brand: brandRaw || null, costCents,`. Импортирай горе: `import { isValidGtin } from "@/lib/gtin";`.

- [ ] **Step 13: Марж в admin (продуктов списък)**

В `src/components/dashboard/product-list.tsx` (или на детайла, ако списъкът е тесен): където се рендерира цената на реда, ако `product.costCents != null && product.priceCents > 0`, покажи дискретно:
```tsx
{product.costCents != null && product.priceCents > 0 && (
  <span className="text-xs text-ink-500">
    Марж: {Math.round(((product.priceCents - product.costCents) / product.priceCents) * 100)}%
  </span>
)}
```
Увери се, че заявката за списъка връща `costCents` (виж `getProducts`/подобната — добави колоната ако е с явен `columns`). Ако списъкът не носи лесно costCents, сложи маржа на страницата за редакция под цената вместо тук — избери по-малката промяна.

- [ ] **Step 14: `pnpm check`**

Run: `pnpm check`
Expected: lint + unit + build минават.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(product-form-2): product identifiers (SKU/GTIN/марка/доставна цена)

- Zod + productValues мап; форма-карта „Продуктови кодове"
- feed: g:mpn/g:gtin + identifier_exists yes/no + brand override
- CSV експорт/импорт колони (валиден GTIN); марж в admin
- edit страница зарежда стойностите; публична марка

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 3: SEO per продукт

**Files:**
- Modify: `src/schemas/product.ts`, `src/actions/product-values.ts`, `src/components/dashboard/product-form.tsx`, `src/app/(dashboard)/dashboard/products/[id]/page.tsx`, `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx` (generateMetadata)

**Interfaces:**
- Consumes: колоните `seoTitle/seoDescription` от Task 1.
- Produces: `productSchema` полета `seoTitle/seoDescription`; `ProductFormInitial.seoTitle/seoDescription`.

- [ ] **Step 1: Zod полета**

В `src/schemas/product.ts`, в `productSchema`:
```ts
  seoTitle: z.string().trim().max(60).default(""),
  seoDescription: z.string().trim().max(160).default(""),
```

- [ ] **Step 2: Мап в `productValues`**

В `src/actions/product-values.ts`, в върнатия обект:
```ts
    seoTitle: input.seoTitle ? sanitizeText(input.seoTitle, 60) : null,
    seoDescription: input.seoDescription ? sanitizeText(input.seoDescription, 160) : null,
```

- [ ] **Step 3: Форма — карта „SEO"**

В `product-form.tsx`: state `const [seoTitle, setSeoTitle] = useState(initial.seoTitle); const [seoDescription, setSeoDescription] = useState(initial.seoDescription);`. Разшири `ProductFormInitial` (`seoTitle: string; seoDescription: string;`) + `emptyInitial`. Подай в `handleSubmit`. Нова `Card` в детайлния блок:
```tsx
          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-ink-900">SEO</h2>
            <Input
              label="SEO заглавие"
              hint="Празно → името на продукта. Показва се в таба на браузъра и Google."
              maxLength={60}
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              error={fieldErrors.seoTitle}
            />
            <div className="flex flex-col gap-1">
              <Textarea
                label="SEO описание"
                hint="Празно → началото на описанието. Показва се в Google под заглавието."
                maxLength={160}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                error={fieldErrors.seoDescription}
              />
              <p className="self-end text-xs text-ink-500">{seoDescription.length}/160</p>
            </div>
          </Card>
```

- [ ] **Step 4: Edit страница initial**

В `[id]/page.tsx` `initial={{…}}` добави:
```tsx
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
```

- [ ] **Step 5: `generateMetadata` override**

В `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`, `generateMetadata` (~36-44):
```tsx
  return {
    title: product.seoTitle || `${product.name} — ${result.shop.name}`,
    description:
      product.seoDescription || product.description.slice(0, 160) || product.name,
    alternates: { canonical: `/s/${slug}/p/${productSlug}` },
    openGraph: {
      title: product.seoTitle || product.name,
      ...(product.images[0] && { images: [publicImageUrl(product.images[0])] }),
    },
  };
```
(`getActiveProduct` връща целия ред → `seoTitle/seoDescription` са налични. JSON-LD блокът НЕ се променя.)

- [ ] **Step 6: `pnpm check`**

Run: `pnpm check`
Expected: минава.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(product-form-2): SEO override per продукт

- seoTitle/seoDescription: Zod + productValues + форма-карта „SEO"
- generateMetadata: override с fallback към име/описание; JSON-LD непроменен

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 4: Size guide (таблици per магазин)

**Files:**
- Create: `src/schemas/size-guide.ts`, `src/db/queries/size-guides.ts`, `src/actions/size-guides.ts`, `src/app/(dashboard)/dashboard/size-guides/page.tsx`, `src/components/dashboard/size-guides-manager.tsx`, `src/components/dashboard/size-guide-editor.tsx`, `src/components/storefront/size-guide-modal.tsx`
- Modify: `src/components/ui/icon.tsx` (икона `ruler`), `src/components/dashboard/nav-items.ts`, `src/schemas/product.ts` (sizeGuideId), `src/actions/product-values.ts`, `src/components/dashboard/product-form.tsx`, `src/app/(dashboard)/dashboard/products/[id]/page.tsx`, `src/app/(dashboard)/dashboard/products/new/page.tsx`, `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`

**Interfaces:**
- Consumes: таблицата `sizeGuides` от Task 1.
- Produces: `sizeGuideSchema`; `getSizeGuides(shopId): Promise<SizeGuide[]>` където `SizeGuide = { id, name, columns: string[], rows: string[][], … }`; `getSizeGuide(shopId, id)`; `saveSizeGuide(id|null, input)`, `deleteSizeGuide({id})`.

- [ ] **Step 1: Zod схема + тест**

Create `src/schemas/size-guide.ts`:
```ts
import { z } from "zod";

export const sizeGuideSchema = z
  .object({
    name: z.string().trim().min(2, "Въведи име").max(60),
    columns: z
      .array(z.string().trim().min(1, "Празна колона").max(40))
      .min(1, "Поне една колона")
      .max(8, "Максимум 8 колони"),
    rows: z.array(z.array(z.string().trim().max(40))).max(50, "Максимум 50 реда"),
  })
  .superRefine((v, ctx) => {
    for (const [i, row] of v.rows.entries()) {
      if (row.length !== v.columns.length) {
        ctx.addIssue({ code: "custom", path: ["rows", i], message: "Редът не съвпада с броя колони" });
      }
    }
  });

export type SizeGuideInput = z.infer<typeof sizeGuideSchema>;
```
Create `src/schemas/size-guide.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { sizeGuideSchema } from "./size-guide";

describe("sizeGuideSchema", () => {
  it("приема валидна таблица", () => {
    const r = sizeGuideSchema.safeParse({ name: "Дамски", columns: ["Размер", "Талия"], rows: [["S", "60"], ["M", "64"]] });
    expect(r.success).toBe(true);
  });
  it("отхвърля ред с грешен брой клетки", () => {
    const r = sizeGuideSchema.safeParse({ name: "Дамски", columns: ["Размер", "Талия"], rows: [["S"]] });
    expect(r.success).toBe(false);
  });
  it("отхвърля 0 колони", () => {
    const r = sizeGuideSchema.safeParse({ name: "Дамски", columns: [], rows: [] });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — очаквай PASS (схемата вече е написана)**

Run: `pnpm test src/schemas/size-guide.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 3: Заявки**

Create `src/db/queries/size-guides.ts`:
```ts
import { and, asc, eq } from "drizzle-orm";
import { db, sizeGuides } from "@/db";

export async function getSizeGuides(shopId: string) {
  return db.query.sizeGuides.findMany({
    where: eq(sizeGuides.shopId, shopId),
    orderBy: [asc(sizeGuides.sortOrder), asc(sizeGuides.createdAt)],
  });
}

export async function getSizeGuide(shopId: string, id: string) {
  const guide = await db.query.sizeGuides.findFirst({
    where: and(eq(sizeGuides.id, id), eq(sizeGuides.shopId, shopId)),
  });
  return guide ?? null;
}

export type SizeGuide = Awaited<ReturnType<typeof getSizeGuides>>[number];
```

- [ ] **Step 4: Actions**

Create `src/actions/size-guides.ts`:
```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, sizeGuides } from "@/db";
import { shopCacheTag } from "@/db/queries/storefront";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { sanitizeText } from "@/lib/sanitize";
import { sizeGuideSchema } from "@/schemas/size-guide";

function revalidate(slug: string) {
  revalidateTag(shopCacheTag(slug), "max");
  revalidatePath("/dashboard/size-guides");
  revalidatePath(`/s/${slug}`, "layout");
}

export async function saveSizeGuide(id: string | null, input: unknown): Promise<ActionResult> {
  const parsed = sizeGuideSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const values = {
    name: sanitizeText(parsed.data.name, 60),
    columns: parsed.data.columns.map((c) => sanitizeText(c, 40)),
    rows: parsed.data.rows.map((r) => r.map((cell) => sanitizeText(cell, 40))),
    updatedAt: new Date(),
  };

  if (id === null) {
    await db.insert(sizeGuides).values({ ...values, shopId: shop.id });
  } else {
    const guide = await db.query.sizeGuides.findFirst({ where: eq(sizeGuides.id, id) });
    if (!guide || guide.shopId !== shop.id) return fail("Таблицата не съществува.");
    await db
      .update(sizeGuides)
      .set(values)
      .where(and(eq(sizeGuides.id, id), eq(sizeGuides.shopId, shop.id)));
  }

  revalidate(shop.slug);
  return ok(null);
}

export async function deleteSizeGuide(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалидна таблица.");
  const { shop } = await requireShop();
  const guide = await db.query.sizeGuides.findFirst({ where: eq(sizeGuides.id, parsed.data.id) });
  if (!guide || guide.shopId !== shop.id) return fail("Таблицата не съществува.");
  await db.delete(sizeGuides).where(and(eq(sizeGuides.id, guide.id), eq(sizeGuides.shopId, shop.id)));
  revalidate(shop.slug);
  return ok(null);
}
```

- [ ] **Step 5: Икона `ruler`**

В `src/components/ui/icon.tsx`, в обекта с пътищата, добави (Lucide „ruler"):
```ts
  ruler: [
    "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z",
    "m14.5 12.5 2-2",
    "m11.5 9.5 2-2",
    "m8.5 6.5 2-2",
    "m17.5 15.5 2-2",
  ],
```
(Множество `d` пътища — следвай формата на съществуваща многопътна икона в файла, напр. `store`.)

- [ ] **Step 6: Editor компонент**

Create `src/components/dashboard/size-guide-editor.tsx` (client): поле „Име"; таблица с редактируеми клетки; бутони „Добави колона" / „Добави ред" / премахване на колона/ред; „Запази" вика `saveSizeGuide`. Използвай `Input`, `Button`, `Icon`, токени. State: `name: string`, `columns: string[]`, `rows: string[][]`. При добавяне на колона → всеки ред получава нова празна клетка; при премахване на колона → всеки ред губи същия индекс. Валидацията идва от action-а (показвай `toast.error`). Props: `{ initial?: { id: string; name: string; columns: string[]; rows: string[][] }; onSaved: () => void }`. Пълна имплементация (следвай `fulfillment`/`reviews-manager` стила за drawer форма):
```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveSizeGuide } from "@/actions/size-guides";
import { Button, Icon, Input } from "@/components/ui";

interface Props {
  initial?: { id: string; name: string; columns: string[]; rows: string[][] };
  onSaved: () => void;
}

export function SizeGuideEditor({ initial, onSaved }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [columns, setColumns] = useState<string[]>(initial?.columns ?? ["Размер"]);
  const [rows, setRows] = useState<string[][]>(initial?.rows ?? [[""]]);
  const [saving, setSaving] = useState(false);

  function addColumn() {
    setColumns([...columns, ""]);
    setRows(rows.map((r) => [...r, ""]));
  }
  function removeColumn(ci: number) {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== ci));
    setRows(rows.map((r) => r.filter((_, i) => i !== ci)));
  }
  function addRow() {
    setRows([...rows, columns.map(() => "")]);
  }
  function removeRow(ri: number) {
    setRows(rows.filter((_, i) => i !== ri));
  }
  function setColumn(ci: number, value: string) {
    setColumns(columns.map((c, i) => (i === ci ? value : c)));
  }
  function setCell(ri: number, ci: number, value: string) {
    setRows(rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? value : c)) : r)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveSizeGuide(initial?.id ?? null, { name, columns, rows });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Таблицата е запазена.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Име на таблицата" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((c, ci) => (
                <th key={ci} className="p-1">
                  <div className="flex items-center gap-1">
                    <Input
                      aria-label={`Колона ${ci + 1}`}
                      value={c}
                      onChange={(e) => setColumn(ci, e.target.value)}
                    />
                    {columns.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeColumn(ci)} aria-label="Премахни колона">
                        <Icon name="x" size={14} />
                      </Button>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-1">
                <Button type="button" variant="secondary" size="sm" onClick={addColumn}>
                  <Icon name="plus" size={14} /> Колона
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-1">
                    <Input
                      aria-label={`Ред ${ri + 1} колона ${ci + 1}`}
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                    />
                  </td>
                ))}
                <td className="p-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(ri)} aria-label="Премахни ред">
                    <Icon name="trash" size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          <Icon name="plus" size={14} /> Ред
        </Button>
        <Button type="button" loading={saving} onClick={handleSave}>
          Запази
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Manager компонент (списък + drawer)**

Create `src/components/dashboard/size-guides-manager.tsx` (client): списък с таблиците (име + брой редове), бутон „Нова таблица" → `Drawer` с `SizeGuideEditor`, редактиране (клик на таблица → drawer с initial), изтриване (`ConfirmDialog` → `deleteSizeGuide`), `EmptyState` при 0. Props `{ guides: SizeGuide[] }`. След запис/триене → `router.refresh()`. Следвай `Drawer` конвенцията (fullscreen на мобилно; не се затваря при клик отвън):
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteSizeGuide } from "@/actions/size-guides";
import { SizeGuideEditor } from "./size-guide-editor";
import { Button, ConfirmDialog, Drawer, EmptyState, Icon } from "@/components/ui";
import type { SizeGuide } from "@/db/queries/size-guides";

export function SizeGuidesManager({ guides }: { guides: SizeGuide[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SizeGuide | "new" | null>(null);
  const [toDelete, setToDelete] = useState<SizeGuide | null>(null);

  /* ConfirmDialog авт. вика onClose след onConfirm — не затваряй ръчно тук. */
  async function handleDelete() {
    if (!toDelete) return;
    const result = await deleteSizeGuide({ id: toDelete.id });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Таблицата е изтрита.");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">Таблици с размери</h1>
        <Button onClick={() => setEditing("new")}>
          <Icon name="plus" size={16} /> Нова таблица
        </Button>
      </div>

      {guides.length === 0 ? (
        <EmptyState
          title="Още няма таблици с размери"
          text="Създай таблица (напр. „Дамски дрехи“) и я закачи към продукти — купувачите ще виждат размерите преди да поръчат."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-surface-200 rounded-card border border-surface-200 bg-surface-0">
          {guides.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-ink-900">{g.name}</p>
                <p className="text-sm text-ink-500">
                  {g.columns.length} колони · {g.rows.length} реда
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(g)}>
                  <Icon name="pencil" size={14} /> Редактирай
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setToDelete(g)} aria-label="Изтрий">
                  <Icon name="trash" size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Нова таблица с размери" : "Редакция на таблица"}
      >
        {editing !== null && (
          <SizeGuideEditor
            initial={editing === "new" ? undefined : { id: editing.id, name: editing.name, columns: editing.columns, rows: editing.rows }}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        title="Изтриване на таблица"
        message={`Сигурен ли си, че искаш да изтриеш „${toDelete?.name ?? ""}“? Продуктите с нея остават без таблица.`}
        confirmLabel="Изтрий"
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
```
(Props верифицирани: `Drawer` = `{open,onClose,title,children,footer?}`; `ConfirmDialog` = `{open,onClose,onConfirm,title?,message,confirmLabel?}` и авт. затваря след confirm.)

- [ ] **Step 8: Dashboard страница + nav**

Create `src/app/(dashboard)/dashboard/size-guides/page.tsx`:
```tsx
import { SizeGuidesManager } from "@/components/dashboard/size-guides-manager";
import { getSizeGuides } from "@/db/queries/size-guides";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Таблици с размери — Frizmo Shops" };

export default async function SizeGuidesPage() {
  const { shop } = await requireShop();
  const guides = await getSizeGuides(shop.id);
  return <SizeGuidesManager guides={guides} />;
}
```
В `src/components/dashboard/nav-items.ts` добави след „Плащане и доставка":
```ts
  { href: "/dashboard/size-guides", label: "Таблици размери", icon: "ruler" },
```

- [ ] **Step 9: Продуктова форма — dropdown**

В `product-form.tsx`: разшири `ProductFormProps` с `sizeGuides: { value: string; label: string }[]` (подадени от страниците). Разшири `ProductFormInitial` с `sizeGuideId: string` + `emptyInitial`. State `const [sizeGuideId, setSizeGuideId] = useState(initial.sizeGuideId);`. Подай `sizeGuideId` в `handleSubmit`. В детайлния блок (до „Продуктови кодове" или в „Характеристики"):
```tsx
          {sizeGuides.length > 0 ? (
            <Select
              label="Таблица с размери"
              options={sizeGuides}
              placeholder="— Няма —"
              value={sizeGuideId}
              onChange={(e) => setSizeGuideId(e.target.value)}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-900">Таблица с размери</span>
              <div className="rounded-control border border-dashed border-surface-300 bg-surface-50 p-4">
                <p className="mb-2 text-sm text-ink-500">Още нямаш таблици с размери.</p>
                <LinkButton href="/dashboard/size-guides" variant="secondary" size="sm">
                  <Icon name="plus" size={16} /> Създай таблица
                </LinkButton>
              </div>
            </div>
          )}
```
Постави го в собствена `Card` „Таблица с размери" или вътре в „Продуктови кодове" — избери по-чистото визуално.

- [ ] **Step 10: Zod + мап за sizeGuideId**

В `src/schemas/product.ts`: `sizeGuideId: z.union([z.uuid(), z.literal("")]).default(""),`. В `productValues`: `sizeGuideId: input.sizeGuideId || null,`. В `saveProduct` (`products.ts`), при непразен `sizeGuideId` — валидирай собствеността (както категорията ~144-149):
```ts
  if (input.sizeGuideId) {
    const guide = await db.query.sizeGuides.findFirst({ where: eq(sizeGuides.id, input.sizeGuideId) });
    if (!guide || guide.shopId !== shop.id) return fail("Невалидна таблица с размери.");
  }
```
Импортирай `sizeGuides` от `@/db` в `products.ts`.

- [ ] **Step 11: Страниците подават size guides**

В `[id]/page.tsx` и `new/page.tsx`: зареди `const sizeGuides = await getSizeGuides(shop.id);`, мапни към опции `sizeGuides.map((g) => ({ value: g.id, label: g.name }))`, подай като `sizeGuides={…}` на `<ProductForm>`. В `[id]` добави в `initial`: `sizeGuideId: product.sizeGuideId ?? "",`.

- [ ] **Step 12: Публичен size guide modal**

Create `src/components/storefront/size-guide-modal.tsx` (client): бутон „Таблица с размери" (`Icon name="ruler"`) → отваря `Modal` (или `Drawer` на мобилно — следвай storefront конвенцията) с таблицата, рендерирана през `--sf-*` токени. Props `{ name: string; columns: string[]; rows: string[][] }`:
```tsx
"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

interface Props {
  name: string;
  columns: string[];
  rows: string[][];
}

export function SizeGuideModal({ name, columns, rows }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 text-sm font-medium text-(--sf-primary) hover:underline"
      >
        <Icon name="ruler" size={16} /> Таблица с размери
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-(--sf-surface-raised) p-5 sm:rounded-(--sf-radius)"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-(--sf-text)">{name}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Затвори" className="text-(--sf-muted)">
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-(--sf-border)">
                    {columns.map((c, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-(--sf-text)">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-(--sf-border) last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-(--sf-muted)">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```
(Верифицирано: storefront НЯМА реюзабилен modal примитив — само `cart-drawer`. Затова горният overlay е правилният подход, но ЗАДЪЛЖИТЕЛНО добави `role="dialog"` + `aria-modal="true"` на панела и Esc-затваряне (`useEffect` с keydown listener, като `Drawer`), за a11y.)

- [ ] **Step 13: Продуктовата страница зарежда + показва таблицата**

В `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`: ако `product.sizeGuideId`, зареди таблицата (добави към `Promise.all` или отделно):
```tsx
import { getSizeGuide } from "@/db/queries/size-guides";
// …
const sizeGuide = product.sizeGuideId ? await getSizeGuide(shop.id, product.sizeGuideId) : null;
```
Рендерирай бутона до варианта (напр. под `<VariantPicker/>`):
```tsx
{sizeGuide && (
  <div className="mt-4">
    <SizeGuideModal name={sizeGuide.name} columns={sizeGuide.columns} rows={sizeGuide.rows} />
  </div>
)}
```
Импортирай `SizeGuideModal`.

- [ ] **Step 14: `pnpm check`**

Run: `pnpm check`
Expected: минава.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(product-form-2): size guides (таблици размери per магазин)

- size_guides CRUD: схема/заявки/actions + /dashboard/size-guides
- редактор (динамична таблица) + manager (списък/drawer/изтриване)
- продуктова форма dropdown + собственост валидация
- публичен modal на продуктовата страница + икона ruler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 5: „Бързо / Детайлно" тогъл

**Files:**
- Create: `src/lib/product-form-mode.ts`
- Modify: `src/components/dashboard/product-form.tsx`

**Interfaces:**
- Consumes: нищо ново.
- Produces: `product-form-mode.ts` store функции; `product-form.tsx` рендерира тогъл + `showDetailed`.

- [ ] **Step 1: localStorage store**

Create `src/lib/product-form-mode.ts` (следва `favorites-storage.ts` snapshot паттерна):
```ts
"use client";

export type FormMode = "quick" | "detailed";
const KEY = "frizmo-product-form-mode";
const EVENT = "frizmo-product-form-mode-changed";

function parse(raw: string | null): FormMode {
  return raw === "quick" ? "quick" : "detailed"; /* default: детайлно */
}

let cache: { raw: string | null; mode: FormMode } | null = null;

export function getModeSnapshot(): FormMode {
  const raw = window.localStorage.getItem(KEY);
  if (cache && cache.raw === raw) return cache.mode;
  const mode = parse(raw);
  cache = { raw, mode };
  return mode;
}

export function getServerModeSnapshot(): FormMode {
  return "detailed";
}

export function setMode(mode: FormMode) {
  window.localStorage.setItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onModeChange(callback: () => void): () => void {
  const onCustom = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
```

- [ ] **Step 2: Тогъл + showDetailed в формата**

В `src/components/dashboard/product-form.tsx`:
- Импортирай `useSyncExternalStore` от `react` и store функциите.
- В компонента:
```tsx
  const mode = useSyncExternalStore(onModeChange, getModeSnapshot, getServerModeSnapshot);
  const showDetailed = !simple && mode === "detailed";
```
- Замени `{!simple && (` (блокът с детайлните карти ~ред 269) с `{showDetailed && (`.
- Добави тогъла в горната част на формата (преди първата `Card`), но САМО когато `!simple`:
```tsx
      {!simple && (
        <div className="flex items-center gap-2 self-start rounded-control border border-surface-200 bg-surface-0 p-1">
          <button
            type="button"
            onClick={() => setMode("quick")}
            aria-pressed={mode === "quick"}
            className={`h-9 rounded-control px-4 text-sm font-medium transition-colors ${
              mode === "quick" ? "bg-brand-600 text-surface-0" : "text-ink-700 hover:bg-surface-100"
            }`}
          >
            Бързо
          </button>
          <button
            type="button"
            onClick={() => setMode("detailed")}
            aria-pressed={mode === "detailed"}
            className={`h-9 rounded-control px-4 text-sm font-medium transition-colors ${
              mode === "detailed" ? "bg-brand-600 text-surface-0" : "text-ink-700 hover:bg-surface-100"
            }`}
          >
            Детайлно
          </button>
        </div>
      )}
```
(Ако има реюзабилен `SegmentedControl`/подобен в `ui/` — преизползвай го. Иначе горното с токени е ОК; провери, че `bg-brand-600`/`text-surface-0` контрастът е валиден и в dark.)

**Важно:** скритите полета остават в state-а и се подават към `saveProduct` както преди — режимът е само визуален (не изтрива данни при edit).

- [ ] **Step 3: `pnpm check`**

Run: `pnpm check`
Expected: минава (внимавай за react-compiler: без синхронен `setState` в effect; `useSyncExternalStore` snapshot е стабилен през кеша).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(product-form-2): „Бързо/Детайлно" тогъл на продуктовата форма

- localStorage store (useSyncExternalStore, default „Детайлно")
- showDetailed = !simple && mode; замества simple гейтовете
- onboarding остава закован „Бързо"; режимът е само визуален (без загуба на данни)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Финал

- [ ] Пълен `pnpm check` (последен път).
- [ ] Скан за контролни символи в променените файлове: `git diff --name-only HEAD~5 | …` (или ръчно) за `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`.
- [ ] Обнови `docs/WORKLOG.md` (нов ред в „Дневник" + текущ commit).
- [ ] Обнови `docs/testing-checklist.md` (нова секция за Пакет A).
- [ ] Обнови паметта (`memory/`) с нов файл за Пакет A + ред в `MEMORY.md`.
- [ ] **Питай потребителя за разрешение за push** към `dev` (= prod). Push само при изрично „да".

## Тестване (ръчно, потребител)

- Форма: тогъл Бързо↔Детайлно (помни се при reload); onboarding остава опростен.
- Identifiers: попълни SKU/GTIN/марка/доставна → провери feed XML (`/s/{slug}/feed.xml`): `g:mpn`, `g:gtin`, `identifier_exists=yes`, `g:brand`. Невалиден GTIN → грешка във формата. Марж в admin.
- SEO: попълни → Ctrl+U на продукта → `<title>` + meta description override; празно → fallback.
- Size guide: създай таблица в `/dashboard/size-guides`; закачи към продукт; публичен бутон → modal с таблицата; изтрий таблица → продуктът остава без.
- CSV: експорт (нови колони) → импорт кръг (валиден GTIN, невалиден ред се пропуска).
- Мобилно 375px; light + dark.
