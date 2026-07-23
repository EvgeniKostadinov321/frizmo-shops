# Одитни поправки #3 (2026-07-23) — план

**Goal:** 8 одобрени находки от одит #3: PERF-01, AUTH-01, ERR-01, ERR-02, BL-02, PERF-02, PERF-03, PERF-04.
BL-01 (cross-month кредит) — ОТЛОЖЕНО за продуктово решение. Дребните BL-03/04/PERF-05 — не сега.

**Изпълнение:** inline, TDD/тест където има логика, `pnpm check`. Индекси = schema.ts + таргетиран SQL на прод.

---

## Задача 1 — PERF-01: reorderToCart batch (N+1 → 1 заявка)
**Файл:** `src/actions/reorder.ts:44-66`
- [ ] Преди цикъла: `const ids = [...new Set(items.map(i => i.productId).filter(Boolean))]`; ако ids.length → `findMany({ where: and(eq(shopId), inArray(products.id, ids)) })` → `Map<id, product>`.
- [ ] В цикъла: `const product = map.get(item.productId)` (без заявка). Импортирай `inArray`.
- [ ] Тест: reorder с 2 продукта → 1 products заявка (не 2).

## Задача 2 — AUTH-01: rate limit на searchOfficesForShop
**Файл:** `src/actions/couriers.ts:33-34`
- [ ] Импортирай `checkRateLimit` + `clientIp` (от @/actions/cart). СЛЕД cache read (ред 34), ПРЕДИ external fetch (ред 36): `if (!(await checkRateLimit(\`courier-search:\${await clientIp()}:\${shopId}\`, 20, 60))) return toPublic(await searchCachedOffices(provider, trimmed));` — cache hits остават бързи, само живата рефреш пътека се throttle-ва.
- [ ] Коментар защо (публичен endpoint → защита на куриерската квота + споделената nomenclature).

## Задача 3 — ERR-01: notifyStockAlerts try/catch
**Файл:** `src/lib/stock-alerts.ts`
- [ ] Обвий цялото тяло на notifyStockAlerts в try/catch → при грешка `console.error(JSON.stringify({scope:'notifyStockAlerts', shopId, error: e instanceof Error ? e.message : String(e)}))`; return тихо. Така голото `void notifyStockAlerts()` не може да даде unhandledRejection.

## Задача 4 — ERR-02: auto-complete-orders per-order try/catch
**Файл:** `src/app/api/cron/auto-complete-orders/route.ts:31-41`
- [ ] Обвий тялото на цикъла в try/catch: при грешка `console.error(JSON.stringify({scope:'auto-complete', orderId: order.id, error}))` + `continue`. Добави `failed` брояч.
- [ ] Провери CAS резултата: update-ът вече има `.where(eq(status,'shipped'))` — добави `.returning()` и брой completed само при непразен (иначе брои и CAS miss). Върни `{completed, failed}`.

## Задача 5 — BL-02: requestReturn през ALLOWED_TRANSITIONS + re-request guard
**Файлове:** `src/lib/order-status.ts`, `src/actions/orders.ts:688`
- [ ] ALLOWED_TRANSITIONS: добави `completed: ["return_requested"]` (прави таблицата авторитетна).
- [ ] requestReturn: валидирай `ALLOWED_TRANSITIONS[order.status]?.includes("return_requested")` вместо голия `order.status === "completed"` (пази и window проверката).
- [ ] Re-request guard: провери дали има `returnRejectedAt` в схемата; ако НЯМА — минимален вариант: блокирай re-request ако поръчката вече е минала през return_requested и е върната на completed. Прагматично: ако `order.returnRequestedAt` е set И статусът е completed (значи е било отхвърлено) → откажи повторна заявка с ясно съобщение. (Без нова колона — returnRequestedAt вече съществува.)
- [ ] Тест: cancelled→return_requested отхвърлен; повторна заявка след reject отхвърлена.

## Задача 6 — PERF-04: getShopQuestions cap
**Файл:** `src/db/queries/questions.ts:26`
- [ ] Добави `.limit(200)` към getShopQuestions (спира unbounded fetch; 200 е разумен таван за dashboard). Коментар: пълна пагинация ако потрябва.

## Задача 7 — PERF-02: индекс orders (status, updatedAt)
**Файлове:** `src/db/schema.ts` (orders индекси), после таргетиран SQL на прод
- [ ] Добави `index("orders_status_updated_idx").on(orders.status, orders.updatedAt)` в orders таблицата.
- [ ] `db:push` на DEV. Таргетиран SQL на ПРОД (`CREATE INDEX IF NOT EXISTS ... ON orders (status, updated_at)`) — НЕ drizzle push (пази trgm). Провери verify-schema-parity.

## Задача 8 — PERF-03: индекс payment_intents (status, createdAt)
**Файлове:** `src/db/schema.ts` (payment_intents индекси), после таргетиран SQL на прод
- [ ] Добави `index("payment_intents_status_created_idx").on(paymentIntents.status, paymentIntents.createdAt)`.
- [ ] `db:push` DEV + таргетиран SQL на прод.

## Финал
- [ ] `pnpm check` зелен.
- [ ] Индекси на прод (таргетиран SQL) + verify-schema-parity.
- [ ] Обнови audit доклад + WORKLOG + памет (BL-01 като отворено решение). Питай за push.
