# Backend контекст (зарежда се при всяка задача)

## Multi-tenant изолация — правило №1

`shopId` е тенант ключът. Всяка заявка/мутация на търговец се филтрира по неговия магазин; кросс-tenant достъп = критичен бъг. Всяка мутация минава през wrapper-а:

```
authorizedAction() = auth (Supabase user) → собственост (shop.ownerId === user.id) → Zod parse → санитизация → изпълнение
```

Мутации живеят САМО в `src/actions/`; всяка използва wrapper-а — без изключения.

## Публични endpoint-и (checkout, контактни форми)

Rate limit (Postgres таблица, плъзгащ прозорец — без Redis) + Zod + санитизация + honeypot поле. Никакво доверие на клиентски данни: цени, наличности и промоции се преизчисляват на сървъра при всяка поръчка.

## Пари

Integer **евроцентове** (EUR), никога float. Парсване: `toCents()`, показване: `formatPrice()` от `src/lib/money.ts`. Аритметика само върху центове.

## База данни (Drizzle + Supabase Postgres)

* SQL/заявки САМО в `src/db/` (schema + query функции). `src/db/schema.ts` е каноничният източник; deploy: `pnpm db:push` (drizzle-kit push, БЕЗ versioned migration файлове — урок от Frizmo).
* Задължителни колони: `id`, `createdAt`, `updatedAt` (+ `shopId` където е приложимо). Индекси на всички FK и търсени колони.
* Транзакции за многостъпкови операции. Поръчка = транзакция: проверка наличност → декремент → запис + пореден номер per-магазин. Race за последна бройка → вторият получава „изчерпано".
* `order_items` пази **snapshot** (име, цена, вариант към момента на поръчката) — историята не се променя при редакция на продукти.
* Отказана поръчка → наличностите се възстановяват.
* Статуси (enum-и): shop `draft|published|suspended|blocked` · order `new|confirmed|shipped|completed|cancelled` · subscription `trial→active→grace→suspended→cancelled`.
* Full-text търсене: Postgres `tsvector` + `pg_trgm` — без външни услуги.

## Валидация и санитизация

Zod схеми в `src/schemas/` — едни и същи за клиент и сървър. Текстов вход: `sanitizeText()` (едноредов) / `sanitizeMultiline()` (описания) от `src/lib/sanitize.ts` преди запис.

## Файлове (Supabase Storage)

Пътища `shops/{shopId}/...` (изолация). Качване само през подписани URL-и. Лимити: до 8 снимки/продукт, ≤5MB, само `image/*`.

## Планови лимити и абонаменти

Лимитите (брой продукти, Pro секции/теми/промоции) се проверяват НА СЪРВЪРА чрез `checkPlanLimit(shopId, feature)` във всяка релевантна action — скрит бутон не е защита. Downgrade/suspend не трие данни: продукти над лимита → неактивни; suspended магазин → „временно затворено", checkout блокиран. Stripe webhooks + дневна reconciliation (Vercel cron).

## Грешки и логове

Никакви stack traces/вътрешни детайли към клиента — общи съобщения на български. Структурирани логове на сървъра (console JSON → Vercel logs).

## Slugs

`slugify()` от `src/lib/slug.ts` (кирилица → латиница). При колизия: суфикс `-2`, `-3`… Резервирани: `admin`, `api`, `auth`, `dashboard`, `shops`, `products`, `blog`, `pricing`, `s`, `www`.
