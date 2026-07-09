# Product feed (Google Merchant / Facebook каталог) — дизайн

**Дата:** 2026-07-10
**Статус:** одобрен за планиране
**Обхват:** чисто в кода (без външна настройка от потребителя)
**Предусловие (готово):** тегло на продукт (`weightGrams`) — вече налично след функция №1.
**Свързани (по-късни):** product identifiers (SKU/GTIN/brand) — SHOULD, отделна функция; abandoned cart — №3.

---

## 1. Цел

Всеки **published** магазин да има автоматично генериран XML product feed на публичен URL, който търговецът (или негов маркетолог) подава на **Google Merchant Center** или **Facebook/Instagram каталог**, за да рекламира продуктите. Нула конфигурация — feed-ът работи наготово.

### Ключово решение: нула конфиг за нетехничния търговец

Целевият търговец (напр. прави бижута, не е технически) няма да знае какво е GTIN, SKU или Google реклами. Затова:
- **Няма нови полета, няма форма, няма задължителна настройка.** Feed-ът се строи от данните, които вече имаме.
- **`identifier_exists=no`** — казваме на Google, че продуктите нямат баркодове (валидно за handmade/малки магазини; Google го приема).
- **`g:brand` = името на магазина** (нямаме отделно brand поле; името е добър fallback).
- Търговецът вижда само **един ред в настройките** с URL + копирай бутон.

**Извън обхвата (нарочно, YAGNI):**
- Product identifiers (SKU/GTIN/brand/MPN на ниво продукт) — отделна функция.
- Ред на всеки **вариант** (item_group_id) — един ред на продукт засега.
- Размери/количество във feed-а — Google ги иска само в специфични категории.
- Google product category mapping (таксономия) — свободната категория отива в `g:product_type`.
- Предгенериране в Storage / cron — ISR кешът е достатъчен.

---

## 2. Архитектура

**Подход:** dynamic route handler с ISR кеш (следва pattern-а на `src/app/(dashboard)/dashboard/products/export/route.ts` и `sitemap.ts`).

Нов route: **`src/app/(storefront)/s/[slug]/feed.xml/route.ts`** (Next.js 16 позволява `.xml` в динамичен сегмент; проверява се при билд).

**GET flow:**
1. `getPublicShop(slug)` — ако няма магазин или не е published → `404` (чист, без stack trace).
2. `getFeedProducts(shop.id)` — активните продукти + категорийни имена.
3. `buildProductFeed(shop, products, categoryNames, baseUrl)` — чиста функция → XML string.
4. `Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": ... } })`.

**Кеширане:** `export const revalidate = 3600` (1 час). Продуктовите мутации вече викат `revalidateShop(slug)` → `revalidateTag(shopCacheTag(slug))`, което инвалидира и feed-а → свеж при промяна, но кеширан за ботовете. Базата се удря рядко (Google/FB теглят на часове).

**Base URL:** същият като sitemap-а — `process.env.NEXT_PUBLIC_SITE_URL` с fallback `https://frizmo-shops.vercel.app`. За консистентност се изнася в малка константа/helper (виж секция 3).

---

## 3. Query (`src/db/queries/storefront.ts`)

Нова функция:
```ts
export async function getFeedProducts(shopId: string) {
  const rows = await db.query.products.findMany({
    where: and(eq(products.shopId, shopId), eq(products.status, "active")),
    orderBy: [desc(products.createdAt)],
    columns: {
      id: true, name: true, slug: true, description: true,
      priceCents: true, promoPriceCents: true, stock: true,
      images: true, weightGrams: true, categoryId: true,
    },
    limit: 10_000, // предпазител; над това е нереалистично за нашия мащаб
  });
  return rows;
}
```
Категорийните имена: отделна заявка `db.query.categories.findMany({ where: eq(categories.shopId, shopId) })` → `Map<id, name>` (както в export route-а). Може да живее в route-а или до заявката — планът решава; идеята: `g:product_type` е по избор, само ако продуктът има категория.

**Забележка:** `getFeedProducts` НЕ пагинира — feed-ът е пълният каталог. Лимит 10000 е таван-предпазител; ако се удари, `console.warn` (структуриран лог) — не тиха загуба.

---

## 4. XML билдър (`src/lib/product-feed.ts`)

### `escapeXml(s: string): string`
Чиста функция. Escape в правилен ред (`&` първо):
```ts
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
```

### `buildProductFeed(shop, products, categoryNames, baseUrl): string`
Чиста функция (без DB/HTTP) — тества се изолирано.

**Сигнатура (типове):**
```ts
interface FeedShop { name: string; slug: string; }
interface FeedProduct {
  id: string; name: string; slug: string; description: string;
  priceCents: number; promoPriceCents: number | null;
  stock: number | null; images: string[];
  weightGrams: number | null; categoryId: string | null;
}
function buildProductFeed(
  shop: FeedShop,
  products: FeedProduct[],
  categoryNames: Map<string, string>,
  baseUrl: string,
): string
```

**Структура (RSS 2.0 + Google namespace):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>{escape(shop.name)}</title>
    <link>{baseUrl}/s/{shop.slug}</link>
    <description>Продукти от {escape(shop.name)}</description>
    {items}
  </channel>
