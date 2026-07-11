# Пакет Б „Доверие на продукта" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавя „X продадени" social-proof бадж + Q&A (въпроси и отговори) на продуктовата страница, с търговски dashboard за модерация.

**Architecture:** „X продадени" = лек aggregate от `order_items`×`orders` (само confirmed/shipped/completed), показан над праг 5. Q&A = нова таблица `product_questions` (pending→answered), огледало на ревю-модерацията: публична форма → pending → търговец отговаря и публикува → само answered се виждат. Всичко през съществуващите слоеве.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + Supabase Postgres, Zod, Tailwind 4, Vitest, pnpm.

**Спец:** `docs/superpowers/specs/2026-07-11-product-trust-design.md`

## Global Constraints

- **Tenant изолация:** търговски мутации през `requireShop()`; всяка заявка филтрирана по `shopId`. Публични подавания резолвват магазина по slug + `status === "published"`. Кросс-tenant = критичен бъг.
- **Публични endpoint-и:** rate limit (`src/lib/rate-limit.ts`) + Zod + honeypot поле (бот → фалшив успех) + `sanitizeText()`/`sanitizeMultiline()` преди запис.
- **DB deploy:** `pnpm db:push` (drizzle-kit push, БЕЗ migration файлове). `src/db/schema.ts` е каноничният източник.
- **db:push env:** drizzle.config.ts чете `DATABASE_URL_MIGRATIONS` директно — зареди го в shell-а от `.env.local` БЕЗ да принтираш стойността, после `pnpm db:push`.
- **UI:** само `ui/` примитиви (`Button`/`Textarea`/`Card`/`Icon`/`Badge`/`EmptyState`/`ConfirmDialog`/`TransitionLink`). Touch ≥44px (`h-11`). Mobile-first 375px. Без емоджита (`Icon`). Платформен UI → `brand-*`/`ink-*`/`surface-*`; storefront → само `--sf-*`. Нула хардкоднати hex/px.
- **Множествено число:** `src/lib/plural.ts` (`count(n, NOUNS.x)`).
- **BG текст:** типографски кавички „…“ (прав `"` чупи JS/lint). Валута EUR.
- **Gate:** `pnpm check` минава преди всеки commit.
- **Push:** само след изрично разрешение (dev = Vercel production).
- **Контролни символи:** скан за `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` преди commit.

---

## File Structure

**Създава:**
- `src/schemas/question.ts` — `submitQuestionSchema`, `answerQuestionSchema`.
- `src/db/queries/questions.ts` — `getAnsweredQuestions`, `getShopQuestions`, `countPendingQuestions`.
- `src/actions/questions.ts` — `submitQuestion`, `answerQuestion`, `deleteQuestion`.
- `src/components/storefront/question-form.tsx` — публична форма (огледало на ReviewForm).
- `src/components/dashboard/questions-manager.tsx` — модерация (огледало на ReviewsManager).
- `src/app/(dashboard)/dashboard/questions/page.tsx` — dashboard страница.

**Модифицира:**
- `src/db/schema.ts` — индекс `order_items_product_idx` + enum `question_status` + таблица `productQuestions` + тип.
- `src/db/queries/storefront.ts` — `getSoldCount` + импорти (`orders`, `orderItems`).
- `src/lib/plural.ts` — `NOUNS.sold`.
- `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx` — бадж + Q&A секция.
- `src/components/dashboard/nav-items.ts` — nav линк „Въпроси".
- `src/components/dashboard/nav.tsx` — `pendingQuestions` prop + `badgeFor`.
- `src/components/dashboard/mobile-menu-button.tsx` — `pendingQuestions` prop + `badgeFor`.
- `src/app/(dashboard)/dashboard/layout.tsx` — `countPendingQuestions` → подаване към nav.

---

## Task 1: „X продадени" бадж

**Files:**
- Modify: `src/db/schema.ts` (order_items индекси ~421), `src/db/queries/storefront.ts`, `src/lib/plural.ts`, `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`
- Test: `src/db/queries/storefront.ts` (чиста функция за прага — виж Step 1)

**Interfaces:**
- Produces: `getSoldCount(shopId: string, productId: string): Promise<number>`; `NOUNS.sold`.

- [ ] **Step 1: Индекс на order_items.productId**

В `src/db/schema.ts`, замени индексния масив на `orderItems` (~421):
```ts
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_product_idx").on(t.productId),
  ],
```

- [ ] **Step 2: `db:push`**

