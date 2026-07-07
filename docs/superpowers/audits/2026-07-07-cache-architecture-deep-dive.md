# Дълбочинен анализ — Кеш архитектура на storefront (отложен дълг от Одит 3 #1)

> Събрана информация, НЕ план за изпълнение. Целта: когато решим да атакуваме
> кеша, стартираме от пълна карта, а не от нула. Статус: **само проучване**.

## 1. Проблемът в едно изречение

Всяка storefront страница (`/s/{slug}` и под-страниците) се рендерира **dynamic
(SSR на всяка заявка)** — нула статичен/ISR кеш — защото `getPublicShop` вика
`cookies()` + `supabase.auth.getUser()`, а това opt-out-ва цялото поддърво от
статична генерация. Цената я плаща **всеки анонимен купувач** (пълен render +
3–5 DB заявки на визита), макар че на 10 от 11 страници auth резултатът изобщо не
се ползва.

## 2. Точният механизъм (потвърден с Next.js 16 docs)

`getPublicShop` (`src/db/queries/storefront.ts:24`) →
`createSupabaseServer` (`src/lib/supabase/server.ts:5`) → `await cookies()` от
`next/headers`.

Next.js 16: извикване на `cookies()`/`headers()` по време на prerender хвърля
`DynamicServerError` и слага `revalidate = 0` → маршрутът пада от статичен на
dynamic (потвърдено от `dynamic-rendering.ts` в next кода). Понеже layout + всяка
page await-ват `getPublicShop`, **цялото `s/[slug]/` поддърво** е dynamic.

`getPublicShop` е `react.cache()`-нат → в рамките на ЕДНА заявка layout и page
споделят един `getUser()`. Тоест не е N+1 auth заявки — една е, но самото
`cookies()` докосване прави поддървото dynamic.

## 3. Кой реално ползва auth резултата (ключово за решението)

Инвентар (Explore одит, 2026-07-07):

| Файл | dynamic причина | Ползва ли `viewerIsOwner`/`viewingDraft`? |
|---|---|---|
| `layout.tsx` | `getPublicShop` (cookies+getUser) | **ДА** — preview банер + `<PreviewListener/>` (L102-112) |
| `page.tsx` (начало) | `getPublicShop` | НЕ — само `{shop, settings}` |
| `p/[productSlug]/page.tsx` | `getPublicShop` | НЕ — само `{shop}` |
| `about/page.tsx` | `getPublicShop` | НЕ — само `{shop, settings}` |
| `contact/page.tsx` | `getPublicShop` | НЕ |
| `terms/page.tsx` | `getPublicShop` | НЕ |
| `cart/page.tsx` | `getPublicShop` | НЕ |
| `checkout/page.tsx` | `getPublicShop` | НЕ |
| `products/page.tsx` | `getPublicShop` + **`searchParams`** | НЕ |
| `order/[orderId]/page.tsx` | `getPublicShop` + **`searchParams`** (order token) | НЕ |
| `newsletter/confirm/page.tsx` | `getPublicShop` + **`searchParams`** | НЕ |

**Прозрение №1:** само `layout.tsx` се нуждае от owner/draft информацията. Всички
10 page-а ползват единствено публични данни (`shop`/`settings`).

**Прозрение №2:** 3 страници (`products`, `order`, `newsletter/confirm`) ползват
`searchParams` → те остават естествено dynamic ДОРИ след кеш поправка. Реалните
кандидати за кеш са останалите: **начало, продукт, about, contact, terms, cart,
checkout** (7 страници — включително най-посещаваните: начало + продукт).

## 4. Инфраструктура, която ВЕЧЕ съществува (наполовина сме готови)

- **On-demand revalidation е налице:** 18 × `revalidatePath('/s/${slug}', 'layout')`
  във всяка мутация (products/categories/site-settings/fulfillment/shop/admin).
  Тоест „кога да опресним кеша" е решено — липсва само „изобщо да има кеш".
- **Draft/publish моделът е чист:** `site_settings.settings` (live) + `.draft`
  (owner-only). `publishSiteSettings` копира draft→settings. Публичният кеш трябва
  да отразява само `settings`, никога `draft`.
- **Storefront НЕ минава през proxy:** `proxy.ts` matcher = само
  `/dashboard|/admin|/auth`. Значи анонимните на `/s/*` нямат session refresh —
  `getUser()` в `getPublicShop` е ЕДИНСТВЕНАТА auth цена, и е излишна за тях.
- **`cacheComponents`/`use cache` НЕ е включен** в `next.config.ts` → проектът е
  на класическия кеш модел (важно за избора на подход).

## 5. Възможни подходи (Next.js 16 идиоми, от docs)

### Подход A — раздели публичния path от owner path (най-чист)
Направи публичните данни (`shop` + published `settings`) кешируеми през отделна
функция БЕЗ `cookies()` (напр. `getPublicShopCached` с `unstable_cache` или
`use cache` + `cacheTag('shop-{slug}')`). Owner draft preview се пренася в тънък
слой, който чете `cookies()` само когато трябва — напр. в layout през Suspense
boundary (docs патърн: static shell + streaming dynamic част).

- Плюс: 7-те безфилтърни страници стават статични/ISR за анонимни.
- Плюс: `revalidateTag('shop-{slug}')` вместо `revalidatePath` — по-точно.
- Внимание: owner draft preview НЕ бива да се счупи; `PreviewListener` +
  warning банер трябва да продължат да работят (те са в layout).
