# Одитни поправки 2026-07-23 — план за изпълнение

**Goal:** Поправи 7-те одобрени находки от одитния цикъл (`docs/superpowers/audits/2026-07-23-audit-cycle.md`).

**Изпълнение:** inline, TDD където има логика, `pnpm check` след групите. Push само с разрешение.

**Global constraints:** integer центове; typographic BG кавички; строг TS (без `as any`); тестовете живеят до кода (`src/**/*.test.ts`, реални v4 UUID в тестове); мутациите пазят wrapper-ите.

---

## Задача 1 — DATA-01: CAS guard в updateOrderStatus (oversell при двоен клик)
**Файл:** `src/actions/orders.ts:784`
- [ ] Тест: два едновременни cancel на confirmed поръчка → стокът се възстановява ВЕДНЪЖ (не двойно). (Верификационен скрипт стил, или unit с mock tx който симулира 0 засегнати редове.)
- [ ] Смени `tx.update(orders).set(patch).where(eq(orders.id, order.id))` на условен CAS:
  `.where(and(eq(orders.id, order.id), eq(orders.status, order.status))).returning({ id: orders.id })`.
- [ ] Ако RETURNING е празен (друга транзакция вече е сменила статуса) → `return` рано от callback-а БЕЗ restoreStock/recordFeeCharge/recordFeeCredit/intent update. Хвърли за rollback или просто пропусни останалите стъпки — избери rollback (throw sentinel, хванат отвън → връща ok, защото друг вече е свършил прехода).
- [ ] `pnpm test` за orders.

## Задача 2 — DATA-02: return window от completedAt
**Файл:** `src/actions/orders.ts:687` (requestReturn)
- [ ] Тест: поръчка completed на T0, updatedAt избутан на T+5 (симулирай), прозорец 3 дни → връщането е ОТКАЗАНО (мери от completedAt=T0, не updatedAt=T+5).
- [ ] Смени `Date.now() - order.updatedAt.getTime()` на `Date.now() - (order.completedAt ?? order.updatedAt).getTime()`.
- [ ] `pnpm test`.

## Задача 3 — BILL-02: webhook paid→issued guard
**Файл:** `src/app/api/webhooks/stripe/route.ts:55-59`
- [ ] Тест: fee_invoice в статус `paid`, пристига invoice.payment_failed → остава `paid` (не се връща на issued).
- [ ] За `payment_failed` добави `ne(feeInvoices.status, "paid")` в WHERE. Импортирай `ne` от drizzle-orm. `invoice.paid` остава безусловен.
- [ ] `pnpm test`.

## Задача 4 — BILL-01 + BILL-01b: bill-fees идемпотентност + per-shop try/catch
**Файл:** `src/app/api/cron/bill-fees/route.ts`
- [ ] idempotencyKey: `stripe.invoices.create({...}, { idempotencyKey: \`fee-invoice-${invoice.id}\` })` — повторен create връща същата фактура.
- [ ] Обвий тялото на `for`-цикъла (редове ~37-65) в try/catch: при грешка `console.error(JSON.stringify({scope:'bill-fees', shopId: shop.id, error: String(e)}))` + `continue` (не гърми целия cron).
- [ ] Броячи: добави `failed` брояч; върни `{ issued, failed }`.
- [ ] (Тестът тук е труден без Stripe mock — покрий с verify скрипт стил ръчно ИЛИ добави коментар защо idempotencyKey решава двойната фактура. Приоритет: idempotencyKey + try/catch са малки, ниско-рискови промени.)

## Задача 5 — REL-01: Stripe outage да не блокира checkout (fail-open)
**Файл:** `src/lib/selling-gate.ts:15` (requiresCard)
- [ ] Тест: `customerHasDefaultCard` хвърля (mock) → `requiresCard` връща `false` (fail-open, не блокира установен магазин), логва грешката.
- [ ] Обвий `customerHasDefaultCard(customerId)` в try/catch; при грешка → `console.error(JSON.stringify({scope:'requiresCard-stripe', shopId, error:String(e)}))` + `return false`.
- [ ] Обосновка в коментар: билинг проблем не бива да сваля публичния checkout; установен магазин продължава да продава; следващият успешен billing цикъл ще хване липсата на карта.
- [ ] `pnpm test`.

## Задача 6 — SEC-01: свързване на гост-поръчки по верифициран email (не телефон)
**Файлове:** `src/actions/buyer.ts` (linkGuestOrders, countLinkableGuestOrders), `src/db/queries/buyer.ts` (countGuestOrdersByPhone → нова по email)
- [ ] Нова query `countGuestOrdersByEmail(email)` в buyer.ts queries: `count() where isNull(buyerId) AND lower(customerEmail)=lower(email) AND customerEmail != ''`.
- [ ] `linkGuestOrders`: вземи `user.email` от requireBuyer (не profile.phone). Ако няма email → fail. `UPDATE orders SET buyerId WHERE isNull(buyerId) AND lower(customerEmail)=lower(user.email)`. Свързва само поръчки с email == верифицирания email на акаунта.
- [ ] Махни `phoneVerified=true` вписването ОТ email-базирания флоу (то беше фалшива верификация на телефон). Ако `phoneVerified` се ползва другаде за нещо — провери; ако не → остави колоната, просто не я вдигай тук фалшиво.
- [ ] `countLinkableGuestOrders`: смени на email-базирано.
- [ ] Провери извикванията в UI (`src/components/account/*`) — copy „свържи по телефон" → „свържи поръчки от този имейл" ако е нужно.
- [ ] Тест: гост-поръчка с email X; акаунт с верифициран email X → linkGuestOrders я свързва. Акаунт с email Y → НЕ я свързва (0). Тест: не се вдига phoneVerified фалшиво.
- [ ] `pnpm test`.

## Финал
- [ ] `pnpm check` (lint + unit + build) — целият пакет зелен.
- [ ] Обнови `docs/WORKLOG.md` + памет (audit-cycle резултат + кои поправени).
- [ ] Питай за push разрешение (dev = прод при билинг, main=прод).
