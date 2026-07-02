# Plan 4: Количка и поръчки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Inline режим). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Купувач поръчва като гост от публичния магазин (количка → checkout → потвърждение), с коректно сървърно ценообразуване (промоции „купи N за X", промо цени, праг за безплатна доставка), а търговецът настройва методи за плащане/доставка, получава имейл + **push „Нова поръчка!"** и управлява поръчките по статуси.

**Architecture:** Количката живее в localStorage per-магазин (гост, без профил); всяка цена се преизчислява на сървъра от чист pricing engine (TDD-ната библиотека, споделена между количка/checkout). Поръчката се създава в транзакция: валидация → декремент на наличности → пореден номер per-магазин (unique + retry). Публичният endpoint е пазен от Postgres rate limiter + honeypot. Известията: Resend имейли + Web Push (VAPID) към абонираните устройства на търговеца — тук PWA-то се изплаща.

**Tech Stack:** наличният + `resend` + `web-push`.

---

## Ключови решения

1. **Количка**: localStorage ключ `frizmo-cart-{shopId}`, редове `{ productId, variantKey | null, qty }`. Клиентът никога не смята пари — цените идват от сървърен action `priceCart()` (същият engine като checkout-а).
2. **Пореден номер на поръчка**: `orders.orderNumber` int, `uniqueIndex(shopId, orderNumber)`; в транзакцията `max+1`, при conflict — 3 retry-а. Показва се като `#0001`.
3. **Количествени промоции**: 1 активна промоция per продукт („купи N за общо X €"), редактира се в продуктовата форма (секция „Промоция"). Прилага се на цели групи от N: qty 5 при N=2 → 2×deal + 1×единична. Не се комбинира с промо цена (deal-ът има приоритет, ако qty ≥ N).
4. **Вариант в количката**: `variantKey` (стабилният ключ от `variantKey()`); при checkout вариантът се резолва наново — изтрит вариант = ред с грешка.
5. **Наличности**: декремент на вариантната наличност, ако вариантът я следи; иначе на продуктовата; `null` = не се следи. Отказана поръчка връща наличностите (симетрично).
6. **Rate limiting**: таблица `rate_limits` (key, window_start, count) — плъзгащ прозорец в Postgres, `checkRateLimit(key, max, windowSec)`; checkout: 5/час per IP per магазин. Без Redis.
7. **Имейли**: Resend; подател `Frizmo Shops <onboarding@resend.dev>` до верифициране на домейн (План 6/launch). До купувача — само ако е дал имейл. Има от преди `RESEND_API_KEY` env.
8. **Web Push**: `push_subscriptions` таблица (userId, endpoint unique, keys); абониране от банер в dashboard-а („Получавай известия за нови поръчки"); VAPID ключове в env (генерирам ги аз); `web-push` изпраща при нова поръчка на всички абонаменти на собственика; 404/410 отговор → абонаментът се трие. Service worker `public/sw.js` (само push — без offline кеширане засега).
9. **Плащане/доставка**: seed на дефолтни методи при първо отваряне на таба (наложен платеж + куриер), за да не е празен checkout-ът.
10. **Checkout на suspended/draft магазин**: блокиран на сървъра (не разчитаме само на UI).

---

### Task 1: Схема (6 нови таблици)

**Files:** Modify `src/db/schema.ts`; `pnpm db:push`

```ts
export const shippingTypeEnum = pgEnum("shipping_type", ["courier", "pickup", "local"]);
export const paymentTypeEnum = pgEnum("payment_type", ["cod", "bank_transfer", "on_site"]);
export const orderStatusEnum = pgEnum("order_status", ["new", "confirmed", "shipped", "completed", "cancelled"]);

shippingMethods: id, shopId FK cascade, type, name text, priceCents int default 0,
  freeOverCents int nullable, active bool default true, sortOrder, timestamps
paymentMethods: id, shopId FK cascade, type, name text, details text default ''  // IBAN и т.н.
  active bool default true, sortOrder, timestamps
promotions: id, shopId FK cascade, productId FK cascade unique, quantity int, totalPriceCents int,
  active bool default true, timestamps
orders: id, shopId FK cascade, orderNumber int, customerName text, customerPhone text,
  customerEmail text default '', address text, city text, note text default '',
  shippingName text, shippingPriceCents int, paymentName text, paymentType paymentTypeEnum,
  subtotalCents int, totalCents int, status default 'new', timestamps
  + uniqueIndex(shopId, orderNumber), index(shopId, status), index(shopId, createdAt)
orderItems: id, orderId FK cascade, productId uuid (БЕЗ FK cascade — snapshot оцелява изтрит продукт;
  nullable FK set null), productName text, variantLabel text default '', variantKey text default '',
  unitPriceCents int, quantity int, lineTotalCents int, appliedDeal text default ''
pushSubscriptions: id, userId uuid FK profiles cascade, endpoint text unique, p256dh text, auth text, timestamps
rateLimits: key text primaryKey, windowStart timestamp, count int
```

Всички `.enableRLS()`. Push + проверка.

---

### Task 2: Pricing engine (TDD — най-критичната логика в целия продукт)

**Files:** `src/lib/pricing.ts`, `src/lib/pricing.test.ts`

Чиста функция без db достъп:

```ts
export interface PricingProduct {
  id: string; name: string; status: "active" | "inactive";
  priceCents: number; promoPriceCents: number | null; stock: number | null;
  variants: { key: string; label: string; priceCents: number | null; stock: number | null }[];
  deal: { quantity: number; totalPriceCents: number } | null;
}
export interface CartLine { productId: string; variantKey: string | null; qty: number }
export type LineError = "not_found" | "inactive" | "variant_missing" | "out_of_stock" | "insufficient_stock";
export interface PricedLine { ...; unitPriceCents; lineTotalCents; appliedDeal: string; error?: LineError }
export interface PricedCart {
  lines: PricedLine[]; subtotalCents: number;
  shipping: { name: string; priceCents: number; freeApplied: boolean } | null;
  totalCents: number; hasErrors: boolean;
}
export function priceCart(lines, products: Map<string, PricingProduct>, shipping?): PricedCart
```

Правила: единична цена = вариантна ?? промо ?? базова; deal: при qty ≥ N →
`floor(qty/N) * totalPrice + (qty % N) * единичната-БЕЗ-промо?` — НЕ: остатъкът
ползва нормалната единична логика (промо ако има). Доставка: freeOverCents ≤ subtotal → 0.

Тестове (минимум): базова цена; промо цена; вариантна override; deal точно N; deal 2N+1;
deal неактивен продукт; недостатъчна наличност (variant и product ниво); изтрит вариант;
безплатна доставка на прага (точно равно); празна количка.

---

### Task 3: Rate limiter (TDD-able през db — интеграционен smoke в action-а)

**Files:** `src/lib/rate-limit.ts`

```ts
/** true = позволено. Фиксиран прозорец в Postgres — достатъчен за MVP. */
export async function checkRateLimit(key: string, max: number, windowSec: number): Promise<boolean>
// upsert: ако window_start < now()-window → reset(1); иначе count+1; връща count <= max
```

---

### Task 4: Таб „Плащане и доставка"

**Files:** `src/schemas/fulfillment.ts`, `src/actions/fulfillment.ts`,
`/dashboard/fulfillment/page.tsx`, `src/components/dashboard/fulfillment-manager.tsx`; nav таб.

Две карти (Доставка / Плащане) със списъци: име, детайли, цена (за доставка) + праг
за безплатна, toggle active, ✎ (Drawer), 🗑 (Confirm), „+ Добави". Seed на дефолтите
при празно (server-side при GET): „Куриер до адрес" 5 € / free over 60 €; „Наложен платеж".
Actions: CRUD с ownership + Zod (както категориите).

---

### Task 5: Промоция „купи N за X" в продуктовата форма

**Files:** Modify `src/schemas/product.ts` (+ `deal: { quantity ≥ 2, totalPrice: priceString } | null`),
`src/actions/products.ts` (upsert/delete на promotions реда в транзакцията),
`src/db/queries/products.ts` (зарежда deal-а), `product-form.tsx` (Card „Промоция":
Checkbox „Количествена промоция" → 2 полета „Купи [N] броя за общо [X €]" + предупреждение,
че замества промо цената при достигнато N).
Валидация: totalPrice < N × редовната цена.

---

### Task 6: Количка (storefront)

**Files:** `src/lib/cart-storage.ts` (client: get/set/add/remove/setQty + event за header брояча),
`src/actions/cart.ts` (`priceCartAction(shopSlug, lines)` — зарежда продуктите+deals+methods,
вика pricing engine; публичен, rate limit 60/мин per IP),
`src/components/storefront/cart-button.tsx` (икона+брояч в header-а),
`src/components/storefront/add-to-cart.tsx` (в продуктовата страница: qty picker + бутон;
изисква избран вариант при опции; toast „Добавено"),
`/s/[slug]/cart/page.tsx` (client: редове със снимка/име/вариант/qty +/−/премахни,
"deal приложен" бадж, суми, грешки по редове („вече не е наличен" → премахни), CTA към checkout).

`VariantPicker` подава избора към `AddToCart` (lift state: двата се обединяват в
`ProductPurchasePanel` — VariantPicker + AddToCart в един клиентски компонент).

---

### Task 7: Checkout + createOrder

**Files:** `/s/[slug]/checkout/page.tsx` + `src/components/storefront/checkout-form.tsx`,
`src/schemas/order.ts`, `src/actions/orders.ts` (`createOrder`),
`/s/[slug]/order/[orderId]/page.tsx` (потвърждение: номер, редове, суми, инструкции при банков превод).

`orderSchema`: име (min 2), телефон (parseBgPhone), имейл optional, адрес (min 5) —
освен при pickup, град, бележка ≤500, shippingMethodId, paymentMethodId, lines, **honeypot
поле `website` (трябва да е празно)**.

`createOrder` стъпки (всичко на сървъра):
1. Магазинът е `published` (иначе fail „Магазинът не приема поръчки.").
2. Honeypot попълнен → тихо ok (ботът не научава нищо) с fake номер.
3. `checkRateLimit("order:{ip}:{shopId}", 5, 3600)` (IP от headers).
4. Методите съществуват, активни, на този магазин.
5. `db.transaction`: заключване на продуктите (`select ... for update`), pricing engine
   върху свежите данни → грешки → fail с per-ред детайли; иначе: декремент наличности,
   orderNumber (max+1, retry×3 при unique conflict), insert order + items (snapshot).
6. След commit: имейли + push (fire-and-forget, не блокират отговора).
7. Връща `{ orderId }` → redirect към потвърждението. Клиентът чисти количката.

---

### Task 8: Имейли (Resend)

**Files:** `src/lib/email.ts` — `sendOrderEmails(order, items, shop)`:
до търговеца („Нова поръчка #0001 — 3 артикула, 54,90 €" + редове + клиент) и до
купувача, ако има имейл („Поръчката ти при {shop} е приета" + резюме + условия линк).
Прости HTML шаблони (инлайн стилове, без библиотека). `RESEND_API_KEY` в env; при
липсващ ключ — логва и продължава (dev-ът не чупи поръчки).

---

### Task 9: Web Push „Нова поръчка"

**Files:** `public/sw.js` (push + notificationclick → отваря /dashboard/orders),
`src/lib/push.ts` (`sendNewOrderPush(ownerId, order, shop)` с web-push + чистене на 404/410),
`src/actions/push.ts` (subscribe/unsubscribe с ownership),
`src/components/dashboard/push-banner.tsx` (в dashboard layout-а: ако Notification.permission
!== granted → карта „Получавай известие при всяка нова поръчка" + бутон; регистрира sw,
абонира се с VAPID public key, праща към action-а; на iOS без инсталирано PWA показва
подканата „Добави приложението на началния екран, за да получаваш известия").
Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:) —
генерирам ги при изпълнението и ги добавям в .env.local (+ Vercel — ръчна стъпка).

---

### Task 10: Поръчки в dashboard-а + статистика

**Files:** `/dashboard/orders/page.tsx` (+ `[id]/page.tsx`), `src/db/queries/orders.ts`,
`src/actions/orders.ts` (+ `updateOrderStatus`), `order-status-badge.tsx`; nav таб + брояч
на новите (badge); dashboard таблото: карти „Поръчки (нови)" и „Приходи (месец)" (sum
totalCents на не-cancelled за текущия месец).

Списък: Table (номер, дата, клиент, сума, статус) + филтър по статус + пагинация.
Детайл: клиент/адрес/методи/редове/суми + статус бутони (позволени преходи:
new→confirmed→shipped→completed; всяка не-completed→cancelled; cancel връща наличностите
в транзакция; completed е терминален). Toast + revalidate.

---

### Task 11: e2e + гейт + deploy

`e2e/orders.spec.ts`: търговец (магазин + продукт с deal „2 за 30 €" + naличност 5 +
методи по подразбиране) → публикува → гост: добавя 2 бр → количката показва deal цена
30,00 → checkout (име/телефон/адрес, наложен платеж) → потвърждение с номер #0001 →
търговецът вижда поръчката, потвърждава я, наличността е 3; отказва я → наличността
пак 5. + невалиден телефон на checkout → грешка. `pnpm check` + пълен e2e suite; push
към dev; Vercel preview; ✅ в roadmap.

---

## Definition of Done (План 4)

- [ ] Гост поръчва end-to-end; клиентски цени = сървърни цени (engine-ът е един)
- [ ] Deal „купи N за X", промо цени и безплатна доставка се смятат вярно (unit-доказано)
- [ ] Наличностите падат при поръчка и се връщат при отказ; race за последна бройка е безопасен
- [ ] Търговецът получава имейл + push при нова поръчка и управлява статусите
- [ ] Rate limit + honeypot пазят checkout-а; suspended/draft магазин не приема поръчки
- [ ] `pnpm check` + e2e зелени; preview deploy проверен
