# Abandoned cart recovery имейл — дизайн

**Дата:** 2026-07-10
**Статус:** одобрен за планиране
**Обхват:** чисто в кода (с ЕДНА env var: `CRON_SECRET` във Vercel — като VAPID/env-ите)
**Свързани (готови):** product feed (№2), тегло (№1).

---

## 1. Цел

Когато купувач (гост) стигне до checkout, попълни имейл, отметне „Напомни ми", но НЕ завърши поръчката — след 1 час да получи **един** имейл с продуктите в количката и линк обратно. Възстановява 5–15% от изоставените колички.

### Защо е нетривиално (контекст)

- **Количката е 100% клиентска** (`localStorage`, `src/lib/cart-storage.ts`) — сървърът НЕ я вижда, докато не се завърши поръчка.
- **Имейл се въвежда чак на checkout** (`orders.customerEmail`), а изоставената количка е ПРЕДИ това.

Затова трябва да уловим **количка + имейл на сървъра** в момент преди завършване — при валиден имейл + изрична отметка на checkout.

**Ключови решения (от брейнсторминга):**
- **Улавяне:** checkbox „Напомни ми" (opt-in, GDPR-чисто, неотметнат по подразбиране) на checkout; при отметка + валиден имейл (onBlur) → server action записва количка на сървъра.
- **Прозорец:** изоставена ако няма поръчка **1 час**; **един** имейл, никога повторно за същата количка.
- **Доставка:** само имейл (Resend). Web push отпада — subscription-ите са за търговци (`userId`), не за гости.
- **Тригер:** Vercel Cron на всеки час (`CRON_SECRET` гард).
- **Дедупликация:** една активна изоставена количка на `(shopId, email)` (upsert).

**Извън обхвата (YAGNI):**
- Серия имейли (1ч + 24ч + купон) — само един засега.
- Купувачески акаунт — гост-only.
- Настройваем от търговеца прозорец/включване — фиксирано 1ч.
- Web push към гости.

---

## 2. Данни (нова таблица `abandoned_carts`)

State машина по образец на `stock_alerts`/`subscribers`.

```ts
export const abandonedCartStatusEnum = pgEnum("abandoned_cart_status", [
  "pending",   // уловена, чака зреене
  "sent",      // имейлът е пратен
  "converted", // купувачът завърши поръчка → не се праща
]);

export const abandonedCarts = pgTable("abandoned_carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  email: text("email").notNull(),                          // lowercase
  lines: jsonb("lines").$type<AbandonedLine[]>().notNull(), // snapshot
  subtotalCents: integer("subtotal_cents").notNull(),
  status: abandonedCartStatusEnum("status").notNull().default("pending"),
  remindedAt: timestamp("reminded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("abandoned_carts_shop_email_idx").on(t.shopId, t.email),
  index("abandoned_carts_status_updated_idx").on(t.status, t.updatedAt),
]).enableRLS();
```

**`AbandonedLine` (snapshot тип):**
```ts
interface AbandonedLine {
  productId: string;
  variantKey: string | null;
  qty: number;
  name: string;
  priceCents: number;   // ефективна цена към момента
  imagePath: string | null;
  productSlug: string;
}
```
Снапшотът пази имейла рендерируем дори ако продуктът се промени. `db:push` добавя таблицата (нула риск — нова таблица).

**Индекси:** unique `(shopId, email)` (upsert дедуп); `(status, updatedAt)` (cron заявка). Всички таблици с `.enableRLS()` (без policies — сървърът минава през direct Postgres).

---

## 3. Улавяне (checkout)

### Checkbox (`src/components/storefront/checkout-form.tsx`)
Под имейл полето — нов ред:
> ☐ Напомни ми с имейл, ако не завърша поръчката

Неотметнат по подразбиране (opt-in). Storefront стил (`--sf-*` променливи, съществуващият `Checkbox` pattern във формата).

### Тригер
При **(валиден имейл onBlur) И (checkbox отметнат) И (непразна количка)** → извиква нов action `saveAbandonedCart`. Дебоунс на клиента (напр. 800ms), за да не спами. Ако checkbox се махне → извиква action с флаг за триене (маха pending за този email/shop).

### Server action `saveAbandonedCart` (`src/actions/abandoned-cart.ts`)
```
saveAbandonedCart({ shopSlug, email, lines, remind }) →
  requirePublic (rate limit + Zod + sanitize) →
  ако !remind: изтрий pending за (shopId, email) → ok
  ако remind:
    прецени редовете НА СЪРВЪРА (priceCart, като checkout) → snapshot + subtotal
    ако количката е празна/невалидна → тихо ok (не чупи checkout)
    upsert в abandoned_carts по (shopId, email):
      lines, subtotalCents, status='pending', updatedAt=now()
    → ok
```
- **Публичен endpoint:** rate limit (Postgres `rate_limits`, `src/lib/rate-limit.ts`) + Zod + `sanitizeText(email)` + `parseBgPhone` не е нужен (само имейл). Никакво доверие на клиентски цени — редовете се преизчисляват през `priceCart` (единственият ценови източник).
- **Upsert:** `onConflict (shopId, email) do update` — нова активност презаписва редовете и връща `status='pending'` (нулира ако е било `sent`).

