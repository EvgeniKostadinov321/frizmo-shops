# Пакет A — „Продуктова форма 2.0" (спецификация)

**Дата:** 2026-07-11
**Обхват:** 4 функции около `product-form.tsx` + продуктовата страница + product feed.
**Подход:** един спец → един план → inline имплементация (без паралелни субагенти).

## Цел

Надграждаме продуктовата форма и продуктовата страница с четири свързани функции:

1. **Product identifiers** — SKU, GTIN/баркод, марка (override), доставна цена (марж). Захранват вече готовия product feed и подобряват Google Shopping видимостта.
2. **SEO per продукт** — meta title/description override с fallback към сегашното поведение.
3. **Size guide** — таблици с размери, дефинирани per магазин и прилагани към много продукти (DRY).
4. **„Бързо / Детайлно" тогъл** — визуален режим на формата, който помни избора.

Всичко минава през съществуващите слоеве: Zod (`src/schemas/`) → action (`src/actions/`) → `requireShop()` wrapper (tenant-изолация по `shopId`). Пари в integer евроцентове. UI на български с типографски кавички „…“.

---

## Глобални ограничения (важат за всяка задача)

- **Tenant изолация:** всяка мутация минава през `requireShop()`; всяка заявка се филтрира по `shopId`. Кросс-tenant достъп = критичен бъг.
- **Пари:** integer евроцентове (EUR). Парсване `toCents()`, показване `formatPrice()` от `src/lib/money.ts`. Никакъв float.
- **DB deploy:** `pnpm db:push` (drizzle-kit push, БЕЗ migration файлове). `src/db/schema.ts` е каноничният източник. Нови колони са nullable (без default стойности, които променят стар ред).
- **Валидация:** Zod схеми в `src/schemas/`, едни и същи за клиент и сървър. Текстов вход → `sanitizeText()` (едноредов) / `sanitizeMultiline()` (многоредов) преди запис.
- **UI:** без голи `<button>`/`<input>` — само `ui/` примитиви (`Button`, `Input`, `Textarea`, `Select`, `PriceInput`, `Checkbox`, `Modal`, `Drawer`, `Card`, `Icon`). Touch targets ≥ 44px (`h-11`). Mobile-first (375px). Без емоджита в платформения UI (използвай `Icon`).
- **Дизайн токени:** платформен UI → `brand-*`/`ink-*`/`surface-*` токени. Storefront → само `--sf-*` променливи. Нула хардкоднати hex/px.
- **Gate:** `pnpm check` (lint + unit + build) преди всеки commit.
- **Контролни символи:** скан за `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` преди commit.

---

## Секция 1 — Product identifiers

### 1.1 Схема (база)

Нови колони в `products` (`src/db/schema.ts`), всички nullable:

```ts
sku: text("sku"),                    // вътрешен код на търговеца
gtin: text("gtin"),                  // EAN/UPC баркод (само цифри, валиден GTIN)
brand: text("brand"),                // override; null → shop.name
costCents: integer("cost_cents"),    // доставна цена, само admin
```

`db:push` ги добавя. Няма нов индекс (полетата не се търсят/филтрират).

### 1.2 GTIN валидация — `src/lib/gtin.ts`

Нова чиста функция + unit тест:

```ts
/** Валиден GTIN: точно 8, 12, 13 или 14 цифри + коректна GS1 контролна цифра. */
export function isValidGtin(raw: string): boolean {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return false;
  if (![8, 12, 13, 14].includes(s.length)) return false;
  // GS1 mod-10: тегла 3/1 отдясно наляво без последната цифра; сборът + check ≡ 0 (mod 10)
  const digits = s.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, pos = 0; i >= 0; i--, pos++) {
    sum += digits[i]! * (pos % 2 === 0 ? 3 : 1);
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}
```

Тестови вектори: `"4006381333931"` (валиден EAN-13) → true; `"036000291452"` (валиден UPC-A) → true; `"12345678"` (валиден EAN-8) → true; `"4006381333930"` (грешна чексума) → false; `"abc"` → false; `"1234567"` (7 цифри) → false; `""` → false.

### 1.3 Zod (`src/schemas/product.ts`)

```ts
sku: z.string().trim().max(60).default(""),
gtin: z.union([
  z.string().trim().refine((s) => isValidGtin(s), "Невалиден баркод (8–14 цифри с контролна цифра)"),
  z.literal(""),
]).default(""),
brand: z.string().trim().max(60).default(""),
cost: optionalPriceString.default(""),   // преизползва съществуващия optionalPriceString
```

Празно за всяко = валидно. Празен низ се пази като `null` в базата.

### 1.4 Action (`src/actions/products.ts`)

