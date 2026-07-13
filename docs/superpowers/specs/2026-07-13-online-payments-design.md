# Онлайн картично плащане за поръчки (ePay.bg) — дизайн

**Дата:** 2026-07-13
**Статус:** одобрен от потребителя (брейнсторм)
**Свързано:** [[courier-integration-feature]] (същият pluggable pattern), [[stripe-billing-status]]
(различен модел — там купувачът плаща на НАС), `docs/remaining-roadmap.md` (категория 2).

## Проблем

Купувач влиза в магазин → пазарува → **плаща с карта** → парите отиват при **ТЪРГОВЕЦА**,
не при платформата. Текущо плащанията са само офлайн (`cod | bank_transfer | on_site`);
`createOrder` не минава през платежен gateway.

## Ключови решения (от брейнсторма)

1. **Модел А — директно към търговеца (marketplace, connected accounts).** Всеки търговец
   свързва СВОЙ ePay акаунт (KIN + secret word). Парите отиват директно при него. Платформата
   е технически посредник — **никога не докосва парите**. Без лиценз за платежна институция,
   без AML/KYC тежест. (Както Shopify/WooCommerce за старта.)
2. **Pluggable `PaymentProvider` интерфейс + registry** — по същия pattern като `CourierProvider`.
   Първа имплементация: **ePay.bg** (HMAC redirect протокол). Per-shop ключове в базата.
3. **Pending поръчка + webhook потвърждение.** `createOrder` създава поръчка в статус
   `pending_payment` + резервира наличността; ePay webhook (сървър-към-сървър) потвърждава →
   `new`; auto-cancel на неплатени след X часа (cron) → връща наличността.
4. **Webhook = единственият източник на истина за „платено".** Браузърният redirect (URL_OK)
   НЕ се доверява за статуса — може да се фалшифицира/изгуби.
5. **Валута: EUR директно** към ePay (магазините са в EUR; България е в еврозоната 2025+).
   Кодира се гъвкаво (валутата като параметър); ако живата проверка покаже, че ePay изисква
   BGN → добавяме конверсия по фиксинга 1.95583. **Отворен въпрос до живата проверка.**
6. **MVP = само ядрото.** Свързване акаунт + checkout онлайн метод + pending→webhook→потвърдена
   + auto-cancel. **ОТЛОЖЕНИ:** refunds през платформата (търговецът връща ръчно през ePay
   панела си засега), частични плащания/капаро, tokenization на карта, няколко доставчика
   едновременно за един магазин.
7. **DEV fallback:** demo среда `demo.epay.bg` + demo KIN/secret в `.env.local` (DEV само).
   Кодът се пише по официалната ePay документация (HMAC redirect протоколът е публичен); жива
   проверка на payload/CHECKSUM когато потребителят вземе реален акаунт (както Еконт demo).

## Референции (ePay протокол)

- Комуникационен пакет: https://www.epay.bg/v3main/img/front/tech_wire_en.pdf
- Billing API протокол: https://kb.epay.bg/en/billing/protocol/
- `PAGE=paylogin`; `ENCODED` = base64 на данните (EOL=''); `CHECKSUM` = HMAC-SHA1(ENCODED, secret).
- Данни: `MIN` (KIN на търговеца), `INVOICE`, `AMOUNT`, `CURRENCY`, `EXP_TIME`, `DESCR`.
- Нотификацията носи `STATUS` (`PAID`/`DENIED`/`EXPIRED`); отговор на merchant-а:
  `INVOICE=<N>:STATUS=OK`. Нотификацията може да дойде **няколко пъти** → задължителна
  идемпотентност.

## Архитектура

Платформата е технически посредник. Поток pending → webhook:

