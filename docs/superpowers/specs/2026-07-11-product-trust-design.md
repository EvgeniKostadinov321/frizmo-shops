# Пакет Б — „Доверие на продукта" (спецификация)

**Дата:** 2026-07-11
**Обхват:** 2 функции на публичната продуктова страница + търговски dashboard.
**Подход:** един спец → един план → inline имплементация (без паралелни субагенти).

## Цел

Добавяме social proof и доверие на продуктовата страница:

1. **„X продадени" бадж** — агрегат от `order_items` (сума продадени бройки в незавършени/завършени поръчки), показан над праг.
2. **Q&A на продукт** — купувачите питат, търговецът отговаря и публикува; модерация огледало на ревютата.

Всичко минава през съществуващите слоеве: Zod (`src/schemas/`) → action (`src/actions/`) → `requireShop()` за търговски мутации (публичното подаване е като `submitReview` — rate limit + honeypot + sanitize). Tenant изолация по `shopId`. UI на български с типографски кавички „…“.

---

## Глобални ограничения (важат за всяка задача)

- **Tenant изолация:** всяка търговска мутация през `requireShop()`; всяка заявка филтрирана по `shopId`. Публичните подавания резолвват магазина по slug + проверяват `status === "published"`. Кросс-tenant достъп = критичен бъг.
- **Публични endpoint-и:** rate limit (`src/lib/rate-limit.ts`, Postgres) + Zod + honeypot поле (ботът получава фалшив успех) + `sanitizeText()`/`sanitizeMultiline()` преди запис. Никакво доверие на клиентски данни.
- **DB deploy:** `pnpm db:push` (drizzle-kit push, БЕЗ migration файлове). `src/db/schema.ts` е каноничният източник.
- **DB env:** drizzle.config.ts чете `DATABASE_URL_MIGRATIONS` директно — зареди го в shell-а от `.env.local` БЕЗ да принтираш стойността, после `pnpm db:push`.
- **UI:** само `ui/` примитиви (`Button`/`Input`/`Textarea`/`Card`/`Icon`/`Badge`/`EmptyState`/`ConfirmDialog`). Touch ≥44px (`h-11`). Mobile-first 375px. Без емоджита (използвай `Icon`). Платформен UI → `brand-*`/`ink-*`/`surface-*` токени; storefront → само `--sf-*`. Нула хардкоднати hex/px.
- **Множествено число:** през `src/lib/plural.ts` (`count(n, NOUNS.x)`) — числово съгласуване.
- **Gate:** `pnpm check` (lint + unit + build) минава преди всеки commit.
- **Push:** само след изрично разрешение от потребителя (dev = Vercel production).
- **Контролни символи:** скан за `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` преди commit.

---

## Функция 1 — „X продадени" бадж

### 1.1 Схема

Нов индекс на `order_items` (за aggregate-а по продукт) — в дефиницията на таблицата (`src/db/schema.ts` ~421):

```ts
(t) => [
  index("order_items_order_idx").on(t.orderId),
  index("order_items_product_idx").on(t.productId),
],
```

Няма нови колони.

### 1.2 Заявка

Нова функция в `src/db/queries/storefront.ts`:

```ts
/** Сума продадени бройки за продукт (поръчки confirmed/shipped/completed, не new/cancelled).
    Tenant: филтър по orders.shopId. 0 ако няма. */
export async function getSoldCount(shopId: string, productId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orderItems.productId, productId),
        eq(orders.shopId, shopId),
        inArray(orders.status, ["confirmed", "shipped", "completed"]),
      ),
    );
  return row?.total ?? 0;
}
```

(Импортите `orderItems`, `orders`, `sql`, `inArray` вероятно вече ги има в storefront.ts — добави липсващите.)

### 1.3 Праг + показване

Праг: **5**. Ако `soldCount >= 5` → покажи бадж; иначе нищо.

На продуктовата страница (`src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`), до марката/size guide реда (или под рейтинга):

```tsx
{soldCount >= 5 && (
  <span className="inline-flex items-center gap-1.5 text-sm text-(--sf-muted)">
    <Icon name="shopping-cart" size={15} />
    {count(soldCount, NOUNS.sold)} {/* „47 продадени" */}
  </span>
)}
```

`NOUNS.sold` се добавя в `src/lib/plural.ts` (форми: продаден/продадени). Заявката `getSoldCount(shop.id, product.id)` се добавя към `Promise.all` в страницата.

---

## Функция 2 — Q&A на продукт

### 2.1 Схема

Нов enum + таблица в `src/db/schema.ts`:

```ts
export const questionStatusEnum = pgEnum("question_status", ["pending", "answered"]);

export const productQuestions = pgTable(
  "product_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    /** Име на питащия; празно → „Купувач" в UI. */
    askerName: text("asker_name").notNull().default(""),
    question: text("question").notNull(),
    /** Отговорът на търговеца; непразен при status='answered'. */
    answer: text("answer").notNull().default(""),
    status: questionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("product_questions_shop_status_idx").on(t.shopId, t.status),
    index("product_questions_product_status_idx").on(t.productId, t.status),
  ],
).enableRLS();

export type ProductQuestion = typeof productQuestions.$inferSelect;
```