- Внимание: 3-те `searchParams` страници остават dynamic (приемливо).

### Подход B — Suspense boundary около cookie достъпа (docs препоръка за миграция)
Обвий частта, която чете `cookies()`/owner статуса, в `<Suspense>` →
статичната обвивка се prerender-ва, owner-специфичното стриймва на request.
- Плюс: по-малка промяна от A.
- Внимание: изисква `cacheComponents` за пълния ефект (не е включен) — иначе
  ползата е частична.

### Подход C — приеми dynamic, но махни излишната цена
Ако owner preview е свещен и не искаме риск: поне спри `getUser()` за анонимни
чрез бърза cookie проверка (има ли изобщо auth cookie, преди да викаш Supabase).
- Плюс: минимален риск, спестява Supabase round-trip за 99% от трафика (анонимни).
- Минус: страниците остават dynamic (SSR), само по-евтин SSR. Не е истински кеш.

## 6. Рискове / капани при изпълнение

1. **Owner draft preview е критичен фийчър** — цялата поправка стои или пада на
   това дали owner-ът продължава да вижда `draft` на живо с `router.refresh()`.
2. **`generateMetadata` също вика `getPublicShop`** на всяка страница → трябва
   същото кеш третиране (docs има `DynamicMarker` патърн за metadata с cookies).
3. **`themeColor` в `generateViewport`** (layout) също минава през `getPublicShop`.
4. **Cross-tenant кеш замърсяване** — кеш ключът ТРЯБВА да е по `slug`/`shopId`,
   иначе магазин A вижда кеша на B. `cacheTag('shop-{shopId}')`.
5. **`suspended`/`blocked`/`draft` магазини** — кешираният публичен path трябва да
   уважава статуса (само `published` е публичен; draft/preview е owner-only).

## 7. Очаквана печалба

- Начална + продуктова страница (най-тежкият трафик, 65% мобилен) от „SSR + 3-5
  DB заявки на визита" → „кеширан HTML, DB заявка само при мутация".
- По-нисък TTFB, по-малко Supabase натоварване, по-евтин Vercel.
- On-demand invalidation вече е свързан → съдържанието остава свежо.

## 8. Отворени въпроси за преди старт

- Има ли ОТДЕЛНА prod база? (одитът предполага „не" — една обща.) Влияе на теста.
- Приемливо ли е 3-те `searchParams` страници да останат dynamic? (да, логично).
- Кой подход — A (чисто разделяне, най-голяма печалба, повече работа) или C
  (нискорисково, частична печалба)?

## 9. Какво Е направено (2026-07-07) — безрискова подготовка

При опита за имплементация се потвърди фундаменталният конфликт: **началната и
продуктовата страница (най-тежкият трафик, който искаме да кешираме) са ТОЧНО
страниците, които owner-ът гледа с draft в preview iframe-а на редактора.** Кеш
(published) + live draft preview на СЪЩАТА страница не съжителстват в класическия
Next.js кеш модел без `cacheComponents`.

Затова НЕ кеширахме страниците (щеше да счупи owner preview). Вместо това
запазихме безрисковата подготовка, която прави бъдещото включване тривиално:

- **`revalidateTag` инфраструктура** — всяка published-мутация вече тагва
  `shop:{slug}` (products, categories, fulfillment, shop, admin, site-settings).
  Next.js 16 сигнатура: `revalidateTag(tag, "max")` (2-ри арг. е cacheLife профил;
  „max" = serve-stale-while-revalidate). Draft-записите (`saveSiteSettings`,
  `savePreviewDraft`) НЕ инвалидират кеша — те пипат само `draft` колоната.
- **`getPublicShopCached(slug)` + `shopCacheTag(slug)`** в `storefront.ts` —
  готова кеширана заявка (published-only, без cookies, `unstable_cache` + таг).
  Още не е закачена към страница (чака cacheComponents), но е тествана и готова.
- Поведението днес е НЕПРОМЕНЕНО — storefront остава dynamic, owner preview цял.

## 10. Пълното решение (следваща отделна стъпка): `cacheComponents`

Единственият чист начин да кешираме начало+продукт БЕЗ да чупим owner preview е
да включим Next.js 16 **Cache Components** режима (`cacheComponents: true` в
`next.config.ts`) и да ползваме static shell + `<Suspense>` за cookie/owner
частта (docs патърн). Тогава:
- Публичната обвивка се prerender-ва (кеш), owner-специфичното (PreviewListener,
  draft) стриймва на request зад Suspense.
- `getPublicShopCached` се закача директно; `revalidateTag` инфраструктурата вече
  е налице → нула допълнителна работа по инвалидацията.

⚠️ Но `cacheComponents` е **project-wide** промяна: ВСЯКА dynamic точка в целия
проект (dashboard, admin, auth, всички `cookies()`/`searchParams` достъпи) трябва
да мине зад Suspense, иначе build гърми. Това е СОБСТВЕН одит + тест цикъл, не
add-on към тази задача. Кандидат за отделна сесия, когато трафикът го оправдае.

Виж [[audit-cycle-2026-07-07]] · брифа на одита `2026-07-07-audit-3-performance.md`.