В PowerShell зареди migration URL-а от `.env.local` без принтиране, после push:
```powershell
$line = Get-Content .env.local | Where-Object { $_ -match '^\s*DATABASE_URL_MIGRATIONS\s*=' }
$env:DATABASE_URL_MIGRATIONS = ($line -replace '^\s*DATABASE_URL_MIGRATIONS\s*=\s*', '').Trim('"')
pnpm db:push
```
Expected: „Changes applied" (нов индекс), exit 0.

- [ ] **Step 3: `getSoldCount` заявка**

В `src/db/queries/storefront.ts`: добави `orders, orderItems` към import-а от `@/db` (провери реда `import { categories, db, … } from "@/db";` и добави ги). `and`, `eq`, `inArray`, `sql` вече са импортнати. Добави функцията:
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

- [ ] **Step 4: `NOUNS.sold` + тест**

В `src/lib/plural.ts`, в обекта `NOUNS` добави:
```ts
  sold: { one: "продаден", many: "продадени" },
```
Добави тест в съществуващия `src/lib/plural.test.ts` (ако липсва файл — създай го със същия import):
```ts
it("продадени: число + дума", () => {
  expect(count(1, NOUNS.sold)).toBe("1 продаден");
  expect(count(47, NOUNS.sold)).toBe("47 продадени");
});
```
(Импортите `count, NOUNS` вземи от начина, по който другите тестове в файла ги ползват.)

- [ ] **Step 5: Run — очаквай PASS**

Run: `pnpm test src/lib/plural.test.ts`
Expected: PASS.

- [ ] **Step 6: Бадж на продуктовата страница**

В `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`:
- Импортирай: `import { count, NOUNS } from "@/lib/plural";` и `getSoldCount` от storefront queries (провери съществуващия import ред от `@/db/queries/storefront`).
- Добави `getSoldCount(shop.id, product.id)` към `Promise.all` (или отделен `await`); хвани резултата като `soldCount`.
- Рендерирай баджа до марката/size guide реда (същия flex контейнер, който Пакет A добави след `<VariantPicker/>`; ако Пакет A не е слят в този branch, сложи го в самостоятелен ред под VariantPicker):
```tsx
{soldCount >= 5 && (
  <span className="inline-flex items-center gap-1.5 text-sm text-(--sf-muted)">
    <Icon name="shopping-cart" size={15} />
    {count(soldCount, NOUNS.sold)}
  </span>
)}
```
`Icon` вече е импортнат в тази страница.

- [ ] **Step 7: `pnpm check`**

Run: `pnpm check`
Expected: минава.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(product-trust): „X продадени" бадж (social proof)

- getSoldCount (order_items×orders, само confirmed/shipped/completed)
- индекс order_items_product_idx + db:push; NOUNS.sold + тест
- бадж на продуктовата страница при праг 5+

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 2: Q&A схема + Zod + заявки + actions

**Files:**
- Modify: `src/db/schema.ts` (enum + таблица + тип)
- Create: `src/schemas/question.ts`, `src/schemas/question.test.ts`, `src/db/queries/questions.ts`, `src/actions/questions.ts`

**Interfaces:**
- Produces: таблица `productQuestions` + `db.query.productQuestions` + тип `ProductQuestion`; `submitQuestionSchema`, `answerQuestionSchema`; `getAnsweredQuestions(productId, page)`, `getShopQuestions(shopId)`, `countPendingQuestions(shopId)`; actions `submitQuestion(shopSlug, input)`, `answerQuestion(input)`, `deleteQuestion({id})`.

- [ ] **Step 1: Enum + таблица (schema.ts)**

В `src/db/schema.ts`, до другите enum-и горе добави:
```ts
export const questionStatusEnum = pgEnum("question_status", ["pending", "answered"]);
```
След дефиницията на `reviews` (~618) добави:
```ts
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
```
Добави тип до другите (`~626`):
```ts
export type ProductQuestion = typeof productQuestions.$inferSelect;
```

- [ ] **Step 2: `db:push`**

Зареди env както в Task 1 Step 2, после:
```
pnpm db:push
```
Expected: „Changes applied" (нов enum + таблица `product_questions`), exit 0.

- [ ] **Step 3: Zod схема + тест**