```
1. Купувач в checkout избира „Карта (ePay)" → „Плати"
2. createOrder → поръчка в статус pending_payment + РЕЗЕРВИРА наличността
   (SELECT ... FOR UPDATE, същата логика като сега) + създава payment_intent
3. Сървърът генерира ePay пакет (ENCODED base64 + CHECKSUM=HMAC-SHA1 със secret-а на
   ТОЗИ магазин) → клиентът auto-submit-ва форма към epay.bg (или demo)
4. Купувачът плаща на ePay (напуска сайта ни)
5. ePay → сървър-към-сървър нотификация → /api/payments/epay/notify
   → проверяваме CHECKSUM със secret-а на магазина → STATUS=PAID → в транзакция:
     payment_intent.status=paid, поръчка pending_payment→new, известия
   → отговаряме „INVOICE=N:STATUS=OK" (идемпотентно — може да дойде няколко пъти)
6. Купувачът се връща на URL_OK → вижда „Платена" (статусът идва от базата, НЕ от redirect-а)
7. Cron: pending_payment поръчки по-стари от EXP_TIME → auto-cancel + връщане на наличността
```

**Защо така:** webhook (не redirect) = източник на истина; резервацията при създаване предпазва
от оверсел; cron-ът чисти изоставените (както abandoned cart cron).

## Файлова структура (всеки файл — една отговорност)

**Създаваме:**
- `src/lib/payments/types.ts` — `PaymentProvider` интерфейс + типове
- `src/lib/payments/epay-signature.ts` — чисти функции (HMAC-SHA1, ENCODED base64, сумна
  конверсия, decode на нотификация, статус мапинг) — TDD без мрежа
- `src/lib/payments/epay.ts` — ePay провайдър (build пакет + verify/parse нотификация)
- `src/lib/payments/registry.ts` — `getPaymentProvider(id)`
- `src/app/api/payments/epay/notify/route.ts` — webhook endpoint
- `src/app/api/cron/expire-payments/route.ts` — reconciliation cron (или разширява abandoned cart)
- `src/actions/payment-account.ts` — dashboard мутации (save/delete/test ePay акаунт)
- `src/schemas/payment-account.ts` — Zod схема (KIN + secret + активен)
- `src/db/queries/payment-accounts.ts` — заявки (get per shop)
- `src/components/dashboard/payment-accounts.tsx` — dashboard таб „Онлайн плащане"

**Модифицираме:**
- `src/db/schema.ts` — нов enum член `online_card`; нов order статус `pending_payment`;
  таблици `shop_payment_accounts`, `payment_intents`
- `src/actions/orders.ts` — `createOrder` разклонение за `online_card` (pending + intent +
  ePay пакет); `ALLOWED_TRANSITIONS` (нови преходи от `pending_payment`)
- `src/components/storefront/checkout-form.tsx` — онлайн метод → redirect форма към ePay
- `src/app/(storefront)/s/[slug]/checkout/page.tsx` — подава ePay наличност
- `src/components/dashboard/nav.tsx` — таб „Онлайн плащане" (под minMode праг)
- `vercel.json` — cron за expire-payments (гард `CRON_SECRET`)
- `.env.local` (+ .env пример) — `EPAY_API_BASE`, `EPAY_DEMO_KIN`, `EPAY_DEMO_SECRET` (DEV)

## Данни модел (Drizzle)

**Нов платежен тип:**
```
paymentTypeEnum: "cod" | "bank_transfer" | "on_site" | "online_card"
```

**Нов статус на поръчката (ПРЕДИ `new`):**
```
orderStatusEnum: "pending_payment" | "new" | "confirmed" | "shipped" | "completed" | "cancelled"
```
Позволени преходи (`ALLOWED_TRANSITIONS`):
- `pending_payment → new` — само системата (webhook: платено), НЕ търговецът
- `pending_payment → cancelled` — webhook (отказано/изтекло) ИЛИ cron auto-cancel → връща наличност
- `pending_payment` поръчки НЕ се броят/показват като „нови" на търговеца (той вижда платените).

**`shop_payment_accounts`** (аналог на `shop_courier_accounts`):
```
id, shopId (FK, onDelete cascade), provider ("epay"),
credentials (jsonb — { kin, secret }; маскирани в UI, никога NEXT_PUBLIC_, никога логвани),
active (boolean, default true),
createdAt, updatedAt
→ uniqueIndex(shopId, provider); index(shopId)
.enableRLS()
```

