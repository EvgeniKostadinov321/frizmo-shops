# Одитен цикъл — 2026-07-23

Периодичен одит на натрупания код (нов + стар) по установения процес:
субагенти (find) → adversarial verify → моя вторична проверка → триаж → план+изпълнение.
Машинария: workflow, 4 измерения × (find high-effort + verify high-effort) = 20 агента, 0 грешки.
База: commit `6bdb524`. Метод: всяка находка сочи реален файл:ред + сценарий на провал; всяка
верифицирана срещу реалния код; 5-те най-важни аз лично сверих.

## Резултат: 15 уникални находки (след дедупликация на 3 дубъла)

Дубъли обединени: PAY-01 = BILL-01 = DATA-03 (bill-fees двойна фактура); PAY-04 = SEC-04
(ensureStripeCustomer race). Халюцинации: 0.

---

## ✅ ПОПРАВЕНИ (7 фикса, `pnpm check` зелен — 485 теста, план `docs/superpowers/plans/2026-07-23-audit-fixes.md`)

| # | Находка | Файл:ред | Фикс |
|---|---|---|---|
| BILL-01 | bill-fees прави 2 Stripe фактури при повторен/паднал cron (няма idempotencyKey; markInvoiceIssued чак след create) | `api/cron/bill-fees/route.ts:51` | idempotencyKey `fee-invoice-{id}` на invoices.create + запиши stripeInvoiceId рано |
| BILL-01b | Един магазин гръмне → всички останали не се фактурират (няма try/catch per-shop; цял GET → 500) | `api/cron/bill-fees/route.ts:36` | try/catch около тялото на цикъла per-shop; логвай, продължи |
| REL-01 | Stripe outage блокира checkout за магазини с ≥1 продажба (canAcceptOrders преди try/catch) | `actions/orders.ts:189` + `lib/selling-gate.ts:15` | try/catch в requiresCard около customerHasDefaultCard → fail-open (не блокирай установен магазин при Stripe грешка) |
| BILL-02 | Webhook paid→issued при пренаредено Stripe събитие → блокира платен магазин | `api/webhooks/stripe/route.ts:55` | payment_failed → update само `where ne(status,'paid')` |
| DATA-02 | Return window от плаващия updatedAt вместо completedAt котва → срокът се удължава | `actions/orders.ts:687` | `(order.completedAt ?? order.updatedAt)` |
| DATA-01 | Двоен клик „Откажи" → двойно възстановяване на склад (oversell); парите защитени | `actions/orders.ts:784` | CAS: `.where(and(eq(id), eq(status, order.status))).returning()`; празен → прекрати без restoreStock |
| SEC-01 | Гост-поръчки се присвояват по НЕПРОВЕРЕН телефон (bulk-claim + презапис на buyerId) | `actions/buyer.ts:169` | Свързвай по `customerEmail == user.email` (Supabase верифицира email-а), НЕ по телефон. orders.customerEmail съществува (schema:554); requireBuyer дава user.email |

SEC-01 беше умишлен UX компромис („без SMS"); решение на потребителя (2026-07-23): затвори теча
чрез email-мач вместо телефон — по-сигурно, пак без SMS. Може да свърже по-малко поръчки (гост без email),
което е приемливо.

---

## 🟡 ЗАПИСАНИ, НЕ поправени сега (известен дълг — по-нисък риск)

| # | Находка | Файл:ред | Защо отложено |
|---|---|---|---|
| DATA-02b | deleteAccount cascade-трие неплатени fee_invoices (търговец заличава дълг) | `actions/account.ts:78` | Реален, но иска активно действие + name-match; таван 50€/поръчка. Малък guard когато се захване. |
| SEC-02 | Куриерски/ePay ключове в RSC payload (собственик вижда своя secret) | `dashboard/fulfillment/page.tsx:22` | Не cross-tenant, без ескалация. Фикс = тесен DTO без credentials колоната. |
| REL-02 | Stripe outage крие и DB фактурите (мъртъв fallback в page.tsx) | `actions/billing.ts:40` | Само при Stripe outage; свързан с REL-01. try/catch в getBillingStatus. |

## ⚪ ПРОПУСНАТИ (дребни / много рядък сценарий)

| # | Находка | Файл:ред | Защо |
|---|---|---|---|
| DATA-04 | abandoned-cart дублиран имейл при DB blip | `api/cron/abandoned-carts/route.ts:31` | Маркетинг, не пари; тесен прозорец |
| SEC-03 | Webhook приема metadata.feeInvoiceId без customer проверка | `api/webhooks/stripe/route.ts:53` | Иска write достъп до споделения Stripe акаунт (privileged) |
| PAY-04/SEC-04 | ensureStripeCustomer race → осиротял Stripe Customer | `lib/stripe.ts:59` | Картата пак ляга на DB-каноничния customer (setDefaultCard reject-ва чужд); само хигиена |
| PAY-03 | ePay не сверява валута | `lib/payments/epay.ts:45` | Ние диктуваме EUR; иска грешна конфигурация на магазина; ePay е блокиран от външно активиране без друго |

---

**Основите остават солидни:** integer центове навсякъде, RLS/индекси/snapshot, webhook подпис timing-safe +
dedup, идемпотентни fee ledger вписвания (onConflictDoNothing), buyer/tenant изолация през сесията, ключове
никога към клиента (освен SEC-02 нюанса). 0 находки в стария добре-утъпкан код освен вече-известните.
```