Create `src/schemas/question.ts`:
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
Create `src/schemas/question.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { answerQuestionSchema, submitQuestionSchema } from "./question";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("submitQuestionSchema", () => {
  it("приема валиден въпрос", () => {
    const r = submitQuestionSchema.safeParse({ productId: uuid, question: "Има ли гаранция?" });
    expect(r.success).toBe(true);
  });
  it("отхвърля кратък въпрос", () => {
    const r = submitQuestionSchema.safeParse({ productId: uuid, question: "а?" });
    expect(r.success).toBe(false);
  });
  it("askerName е опционален", () => {
    const r = submitQuestionSchema.safeParse({ productId: uuid, question: "Достатъчно дълъг въпрос?" });
    expect(r.success && r.data.askerName).toBe("");
  });
});

describe("answerQuestionSchema", () => {
  it("отхвърля празен отговор", () => {
    const r = answerQuestionSchema.safeParse({ id: uuid, answer: "" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run — очаквай PASS**

Run: `pnpm test src/schemas/question.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Заявки**

Create `src/db/queries/questions.ts`:
```ts
import { and, count, desc, eq } from "drizzle-orm";
import { db, productQuestions } from "@/db";

export const QUESTIONS_PAGE_SIZE = 10;

/** Отговорени въпроси за продукт (публично, най-нови първи), пагинирано. */
export async function getAnsweredQuestions(productId: string, page = 1) {
  const safePage = Math.max(1, page);
  const where = and(
    eq(productQuestions.productId, productId),
    eq(productQuestions.status, "answered"),
  );
  const [items, [total]] = await Promise.all([
    db.query.productQuestions.findMany({
      where,
      orderBy: [desc(productQuestions.createdAt)],
      limit: QUESTIONS_PAGE_SIZE,
      offset: (safePage - 1) * QUESTIONS_PAGE_SIZE,
    }),
    db.select({ value: count() }).from(productQuestions).where(where),
  ]);
  return { items, total: total?.value ?? 0, page: safePage, pageSize: QUESTIONS_PAGE_SIZE };
}

/** Всички въпроси на магазина (dashboard), pending най-отгоре, после по дата. */
export async function getShopQuestions(shopId: string) {
  const rows = await db
    .select({ question: productQuestions, productName: products.name, productSlug: products.slug })
    .from(productQuestions)
    .innerJoin(products, eq(productQuestions.productId, products.id))
    .where(eq(productQuestions.shopId, shopId))
    .orderBy(
      /* pending (0) преди answered (1), после най-нови първи. */
      asc(sql`case when ${productQuestions.status} = 'pending' then 0 else 1 end`),
      desc(productQuestions.createdAt),
    );
  return rows.map((r) => ({
    ...r.question,
    productName: r.productName,
    productSlug: r.productSlug,
  }));
}

/** Брой чакащи (pending) — за nav badge. */
export async function countPendingQuestions(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(productQuestions)
    .where(and(eq(productQuestions.shopId, shopId), eq(productQuestions.status, "pending")));
  return row?.value ?? 0;
}

export type ShopQuestion = Awaited<ReturnType<typeof getShopQuestions>>[number];
```
Добави липсващите импорти горе: `import { and, asc, count, desc, eq, sql } from "drizzle-orm";` и `import { db, products, productQuestions } from "@/db";`.

- [ ] **Step 6: Actions**

Create `src/actions/questions.ts` (огледало на `src/actions/reviews.ts`):
```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, products, productQuestions, shops } from "@/db";
import { clientIp } from "@/actions/cart";
import { shopCacheTag } from "@/db/queries/storefront";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import { answerQuestionSchema, submitQuestionSchema } from "@/schemas/question";

/** Публично подаване на въпрос — влиза pending (невидим до отговор). Rate limit + honeypot. */
export async function submitQuestion(shopSlug: string, rawInput: unknown): Promise<ActionResult> {
  const parsed = submitQuestionSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  if (input.website !== "") return ok(null); /* honeypot */

  const ip = await clientIp();
  if (!(await checkRateLimit(`question:${ip}`, 5, 3600))) {
    return fail("Твърде много въпроси за кратко време. Опитай по-късно.");
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail("Магазинът не съществува.");

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, input.productId), eq(products.shopId, shop.id)),
  });
  if (!product || product.status !== "active") return fail("Продуктът не съществува.");

  await db.insert(productQuestions).values({
    shopId: shop.id,
    productId: product.id,
    askerName: sanitizeText(input.askerName, 60),
    question: sanitizeMultiline(input.question, 500),
  });

  return ok(null);
}

/** Търговец отговаря и публикува (или редактира отговор) → status='answered'. */
export async function answerQuestion(rawInput: unknown): Promise<ActionResult> {
  const parsed = answerQuestionSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();
  const [row] = await db
    .update(productQuestions)
    .set({
      answer: sanitizeMultiline(parsed.data.answer, 1000),
      status: "answered",
      updatedAt: new Date(),
    })
    .where(and(eq(productQuestions.id, parsed.data.id), eq(productQuestions.shopId, shop.id)))
    .returning({ id: productQuestions.id });
  if (!row) return fail("Въпросът не съществува.");

  revalidatePath("/dashboard/questions");
  revalidateTag(shopCacheTag(shop.slug), "max");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok(null);
}

/** Изтриване на въпрос (pending или answered). */
export async function deleteQuestion(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Невалиден въпрос.");

  const { shop } = await requireShop();
  const [row] = await db
    .delete(productQuestions)
    .where(and(eq(productQuestions.id, parsed.data.id), eq(productQuestions.shopId, shop.id)))
    .returning({ id: productQuestions.id });
  if (!row) return fail("Въпросът не съществува.");

  revalidatePath("/dashboard/questions");
  revalidateTag(shopCacheTag(shop.slug), "max");
  revalidatePath(`/s/${shop.slug}`, "layout");
  return ok(null);
}
```
(Верифицирано: `clientIp` се експортва от `@/actions/cart` — `reviews.ts` го ползва по същия начин.)

