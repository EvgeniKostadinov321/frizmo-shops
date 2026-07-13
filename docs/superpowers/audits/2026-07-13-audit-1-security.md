# Одит 1 — Security (нов код) · 2026-07-13

**Обхват:** сигурността на кода, писан след 2026-07-07 — онлайн плащане (ePay,
marketplace Модел А), куриерска интеграция (Еконт/Спиди), глобален купувачески
профил. Метод: inline четене на целия нов код по веригата (schema → queries →
actions → API routes → UI), с фокус върху webhook подпис/идемпотентност, per-shop
ключове, cross-tenant (`shopId`) и cross-buyer (`buyerId`) изолация.

**Резюме:** Основата е стабилна — webhook подписът е timing-safe, ключовете никога
не напускат сървъра, buyer-изолацията минава през сесията навсякъде. Открих **1
критична** находка (multi-tenant colllision в `payment_intents`, чупи онлайн
плащане за 2-рия+ магазин) и няколко по-леки. Критичната трябва да се оправи
преди реални търговци с онлайн плащане.

Severity: 🔴 критична · 🟠 важна · 🟡 дребна

---

## 🔴 S1-01 — `payment_intents.providerRef` unique index е глобален, но orderNumber е per-shop → colllision между магазини

**Къде:**
- `src/db/schema.ts:399` — `uniqueIndex("payment_intents_ref_idx").on(t.provider, t.providerRef)`
- `src/actions/orders.ts:387` — `providerRef: String(inserted.orderNumber)`
- `src/actions/orders.ts:119` — orderNumber = `max(order_number) where shopId` (**per-магазин**)

**Проблем:** `providerRef` се пълни с поредния номер на поръчката, който е
уникален само В РАМКИТЕ на магазина (магазин А има поръчка №1, магазин Б също
има поръчка №1). Unique индексът обаче е само `(provider, providerRef)` — БЕЗ
`shopId`. Първият магазин, който направи онлайн поръчка №1, „запазва" ключа
`(epay, "1")` глобално. Когато вторият магазин направи своята онлайн поръчка №1,
`INSERT INTO payment_intents` хвърля 23505 (unique violation) → цялата поръчкова
транзакция rollback-ва → **вторият магазин не може да приема онлайн плащане за
никой номер, който вече съществува в друг магазин.**

