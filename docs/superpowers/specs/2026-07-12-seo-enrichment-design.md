# Дизайн: SEO обогатяване (Пакет A)

**Дата:** 2026-07-12
**Статус:** одобрен дизайн, чака ревю на спеца
**Обхват:** обогатяване на SEO метаданните (Twitter/OG cards, Product schema, липсващи description/OG). Чисто декларативно — нула промяна в логика/данни/рендер.

## Контекст и цел

Одит на Next.js плюсовете (2026-07-12) показа: SSR/рутиране/Server Actions/оптимизации са отлични; SEO основата е солидна (metadataBase, canonical, динамичен sitemap, богат Product JSON-LD), но с пропуски. Този пакет ги затваря.

Разделено: **Пакет A = SEO** (този спец, нискорисков). **Пакет B = кеширане** (отделно, само безопасни победи — cookie-guard + about/contact/terms; главните страници остават dynamic = винаги свежи цени/наличност).

## Риск: практически нулев

Метаданните и JSON-LD не влияят на функционалност, данни или рендер — само на това как страницата изглежда в Google/социално споделяне. Най-лошият случай при грешка = „по-лош preview", не счупен сайт.

## Три подобрения

### 1. Twitter/OG глобални дефолти (`src/app/layout.tsx`)

В root `metadata` добавяме:
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
Next.js мержва метаданните надолу — страниците със свой `generateMetadata` (продукт `p/[productSlug]/page.tsx`, магазин `s/[slug]/page.tsx`) добавят своите `openGraph.images`/`title` върху тези дефолти. Нула дублиране, покрива всички страници наведнъж.

### 2. Обогати Product schema (`p/[productSlug]/page.tsx:92`)

Съществуващото `Product` JSON-LD ВЕЧЕ има: name, description, image, offers (price + **availability** — ред 102, вече присъства), aggregateRating, weight. Добавяме условно (само ако данните ги има):
- **`brand`**: `{ "@type": "Brand", name: product.brand }` — само ако `product.brand` е попълнен (иначе името на магазина като fallback).
- **`sku`**: `product.sku` — само ако попълнен.
- **`gtin13`**: `product.gtin` — само ако попълнен (schema.org gtin13 за EAN-13).
- **`offers.priceValidUntil`**: бъдеща дата (~1 година напред). Google предупреждава без нея за offers. Датата се подава от page-а (server) — НЕ се генерира в чиста функция (`new Date()` е забранен в helper-и/тестове по проектна конвенция; page-ът е server component и може да я сметне).

Всичко условно → нула празни/грешни полета към Google.

**Извличане за тестване:** логиката за building на Product schema обекта се изнася в чиста функция `buildProductJsonLd(input)` в неутрален модул `src/lib/product-json-ld.ts` (приема вече-изчислени стойности: name, description, image, price, currency, availability, brand, sku, gtin, rating, weight, priceValidUntil — всички прости стойности, без `Date`/`new Date`). Page-ът смята динамичните части (цена, дата) и извиква функцията. TDD.

### 3. Липсващи description/OG (`generateMetadata` на 5 страници)

- **storefront products** (`s/[slug]/products/page.tsx:37`) — добави `description` (напр. „Разгледай всички продукти от {shop.name}.") + `openGraph`.
- **about** (`s/[slug]/about/page.tsx:15`) — `description` (от shop.description или generic) + `openGraph`.
- **contact** (`s/[slug]/contact/page.tsx:16`) — `description` + `openGraph`.
- **catalog products** (`(catalog)/products/page.tsx:9`) — `openGraph` (title/description вече ги има).
- **catalog shops** (`(catalog)/shops/page.tsx:7`) — `openGraph`.

## Извън обхвата

- **ItemList / BreadcrumbList** JSON-LD — отложено (по-нишово).
- **Кеширане** — Пакет B (отделно).
- `availability` в Product — вече съществува, не се пипа.

## Тестване

- **`buildProductJsonLd`** — unit тестове (Vitest, TDD): brand присъства/липсва (fallback към магазин), sku/gtin условно, availability по флаг, priceValidUntil се включва когато е подадена. Без `Date` в теста (подава се като параметър).
- Метаданните (декларативни обекти) — не unit; визуална проверка.
- `pnpm check` гейт зелен преди край.

## Валидация на живо (потребител)

- Сподели продуктов/магазин линк в Facebook/Viber/X → preview картата излиза правилно.
- Google Rich Results Test (search.google.com/test/rich-results) → продуктов URL → Product schema минава с brand/availability/sku.
- Meta description на about/contact/products се вижда в `<head>` (view source).

**Важно:** OG preview-ите се кешират от соц. мрежите (Facebook debugger форсва ново четене) и OG images сочат абсолютни URL-и → пълната проверка на споделянето иска активен домейн (`frizmoshops.bg`) или прод deploy. На localhost OG няма да работи. Schema-та обаче се валидира сега (Rich Results Test приема прод URL).
