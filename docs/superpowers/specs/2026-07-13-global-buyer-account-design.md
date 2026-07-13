# Глобален купувачески профил — дизайн (спец)

> **Дата:** 2026-07-13 · **Статус:** одобрен, чака имплементационен план.
> Разширение на купувачския профил ([[buyer-account-feature]] в паметта, спец
> `2026-07-13-buyer-account-design.md`). Преобръща per-магазинния модел → глобален.
> ADR: `docs/decisions/2026-07-13-global-buyer-account.md`.

## Мотивация

Ръчен тест (2026-07-13) разкри, че per-магазинният профил е объркващ: купувач влиза
глобално (Google), стои на каталога `/shops`, и няма къде да иде — профил икона има само
в storefront хедъра (`/s/{slug}`), а „моите поръчки" са само от онзи магазин. Купувачът
пазарува от МНОГО магазини → профилът трябва да е глобален.

## Одобрени решения (2026-07-13)

1. **Глобален `/account`** (платформена страница, не storefront) — всички поръчки/любими на
   едно място; профил икона в каталога/landing (`SiteHeader`).
2. **Любими: продукти + магазини.** Продуктите вече ги имаме (`buyerFavorites`); нова таблица
   `buyerFavoriteShops` + „сърце" на магазина в storefront хедъра И на каталог картите.
3. **Изтриване на акаунт** с потвърждение думата „ИЗТРИЙ" + анонимизиране на поръчките
   (`buyerId→null`, не се трият — търговецът ги пази за счетоводство) + гард за продавачи.
4. **Старите `/s/{slug}/account/*` → redirect** към глобалния `/account` (без дублиране).
5. **Купувач след вход → `/account`** (не `/shops`).

## Изрично ИЗВЪН обхвата (YAGNI)

- ❌ Известия за любими магазини (нови продукти/промоции).
- ❌ „Подобни магазини" / препоръки.
- ❌ Споделяне на wishlist.
- ❌ Обвързване на ревюта/Q&A с акаунт (както и в базовия спец).

---

## Архитектура

### Route структура — глобален `/account`

Нов платформен route (route група `(catalog)` — споделя `SiteHeader`/`SiteFooter`; НЕ
storefront, значи платформени токени `ink-*`/`surface-*`/`brand-*`, НЕ `--sf-*`):

- `/account` — табло: поздрав + последни поръчки (всички магазини) + бързи връзки +
  банер „свържи минали поръчки" (реюз на `countLinkableGuestOrders`/`linkGuestOrders`).
- `/account/orders` — ВСИЧКИ поръчки кросс-магазинно, всяка с бадж „от {магазин}", линк
  към детайла ѝ (`/s/{slug}/order/{id}?t={publicToken}`).