**Ефект:** С двама+ търговци с ePay, онлайн плащането се чупи тихо за всички освен
първия (купувачът вижда „Поръчката не можа да бъде създадена"). Това е директно
нарушение на multi-tenant изолацията (тенант А блокира тенант Б).

**Защо не е хванато:** тествано е само с един магазин; при един магазин
orderNumber-ите не се застъпват, така че colllision-ът никога не се задейства.

**Препоръка:** Добави `shopId` към unique индекса:
`uniqueIndex("payment_intents_ref_idx").on(t.shopId, t.provider, t.providerRef)`.
Тогава `(shopId, epay, "1")` е уникален per-tenant, както трябва. Идемпотентността
на webhook-а остава — `confirmEpayPayment` намира кандидатите по `providerRef` и
разграничава магазина по secret-а (`parseNotification`), така че разширеният
индекс не чупи confirm логиката. **Изисква `db:push`** (нов индекс; старият се
сваля). Провери и дали `confirmEpayPayment` трябва да стесни заявката за
кандидати — при много магазини с еднакъв номер ще има повече кандидати за
итерация, но коректността се пази от secret проверката.

---

## 🟠 S1-02 — ePay `URL_OK` не носи `?t=<token>` → купувачът се връща на 404 след плащане

**Къде:**
- `src/lib/payments/build-order-package.ts:23` — `urlOk: ${base}/s/${slug}/order/${orderId}?paid=1`
- `src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx:34` — `if (!z.uuid()... || !token) notFound()`

**Проблем:** Страницата на поръчката е IDOR-защитена — изисква валиден
`publicToken` в `?t=`, иначе `notFound()` (правилно). Но `URL_OK`, който ePay
отваря след плащане, подава само `?paid=1` — без токена. Офлайн пътят в
checkout-а навигира коректно с `?t=${result.data.token}`
(`checkout-form.tsx:365`), но онлайн пътят разчита на този URL от сървъра.

**Ефект:** След успешно плащане с карта купувачът вижда 404 вместо потвърждение.
Функционален, но саботира целия онлайн UX (изглежда сякаш плащането се е
провалило). Токенът е наличен при създаването (`created.publicToken`) — просто не
е добавен към URL-а.

**Препоръка:** Прекарай `publicToken` до `buildEpayForOrder` и добави го в
`urlOk`: `?paid=1&t=${token}`. (Едновременно намаление на риск и correctness —
дублира се в Одит #3 като част от онлайн потока.)

---

## 🟡 S1-03 — Webhook rate-limit кофата колабира при липсващ `x-forwarded-for` — ✅ ПОПРАВЕНО

**Къде:**
- `src/app/api/payments/epay/notify/route.ts:14` — `checkRateLimit(\`epay-notify:${ip}\`, 60, 60)`
- `src/actions/cart.ts:30` — `clientIp()` fallback `?? "local"`

**Проблем:** Rate-limit ключът е по IP. Ако ePay нотификациите пристигнат без
`x-forwarded-for` (или зад прокси, който не го подава), всички падат в една кофа
`epay-notify:local` с лимит 60/минута. При по-голям обем нотификации от една и
съща „сплескана" стойност → 429 → ePay ретрайва, потвърждението се бави.

**Ефект:** Нисък в практика (Vercel почти винаги подава `x-forwarded-for`; ePay не
праща стотици нотификации/мин към един магазин). Но е крехка връзка на критичен
път (потвърждение на плащане).

**Препоръка:** Приемливо за старта. За устойчивост: подсили лимита конкретно за
този endpoint (напр. 300/мин), ИЛИ не rate-limit-вай по IP тук, а разчитай на
CHECKSUM проверката (невалиден подпис така или иначе се отхвърля без DB запис).
Подписът е истинската защита; rate-limit-ът е само против флууд.

---

## 🟡 S1-04 — `confirmEpayPayment` не проверява, че `INVOICE`/сумата се отнасят за същия магазин преди amount-guard — ✅ РЕГРЕСИЯ ДОБАВЕНА

**Къде:** `src/actions/payment-confirm.ts:32-53`

**Наблюдение (не бъг):** Логиката итерира кандидатите по `providerRef` и
разграничава правилния магазин чрез `parseNotification` (secret verify). Amount
guard-ът и idempotency guard-ът се прилагат СЛЕД `if (!note) continue`, т.е. само
за магазина, чийто secret верифицира подписа — коректно. Отбелязвам го изрично,
защото при S1-01 (повече кандидати с еднакъв `providerRef`) тази примка става
по-натоварена: подписът се проверява за всеки кандидат. Функционално остава
вярно (само правилният secret минава), но е добре да се потвърди с тест след
поправката на S1-01 (два магазина, еднакъв orderNumber, нотификация за единия →
другият intent НЕ се пипа).

**Препоръка:** Няма промяна в кода. Добави e2e/unit регресия: две поръчки №1 в
два магазина с ePay, нотификация с secret-а на магазин А → само intent-ът на А
става `paid`, интентът на Б остава `pending`.

---

## ✅ Проверено и чисто

- **Webhook подпис:** `verifyChecksum` е timing-safe (`crypto.timingSafeEqual`,
  дължинна проверка преди сравнението) — `epay-signature.ts:36`. Невалиден подпис
  → `parseNotification` връща null → intent-ът не се пипа.
- **Идемпотентност:** `intent.status !== "pending"` guard преди всяка мутация
  (`payment-confirm.ts:40`); повторна нотификация → `ignored`, без втори restock
  или double-confirm.
- **Amount tamper защита:** `note.amountCents !== intent.amountCents` → лог +
  `invalid`, поръчката не се потвърждава (`payment-confirm.ts:43`).
- **Ключове никога към клиента:** `credentials` (ePay secret/KIN, куриерски
  user/pass) се четат само server-side (`getShopPaymentAccount`,
  `getCourierAccount` — извикват се в actions/routes, не в client компоненти).
  UI полето за secret е `type="password"`, никога не preload-ва стойността
  (`payment-accounts.tsx:65`). Няма `NEXT_PUBLIC_` за ключове.
- **Buyer изолация (cross-buyer):** ВСЯКА `/account` страница взима `buyerId` от
  `requireBuyer()` (сесията), НИКОГА от URL/param — `account/page.tsx:14`,
  `orders/page.tsx:23`, `favorites/page.tsx:14-15`, `addresses/page.tsx:10`.
  Всяка buyer мутация проверява собственост (`owned.buyerId !== profile.id`) —
  `buyer.ts:58,83,95`. Глобалните queries (`buyer-global.ts`) филтрират стриктно
  по подадения `buyerId`.
- **Tenant изолация (cross-shop) в куриери/плащане:** всяка мутация минава през
  `requireShop()` и скоупва по `shop.id`; `generateWaybill` проверява
  `order.shopId !== shop.id` (`waybills.ts:24`); upsert-ите на акаунти са по
  `(shopId, provider)` unique. `payment-account`/`courier` actions не приемат
  shopId от клиента.
- **Order confirmation IDOR:** страницата изисква валиден `publicToken`
  (`order/[orderId]/page.tsx:34`); `lookupOrder` е с rate-limit + обща грешка
  (не издава дали номер съществува) — `orders.ts:785`.
- **Санитизация/Zod:** всички нови входове минават през Zod схема + `sanitizeText`
  преди запис (buyer адрес/профил, courier/payment акаунт). Публичните endpoint-и
  (checkout, webhook, lookup) са с rate-limit + honeypot (checkout).
- **RLS:** всички нови таблици са `.enableRLS()` (Data API заключен; сървърът
  минава през direct Postgres) — `schema.ts:320,341,364,403,887,906,925`.
- **Грешки навън:** общи BG съобщения; детайлите отиват в структуриран `console`
  лог (`PaymentError`/`CourierError` пазят detail сървър-side).

---

## Статус на находките

- [x] **S1-01 🔴 — ПОПРАВЕНО** (2026-07-13): индексът е `(shopId, provider, providerRef)`
      (`schema.ts:399`); `db:push` приложен на dev; чака прод push докато е чист (P4-03).
- [x] **S1-02 🟠 — ПОПРАВЕНО** (2026-07-13): `buildEpayForOrder` носи `token` →
      `URL_OK ?paid=1&t=<token>` (`build-order-package.ts`); `createOrder` подава
      `publicToken`; тест добавен.
- [x] S1-03 🟡 — webhook rate-limit устойчивост ✅ (лимит 600/мин за ePay notify; `notify/route.ts` — CHECKSUM остава истинската защита)
- [x] S1-04 🟡 — регресионен тест за multi-tenant webhook ✅ (два магазина, еднакъв orderNumber, PAID за А → само А paid; `payment-confirm.test.ts`)

Свързано: [[online-payments-feature]], [[courier-integration-feature]],
[[buyer-account-feature]], `docs/superpowers/audits/2026-07-13-pre-launch-audit-plan.md`,
Одит #3 (payments correctness — S1-02 се разглежда и там).