`saveProduct` приема новите полета; преди запис: `sanitizeText()` на sku/brand; gtin вече е валиден низ; `cost` → `toCents()` → `costCents` (или `null` при празно).

### 1.5 Форма — карта „Продуктови кодове" (детайлен режим)

Нова `Card` (само `showDetailed`):
- `Input` **SKU** — hint „Твой вътрешен код (напр. BLU-M-01). Клиентът не го вижда.“
- `Input` **GTIN / баркод** — `inputMode="numeric"`, hint „Баркод на артикула (EAN/UPC). Подобрява рекламите в Google.“, error от Zod.
- `Input` **Марка** — hint „Реалната марка. Празно → името на магазина.“
- `PriceInput` **Доставна цена** — hint „Само за теб — смятаме печалба. Не се вижда никъде публично.“

### 1.6 Feed (`src/lib/product-feed.ts`)

`FeedProduct` получава `sku: string | null`, `gtin: string | null`, `brand: string | null`.
- `<g:mpn>` = `sku`, само ако непразно.
- `<g:gtin>` = `gtin`, само ако непразно (вече валидиран при запис).
- `<g:identifier_exists>` = `yes` ако има gtin, иначе `no` (заменя твърдото `no`).
- `<g:brand>` = `brand ?? shop.name` (заменя твърдото `shop.name`).

Заявката, която зарежда feed продуктите, добавя новите три колони.

### 1.7 Публична страница

Марката се показва дискретно под името на продукта (в `VariantPicker` header или под него), само ако `product.brand` е зададена. SKU/GTIN/costCents **не** излизат публично.

### 1.8 Admin марж

На продуктовия списък/детайл (`/dashboard/products`): ако `costCents` е зададена, покажи „Марж: X%" = `round((priceCents - costCents) / priceCents * 100)`. Само за търговеца.

### 1.9 CSV (`product-import-export`)

4-те полета (sku, gtin, brand, cost в EUR десетично) стават нови колони в експорт/импорт. Импорт: празно → null; невалиден gtin → пропуска реда със съобщение (както другите валидации).

---

## Секция 2 — SEO per продукт

### 2.1 Схема

Нови колони в `products`, nullable:

```ts
seoTitle: text("seo_title"),
seoDescription: text("seo_description"),
```

### 2.2 Zod

```ts
seoTitle: z.string().trim().max(60).default(""),
seoDescription: z.string().trim().max(160).default(""),
```

### 2.3 Action

`sanitizeText()` на двете преди запис; празно → `null`.

### 2.4 Форма — карта „SEO" (детайлен режим)

- `Input` **SEO заглавие** — hint „Празно → името на продукта. Показва се в таба на браузъра и Google.“
- `Textarea` **SEO описание** — hint „Празно → началото на описанието. Показва се в Google под заглавието.“ + брояч на знаци (X/160).

### 2.5 Публична страница `generateMetadata`

```ts
title:            product.seoTitle || `${product.name} — ${shop.name}`
description:       product.seoDescription || product.description.slice(0, 160) || product.name
openGraph.title:  product.seoTitle || product.name
```

JSON-LD остава непроменен (реалните име/описание на продукта — не meta override).

---

## Секция 3 — Size guide (per магазин)

### 3.1 Схема — нова таблица `size_guides`

Огледало на `shipping_methods`:

```ts
export const sizeGuides = pgTable("size_guides", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  columns: jsonb("columns").$type<string[]>().notNull().default([]),
  rows: jsonb("rows").$type<string[][]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("size_guides_shop_idx").on(t.shopId)]).enableRLS();
```

Нова колона в `products`: `sizeGuideId: uuid("size_guide_id").references(() => sizeGuides.id, { onDelete: "set null" })`. Изтрита таблица → продуктите остават без размерна таблица (без счупен FK).

### 3.2 Zod — `src/schemas/size-guide.ts`

```ts
export const sizeGuideSchema = z.object({
  name: z.string().trim().min(2, "Въведи име").max(60),
  columns: z.array(z.string().trim().min(1).max(40)).min(1, "Поне една колона").max(8, "Максимум 8 колони"),
  rows: z.array(z.array(z.string().trim().max(40)).length(/* = columns.length, проверено в superRefine */))
    .max(50, "Максимум 50 реда"),
}).superRefine((v, ctx) => {
  for (const [i, row] of v.rows.entries()) {
    if (row.length !== v.columns.length) {
      ctx.addIssue({ code: "custom", path: ["rows", i], message: "Редът не съвпада с броя колони" });
    }
  }
});
```

Продуктовата схема получава: `sizeGuideId: z.union([z.uuid(), z.literal("")]).default("")`.

### 3.3 Заявки — `src/db/queries/size-guides.ts`