- `/account/favorites` — таб „Продукти" (групирани по магазин) + таб „Магазини".
- `/account/addresses` — адресната книга (мести се от storefront).
- `/account/settings` — име/телефон + изтриване на акаунт („ИЗТРИЙ") + изход.

Гард: `/account` layout вика `requireBuyer()` (нелогнат → `/auth/login`).

### Профил икона в `SiteHeader` (`marketing/site-header.tsx`)

`SiteHeader` е хедърът на каталога И landing-а. Нужен е логнат-статус (същия
`supabase.auth.getUser()` както в storefront layout-а — прокарва се като prop от layout-а,
защото `SiteHeader` е client компонент). Гост → „Вход" (както сега); логнат → икона „човече"
(`Icon name="user"`) → `/account`.

### Данен модел (`src/db/schema.ts`)

Нова таблица (нова + nullable → `db:push` безопасен, `.enableRLS()`):
```
buyerFavoriteShops:
  id, buyerId → profiles.id (onDelete cascade)
  shopId → shops.id (onDelete cascade)
  createdAt
  uniqueIndex (buyerId, shopId) · index (buyerId)
```
Без промяна: `buyerFavorites` (продукти), `buyerAddresses`, `orders.buyerId` — вече ги има.

### Query слой (`src/db/queries/buyer.ts`) — глобални варианти

- `getBuyerOrdersGlobal(buyerId)` → всички поръчки (join `shops` за име/slug на баджа),
  desc по дата. (Съществуващият `getBuyerOrders(buyerId, shopId)` остава за евентуален
  per-магазин изглед; глобалният е нов.)
- `getBuyerFavoriteProductsGlobal(buyerId)` → всички любими продукти (активни) + магазина им.
- `getBuyerFavoriteShops(buyerId)` → любимите магазини (име, лого, slug).
- `getBuyerFavoriteShopIds(buyerId)` → за сърце състоянието.

### Мутации (`src/actions/buyer.ts`)

- `toggleFavoriteShop(shopId)` → own, по аналогия с `toggleBuyerFavorite`.
- `deleteBuyerAccount()`:
  1. **Гард:** ако `shops.ownerId === user.id` → връща грешка „Имаш магазин — изтрий първо
     него от настройките на магазина." (не смесваме продавач/купувач потоците).
  2. Анонимизира: `update orders set buyerId=null where buyerId=user.id`.
  3. Трие `buyerAddresses`, `buyerFavorites`, `buyerFavoriteShops` на купувача.
  4. Трие Supabase auth юзъра: `createSupabaseAdmin().auth.admin.deleteUser(user.id)`.
  5. `signOut()` + redirect.

### Чиста функция (`src/lib/account-deletion.ts`)

- `confirmDeleteWord(input)` → `input.trim().toUpperCase() === "ИЗТРИЙ"` (по аналогия с
  съществуващия продавачки `confirmNameMatches`, но дума вместо име на магазин).

### Redirect (`src/lib/auth-redirect.ts`)

`resolvePostAuthPath` — купувач без валиден next: `/shops` → **`/account`** (профилът вече
съществува глобално). Продавач/има магазин → `/dashboard` (без промяна).

### Миграция на старите страници

- `/s/{slug}/account` + подстраниците (`orders`, `addresses`, `settings`) → server
  `redirect("/account…")`. Storefront профил иконата (`AccountButton`) сочи направо
  глобалния `/account`, не `${base}/account`.
- `FavoritesMerger` остава в storefront layout-а (merge на localStorage любими при вход).
- Account компонентите (nav, address-manager, settings-form) се пренаписват с платформени
  токени (глобалният `/account` е платформена страница) — или се правят нови платформени
  версии; старите `--sf-*` версии се махат заедно с per-магазин страниците.

### „Сърце" на магазина

- Storefront хедър: бутон-сърце до профил иконата (`toggleFavoriteShop`, оптимистично).
- Каталог карта (`marketing/ShopCard` или каталог списъка): сърце в ъгъла.
- И двете: логнат → server toggle; гост → подкана за вход (или скрито — реши при имплементация,
  по подразбиране води към `/auth/login?role=buyer`).

---

## Грешки, сигурност, тестове

**Изолация:** всяка глобална заявка/мутация филтрира по `buyerId = profile.id`; cross-buyer
теч = критичен бъг. `deleteBuyerAccount` минава през `requireBuyer` + гард за продавач.
`createSupabaseAdmin` (SECRET key) само на сървъра.

**Грешки:** общи BG съобщения. Rate limit на публичните купувачки мутации (toggle shop,
delete) през `rate-limit.ts`.

**Тестове (Vitest unit):**
- `confirmDeleteWord` — „ИЗТРИЙ"/„изтрий"/празно/грешна дума.
- `deleteBuyerAccount` — гард (продавач → отказ); анонимизира поръчки; трие own данни.
- Глобални queries — без shopId филтър, cross-buyer изолация.
- `toggleFavoriteShop` — добавя/маха, own only, невалиден shopId.
- `resolvePostAuthPath` — купувач без next → `/account`.

**E2e (Playwright, само гейт):**
- Логнат купувач → профил икона в каталога → `/account` → всички поръчки видими.
- Любим магазин toggle (сърце) → показва се в `/account/favorites` таб „Магазини".
- Изтриване с „ИЗТРИЙ" → акаунтът е изтрит, redirect.

---

## Обобщение на одобрените решения (2026-07-13)

1. Глобален `/account` (платформен), профил икона в `SiteHeader`.
2. Любими продукти + магазини (нова `buyerFavoriteShops` + сърце в каталог + storefront хедър).
3. Изтриване с „ИЗТРИЙ" + анонимизиране на поръчки + гард за продавачи.
4. Стари `/s/{slug}/account/*` → redirect към `/account`.
5. Купувач след вход → `/account`.