- [ ] **Step 7: `pnpm check`**

Run: `pnpm check`
Expected: минава (4 нови теста в общия брой).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(product-trust): Q&A схема + Zod + заявки + actions

- product_questions таблица + question_status enum + db:push
- submitQuestionSchema/answerQuestionSchema + тестове
- getAnsweredQuestions/getShopQuestions/countPendingQuestions
- submitQuestion (публичен, rate limit+honeypot) / answerQuestion / deleteQuestion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 3: Q&A публичен изглед

**Files:**
- Create: `src/components/storefront/question-form.tsx`
- Modify: `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`

**Interfaces:**
- Consumes: `submitQuestion` (Task 2), `getAnsweredQuestions` (Task 2).
- Produces: `QuestionForm` компонент.

- [ ] **Step 1: `QuestionForm` компонент**

Create `src/components/storefront/question-form.tsx` (огледало на `ReviewForm`, `--sf-*` токени):
```tsx
"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import { submitQuestion } from "@/actions/questions";

/** Публична форма за въпрос — влиза pending до отговор от магазина. */
export function QuestionForm({ shopSlug, productId }: { shopSlug: string; productId: string }) {
  const [askerName, setAskerName] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await submitQuestion(shopSlug, { productId, askerName, question, website: "" });
      if (!result.ok) {
        setError(result.fieldErrors ? Object.values(result.fieldErrors)[0]! : result.error);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2.5 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4 text-sm text-(--sf-text)">
        <Icon name="check" size={18} className="shrink-0 text-(--sf-primary)" />
        Благодарим! Въпросът ти ще се публикува след отговор от магазина.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4"
    >
      <p className="font-medium text-(--sf-text)">Задай въпрос</p>
      <input
        type="text"
        maxLength={60}
        value={askerName}
        onChange={(e) => setAskerName(e.target.value)}
        placeholder="Твоето име (по избор)"
        aria-label="Твоето име (по избор)"
        autoComplete="name"
        className="h-11 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={500}
        minLength={5}
        required
        rows={3}
        placeholder="Какво искаш да попиташ за този продукт?"
        aria-label="Твоят въпрос"
        className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 py-2.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-11 self-start rounded-(--sf-radius) bg-(--sf-primary) px-5 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Изпращане…" : "Изпрати въпрос"}
      </button>
      <p className="text-xs text-(--sf-muted)">Въпросът се публикува след отговор от магазина.</p>
    </form>
  );
}
```

- [ ] **Step 2: Q&A секция на продуктовата страница**