</rss>
```

**Всеки `<item>` (само за продукти СЪС снимка — без снимка се пропуска):**

| Таг | Стойност | Условие |
|---|---|---|
| `g:id` | `product.id` (UUID) | винаги |
| `g:title` | `escape(name)` | винаги |
| `g:description` | `escape(plainText(description).slice(0,5000))` | винаги (може празно) |
| `g:link` | `{baseUrl}/s/{shop.slug}/p/{product.slug}` | винаги |
| `g:image_link` | `publicImageUrl(images[0])` | винаги (иначе продуктът се пропуска) |
| `g:additional_image_link` | `publicImageUrl(images[i])` за i=1..10 | по един таг на снимка |
| `g:availability` | `in_stock` ако `stock===null \|\| stock>0`, иначе `out_of_stock` | винаги |
| `g:price` | `{(priceCents/100).toFixed(2)} EUR` | винаги (редовната цена) |
| `g:sale_price` | `{(promoPriceCents/100).toFixed(2)} EUR` | само ако `promoPriceCents !== null` |
| `g:brand` | `escape(shop.name)` | винаги |
| `g:condition` | `new` | винаги |
| `g:identifier_exists` | `no` | винаги |
| `g:shipping_weight` | `{weightGrams} g` | само ако `weightGrams !== null` |
| `g:product_type` | `escape(categoryNames.get(categoryId))` | само ако има категория |

**`plainText(s)`:** маха HTML тагове (описанието е plain, но за сигурност) + нормализира whitespace. Малка вътрешна helper функция.

**Пропуснати продукти без снимка:** логват се обобщено (брой) с `console.warn` — не тихо.

**`publicImageUrl`** идва от `@/lib/storage` (връща абсолютен Supabase URL).

---

## 5. Discovery UI (dashboard настройки)

Ред в `src/app/(dashboard)/dashboard/store/page.tsx` — в header Card-а (където вече се показва „Публичен адрес: /s/{slug}"), **само за published магазин**:

- Заглавие/етикет: **„Product feed за реклами"**
- Едно изречение (тон „на ти", типографски кавички): „Дай този линк на Google Merchant или Facebook каталог, за да рекламираш продуктите си."
- Read-only показан URL: `{baseUrl}/s/{slug}/feed.xml`
- **Копирай бутон** — нов малък client компонент `src/components/dashboard/copy-button.tsx` (`"use client"`): `navigator.clipboard.writeText(url)` → toast „Копирано"; иконата е `<Icon name="link" />`, при успех временно `<Icon name="check" />`. Ползва `@/components/ui` `<Button>`.
- Ако магазинът НЕ е published → редът не се показва (или показва „Публикувай магазина, за да получиш feed") — планът избира по-простото; предпочитано: просто не се показва.

Само `@/components/ui` компоненти, без голи елементи, touch target ≥44px, без емоджита.

---

## 6. Грешки

- Немо́жем/не-published магазин → route `404` (Next `notFound()` или `new Response(null,{status:404})`).
- Продукт без снимка → тихо пропуснат от feed-а (Google изисква `image_link`); обобщен `console.warn`.
- Празен каталог → валиден XML с 0 `<item>` (Google приема празен feed).
- Никакви stack traces към клиента.

---

## 7. Тестове (Vitest — само логиката)

`src/lib/product-feed.test.ts`:
- **`escapeXml`:** `&`→`&amp;` · `<`→`&lt;` · `>`→`&gt;` · `"`→`&quot;` · `'`→`&apos;` · комбиниран `a & <b>` → правилен ред (амперсандът не се двойно-escape-ва)
- **`buildProductFeed`:**
  - съдържа `<?xml` + `<rss` + namespace + `<channel><title>`
  - продукт: `<g:id>`, `<g:title>`, `<g:price>12.50 EUR</g:price>`, `<g:link>` абсолютен
  - `<g:sale_price>` присъства при промо, липсва без промо
  - `<g:availability>in_stock</g:availability>` при stock>0/null; `out_of_stock` при stock=0
  - `<g:shipping_weight>500 g</g:shipping_weight>` само при тегло
  - `<g:product_type>` само при категория (с име от Map)
  - продукт БЕЗ снимка → не се появява `<item>` за него
  - escape в title/description (продукт с име „A & B <c>")
  - `<g:brand>` = името на магазина
  - `identifier_exists>no` винаги
  - празен списък продукти → валиден XML, 0 `<item>`

UI (копирай бутон) — ръчна проверка от потребителя (правило: без Playwright визуални тестове).

**Гейт:** `pnpm check` (lint + unit + build) минава преди commit.

---

## 8. Обобщение на засегнатите файлове

| Файл | Промяна |
|---|---|
| `src/lib/product-feed.ts` | `escapeXml` + `plainText` + `buildProductFeed` (нов, чист) |
| `src/lib/product-feed.test.ts` | тестове (нов) |
| `src/db/queries/storefront.ts` | `getFeedProducts(shopId)` (нов) |
| `src/app/(storefront)/s/[slug]/feed.xml/route.ts` | GET handler (нов) |
| `src/components/dashboard/copy-button.tsx` | copy бутон (нов, client) |
| `src/app/(dashboard)/dashboard/store/page.tsx` | ред „Product feed за реклами" + URL + copy |

**Няма:** нови колони, нови задължителни полета, cron, Storage, миграция. Feed-ът е чист automation върху съществуващите данни.

**Ред на изпълнение (за плана):** `escapeXml`+`buildProductFeed`+тестове (чиста логика първо) → `getFeedProducts` заявка → route handler → copy бутон компонент → UI ред в store → финална `pnpm check`.
