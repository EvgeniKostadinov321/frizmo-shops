# Дизайн: Кеш безопасни победи (Пакет B)

**Дата:** 2026-07-12
**Статус:** одобрен дизайн, чака ревю на спеца
**Обхват:** две нискорискови performance подобрения — cookie-guard на `getPublicShop` + кеширане на `terms`. Нулев риск от стара информация.

## Контекст и цел

Одит на Next.js плюсовете (2026-07-12) намери, че кеширането е единствената реална дупка. Известният кеш дълг: главните публични страници (магазин/продукт) са dynamic заради owner draft preview конфликт. Пълното решение (`cacheComponents`) е project-wide → отделна сесия.

Този пакет взима САМО безопасните печалби. Разделено от Пакет A (SEO).

**Ключова корекция на одита:** одитът предположи, че about/contact/terms са безопасни за кеш. Проверка показа: **about и contact СА в owner preview iframe-а** (`preview.tsx` пътища: home/продукт/cart/about/contact) и owner редактира техния текст в редактора (`editor.tsx` — aboutText, legalOverrides) → те имат същия draft preview конфликт → **остават dynamic**. Само **`terms` НЕ е в preview iframe-а** → безопасен за кеш.

## Обхват и защо е безопасно

### 1. Cookie-guard в `getPublicShop` (`src/db/queries/storefront.ts:60`)

Днес всяка заявка към dynamic страница прави Supabase `getUser()` round-trip дори за анонимен посетител (ред 64-67: `createSupabaseServer()` + `getUser()` безусловно). Добавяме проверка за Supabase auth cookie преди round-trip-а.

- **Печалба:** ~99% анонимен трафик → спестен мрежов round-trip към Supabase на всяка dynamic страница (about/contact/cart/checkout/products/order/newsletter).
- **Риск: НУЛЕВ.** Логиката е идентична за анонимен (той и без това получаваше `viewerIsOwner=false`). Логнат → cookie съществува → пълен `getUser()` както сега. Никой не вижда различни данни — само спестена излишна заявка.
- **Fail-safe посока:** ако guard-ът сгреши, безопасната посока е да НЕ пропусне round-trip (по-бавно, но коректно — owner пази draft preview). Никога обратното. Затова guard-ът е нарочно ШИРОК (`sb-` + съдържа `auth-token`).

### 2. Terms → `getPublicShopCached` (`s/[slug]/terms/page.tsx`)

`terms` НЕ е в owner preview iframe-а (потвърдено: `preview.tsx` пътищата НЕ включват terms). Owner не гледа draft на terms. Terms прави `notFound()` при `null` и НЕ ползва `viewerIsOwner`/`viewingDraft` (потвърдено — само `shop` + `settings.legalOverrides`).

- **Печалба:** terms става ISR (кеширан) — нула SSR/DB за анонимен.
- **Риск: НУЛЕВ.** `legalOverrides` се инвалидират чрез `revalidateTag(shopCacheTag(slug))` при промяна (мрежата е готова). Owner не очаква live draft на terms.
- Непубликуван магазин → `getPublicShopCached` връща `null` → `notFound()` (както сега).

## Архитектура

### Cookie-guard

Чиста тествана функция `hasSupabaseAuthCookie(cookieNames: string[]): boolean` в неутрален модул `src/lib/supabase/auth-cookie.ts` (Supabase `@supabase/ssr` ползва `sb-<ref>-auth-token`, с `.0`/`.1` chunk суфикси при големи сесии — guard-ът покрива всички: име съдържа `auth-token` и започва с `sb-`).

В `getPublicShop`:
```ts
export const getPublicShop = cache(async (slug: string) => {
  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, slug) });
  if (!shop) return null;

  const cookieNames = (await cookies()).getAll().map((c) => c.name);
  let viewerIsOwner = false;
  let user = null;
  if (hasSupabaseAuthCookie(cookieNames)) {
    const supabase = await createSupabaseServer();
    ({ data: { user } } = await supabase.auth.getUser());
    viewerIsOwner = user?.id === shop.ownerId;
  }

  if (shop.status !== "published" && !viewerIsOwner) return null;
  // ... settings/draft логика непроменена (useDraft = viewerIsOwner && row?.draft != null)
});
```
`cookies` се импортира от `next/headers`.

### Terms

Замяна на `getPublicShop(slug)` с `getPublicShopCached(slug)` в двете места (`generateMetadata` + компонента). `getPublicShopCached` връща `{ shop, settings }`. Terms ползва само тях → чиста замяна. `notFound()` при `null` остава.

## Тестване

- **`hasSupabaseAuthCookie`** — unit тестове (Vitest, TDD): празен списък → false; `["sb-abc-auth-token"]` → true; `["sb-abc-auth-token.0"]` → true (chunk); `["some-other", "session"]` → false; смесен списък с auth cookie → true.
- **Terms / cookie-guard интеграция** — без нов e2e; визуална проверка на живо.
- `pnpm check` гейт зелен.

## Валидация на живо (потребител)

- Анонимен посетител → магазин/страници работят (нищо визуално различно, само по-бърз SSR).
- Owner в редактора → draft preview на about/contact още работи (guard-ът не го чупи — owner има cookie).
- Terms зарежда правилно; промяна на правен текст → инвалидира се (revalidateTag).

## Извън обхвата

- **about / contact** — имат owner preview draft конфликт → остават dynamic.
- **магазин / продукт** — dynamic (свежи цени/наличност).
- **Пълно `cacheComponents`** — project-wide, отделна сесия.