**`payment_intents`** (одит + идемпотентност + reconciliation):
```
id, orderId (FK, onDelete cascade), shopId (FK), provider ("epay"),
providerRef (text — ePay INVOICE номер), 
amountCents (integer — сверяваме срещу webhook),
status ("pending" | "paid" | "denied" | "expired", default "pending"),
rawNotification (jsonb nullable — одит/дебъг),
paidAt (timestamp nullable),
createdAt, updatedAt
→ uniqueIndex(provider, providerRef); index(orderId); index(shopId)
.enableRLS()
```
**Защо отделна таблица:** (а) идемпотентност (`providerRef` unique + status guard пази от двойна
обработка на повторен webhook); (б) одит следа; (в) сверка на сумата срещу поръчката (защита
срещу подправена сума); (г) reconciliation (cron намира изтеклите pending).

**Пари:** integer евроцентове навсякъде (правило №1). ePay сумата се строи с чиста функция
`toEpayAmount(cents)` (тествана). `INVOICE` номерът е поредният номер на поръчката (per-shop,
вече уникален).

**Миграция:** нови таблици + нов enum член + нов статус + nullable колони → безопасен `db:push`
(без разрушаване; стари поръчки не се чупят).

## Потоци, сигурност и edge cases

### A) Изграждане на ePay пакета (`createOrder`, `online_card`)
Редът е фиксиран: (1) транзакцията резервира наличността + записва поръчка `pending_payment`
+ `payment_intent` (status `pending`) и commit-ва; (2) СЛЕД успешния commit генерираме ePay
пакета (чиста функция върху secret-а на магазина — не пипа базата) и го връщаме. Ако
генерирането гръмне (напр. липсващ/невалиден secret), поръчката остава `pending_payment` и
cron-ът ще я auto-cancel-не + върне наличността — купувачът получава грешка и не е таксуван.
- `data`: `MIN=<KIN>\nINVOICE=<пореден №>\nAMOUNT=<EUR>\nCURRENCY=EUR\nEXP_TIME=<+2ч>\nDESCR=<Поръчка №N от {магазин}>`
- `ENCODED = base64(data, EOL='')`, `CHECKSUM = HMAC-SHA1(ENCODED, secret)`
- Резултат към клиента: `{ epay: { actionUrl, encoded, checksum, urlOk, urlCancel } }`
- Клиентът auto-submit-ва скрита форма (POST) към `actionUrl` (`epay.bg/?PAGE=paylogin` или demo)
- `URL_OK = <site>/s/{slug}/order/{id}?paid=1`; `URL_CANCEL = <site>/s/{slug}/checkout?cancelled=1`

### B) Webhook (`/api/payments/epay/notify`) — сърце на сигурността
1. ePay праща `encoded` + `checksum` (POST form-urlencoded)
2. Декодираме `encoded` → вадим `INVOICE` → намираме поръчката + магазина → неговия secret
3. **Преизчисляваме CHECKSUM = HMAC-SHA1(encoded, secret) и сравняваме** (timing-safe). Несъвпадение
   → 200 но игнорирано + структуриран лог (не издаваме детайли). Това е автентикацията: без
   валиден подпис със secret-а на магазина, „платено" не може да се фалшифицира.
4. Парсваме `STATUS` (`PAID` / `DENIED` / `EXPIRED`) + `AMOUNT`
5. **Идемпотентност:** намираме `payment_intent` по `providerRef`; ако вече `paid` → връщаме
   `INVOICE=N:STATUS=OK`, нищо не правим (повторен webhook)
6. **Сверка на сумата:** `AMOUNT` (webhook) == `payment_intent.amountCents`? Ако не → лог +
   отхвърляме (защита срещу подправяне)
7. В ТРАНЗАКЦИЯ:
   - `PAID` → `payment_intent.status=paid, paidAt=now`; поръчка `pending_payment → new`;
     известия (имейл + push на търговеца; имейл на купувача)
   - `DENIED`/`EXPIRED` → `payment_intent.status=...`; поръчка `pending_payment → cancelled` +
     връщане на наличността (`ALLOWED_TRANSITIONS`)
