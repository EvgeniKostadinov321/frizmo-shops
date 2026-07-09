# Спец: Stripe билинг — абонамент на търговеца

**Дата:** 2026-07-10
**Статус:** за преглед от потребителя преди план/имплементация
**Заменя:** stub-а `getShopPlan()` (src/lib/plan.ts) — План 6 Фаза Б от `docs/CLAUDE.md`.

## Контекст и цел

Днес `getShopPlan()` връща хардкоднато `"pro"` — всеки магазин е Pro безплатно
завинаги, нулев приход. Този спец въвежда реален recurring абонамент през
**Stripe**, който таксува търговците месечно (10€ Starter / 20€ Pro), с trial,
промо код за първи месец, и автоматичен suspend при неплащане.

Проучването (2026-07-10) потвърди: Stripe е напълно наличен за BG фирми, EUR е
нативна валута от 1.1.2026, Customer Portal спестява целия billing UI, EasyPay/
Borica не са подходящи за автоматичен абонамент.

## Решения на потребителя (2026-07-10)

1. **Trial:** карта се въвежда от началото; първо таксуване на ден 30. Landing
   текстът се сменя (маха се „без карта").
2. **Промо код -50% първи месец:** търговецът въвежда код при абониране (напр.
   `FRIZMO50`). Потребителят раздава кодове в кампании/партньори.
3. **Без плащане (trial изтича без карта / отказан абонамент / неплатено):**
   магазинът **спира** — checkout блокиран, показва „временно затворено".
4. **Stripe акаунт:** споделен с другия Frizmo проект (една фирма), но с **отделен
   webhook endpoint + собствен signing secret** + `metadata.app: "frizmo-shops"`
   таг на всички Stripe обекти (защита срещу кръстосани събития).

## Не-цели (извън обхвата)

- Онлайн плащане на КУПУВАЧА в магазина (отделен фийчър, по-късно).
- Фактура за абонамента с BG ЗДДС формат (Stripe hosted invoice за старта;
  ЗДДС съответствие — въпрос към счетоводител, отделно).
- Reconciliation cron (webhook-ите покриват 99%; cron е hardening после).
- Годишни планове / отстъпки за годишно плащане (само месечно за старта).

---

## Архитектура

### Оси: billing статус ≠ модерация статус (НЕ смесвай)

Потвърдено в кода — две независими оси:
- **`shops.status`** (`draft|published|suspended|blocked`) — платформена модерация,
  само админ я мени (`src/actions/admin.ts` TRANSITIONS). „Позволява ли платформата
  магазинът да е публичен."
- **`subscriptions.status`** (нов) — billing състояние, Stripe webhooks я менят.
  „Платил ли е търговецът."

И двете имат стойност `suspended`, но значат различно (админ-наказан vs неплатен).
Магазин може да е `published` (админ ОК) + subscription `suspended` (неплатено) →
резултат: checkout блокиран заради billing, но НЕ от модерация. Държат се в
отделни таблици.

### Нови таблици (schema.ts)

```
subscriptions
  id, shopId (FK shops, onDelete cascade, UNIQUE — един абонамент/магазин)
  stripeCustomerId (text, unique)
  stripeSubscriptionId (text, unique, nullable)
  plan (planEnum: starter|pro)
  status (subscriptionStatusEnum: trialing|active|past_due|suspended|canceled)
  currentPeriodEnd (timestamptz, nullable)
  trialEndsAt (timestamptz, nullable)
  createdAt, updatedAt

stripe_events  (webhook идемпотентност)
  id (text PK — Stripe event id)
  type (text)
  processedAt (timestamptz default now)
```

**Enum mapping към Stripe статусите** (проучването): `trialing`=Stripe trialing,
`active`=active, `past_due`=past_due (Smart Retries тече = нашият „grace"),
`suspended`=Stripe canceled/unpaid след изчерпани retry-и, `canceled`=доброволен
отказ. Държим нашите 5 стойности; webhook-ът ги маппва.

Забележка: enum-ите в CLAUDE-backend.md са `trial→active→grace→suspended→cancelled`.
Изравняваме към Stripe речника (`trialing`/`past_due`/`canceled`) за по-малко
объркване при webhook маппинг — обновяваме и документацията.

### Нови файлове

```
src/lib/stripe.ts                          → Stripe клиент (server-only)
src/actions/billing.ts                     → checkout/portal/status server actions
src/app/api/webhooks/stripe/route.ts       → webhook route handler (raw body)
src/app/(dashboard)/dashboard/billing/     → billing страница (план + статус + бутони)
src/db/queries/subscriptions.ts            → четене на subscription по shopId
```

### Env vars (нови — server-only, никога NEXT_PUBLIC_)

- `STRIPE_SECRET_KEY` — общ за акаунта (същият като другия Frizmo проект)
- `STRIPE_WEBHOOK_SECRET` — НОВ, за Frizmo webhook endpoint-а
- `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` — Price ID-тата (нови Products в Stripe)

Добавят се в `src/env.ts` валидацията (препоръчани, не критични — билингът
деградира грациозно ако липсват в dev). Във Vercel prod → Redeploy.

---

## Потоци

### 1. Абониране (Stripe Checkout)

- Dashboard → Billing страница → „Абонирай се" (избор Starter/Pro).
- Опционално поле „Промо код" → подава се като Stripe `discounts[coupon]`.
- Server action `createCheckoutSession(plan, promoCode?)`:
  - `requireShop()` → взима/създава Stripe Customer (пази `stripeCustomerId`).
  - `stripe.checkout.sessions.create({ mode: "subscription", line_items: [price],
    subscription_data: { trial_period_days: 30 }, discounts, metadata: {app, shopId},
    success_url, cancel_url })`.
  - Redirect към Stripe hosted Checkout (картата се въвежда там — PCI на Stripe).
- Промо кодът е Stripe **Coupon** (`percent_off: 50, duration: once`) + **Promotion
  Code** (човешкия код FRIZMO50). Създава се веднъж в Stripe dashboard; кодът от
  формата се валидира от Stripe при checkout (невалиден → Stripe го отхвърля).

### 2. Trial → активен

- 30 дни trial (`trial_period_days: 30`), картата е записана.
- На ден 30 Stripe таксува автоматично → `invoice.paid` webhook → status `active`.
- Промо кодът (`duration: once`) се прилага на **първата реална фактура** (ден 30),
  не на trial-а → първият платен месец е -50%.

### 3. Неуспешно плащане → grace → suspend

- Плащане се проваля → Stripe `invoice.payment_failed` → status `past_due`.
- Stripe Smart Retries опитва пак (конфигурируем прозорец = нашият grace).
- Retry-ите изчерпани → Stripe `customer.subscription.deleted`/`updated` (canceled)
  → status `suspended` → **магазинът спира** (виж enforcement).

### 4. Управление (Stripe Customer Portal)

- Billing страница → „Управлявай абонамента" → server action
  `createPortalSession()` → `stripe.billingPortal.sessions.create({customer, return_url})`
  → redirect. Stripe host-ва: смяна на карта, план (Starter↔Pro), отказ, фактури.
- Нула наш UI за тези — Portal-ът ги покрива.

### 5. Enforcement (getShopPlan + suspend)

**`getShopPlan(shopId)`** (заменя stub-а, единственото място):
```
чети subscription по shopId
  няма ред → trial по shop.createdAt: ако < 30 дни → "pro", иначе → спрян
  status trialing/active/past_due → subscription.plan
  status suspended/canceled → магазинът е спрян (виж по-долу)
```

**„Спрян" магазин (без валиден абонамент):**
- НЕ се трият данни. Продуктите над Starter лимита → неактивни (вече е поведението).
- Checkout блокиран: `createOrder` (`orders.ts:141`) вече проверява
  `shop.status !== "published"`. Добавяме паралелна проверка: ако billing е
  `suspended`/`canceled` → същият блок + „временно затворено" на storefront-а.
- **Реализация:** нов helper `isShopActive(shopId)` = `shop.status === "published"
  && billingAllowsSelling(subscription)`. Викаме го в checkout + storefront gate.

**Trial enforcement — лениво, без cron** (проектната конвенция): проверката е чиста
дата в `getShopPlan`/`isShopActive`. Cron само за proactive „trial-ът ти изтича"
имейл (hardening, по-късно).

---

## Webhook (критично за сигурност)

`src/app/api/webhooks/stripe/route.ts` — `export async function POST(req)`:
1. `const body = await req.text()` — RAW body (не `req.json()` — чупи подписа).
2. `stripe.webhooks.constructEvent(body, sig header, STRIPE_WEBHOOK_SECRET)` —
   верификация. Невалиден подпис → 400. **Това е auth-ът** (няма user session).
3. Идемпотентност: `INSERT into stripe_events (id) ON CONFLICT DO NOTHING RETURNING`
   — ако не върне ред → вече обработен, връщаме 200 (Stripe праща at-least-once).
4. **Metadata guard:** обработваме само събития с `metadata.app === "frizmo-shops"`
   (или чийто Customer има този таг) → чуждите (от другия проект) се игнорират.
5. Обработени събития:
   - `checkout.session.completed` → запиши stripeSubscriptionId, status trialing/active.
   - `invoice.paid` → status active, обнови currentPeriodEnd.
   - `invoice.payment_failed` → status past_due.
   - `customer.subscription.updated` → синхронизирай status/plan/period.
   - `customer.subscription.deleted` → status suspended → магазинът спира.

**Auth изключение:** `src/proxy.ts` не бива да блокира `/api/webhooks/stripe` с
редирект/401 (Stripe не е логнат). Изключваме пътя от proxy auth.

---

## Файлове за пипане (по ред)

1. **schema.ts** — `subscriptions` + `stripe_events` + `subscriptionStatusEnum` +
   `planEnum`. → `pnpm db:push`.
2. **src/lib/stripe.ts** — клиент (`new Stripe(env.STRIPE_SECRET_KEY)`), server-only.
3. **src/env.ts** — 4-те нови env vars (препоръчани секция).
4. **src/lib/plan.ts** — `getShopPlan` чете реален план; `isShopActive` helper.
   (call site-овете в products.ts не се пипат — сигнатурата е същата.)
5. **src/db/queries/subscriptions.ts** — четене по shopId.
6. **src/actions/billing.ts** — createCheckoutSession, createPortalSession,
   getBillingStatus. Всички през `requireShop()`.
7. **src/app/api/webhooks/stripe/route.ts** — webhook (raw body + подпис + dedup).
8. **src/proxy.ts** — изключи webhook пътя от auth.
9. **orders.ts + storefront gate** — `isShopActive` в checkout + „временно затворено".
10. **src/app/(dashboard)/dashboard/billing/** — billing страница (план, статус,
    „Абонирай се" + промо поле, „Управлявай абонамента").
11. **Landing текст** (plans-content.ts) — махни „без карта"; „30 дни безплатно ·
    откажи по всяко време".
12. Stripe dashboard (ръчно, от потребителя): 2 Products + месечни Prices,
    Coupon FRIZMO50 (50% once) + Promotion Code, webhook endpoint → взима secret.

## Идемпотентност — преизползва проектната култура

- Webhook dedup: `stripe_events` PK + ON CONFLICT (като `orders_idempotency_idx`).
- Customer създаване: guard „ако вече има stripeCustomerId → преизползвай" (да не
  създаде двоен Customer при двоен клик).
- Всичко през `requireShop()` (multi-tenant изолация автоматична).

## Тестване

- Stripe **test mode** (test ключове) — целият поток без реални пари.
- Stripe CLI `stripe listen --forward-to localhost:3000/api/webhooks/stripe` за
  локални webhooks + `stripe trigger invoice.paid` за симулация.
- Test карти (4242…) за успех, 4000000000000341 за fail (grace/suspend поток).
- Обективен verification скрипт: симулирай subscription в test mode → провери
  `getShopPlan` връща правилен план по статус; провери suspend блокира checkout.
- `pnpm check` гейт.

## Отворени въпроси (за потвърждение при имплементация)

- Точната Stripe npm версия (`pnpm view stripe version`).
- Grace прозорец (Smart Retries) — колко дни/опити (Stripe dashboard настройка).
- ЗДДС фактура — Stripe hosted достатъчна ли е за счетоводителя (питане отделно).
- Landing копие — точният нов текст на trial бележката (кратко ревю с потребителя).