Публично видими = само `status='answered'`.

### 2.2 Zod — `src/schemas/question.ts`

```ts
import { z } from "zod";

export const submitQuestionSchema = z.object({
  productId: z.uuid(),
  askerName: z.string().trim().max(60).default(""),
  question: z.string().trim().min(5, "Въпросът е твърде кратък").max(500),
  /** Honeypot: реален потребител никога не го попълва. */
  website: z.string().max(100).default(""),
});

export const answerQuestionSchema = z.object({
  id: z.uuid(),
  answer: z.string().trim().min(1, "Въведи отговор").max(1000),
});
```

### 2.3 Заявки — `src/db/queries/questions.ts`

```ts
/** Само отговорени въпроси за продукта (публично), пагинирано като ревютата. */
export async function getAnsweredQuestions(productId: string, page = 1)
/** Всички въпроси на магазина (dashboard), pending най-отгоре. */
export async function getShopQuestions(shopId: string)
/** Брой чакащи (pending) — за nav badge. */
export async function countPendingQuestions(shopId: string): Promise<number>
```

`getAnsweredQuestions` връща `{ items, total, pageSize }` (същата форма като `getApprovedReviews`).

### 2.4 Actions — `src/actions/questions.ts`

- `submitQuestion(shopSlug, rawInput)` — публично, огледало на `submitReview`: honeypot → rate limit (`question:${ip}`, 5, 3600) → резолв магазин (`published`) + продукт (`active`) → sanitize → insert `pending`.
- `answerQuestion(rawInput)` — `requireShop()`, Zod, sanitize отговора, set `answer` + `status='answered'`, `WHERE shopId`. `revalidatePath("/dashboard/questions")` + `revalidateShop`.
- `deleteQuestion({ id })` — `requireShop()`, delete `WHERE shopId`.

### 2.5 Публична форма — `src/components/storefront/question-form.tsx`

Client компонент (огледало на `ReviewForm`): поле „Име (по избор)" + `Textarea` „Твоят въпрос" + скрит honeypot `website`. Подава `submitQuestion`. Успех → toast „Въпросът е изпратен. Ще се публикува след отговор." Storefront `--sf-*` токени.

### 2.6 Публичен изглед — продуктова страница

Секция „Въпроси и отговори" под ревютата:
- `getAnsweredQuestions(product.id, page)` (пагинация през `?questionsPage=`).
- Всеки: въпрос + (`askerName || "Купувач"`) + дата → отговор от магазина (визуално отделен, напр. с ляв бордер/индент).
- Винаги показвай `QuestionForm` (подкана „Имаш въпрос? Питай."). Празно състояние: „Още няма въпроси — задай първия."

### 2.7 Търговски dashboard — `/dashboard/questions`

- Нова страница + `QuestionsManager` (client): списък pending (най-отгоре, подчертани) + answered.
  - Pending: въпрос + `Textarea` за отговор + бутон **Публикувай** (`answerQuestion`) + **Изтрий** (`ConfirmDialog` → `deleteQuestion`).
  - Answered: въпрос + отговор (read-only) + **Редактирай отговора** (пак `answerQuestion`) + **Изтрий**.
  - `EmptyState` при 0.
- Nav линк „Въпроси" (`src/components/dashboard/nav-items.ts`) с **badge за брой pending**.
- Badge wiring: `countPendingQuestions(shop.id)` в `src/app/(dashboard)/dashboard/layout.tsx`, подаден на `DashboardNav` + `MobileMenuButton` (същият паттерн като `pendingReviews`). `nav.tsx` и `mobile-menu-button.tsx` разширяват `badgeFor` да покрива и „Въпроси".

---

## Ред на имплементация (един по един)

1. **„X продадени"** — индекс + `getSoldCount` + `NOUNS.sold` + бадж на продуктовата страница.
2. **Q&A схема + заявки + actions** — таблица/enum + `db:push` + queries + actions + Zod.
3. **Q&A публичен** — `QuestionForm` + секция на продуктовата страница.
4. **Q&A dashboard** — `/dashboard/questions` + manager + nav badge.

Всяка стъпка завършва с независимо тестваем deliverable + `pnpm check`.

## Тестване

- **Unit (Vitest):** `getSoldCount` семантика (изключва new/cancelled) — чрез чиста помощна функция ако се изнесе, или интеграционно; праг логика; `submitQuestionSchema`/`answerQuestionSchema` валидация; „answered-only" филтър.
- **Ръчно (потребител):** бадж при ≥5 продадени (и скрит под 5, и скрит при само cancelled); задай въпрос → pending (невидим) → отговори в dashboard → публичен въпрос+отговор; badge за pending; изтриване; honeypot; rate limit; мобилно 375px; light/dark.
- **Без Playwright за естетика** (проектно правило).

## Извън обхват (YAGNI)

- Бадж „X продадени" на листинг карти (само продуктовата страница засега).
- Гласуване/лайкове на въпроси.
- Имейл известие до питащия при отговор (нужен е имейл на питащия — сега не го събираме).
- Публично одобрение на въпрос без отговор (само answered се виждат).
