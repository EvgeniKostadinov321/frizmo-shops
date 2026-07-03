# Backend контекст (зарежда се при всяка задача)

## Multi-tenant изолация — правило №1

`shopId` е тенант ключът. Всяка заявка/мутация на търговец се филтрира по неговия магазин; кросс-tenant достъп = критичен бъг. Всяка мутация минава през wrapper-а (`src/lib/auth.ts`):

```
requireShop() = auth (Supabase user) → собственост (shop.ownerId === user.id) → Zod parse → санитизация → изпълнение
```

Мутации живеят САМО в `src/actions/`; всяка използва wrapper-а — без изключения.
Платформен админ: `requireAdmin()` — имейлът трябва да е в `PLATFORM_ADMIN_EMAILS` (env), иначе `notFound()`. Админ мутациите са в `src/actions/admin.ts`.

## Публични endpoint-и (checkout, контактни форми)

Rate limit (Postgres таблица `rate_limits`, `src/lib/rate-limit.ts` — без Redis) + Zod + санитизация + honeypot поле (ботът получава фалшив успех). Никакво доверие на клиентски данни: цени, наличности и промоции се преизчисляват на сървъра при всяка поръчка (`src/lib/pricing.ts` — чиста функция, единственият ценови източник за количка И checkout).

## Пари

Integer **евроцентове** (EUR), никога float. Парсване: `toCents()`, показване: `formatPrice()` от `src/lib/money.ts`. Аритметика само върху центове.

## База данни (Drizzle + Supabase Postgres)

* SQL/заявки САМО в `src/db/` (schema + query функции в `src/db/queries/`). `src/db/schema.ts` е каноничният източник; deploy: `pnpm db:push` (drizzle-kit push, БЕЗ versioned migration файлове — урок от Frizmo).
* Всички таблици са с `.enableRLS()` (без policies — Data API е заключен; сървърът минава през direct Postgres). App connection = transaction pooler `:6543` (`prepare:false`); drizzle-kit = session pooler `:5432`.
* Задължителни колони: `id`, `createdAt`, `updatedAt` (+ `shopId` където е приложимо). Индекси на всички FK и търсени колони.
* Транзакции за многостъпкови операции. Поръчка = транзакция със `SELECT ... FOR UPDATE`: проверка наличност → декремент → запис + пореден номер per-магазин (max+1, unique index + 3 retry-а). Race за последна бройка → вторият получава „изчерпано“.
* `order_items` пази **snapshot** (име, цена, вариант към момента на поръчката). Отказана поръчка → наличностите се възстановяват (позволените преходи са в `ALLOWED_TRANSITIONS`, src/actions/orders.ts).
* Статуси (enum-и): shop `draft|published|suspended|blocked` · order `new|confirmed|shipped|completed|cancelled` · subscription `trial→active→grace→suspended→cancelled`.
* Търсене: `pg_trgm` + GIN индекси (scripts/setup-search.mjs), ILIKE заявки — без външни услуги.

## Валидация и санитизация

Zod схеми в `src/schemas/` — едни и същи за клиент и сървър. Текстов вход: `sanitizeText()` (едноредов) / `sanitizeMultiline()` (описания) от `src/lib/sanitize.ts` преди запис. Телефони: `parseBgPhone()` от `src/lib/phone.ts` (стационарни са валидни; `requireMobile` за checkout).

## Файлове (Supabase Storage)

Bucket `shop-media`, пътища `shops/{shopId}/{products|branding|site}/...` (изолация). Качване само през подписани URL-и (`requestImageUpload` action → `uploadToSignedUrl`). Лимити: до 8 снимки/продукт, ≤5MB, само `image/*`. Публично четене: `publicImageUrl()` от `src/lib/storage.ts`. Storage операции на сървъра — през `createSupabaseAdmin` (`SUPABASE_SECRET_KEY`, никога `NEXT_PUBLIC_`).

## Известия

Имейли: Resend от `shops@frizmo.bg` (`src/lib/email.ts`). Web push: VAPID + `public/sw.js` + таблица `push_subscriptions` (`src/lib/push.ts`); 404/410 при изпращане → subscription-ът се трие.

## Планови лимити и абонаменти

**Текущо състояние: `getShopPlan()` (src/lib/plan.ts) е stub → всички са "pro". План 6 Фаза Б (Stripe) го заменя — стартира само при изрична заявка от потребителя.**
Целевото поведение: лимитите се проверяват НА СЪРВЪРА чрез `checkPlanLimit(shopId, feature)` във всяка релевантна action — скрит бутон не е защита. Downgrade/suspend не трие данни: продукти над лимита → неактивни; suspended магазин → „временно затворено“, checkout блокиран. Stripe webhooks + дневна reconciliation (Vercel cron).

## Грешки и логове

Никакви stack traces/вътрешни детайли към клиента — общи съобщения на български. Структурирани логове на сървъра (console JSON → Vercel logs).

## Slugs

`slugify()` от `src/lib/slug.ts` (кирилица → латиница). При колизия: суфикс `-2`, `-3`… Резервирани slug-ове: виж `RESERVED_SLUGS` в `src/lib/shop-slug.ts`.