- `getSizeGuides(shopId)` → списък (за dashboard + за dropdown във формата).
- `getSizeGuide(shopId, id)` → една (за редактиране, филтрирана по shopId).
- `getProductSizeGuide(sizeGuideId)` → за публичната страница (само ако продуктът има закачена; заявката се извиква с вече валидиран id от продукта на магазина).

### 3.4 Actions — `src/actions/size-guides.ts`

`saveSizeGuide(id | null, input)`, `deleteSizeGuide(id)` — през `requireShop()`, Zod parse, sanitize на всяка клетка/име/колона.

### 3.5 Dashboard страница `/dashboard/size-guides`

Огледало на страницата за доставка:
- Списък с таблиците (име + брой редове) + бутон „Нова таблица" → `Drawer`.
- `EmptyState` когато няма таблици.
- Реюзабилен client компонент `SizeGuideEditor`: поле „Име" + динамична таблица — добави/премахни колона, добави/премахни ред, редактиране на клетки. Записва през `saveSizeGuide`. Изтриване с потвърждение.
- Nav линк в `src/components/dashboard/nav.tsx`.

### 3.6 Форма на продукта (детайлен режим)

`Select` **„Таблица с размери"** с опциите от `getSizeGuides(shopId)` (подадени като prop) + „— Няма —“. Ако магазинът няма таблици → hint с `LinkButton` към `/dashboard/size-guides` (шаблон като категориите сега).

### 3.7 Публична продуктова страница

Ако `product.sizeGuideId` е зададен → зареди таблицата → покажи бутон „Таблица с размери" (с `Icon`, не емоджи) до варианта. Клик → `Modal` (десктоп) / `Drawer` (мобилно) с реюзабилен `SizeGuideTable` компонент, който рендерира `columns` + `rows` през `--sf-*` токени. Показва се само при закачена таблица.

---

## Секция 4 — „Бързо / Детайлно" тогъл

### 4.1 Поведение

- Segmented control в горната част на формата: **Бързо** · **Детайлно**.
- **Бързо** = Основни · Цена/наличност · Снимки.
- **Детайлно** = всичко останало (тегло/размери, промоция, характеристики, варианти, продуктови кодове, SEO, size guide).
- `showDetailed = !simple && mode === "detailed"` — една производна, която заменя сегашните `!simple` гейтове.
- Onboarding (`simple = true`) → режимът е закован „Бързо"; тогълът **не се рендерира**.

### 4.2 Persist на избора

`localStorage` ключ `frizmo-product-form-mode` (`"quick" | "detailed"`), четен през `useSyncExternalStore` с кеширан snapshot (проектното правило — избягва hydration mismatch и react-compiler проблеми). Default при липса = `"detailed"` (запазва сегашното поведение за съществуващи потребители, които виждат пълната форма).

### 4.3 Скрити ≠ изтрити

Режимът е само визуален. Скритите полета остават в state-а и се подават към `saveProduct` с текущите си стойности — edit на продукт, създаден в детайлен режим, не губи данни при преминаване в „Бързо".

### 4.4 Компонент

`FormModeToggle` — локален за `product-form.tsx` (ползва се на едно място; ако по-късно потрябва другаде → изнасяме в `ui/`). Използва `ui/` бутони + токени.

---

## Ред на имплементация (един по един)

1. **Схема + GTIN util** — всички нови колони + `size_guides` таблица + `isValidGtin()` + `db:push`. (Основа за всичко.)
2. **Identifiers** — Zod + action + форма-карта + feed + публична марка + admin марж + CSV.
3. **SEO** — Zod + action + форма-карта + `generateMetadata`.
4. **Size guide** — заявки + actions + dashboard страница + редактор + форма-dropdown + публичен изглед.
5. **Тогъл** — `FormModeToggle` + persist + пренасочване на `!simple` гейтовете.

Всяка стъпка завършва с независимо тестваем deliverable + `pnpm check`.

## Тестване

- **Unit (Vitest):** `isValidGtin()` (векторите горе); feed промените (mpn/gtin/identifier_exists/brand override); size-guide row-length superRefine; SEO fallback логика (чиста функция ако се изнесе).
- **Ръчно (потребител):** форма в двата режима; identifiers → feed XML; марж в admin; SEO в `<head>` (Ctrl+U); size guide CRUD + публичен modal; CSV кръг; мобилно 375px; light/dark.
- **Без Playwright за естетика** (проектно правило).

## Извън обхват (YAGNI)

- Canonical/noindex per продукт (рядко нужно за дребен търговец).
- Google preview рендер под SEO полетата.
- Per-variant GTIN (feed е на ниво продукт).
- Auto-генериране на SKU.