В `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`:
- Импортирай `import { getAnsweredQuestions } from "@/db/queries/questions";` и `import { QuestionForm } from "@/components/storefront/question-form";`.
- Прочети `?questionsPage=` от `searchParams` (типа на searchParams вече включва `reviewsPage`; добави `questionsPage?: string`). Изчисли `questionsPage` като `reviewsPage`.
- Зареди `const questions = await getAnsweredQuestions(product.id, questionsPage);` (добави го към съществуващия `Promise.all` или отделно след него).
- Добави секция след блока с ревютата (преди „Още от магазина"):
```tsx
      <div className="mt-14 border-t border-(--sf-border) pt-10">
        <h2 className="mb-6 text-2xl text-(--sf-text)">Въпроси и отговори</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            {questions.items.length === 0 ? (
              <p className="text-sm text-(--sf-muted)">
                Още няма въпроси — задай първия.
              </p>
            ) : (
              <>
                <ul className="flex flex-col divide-y divide-(--sf-border)">
                  {questions.items.map((q) => (
                    <li key={q.id} className="flex flex-col gap-2 py-4 first:pt-0">
                      <div className="flex items-baseline gap-2">
                        <Icon name="help-circle" size={15} className="shrink-0 text-(--sf-primary)" />
                        <p className="font-medium text-(--sf-text)">{q.question}</p>
                      </div>
                      <p className="pl-6 text-xs text-(--sf-muted)">
                        {q.askerName || "Купувач"} ·{" "}
                        {new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short", year: "numeric" }).format(q.createdAt)}
                      </p>
                      <div className="ml-6 border-l-2 border-(--sf-border) pl-3">
                        <p className="text-sm leading-relaxed text-(--sf-muted)">{q.answer}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {questions.total > questionsPage * questions.pageSize && (
                  <Link
                    href={`${base}/p/${product.slug}?questionsPage=${questionsPage + 1}`}
                    className="self-start text-sm font-medium text-(--sf-primary) hover:underline"
                  >
                    Виж още въпроси →
                  </Link>
                )}
              </>
            )}
          </div>
          <QuestionForm shopSlug={shop.slug} productId={product.id} />
        </div>
      </div>
```
(`Link`, `Icon`, `base` вече са налични в тази страница. Постави секцията между ревютата и „Още от магазина".)

- [ ] **Step 3: `pnpm check`**

Run: `pnpm check`
Expected: минава.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(product-trust): Q&A публичен изглед на продуктовата страница

- QuestionForm (публична форма, --sf-* токени, honeypot)
- секция „Въпроси и отговори" (само answered, пагинация ?questionsPage)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 4: Q&A dashboard + nav badge

**Files:**
- Create: `src/components/dashboard/questions-manager.tsx`, `src/app/(dashboard)/dashboard/questions/page.tsx`
- Modify: `src/components/dashboard/nav-items.ts`, `src/components/dashboard/nav.tsx`, `src/components/dashboard/mobile-menu-button.tsx`, `src/app/(dashboard)/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `getShopQuestions`, `countPendingQuestions` (Task 2), `answerQuestion`, `deleteQuestion` (Task 2), тип `ShopQuestion`.

- [ ] **Step 1: `QuestionsManager` компонент**

Create `src/components/dashboard/questions-manager.tsx` (огледало на `ReviewsManager`):
```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { answerQuestion, deleteQuestion } from "@/actions/questions";
import { Badge, Button, ConfirmDialog, EmptyState, Icon, Textarea } from "@/components/ui";
import type { ShopQuestion } from "@/db/queries/questions";

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function QuestionsManager({ items, shopSlug }: { items: ShopQuestion[]; shopSlug: string }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ShopQuestion | null>(null);

  async function handleAnswer(id: string) {
    const answer = (drafts[id] ?? "").trim();
    if (!answer) {
      toast.error("Въведи отговор.");
      return;
    }
    setBusyId(id);
    try {
      const result = await answerQuestion({ id, answer });
      if (!result.ok) toast.error(result.error);
      else toast.success("Отговорът е публикуван.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    const result = await deleteQuestion({ id: toDelete.id });
    if (!result.ok) toast.error(result.error);
    else toast.success("Въпросът е изтрит.");
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="help-circle"
        title="Още няма въпроси"
        description="Въпросите от клиентите на магазина ще се появяват тук за отговор."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((q) => (
          <li
            key={q.id}
            className="flex flex-col gap-2 rounded-card border border-surface-200 bg-surface-0 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink-900">{q.askerName || "Купувач"}</span>
              <span className="text-xs text-ink-500">{dateFormat.format(q.createdAt)}</span>
              <Badge tone={q.status === "answered" ? "success" : "warning"}>
                {q.status === "answered" ? "Публикуван" : "Чака отговор"}
              </Badge>
              <span className="flex-1" />
              <Link
                href={`/s/${shopSlug}/p/${q.productSlug}`}
                target="_blank"
                className="max-w-48 truncate text-sm text-brand-600 hover:text-brand-700 hover:underline"
              >
                {q.productName}
              </Link>
            </div>

            <p className="flex items-baseline gap-2 text-sm text-ink-900">
              <Icon name="help-circle" size={15} className="shrink-0 text-brand-600" />
              {q.question}
            </p>

            <Textarea
              label="Отговор"
              rows={2}
              maxLength={1000}
              defaultValue={q.answer}
              placeholder="Напиши отговор…"
              onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
            />

            <div className="flex gap-2">
              <Button size="sm" loading={busyId === q.id} onClick={() => handleAnswer(q.id)}>
                {q.status === "answered" ? "Обнови отговора" : "Публикувай отговор"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="text-danger-600"
                onClick={() => setToDelete(q)}
              >
                Изтрий
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        message={`Изтриване на въпроса от „${toDelete?.askerName || "Купувач"}“? Действието е необратимо.`}
      />
    </>
  );
}
```
(Верифицирано: `Textarea` иска видим `label` (няма `hideLabel`) — затова `label="Отговор"` е видим. `clientIp` се експортва от `@/actions/cart` ✓.)

- [ ] **Step 2: Dashboard страница**

Create `src/app/(dashboard)/dashboard/questions/page.tsx`:
```tsx
import { QuestionsManager } from "@/components/dashboard/questions-manager";
import { getShopQuestions } from "@/db/queries/questions";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Въпроси — Frizmo Shops" };

export default async function QuestionsPage() {
  const { shop } = await requireShop();
  const items = await getShopQuestions(shop.id);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Въпроси</h1>
        <p className="mt-1 text-sm text-ink-500">
          Отговори на въпросите — публикуват се в магазина заедно с отговора.
        </p>
      </div>
      <QuestionsManager items={items} shopSlug={shop.slug} />
    </div>
  );
}
```

- [ ] **Step 3: Nav линк**

В `src/components/dashboard/nav-items.ts`, след „Ревюта":
```ts
  { href: "/dashboard/questions", label: "Въпроси", icon: "help-circle" },
```

- [ ] **Step 4: Nav badge (desktop)**

В `src/components/dashboard/nav.tsx`:
- Разшири props: `{ pendingReviews = 0, pendingQuestions = 0 }: { pendingReviews?: number; pendingQuestions?: number }`.
- Разшири `badgeFor`:
```tsx
  const badgeFor = (href: string) => {
    if (href === "/dashboard/reviews" && pendingReviews > 0) return pendingReviews;
    if (href === "/dashboard/questions" && pendingQuestions > 0) return pendingQuestions;
    return null;
  };
```

- [ ] **Step 5: Nav badge (mobile)**

В `src/components/dashboard/mobile-menu-button.tsx`: същите две промени като Step 4 (props + `badgeFor`).

- [ ] **Step 6: Layout подава броя**

В `src/app/(dashboard)/dashboard/layout.tsx`:
- Импортирай `import { countPendingQuestions } from "@/db/queries/questions";`.
- До `pendingReviews`:
```tsx
  const pendingQuestions = shop ? await countPendingQuestions(shop.id) : 0;
```
- Подай към двата компонента:
```tsx
  <MobileMenuButton pendingReviews={pendingReviews} pendingQuestions={pendingQuestions} />
  …
  <DashboardNav pendingReviews={pendingReviews} pendingQuestions={pendingQuestions} />
```

- [ ] **Step 7: `pnpm check`**

Run: `pnpm check`
Expected: минава.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -F - <<'EOF'
feat(product-trust): Q&A dashboard + nav badge

- /dashboard/questions + QuestionsManager (отговори/публикувай/изтрий)
- nav линк „Въпроси" + badge за чакащи (desktop + mobile)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Финал

- [ ] Пълен `pnpm check` (последен път).
- [ ] Скан за контролни символи в променените/новите файлове за `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`.
- [ ] Обнови `docs/WORKLOG.md` (нов ред в „Дневник" + текущ commit).
- [ ] Обнови `docs/testing-checklist.md` (нова секция за Пакет Б).
- [ ] Обнови паметта (`memory/`) с нов файл за Пакет Б + ред в `MEMORY.md`.
- [ ] **Питай потребителя за разрешение за push** към `dev` (= prod). Push само при изрично „да".

## Тестване (ръчно, потребител)

- „X продадени": продукт с ≥5 продадени (confirmed/shipped/completed) → бадж; <5 → скрит; само cancelled → скрит.
- Q&A: задай въпрос (pending, невидим) → отговори в `/dashboard/questions` → въпрос+отговор публични; badge за pending; редакция на отговор; изтриване; honeypot (скрито поле → фалшив успех); rate limit (6-и въпрос).
- Мобилно 375px; light + dark.