### При завършена поръчка (`src/actions/orders.ts`)
В `saveOrder` (и двата пътя — със/без варианти), СЛЕД успешен запис: маркирай `abandoned_carts` за `(shopId, lower(customerEmail))` като `status='converted'` (неблокиращо, `void`). Така купил човек не получава напомняне.

---

## 4. Cron + изпращане

### `vercel.json` (нов)
```json
{
  "crons": [
    { "path": "/api/cron/abandoned-carts", "schedule": "0 * * * *" }
  ]
}
```
(на всеки час, в началото на часа)

### Route `src/app/api/cron/abandoned-carts/route.ts`
```
GET →
  гард: Authorization === `Bearer ${process.env.CRON_SECRET}` иначе 401
  вземи зрелите: dueAbandonedCarts заявка (status='pending' AND updatedAt < now()-1h, LIMIT 100)
  за всяка (с магазина ѝ):
    try: sendAbandonedCartEmail(...) → update status='sent', remindedAt=now()
    catch: log, остави pending (следващият час опитва пак)
  връща JSON { processed, sent, failed }
```
- **Гард:** без валиден `CRON_SECRET` → `401`. Vercel Cron праща header-а автоматично.
- **Идемпотентност:** `sent` веднага след успех → следваща заявка не го хваща.
- **Партиден лимит:** 100 на пускане (предпазител); ако се удари, следващият час взима останалите.

### Чиста логика `src/lib/abandoned-cart.ts`
```ts
/** Кои pending колички са зрели за имейл (>1ч). Чиста функция — тества се без DB. */
export function dueAbandonedCarts<T extends { status: string; updatedAt: Date }>(
  carts: T[],
  now: Date,
  thresholdMs = 60 * 60 * 1000,
): T[]
```
Заявката в `queries` ползва SQL за ефективност, но прагът/филтърът се покрива и от чистата функция за тестове.

### Имейл `sendAbandonedCartEmail` (`src/lib/email.ts`)
По образец на `sendBackInStockEmail`:
```ts
sendAbandonedCartEmail(input: {
  toEmail: string;
  shopName: string;
  shopSlug: string;
  lines: AbandonedLine[];
  subtotalCents: number;
}): Promise<void>
```
- От `shops@frizmo.bg`, тема „Забрави ли нещо в количката?"
- Съдържание: продуктите (име, снимка през `publicImageUrl`, цена, кол-во), сбор (`formatPrice`), голям бутон „Върни се към количката" → `{SITE_URL}/s/{slug}/checkout`
- Тон „на ти", уважителен, еднократен; типографски кавички.

---

## 5. Грешки

- Cron без валиден secret → `401` (без обработка).
- Resend fail за един ред → try/catch per ред, log, продължава; редът остава `pending` (следващият час опитва).
- `saveAbandonedCart` при невалиден имейл/празна количка → тихо `ok` (не чупи checkout).
- Никакви stack traces към клиента; структурирани логове (console JSON → Vercel).

---

## 6. Тестове (Vitest — само логиката)

`src/lib/abandoned-cart.test.ts`:
- `dueAbandonedCarts`: pending >1ч → връща се · pending <1ч → не · sent/converted → не · граничен случай точно на 1ч
- snapshot builder (ако е изнесен): правилен сбор от редовете, коректен ред на полетата

`src/actions/abandoned-cart` (интеграционно, ако си струва): upsert презаписва; `remind=false` трие pending.

Cron гард (401 без secret) — ако е лесно изолируемо (иначе ръчно).

UI (checkbox, имейл рендер) — ръчна проверка от потребителя (правило: без Playwright визуални тестове).

**Гейт:** `pnpm check` минава преди commit.

---

## 7. Обобщение на засегнатите файлове

| Файл | Промяна |
|---|---|
| `src/db/schema.ts` | таблица `abandoned_carts` + enum + `db:push` |
| `src/lib/abandoned-cart.ts` | `dueAbandonedCarts` + snapshot логика (нов, чист) |
| `src/lib/abandoned-cart.test.ts` | тестове (нов) |
| `src/db/queries/abandoned-cart.ts` | upsert + due + convert заявки (нов) |
| `src/actions/abandoned-cart.ts` | `saveAbandonedCart` action (нов) |
| `src/lib/email.ts` | `sendAbandonedCartEmail` |
| `src/app/api/cron/abandoned-carts/route.ts` | cron handler (нов) |
| `src/components/storefront/checkout-form.tsx` | checkbox + debounce onBlur извикване |
| `src/actions/orders.ts` | маркиране `converted` при поръчка (двата пътя) |
| `vercel.json` | cron дефиниция (нов) |
| CLAUDE.md / env reference | `CRON_SECRET` в списъка |

**Единствена външна настройка:** `CRON_SECRET` env var във Vercel (+ локално за тест). Всичко останало е чист код. `db:push` добавя нова таблица (нула риск).

**Ред на изпълнение (за плана):** схема (нова таблица, `db:push`) → чиста логика `dueAbandonedCarts` + тестове → queries (upsert/due/convert) → `saveAbandonedCart` action → checkout checkbox + тригер → `sendAbandonedCartEmail` → cron route + `vercel.json` → convert в `saveOrder` → env doc → финална `pnpm check`.
