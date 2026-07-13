# Поправка на 3-те одит блокера (онлайн плащане) — план

> Изпълнение inline. Източник = находките от одитите 2026-07-13 (audit-1/audit-3).
> Всяка задача е тесна, локализирана поправка с тест. Gate: `pnpm check`.

**Goal:** Затвори трите code блокера преди онлайн старт: multi-tenant colllision
в `payment_intents` (S1-01), 404 след плащане (S1-02), late-webhook възкресяване
(S3-01).

**Global Constraints:**
- Пари = integer евроцентове. `"use server"` файл експортира само async.
- BG копи с типографски кавички. Без hardcode. Строг TypeScript (без `as any`).
- `db:push` на dev локално сега; на прод — при Vercel достъп (докато е чист).
- Не push/deploy без изрично разрешение.

---

## Задача 1 — S1-01: `payment_intents` unique индекс + `shopId`

**Files:** `src/db/schema.ts:399` · тест `src/db/payment-schema.test.ts`

- [ ] Промени `uniqueIndex("payment_intents_ref_idx").on(t.provider, t.providerRef)`
      → `.on(t.shopId, t.provider, t.providerRef)`.
- [ ] `confirmEpayPayment` остава — намира кандидати по `providerRef`, secret verify
      разграничава магазина (вече коректно; повече кандидати само при еднакъв номер).
- [ ] `pnpm db:push` срещу dev (`.env.local`) — прилага новия индекс.
- [ ] Тест: добави проверка, че индексът съществува (schema-level) — по избор,
      schema тестът вече проверява колоните.

## Задача 2 — S1-02: ePay `URL_OK` + `?t=<token>`

**Files:** `src/lib/payments/build-order-package.ts` · `src/actions/orders.ts:421-443`
· тест `src/lib/payments/build-order-package.test.ts`

- [ ] `buildEpayForOrder` args: добави `token: string`.
- [ ] `urlOk`: `${base}/s/${slug}/order/${orderId}?paid=1&t=${token}`.
- [ ] `createOrder`: подай `token: created.publicToken` при извикването.
- [ ] Обнови теста: `URL_OK` да съдържа `?paid=1&t=` + подай `token` в input.

## Задача 3 — S3-01: ръчен cancel на pending отменя intent-а

**Files:** `src/actions/orders.ts:727-737` · нов unit тест (или разшири orders тест)

- [ ] В `updateOrderStatus` cancel клона: ако `order.status === "pending_payment"`,
      в СЪЩАТА транзакция маркирай `paymentIntents.status = "expired"` за този orderId
      (`where eq(paymentIntents.orderId, order.id)`), за да не мине webhook guard-ът.
- [ ] Импортирай `paymentIntents` (вече импортнат в orders.ts).
- [ ] Тест: cancel на pending_payment поръчка → intent update се вика.

## Финал

- [ ] `pnpm check` (lint + unit + build) зелено.
- [ ] Обнови одит файловете: маркирай S1-01/S1-02/S3-01/S3-03 като [x] (поправени).
- [ ] Commit локално. Push само при изрично разрешение.