8. Отговор точно `INVOICE=<N>:STATUS=OK` (иначе ePay ретрайва)

### C) Сигурност на webhook-а
Публичен endpoint (ePay го вика), защитен от CHECKSUM проверката (само валиден подпис минава)
+ rate limit (Postgres таблица `rate_limits`, вече я има). Никакви stack traces/детайли към ePay
— само `STATUS=OK` или неутрална грешка. Структурирани логове на сървъра.

### D) Cron — reconciliation
`/api/cron/expire-payments` (гард `CRON_SECRET`, като abandoned cart) — намира `pending_payment`
поръчки по-стари от EXP_TIME (**2 часа** — одобрено) → в транзакция: `cancelled` + връщане на
наличността + `payment_intent.status=expired`. **Guard по статус:** ако късен PAID webhook вече
е потвърдил поръчката, cron-ът не я разваля (проверява текущия статус преди преход).

### E) Edge cases (изрично решени)
- Купувач затваря браузъра след redirect, но плаща → webhook пак идва → потвърдена (redirect-независимо) ✓
- Webhook идва преди купувачът да се върне → поръчката е `new`, при връщане вижда „Платена" ✓
- Двойно „Плати" → идемпотентният ключ (вече в checkout) + резервацията пазят от дублирана поръчка ✓
- ePay недостъпен при създаване → поръчката НЕ се създава, грешка към купувача, наличността не се пипа ✓
- Магазин без свързан ePay акаунт → методът „Карта" не се показва в checkout ✓
- Късен webhook след auto-cancel → status guard в webhook-а (ако поръчката е cancelled и наличността
  върната, PAID води до „конфликт": логваме + оставяме cancelled, `payment_intent` бележи разминаване
  за ръчна намеса; търговецът връща парите ръчно през ePay) ✓
- Частично плащане → извън обхвата (MVP = пълно плащане) ✓

### F) DEV fallback
demo `demo.epay.bg` + demo KIN/secret в `.env.local` (DEV само; коментирани като Спиди).
`EPAY_API_BASE` избира demo/prod. Per-shop ключовете живеят в dashboard/DB, не env.

## Тестване

- **Чисти функции (TDD, без мрежа):** `epay-signature.ts` — HMAC-SHA1, ENCODED base64,
  `toEpayAmount`, decode на нотификация, статус мапинг, сверка на сума, идемпотентност guard.
- **Webhook:** unit с mock-нат валиден/невалиден подпис; проверки за идемпотентност (двоен PAID),
  сверка на сума (подправена сума), статус преходи (PAID→new, EXPIRED→cancelled+restock).
- **`createOrder` онлайн клон:** pending поръчка + intent + пакет (mock provider).
- **e2e:** checkout с онлайн метод → pending поръчка (спираме ПРЕДИ реалния ePay redirect;
  без реален акаунт). Демо магазин получава ePay акаунт в seed или тестът го създава.
- Гейт: `pnpm check` (lint + unit + build). e2e: Playwright.

## Извън обхвата (YAGNI — отложено)

- Refunds през платформата (ePay refund API) — търговецът връща ръчно през ePay панела си.
- Частични плащания / капаро / разсрочено.
- Tokenization (записана карта за бъдещи поръчки).
- Няколко активни доставчика едновременно за един магазин (per-shop = един).
- Други доставчици (myPOS, Borica) — интерфейсът позволява, но не в този спец.
- Онлайн карта за АБОНАМЕНТА (това е Stripe billing — отделен, вече готов, „спящ").

## Отворени въпроси (до живата проверка с реален ePay акаунт)

1. **Валута:** ePay приема ли EUR директно? (Заложено EUR; ако не → BGN конверсия по 1.95583.)
2. Точен формат на нотификацията (POST полета, точен STATUS низ) — сверява се на demo.
3. Точен `actionUrl` + POST vs GET на redirect формата — сверява се на demo.
