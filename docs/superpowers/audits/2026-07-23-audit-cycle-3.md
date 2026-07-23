# Одитен цикъл #3 — 2026-07-23

Трети одит (нови измерения: Error/resilience, Business-logic, Performance/N+1, Auth/session edge).
Процес: субагенти (workflow, 16 агента, 0 грешки) → моя вторична проверка. База: `1e4f7b2`.
Подадени находките от #1+#2 → 0 повторения. **11 уникални находки, всичките нови.**
✅ Този цикъл нито един агент не пипна файлове (усилен промпт „само чети").

Вторична проверка: лично сверих AUTH-01 (courier code), BL-01 (спец §7.2 vs schema коментар — реално
противоречие), PERF-01 (reorder N+1). 0 халюцинации.

---

## ✅ ПОПРАВЕНИ 8 (план `docs/superpowers/plans/2026-07-23-audit-fixes-3.md`, `pnpm check` = 489 теста)
PERF-01 (reorder batch), AUTH-01 (courier rate limit), ERR-01 (notifyStockAlerts try/catch), ERR-02
(auto-complete per-order try/catch + CAS брояч), BL-02 (ALLOWED_TRANSITIONS + re-request guard), PERF-04
(getShopQuestions cap 200), PERF-02/03 (индекси orders + payment_intents — таргетиран SQL на прод, trgm
запазени, dev↔прод parity чист). BL-01 → отворено (долу). Дребните BL-03/04/PERF-05 → дълг.

## 🟠 ОТВОРЕНО — ИЗИСКВА ПРОДУКТОВО РЕШЕНИЕ (НЕ поправено)

| # | Находка | Файл:ред | Severity |
|---|---|---|---|
| **BL-01** | Cross-month return кредит се ГУБИ → търговец надплаща таксата. Продажба завършена март (charge 5€), върната април → април amountDue=-500 → `continue` → кредитът никога не се връща/пренася. **УМИШЛЕНО** (спец §7.2 „не се пренася"), НО спецът СИ ПРОТИВОРЕЧИ: schema дефиниция ред 198 казва „→ пренася се", §7.2 ред 206 казва „не се пренася". Кодът следва §7.2. Реални пари при всяко cross-month връщане. | `db/queries/fees.ts` / `bill-fees:43` / spec §7.2 | high |

Решение на потребителя нужно: (а) пренасяй отрицателен баланс напред, ИЛИ (б) Stripe credit note срещу
оригиналната фактура, ИЛИ (в) остави както е + разкрий в условията + оправи спец противоречието.

## 🔴 За поправка (реални, ясни фиксове)

| # | Находка | Файл:ред | Severity |
|---|---|---|---|
| **AUTH-01** | `searchOfficesForShop` (публичен checkout endpoint) БЕЗ rate limit → атакуващ с публичен shopId изчерпва куриерската API квота на магазина + замърсява споделената offices таблица. Единственият публичен endpoint без rate limit (нарушава CLAUDE-backend.md). | `actions/couriers.ts:22` | medium |
| **PERF-01** | `reorderToCart` N+1 — `products.findFirst` per поръчков ред в цикъл (15 реда → 15 заявки). Единственият истински N+1; house pattern e `inArray`. | `actions/reorder.ts:49` | high |
| **ERR-01** | `void notifyStockAlerts()` без `.catch()` → незащитени DB заявки → unhandledRejection (всички други известия минават през `Promise.allSettled`). | `actions/products.ts:189,530` | medium |
| **ERR-02** | `auto-complete-orders` cron без per-order try/catch → един провал спира целия batch (другите 3 cron-а имат изолация). | `api/cron/auto-complete-orders:33` | medium |
| **BL-02** | `requestReturn` заобикаля ALLOWED_TRANSITIONS (няма `completed→return_requested` в таблицата) + reject→re-request loop (completedAt не се обновява → купувач може да спами в прозореца). | `actions/orders.ts:688` + `order-status.ts` | medium |

## 🟡 Performance (индекси/пагинация — реални, скалиращи)

| # | Находка | Файл:ред | Severity |
|---|---|---|---|
| **PERF-02** | `auto-complete-orders` глобален seq scan на orders (няма индекс на status/updatedAt без shopId; daily cron). | `api/cron/auto-complete-orders:20` | medium |
| **PERF-03** | `expire-payments` seq scan на payment_intents (няма индекс на status/createdAt). | `db/queries/payment-reconcile.ts:16` | medium |
| **PERF-04** | `getShopQuestions` без LIMIT/пагинация (всички dashboard листинги са пагинирани, само този не). | `db/queries/questions.ts:26` | medium |

## ⚪ Дребни

| # | Находка | Файл:ред | Severity |
|---|---|---|---|
| **BL-03** | Bulk deal не се сравнява с промо цена (Case A: промо+deal → надплащане). Case B (deal по-лош от unit) вече е блокиран от guard. | `lib/pricing.ts:181` | low |
| **BL-04** | Fee occurredAt (UTC instant) vs UTC месечна граница → късни BG вечерни продажби на грешен месец (само period attribution, без загуба). | `bill-fees:13` | low |
| **PERF-05** | bill-fees прави balance заявка за ВСЕКИ магазин (вкл. без продажби) + празен draft ред. | `bill-fees:37` | low |

---

**Основите остават солидни:** integer центове, идемпотентни fee вписвания, tenant/buyer изолация,
webhook подписи. Находките са конкретни пропуски: 1 продуктово решение (BL-01), 1 auth дупка, 1 N+1,
error изолация, индекси.
