# Спец: Доверие + AOV пакет (verified ревюта · cross-sell в количката · „Нов" badge)

**Дата:** 2026-07-11
**Контекст:** Продуктовият gap одит сочи social proof и AOV като силни евтини лостове.
Три малки, комплементарни storefront функции в един спец (както конверсионното трио):
verified ревюта (доверие), cross-sell в количката (+AOV), „Нов" badge (свежест).
Всичко реюзва съществуващо; само **1 нова колона**.

**Дизайн език:** storefront — само `--sf-*` токени; mobile-first; един компонент за всички теми.

---

## A. Verified purchase ревюта

**Днес:** ревютата (`reviews`: shopId, productId, authorName, rating, text, status) са анонимни;
формата (`review-form.tsx`) не събира контакт; влизат `pending` до одобрение.

**Решение (избор: всеки може, телефон опционален):**
- Нова колона **`reviews.verified`** (boolean NOT NULL default false). `db:push` на общата база.
- Ревю формата получава **опционално поле „Телефон"** — не се показва публично и **не се пази**
  (използва се само транзиентно при submit). Placeholder подсказва защо („за бадж Потвърдена покупка").
- `submitReview` schema += `phone` (опционален). Логика: `parseBgPhone(phone)` → ако валиден И
  съществува поръчка в магазина с `customerPhone === e164`, статус ∈ {`confirmed`,`shipped`,
  `completed`}, съдържаща този продукт (`order_items.productId === productId`) → **`verified: true`**.
  Иначе `verified: false` (ревюто пак се записва `pending`).
- Проверката се изнася в query `hasPurchasedProduct(shopId, phoneE164, productId): Promise<boolean>`
  (`db/queries/reviews.ts`) — join `orders` × `order_items`.
- **Показване:** `getApprovedReviews` връща и `verified`; продуктовата страница показва бадж
  **„Потвърдена покупка"** (икона `shield-check`, `--sf-primary`) до `authorName` при `verified`.
- **Модерация непроменена:** verified НЕ заобикаля одобрението; и verified, и non-verified влизат
  `pending`. (verified е свойство на реда, търговецът пак решава дали да го публикува.)
- **Edge:** телефон без съвпадение → `verified=false`, без грешка. Празен телефон → `verified=false`.
  Rate limit/honeypot остават.

## B. Cross-sell в количката

**Днес:** количката е клиентска (localStorage; `CartView` е client, чете `cart-storage`); няма
предложения.

**Решение:**
- Нов server action **`getCartSuggestions(slug, productIds: string[])`** → зарежда категориите на
  подадените продукти → връща до **4** активни продукта от тези категории, **извън количката**,
  подредени по най-нови. Публичен → Zod (масив uuid-та, cap дължина) + лек rate limit; празно → `[]`.
  Заявка `getCrossSellProducts(shopId, productIds)` (`db/queries/storefront.ts`) — генерализира
  `getRelatedProducts` за няколко категории.
- В `CartView` (drawer + `/cart`, един компонент): под редовете, преди сумите — лента
  **„Може да ти хареса"** с компактни карти (снимка + име + цена + линк към продукта; клик =
  `onNavigate` затваря drawer-а). Извиква се веднъж при смяна на **набора productId-та** (не при +/−).
- **Edge:** празни предложения → лентата не се рендира; количката празна → нищо (компонентът вече
  връща empty state).

## C. „Нов" badge

**Днес:** `ProductCard` показва промо и „Изчерпано"; няма индикатор за нови продукти.

**Решение (избор: 14 дни):**
- Чиста функция **`isNewProduct(createdAt: Date, now: number, days = 14): boolean`** (`lib/product-badges.ts`,
  тествана).
- В `ProductCard`: бадж **„Нов"** (top-left) когато `isNewProduct(product.createdAt, Date.now())`.
  Позиция: колона от баджове top-left — промо баджът остава пръв, „Нов" под него ако и двете важат.
- Реюз навсякъде, където има `ProductCard` (листинги, свързани, cross-sell). Storefront е dynamic
  → баджът винаги е актуален (без кеш проблем).

---

## Тестване

- **Unit** (Vitest): `isNewProduct` (в прозореца → true; извън → false; точна граница; различни `days`).
- **Гейт** `pnpm check`.
- **Ръчна проверка** от потребителя (light + dark + 375px): бадж „Потвърдена покупка" след ревю с
  телефон, който съвпада с реална поръчка (и без съвпадение → без бадж); cross-sell лента в
  drawer-а и на `/cart`; „Нов" badge на скоро добавени продукти. (A и B са DB-интеграция → ръчно,
  по модела на storefront функциите.)

## Не-цели / решения

- Verified ревюта НЕ заобикалят модерацията; телефонът НЕ се съхранява (само за проверка).
- Cross-sell е по категория (без AI/история на покупки).
- „Нов" е само от `createdAt` (без ръчен флаг).
- Без промяна по съществуващата ревю модерация, `priceCart`, или количковата логика.
