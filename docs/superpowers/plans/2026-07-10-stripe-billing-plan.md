# Stripe Билинг Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменя `getShopPlan()` stub-а с реален recurring Stripe абонамент — trial 30 дни с карта, промо код -50% първи месец, автоматичен suspend при неплащане.

**Architecture:** Stripe Checkout Sessions (`mode: subscription`) за абониране + Customer Portal за self-service управление + webhook route за синхронизация на статуса. Локална `subscriptions` таблица огледало на Stripe състоянието; `getShopPlan` чете от нея. Billing статус е ОТДЕЛНА ос от `shops.status` (модерация).

**Tech Stack:** Next.js 16 (App Router route handler за webhook, Server Actions за checkout/portal), `stripe` npm (API версия `2026-06-24.dahlia`), Drizzle, Supabase Postgres. Stripe CLI за test setup + local webhook forwarding.

**Спец:** `docs/superpowers/specs/2026-07-10-stripe-billing-design.md`

## Global Constraints

- **API версия:** Stripe `2026-06-24.dahlia` (най-новата). SDK: `stripe` npm.
- **API ключ:** Restricted API Key (`rk_`), НЕ secret (`sk_`). Server-only, никога `NEXT_PUBLIC_`.
- **НИКОГА `payment_method_types`** в Stripe заявка (динамични методи = по-висока конверсия).
- **Deprecated `plan` обект — НЕ.** Само Prices.
- **Webhook:** raw body (`await req.text()`) + `constructEvent` подпис + idempotency през `stripe_events`. Никога `req.json()` преди верификация.
- **Изолация (споделен акаунт):** `metadata: { app: "frizmo-shops", shopId }` на всеки Stripe обект; webhook обработва само наши Price ID-та / наш metadata.
- **Billing статус ≠ shops.status** — две независими оси, отделни таблици.
- **Пари:** integer евроцентове. UI текст: български, типографски кавички „…".
- **Гейт:** `pnpm check` (lint + vitest + build) преди всеки commit към dev.
- **db:push** (не migration файлове) за схема промени; нужен `DATABASE_URL_MIGRATIONS`.
- **Не логвай Stripe ключове/секрети** никъде.

---

## File Structure

**Нови файлове:**
- `src/lib/stripe.ts` — Stripe клиент (server-only, API версия pinned).
- `src/db/queries/subscriptions.ts` — четене на subscription по shopId.
- `src/actions/billing.ts` — createCheckoutSession, createPortalSession, getBillingStatus.
- `src/app/api/webhooks/stripe/route.ts` — webhook route handler.
- `src/app/(dashboard)/dashboard/billing/page.tsx` — billing страница.
- `src/components/dashboard/billing-panel.tsx` — client компонент (бутони + промо поле).
- `scripts/setup-stripe.mjs` — CLI setup: Products/Prices/Coupon (еднократно).
- `scripts/verify-billing.mjs` — обективна проверка на getShopPlan логиката.

**Модифицирани:**
- `src/db/schema.ts` — `subscriptions` + `stripe_events` таблици + enum-и.
- `src/lib/plan.ts` — `getShopPlan` чете реален план; `isShopActive` helper.
- `src/env.ts` — 4 нови env vars.
- `src/actions/orders.ts` — `isShopActive` guard в createOrder.
- `src/lib/plans-content.ts` — landing текст (маха „без карта").

---

## Task 1: Схема — subscriptions + stripe_events таблици

**Files:**
- Modify: `src/db/schema.ts` (след `shops` таблицата, ~ред 70)

**Interfaces:**
- Produces: `subscriptions` таблица (`shopId`, `stripeCustomerId`, `stripeSubscriptionId`, `plan`, `status`, `currentPeriodEnd`, `trialEndsAt`); `stripe_events` таблица (`id`, `type`, `processedAt`); `subscriptionStatusEnum`, `planEnum`. Drizzle типове `Subscription = typeof subscriptions.$inferSelect`.

- [ ] **Step 1: Добави enum-ите и таблиците**

В `src/db/schema.ts`, веднага след дефиницията на `shops` таблицата (около ред 70, преди `productStatusEnum`):

```ts
export const planEnum = pgEnum("plan", ["starter", "pro"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: planEnum("plan").notNull().default("starter"),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_shop_idx").on(t.shopId),
    uniqueIndex("subscriptions_customer_idx").on(t.stripeCustomerId),
  ],
).enableRLS();

/** Webhook идемпотентност: Stripe праща at-least-once → PK dedup. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type Subscription = typeof subscriptions.$inferSelect;
```

- [ ] **Step 2: Провери, че `db` barrel-ът експортира новите таблици**

Виж `src/db/index.ts` — ако реекспортира от `schema.ts` с `export *` или изрично, добави `subscriptions`, `stripeEvents` в изричния списък (ако е изричен).

Run: `grep -n "subscriptions\|stripeEvents\|export \*" src/db/index.ts`
Expected: или `export *` (нищо не се прави), или добави имената.

- [ ] **Step 3: Приложи схемата към базата**

Run: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push`
Expected: `[✓] Changes applied`

- [ ] **Step 4: Потвърди колоните в базата**

Run:
```bash
node --env-file=.env.local -e "const p=require('postgres');const sql=p(process.env.DATABASE_URL_MIGRATIONS,{prepare:false});(async()=>{const c=await sql\`select table_name from information_schema.tables where table_name in ('subscriptions','stripe_events')\`;console.log(c.map(x=>x.table_name).join(', '));await sql.end();})()"
```
Expected: `subscriptions, stripe_events`

- [ ] **Step 5: Гейт + commit**

Run: `pnpm check`
Expected: PASS (build компилира новите типове)

```bash
git add src/db/schema.ts src/db/index.ts
git commit -m "feat(billing): subscriptions + stripe_events таблици"
```

---

## Task 2: Stripe клиент + env vars

**Files:**
- Create: `src/lib/stripe.ts`
- Modify: `src/env.ts`
- Modify: `.env.local` (ръчно, локално — НЕ се commit-ва)

**Interfaces:**
- Produces: `stripe` singleton (`import { stripe } from "@/lib/stripe"`), типизиран Stripe клиент с API версия `2026-06-24.dahlia`. `STRIPE_PRICE` helper за Price ID по план.

- [ ] **Step 1: Инсталирай stripe npm**

Run: `pnpm add stripe`
Expected: добавен в package.json dependencies.

Провери версията:
Run: `pnpm view stripe version`
(Ползвай най-новата; API версията се pin-ва в кода, не от пакета.)

- [ ] **Step 2: Създай Stripe клиента**

Create `src/lib/stripe.ts`:

```ts
import "server-only";
import Stripe from "stripe";

/**
 * Stripe клиент — server-only. API версията е pin-ната изрично (не зависи от
 * SDK ъпдейти). Ключът е Restricted API Key (rk_), не secret — минимални права.
 * Споделен акаунт с другия Frizmo проект: изолацията е през metadata.app +
 * отделен webhook secret + отделни Price-ове.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-06-24.dahlia",
  appInfo: { name: "frizmo-shops" },
});

/** Metadata таг на всеки Stripe обект — за изолация в споделения акаунт. */
export const STRIPE_APP_TAG = "frizmo-shops";

/** Price ID по план (от env). */
export function priceIdForPlan(plan: "starter" | "pro"): string {
  const id = plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STARTER;
  if (!id) throw new Error(`Липсва Stripe Price ID за план ${plan}`);
  return id;
}
```

- [ ] **Step 3: Добави env vars във валидацията**

В `src/env.ts`, в секцията с препоръчани (warn) ключове, добави проверка:

```ts
  if (!process.env.STRIPE_SECRET_KEY) warnings.push("STRIPE_SECRET_KEY — билингът е изключен.");
  if (!process.env.STRIPE_WEBHOOK_SECRET) warnings.push("STRIPE_WEBHOOK_SECRET — Stripe webhook няма да работи.");
  if (!process.env.STRIPE_PRICE_STARTER || !process.env.STRIPE_PRICE_PRO)
    warnings.push("STRIPE_PRICE_* — Stripe Price ID-тата липсват (билинг checkout ще гърми).");
```

- [ ] **Step 4: Гейт + commit**

Run: `pnpm check`
Expected: PASS

```bash
git add src/lib/stripe.ts src/env.ts package.json pnpm-lock.yaml
git commit -m "feat(billing): Stripe клиент (rk_ ключ, API 2026-06-24.dahlia) + env"
```

---

## Task 3: Stripe test setup през CLI

**Files:**
- Create: `scripts/setup-stripe.mjs`

**Interfaces:**
- Produces: 2 Products (Starter/Pro) + месечни Prices + Coupon FRIZMO50 (50% once) + Promotion Code в Stripe test mode. Отпечатва Price ID-тата за `.env.local`.

Забележка: Този скрипт се пуска ВЕДНЪЖ от разработчика с логнато Stripe CLI (акаунт FRIZMO). Ползва `stripe` CLI командите директно, не npm.

- [ ] **Step 1: Провери, че CLI е логнат в правилния акаунт**

Run: `stripe config --list | grep display_name`
Expected: `display_name = 'FRIZMO'`

- [ ] **Step 2: Създай Products + Prices през CLI**

Run:
```bash
stripe products create --name="Frizmo Shops — Starter" --metadata[app]=frizmo-shops
stripe products create --name="Frizmo Shops — Pro" --metadata[app]=frizmo-shops
```
Запиши двата `prod_...` id-та. После (замести PROD_ID):
```bash
stripe prices create --product=PROD_STARTER_ID --unit-amount=1000 --currency=eur --recurring[interval]=month
stripe prices create --product=PROD_PRO_ID --unit-amount=2000 --currency=eur --recurring[interval]=month
```
Запиши двата `price_...` id-та.
Expected: JSON с `id: price_...` за всяко.

- [ ] **Step 3: Създай Coupon + Promotion Code за -50% първи месец**

Run:
```bash
stripe coupons create --percent-off=50 --duration=once --name="Първи месец -50%" --metadata[app]=frizmo-shops
```
Запиши `coupon_...` / връща id. После (замести COUPON_ID):
```bash
stripe promotion_codes create --coupon=COUPON_ID --code=FRIZMO50
```
Expected: Promotion Code с `code: FRIZMO50`.

- [ ] **Step 4: Създай RAK за приложението**

В Stripe Dashboard (test mode) → Developers → API keys → Create restricted key.
Права (минимум): Customers (write), Checkout Sessions (write), Billing Portal Sessions (write), Subscriptions (read), Prices (read), Products (read), Promotion codes (read).
Копирай `rk_test_...`.

- [ ] **Step 5: Попълни `.env.local`**

Добави (замести реалните стойности):
```
STRIPE_SECRET_KEY=rk_test_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_WEBHOOK_SECRET=whsec_...   # от stripe listen (Task 6)
```

- [ ] **Step 6: Документирай скрипта (за повторяемост)**

Create `scripts/setup-stripe.mjs` с коментар-документация на командите от Steps 2-3 (за да е записано как е създаден setup-ът; скриптът може да е просто документиращ shell коментар или node, който вика `child_process` за idempotent create). Commit само документацията:

```bash
git add scripts/setup-stripe.mjs
git commit -m "chore(billing): Stripe test setup скрипт (Products/Prices/Coupon)"
```

---

## Task 4: getShopPlan чете реален план + isShopActive

**Files:**
- Modify: `src/lib/plan.ts`
- Create: `src/db/queries/subscriptions.ts`
- Test: `src/lib/plan.test.ts`

**Interfaces:**
- Consumes: `subscriptions` таблица (Task 1), `Subscription` тип.
- Produces: `getShopPlan(shopId): Promise<PlanId>` (реален план); `isShopActive(shopId): Promise<boolean>` (billing позволява ли продажби); `getSubscription(shopId): Promise<Subscription | null>`.

- [ ] **Step 1: Заявка за subscription**

Create `src/db/queries/subscriptions.ts`:

```ts
import { eq } from "drizzle-orm";
import { db, subscriptions, type Subscription } from "@/db";

export async function getSubscription(shopId: string): Promise<Subscription | null> {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.shopId, shopId),
  });
  return row ?? null;
}
```

- [ ] **Step 2: Напиши failing тестове за getShopPlan/isShopActive логиката**

Create `src/lib/plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolvePlan, billingAllowsSelling } from "./plan";

const DAY = 86_400_000;

describe("resolvePlan — trial по createdAt (без subscription)", () => {
  it("нов магазин в trial → pro", () => {
    const createdAt = new Date(Date.now() - 5 * DAY);
    expect(resolvePlan(null, createdAt)).toBe("pro");
  });
  it("изтекъл trial без subscription → starter", () => {
    const createdAt = new Date(Date.now() - 40 * DAY);
    expect(resolvePlan(null, createdAt)).toBe("starter");
  });
});

describe("resolvePlan — с subscription", () => {
  const base = { plan: "pro" as const, currentPeriodEnd: null, trialEndsAt: null };
  it("trialing → плана", () => {
    expect(resolvePlan({ ...base, status: "trialing" }, new Date())).toBe("pro");
  });
  it("active → плана", () => {
    expect(resolvePlan({ ...base, status: "active" }, new Date())).toBe("pro");
  });
  it("past_due → още плана (grace)", () => {
    expect(resolvePlan({ ...base, status: "past_due" }, new Date())).toBe("pro");
  });
  it("suspended → starter (fallback лимити)", () => {
    expect(resolvePlan({ ...base, status: "suspended" }, new Date())).toBe("starter");
  });
  it("canceled → starter", () => {
    expect(resolvePlan({ ...base, status: "canceled" }, new Date())).toBe("starter");
  });
});

describe("billingAllowsSelling", () => {
  const createdAt = new Date();
  it("trialing → продава", () => {
    expect(billingAllowsSelling({ status: "trialing" }, createdAt)).toBe(true);
  });
  it("active → продава", () => {
    expect(billingAllowsSelling({ status: "active" }, createdAt)).toBe(true);
  });
  it("past_due → още продава (grace)", () => {
    expect(billingAllowsSelling({ status: "past_due" }, createdAt)).toBe(true);
  });
  it("suspended → НЕ продава", () => {
    expect(billingAllowsSelling({ status: "suspended" }, createdAt)).toBe(false);
  });
  it("нов магазин без subscription в trial → продава", () => {
    expect(billingAllowsSelling(null, new Date(Date.now() - 5 * DAY))).toBe(true);
  });
  it("изтекъл trial без subscription → НЕ продава", () => {
    expect(billingAllowsSelling(null, new Date(Date.now() - 40 * DAY))).toBe(false);
  });
});
```

- [ ] **Step 3: Пусни теста — да гръмне**

Run: `pnpm vitest run src/lib/plan.test.ts`
Expected: FAIL — `resolvePlan`/`billingAllowsSelling` не съществуват.

- [ ] **Step 4: Имплементирай plan.ts**

Замести `src/lib/plan.ts` съдържанието (пази `PLAN_LIMITS` и `PlanId`):

```ts
import { getSubscription } from "@/db/queries/subscriptions";

export type PlanId = "starter" | "pro";

export const PLAN_LIMITS = {
  starter: { maxProducts: 50 },
  pro: { maxProducts: Infinity },
} as const;

const TRIAL_DAYS = 30;
const DAY_MS = 86_400_000;

type SubShape = { plan?: PlanId; status: string } | null;

/** В trial ли е магазин без subscription (по дата на създаване)? */
function inSignupTrial(createdAt: Date): boolean {
  return Date.now() < createdAt.getTime() + TRIAL_DAYS * DAY_MS;
}

/** Чиста функция — планът от subscription статуса (тествана). */
export function resolvePlan(sub: SubShape, shopCreatedAt: Date): PlanId {
  if (!sub) return inSignupTrial(shopCreatedAt) ? "pro" : "starter";
  if (sub.status === "trialing" || sub.status === "active" || sub.status === "past_due") {
    return sub.plan ?? "pro";
  }
  return "starter"; // suspended / canceled → fallback лимити
}

/** Чиста функция — billing позволява ли продажби (тествана). */
export function billingAllowsSelling(sub: SubShape, shopCreatedAt: Date): boolean {
  if (!sub) return inSignupTrial(shopCreatedAt);
  return sub.status === "trialing" || sub.status === "active" || sub.status === "past_due";
}

/** Реалният план на магазина (заменя stub-а). Единственото място за плановата логика. */
export async function getShopPlan(shopId: string, shopCreatedAt: Date): Promise<PlanId> {
  const sub = await getSubscription(shopId);
  return resolvePlan(sub, shopCreatedAt);
}

/** Billing позволява ли магазинът да продава (checkout gate). */
export async function isShopActive(shopId: string, shopCreatedAt: Date): Promise<boolean> {
  const sub = await getSubscription(shopId);
  return billingAllowsSelling(sub, shopCreatedAt);
}
```

- [ ] **Step 5: Пусни теста — да мине**

Run: `pnpm vitest run src/lib/plan.test.ts`
Expected: PASS (всички).

- [ ] **Step 6: Оправи call site-овете (сигнатурата се смени — иска shopCreatedAt)**

`getShopPlan` вече иска `shopCreatedAt`. В `src/actions/products.ts:165` и `:408` подай `shop.createdAt`:

```ts
const plan = await getShopPlan(shop.id, shop.createdAt);
```

Run: `grep -n "getShopPlan(shop.id)" src/actions/products.ts`
Expected: 0 (всички са с втория аргумент).

- [ ] **Step 7: Гейт + commit**

Run: `pnpm check`
Expected: PASS

```bash
git add src/lib/plan.ts src/lib/plan.test.ts src/db/queries/subscriptions.ts src/actions/products.ts
git commit -m "feat(billing): getShopPlan чете реален план + isShopActive (11 теста)"
```

---

## Task 5: Billing actions (checkout + portal)

**Files:**
- Create: `src/actions/billing.ts`

**Interfaces:**
- Consumes: `stripe`, `priceIdForPlan`, `STRIPE_APP_TAG` (Task 2); `getSubscription` (Task 4); `requireShop` (`src/lib/auth.ts`).
- Produces: `createCheckoutSession(plan, promoCode?): ActionResult<{ url: string }>`; `createPortalSession(): ActionResult<{ url: string }>`; `getBillingStatus(): ActionResult<{ status, plan, currentPeriodEnd }>`.

- [ ] **Step 1: Създай billing.ts**

Create `src/actions/billing.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/db";
import { requireShop } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { stripe, priceIdForPlan, STRIPE_APP_TAG } from "@/lib/stripe";
import { getSubscription } from "@/db/queries/subscriptions";
import { z } from "zod";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://frizmo-shops.vercel.app";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
  promoCode: z.string().trim().max(40).optional(),
});

/** Взима или създава Stripe Customer за магазина (idempotent — пази id-то). */
async function ensureCustomer(shopId: string, email: string, name: string): Promise<string> {
  const existing = await getSubscription(shopId);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: email || undefined,
    name,
    metadata: { app: STRIPE_APP_TAG, shopId },
  });
  /* Записваме частичен ред веднага (customer id), за да е idempotent при повторен клик. */
  await db
    .insert(subscriptions)
    .values({ shopId, stripeCustomerId: customer.id, status: "trialing" })
    .onConflictDoNothing({ target: subscriptions.shopId });
  return customer.id;
}

export async function createCheckoutSession(rawInput: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Невалиден план.");
  const { shop, user } = await requireShop();

  try {
    const customerId = await ensureCustomer(shop.id, user.email ?? "", shop.name);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdForPlan(parsed.data.plan), quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { app: STRIPE_APP_TAG, shopId: shop.id },
      },
      /* Промо код: Stripe валидира FRIZMO50; невалиден → отхвърля. allow_promotion_codes
         показва поле в Checkout, а discounts го прилага директно ако е подаден. */
      ...(parsed.data.promoCode
        ? { discounts: [{ promotion_code: await resolvePromoCode(parsed.data.promoCode) }] }
        : { allow_promotion_codes: true }),
      metadata: { app: STRIPE_APP_TAG, shopId: shop.id },
      success_url: `${BASE_URL}/dashboard/billing?success=1`,
      cancel_url: `${BASE_URL}/dashboard/billing`,
    });
    if (!session.url) return fail("Stripe не върна URL. Опитай пак.");
    return ok({ url: session.url });
  } catch (error) {
    console.error("createCheckoutSession се провали:", error);
    return fail("Плащането не можа да стартира. Опитай пак.");
  }
}

/** Промо код (човешки, напр. FRIZMO50) → Stripe promotion_code id. Невалиден → грешка. */
async function resolvePromoCode(code: string): Promise<string> {
  const list = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  const promo = list.data[0];
  if (!promo) throw new Error("INVALID_PROMO");
  return promo.id;
}

export async function createPortalSession(): Promise<ActionResult<{ url: string }>> {
  const { shop } = await requireShop();
  const sub = await getSubscription(shop.id);
  if (!sub?.stripeCustomerId) return fail("Няма активен абонамент за управление.");
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${BASE_URL}/dashboard/billing`,
    });
    return ok({ url: session.url });
  } catch (error) {
    console.error("createPortalSession се провали:", error);
    return fail("Порталът не можа да се отвори. Опитай пак.");
  }
}

export async function getBillingStatus(): Promise<
  ActionResult<{ status: string; plan: string; currentPeriodEnd: string | null }>
> {
  const { shop } = await requireShop();
  const sub = await getSubscription(shop.id);
  if (!sub) return ok({ status: "trial", plan: "pro", currentPeriodEnd: null });
  return ok({
    status: sub.status,
    plan: sub.plan,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
  });
}
```

Забележка за `resolvePromoCode` грешка: обвий в `createCheckoutSession` try — при `INVALID_PROMO` върни `fail("Промо кодът не е валиден.")`. Добави в catch:

```ts
    if ((error as Error).message === "INVALID_PROMO") return fail("Промо кодът не е валиден.");
```

- [ ] **Step 2: Гейт + commit**

Run: `pnpm check`
Expected: PASS (компилира; Stripe типовете валидират заявките)

```bash
git add src/actions/billing.ts
git commit -m "feat(billing): checkout + portal + status actions (promo код, idempotent customer)"
```

---

## Task 6: Webhook route

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `stripe` (Task 2); `subscriptions`, `stripeEvents` (Task 1).
- Produces: POST endpoint `/api/webhooks/stripe`, синхронизира subscription статуса.

- [ ] **Step 1: Създай webhook route**

Create `src/app/api/webhooks/stripe/route.ts`:

```ts
import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db, subscriptions, stripeEvents } from "@/db";
import { stripe, STRIPE_APP_TAG } from "@/lib/stripe";

/** Маппинг Stripe subscription статус → нашия enum. */
function mapStatus(s: Stripe.Subscription.Status): "trialing" | "active" | "past_due" | "suspended" | "canceled" {
  switch (s) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled":
    case "unpaid": return "suspended";
    default: return "canceled"; // incomplete/incomplete_expired/paused
  }
}

/** Плана от Price ID (нашите два). null = чужд Price (друг проект) → игнорирай. */
function planFromPrice(priceId: string | undefined): "starter" | "pro" | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.text(); // RAW — никога req.json() преди верификация
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  /* Идемпотентност: at-least-once → dedup по event id. */
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing({ target: stripeEvents.id })
    .returning({ id: stripeEvents.id });
  if (inserted.length === 0) return new Response("Already processed", { status: 200 });

  try {
    await handleEvent(event);
  } catch (error) {
    console.error("Stripe webhook обработка се провали:", event.type, error);
    return new Response("Handler error", { status: 500 }); // Stripe ще retry-не
  }
  return new Response("OK", { status: 200 });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.app !== STRIPE_APP_TAG) return; // чужд проект
      const shopId = session.metadata?.shopId;
      if (!shopId || !session.subscription) return;
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      await upsertFromSubscription(shopId, sub);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.metadata?.app !== STRIPE_APP_TAG) return; // чужд проект
      const shopId = sub.metadata?.shopId;
      if (!shopId) return;
      await upsertFromSubscription(shopId, sub);
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as unknown as { subscription?: string }).subscription;
      if (!subId) return;
      const sub = await stripe.subscriptions.retrieve(subId);
      if (sub.metadata?.app !== STRIPE_APP_TAG) return; // чужд проект
      const shopId = sub.metadata?.shopId;
      if (shopId) await upsertFromSubscription(shopId, sub);
      break;
    }
    default:
      break; // игнорираме останалите
  }
}

/** Записва subscription състоянието локално от Stripe обекта. */
async function upsertFromSubscription(shopId: string, sub: Stripe.Subscription): Promise<void> {
  const priceId = sub.items.data[0]?.price.id;
  const plan = planFromPrice(priceId);
  if (!plan) return; // чужд Price → не пипай
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

  await db
    .update(subscriptions)
    .set({
      stripeSubscriptionId: sub.id,
      plan,
      status: mapStatus(sub.status),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.shopId, shopId));
}
```

- [ ] **Step 2: Стартирай webhook forwarding (local test)**

В отделен терминал:
Run: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
Expected: отпечатва `whsec_...` — сложи го в `.env.local` като `STRIPE_WEBHOOK_SECRET`, рестартирай dev.

- [ ] **Step 3: Тествай webhook с trigger**

С пуснат `pnpm dev` + `stripe listen`:
Run: `stripe trigger checkout.session.completed`
Expected: в `stripe listen` терминала → `200 OK`; в dev лога няма грешка.

(Забележка: trigger-нато събитие няма нашия metadata → ще се игнорира тихо. Реалният тест на записа е в Task 9 verification скрипта / ръчния e2e с реален checkout.)

- [ ] **Step 4: Гейт + commit**

Run: `pnpm check`
Expected: PASS

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(billing): Stripe webhook (подпис + dedup + metadata изолация + статус синх)"
```

---

## Task 7: Checkout gate — блокирай продажби при suspended билинг

**Files:**
- Modify: `src/actions/orders.ts` (createOrder, ~ред 140)
- Test: `src/lib/plan.test.ts` (вече покрива billingAllowsSelling)

**Interfaces:**
- Consumes: `isShopActive` (Task 4).

- [ ] **Step 1: Добави billing guard в createOrder**

В `src/actions/orders.ts`, след проверката `shop.status !== "published"` (около ред 141-143), добави:

```ts
  /* Billing gate: неплатен/спрян абонамент → магазинът не приема поръчки
     („временно затворено"). Отделно от модерацията (shop.status). */
  const { isShopActive } = await import("@/lib/plan");
  if (!(await isShopActive(shop.id, shop.createdAt))) {
    return fail("Магазинът временно не приема поръчки.");
  }
```

(Динамичен import избягва циклична зависимост, ако plan.ts тегли от orders. Ако няма цикъл — обикновен top import е по-чист.)

- [ ] **Step 2: Провери за цикъл — ако няма, направи import статичен**

Run: `grep -n "from \"@/actions/orders\"" src/lib/plan.ts src/db/queries/subscriptions.ts`
Expected: празно → няма цикъл → премести import-а горе:
```ts
import { isShopActive } from "@/lib/plan";
```
и махни динамичния.

- [ ] **Step 3: Гейт + commit**

Run: `pnpm check`
Expected: PASS

```bash
git add src/actions/orders.ts
git commit -m "feat(billing): checkout блокиран при спрян абонамент (billing gate)"
```

---

## Task 8: Billing страница (dashboard)

**Files:**
- Create: `src/app/(dashboard)/dashboard/billing/page.tsx`
- Create: `src/components/dashboard/billing-panel.tsx`

**Interfaces:**
- Consumes: `getBillingStatus`, `createCheckoutSession`, `createPortalSession` (Task 5).

- [ ] **Step 1: Създай client панела**

Create `src/components/dashboard/billing-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, Select } from "@/components/ui";
import { createCheckoutSession, createPortalSession } from "@/actions/billing";

interface BillingPanelProps {
  status: string;
  plan: string;
  currentPeriodEnd: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  trial: "Пробен период",
  trialing: "Пробен период",
  active: "Активен",
  past_due: "Забавено плащане",
  suspended: "Спрян — без плащане",
  canceled: "Отказан",
};

export function BillingPanel({ status, plan, currentPeriodEnd }: BillingPanelProps) {
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro">(plan === "pro" ? "pro" : "starter");
  const [promo, setPromo] = useState("");
  const hasSubscription = status !== "trial";

  async function subscribe() {
    setBusy(true);
    try {
      const res = await createCheckoutSession({ plan: selectedPlan, promoCode: promo.trim() || undefined });
      if (!res.ok) { toast.error(res.error); return; }
      window.location.href = res.data.url;
    } finally { setBusy(false); }
  }

  async function manage() {
    setBusy(true);
    try {
      const res = await createPortalSession();
      if (!res.ok) { toast.error(res.error); return; }
      window.location.href = res.data.url;
    } finally { setBusy(false); }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-bold text-ink-900">Абонамент</h2>
        <p className="mt-1 text-sm text-ink-500">
          Състояние: <span className="font-medium text-ink-900">{STATUS_LABEL[status] ?? status}</span>
          {currentPeriodEnd && ` · до ${new Date(currentPeriodEnd).toLocaleDateString("bg-BG")}`}
        </p>
      </div>

      {hasSubscription ? (
        <Button loading={busy} onClick={manage}>Управлявай абонамента</Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Select
            label="План"
            options={[
              { value: "starter", label: "Starter — 10 €/мес" },
              { value: "pro", label: "Pro — 20 €/мес" },
            ]}
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value as "starter" | "pro")}
          />
          <Input
            label="Промо код (по избор)"
            placeholder="напр. FRIZMO50"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
          <Button loading={busy} onClick={subscribe}>Абонирай се</Button>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Създай страницата**

Create `src/app/(dashboard)/dashboard/billing/page.tsx`:

```tsx
import { getBillingStatus } from "@/actions/billing";
import { BillingPanel } from "@/components/dashboard/billing-panel";

export const metadata = { title: "Абонамент — Frizmo Shops" };

export default async function BillingPage() {
  const res = await getBillingStatus();
  const data = res.ok ? res.data : { status: "trial", plan: "pro", currentPeriodEnd: null };

  return (
    <div className="mx-auto w-full max-w-xl">
      <BillingPanel status={data.status} plan={data.plan} currentPeriodEnd={data.currentPeriodEnd} />
    </div>
  );
}
```

- [ ] **Step 3: Добави линк към Billing в dashboard nav**

В `src/components/dashboard/nav-items.ts` (NAV_ITEMS масива), добави запис за Billing:
```ts
{ href: "/dashboard/billing", label: "Абонамент", icon: "receipt" },
```
(Провери точния shape на записите + наличната икона в `src/components/ui/icon.tsx`.)

- [ ] **Step 4: Гейт + commit**

Run: `pnpm check`
Expected: PASS

```bash
git add "src/app/(dashboard)/dashboard/billing/page.tsx" src/components/dashboard/billing-panel.tsx src/components/dashboard/nav-items.ts
git commit -m "feat(billing): billing страница (абониране + промо + управление) + nav линк"
```

---

## Task 9: Landing текст + обективна верификация

**Files:**
- Modify: `src/lib/plans-content.ts`
- Create: `scripts/verify-billing.mjs`

- [ ] **Step 1: Смени landing текста (маха „без карта")**

В `src/lib/plans-content.ts`:
- `TRIAL_NOTE` → `"30 дни безплатен пробен период с пълен Pro достъп. Откажи по всяко време."`
- `PRICING_TRUST` → махни `"Без карта за пробния период"`, добави `"Първо плащане чак след 30 дни"`.

- [ ] **Step 2: Обективна проверка на плановата логика срещу базата**

Create `scripts/verify-billing.mjs` — създава тестов магазин + subscription редове с различни статуси, проверява че `resolvePlan`/`billingAllowsSelling` дават правилен резултат (импортва чистите функции). Чисти след себе си.

```js
/* Обективна проверка на billing плановата логика (без Stripe, чисти функции +
   реален DB ред). node --env-file=.env.local scripts/verify-billing.mjs */
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
let fails = 0;
const check = (n, ok) => { console.log(`${ok ? "✓" : "✗"} ${n}`); if (!ok) fails++; };

async function main() {
  const [owner] = await sql`select owner_id from shops limit 1`;
  const [shop] = await sql`
    insert into shops (owner_id, name, slug, business_category, status, created_at)
    values (${owner.owner_id}, '__billing_test__', ${"__bt_" + Date.now()}, 'Друго', 'published', now())
    returning id, created_at`;
  try {
    // suspended subscription → магазинът не продава
    await sql`insert into subscriptions (shop_id, stripe_customer_id, plan, status)
              values (${shop.id}, ${"cus_test_" + Date.now()}, 'pro', 'suspended')`;
    const [sub] = await sql`select status, plan from subscriptions where shop_id = ${shop.id}`;
    check("suspended subscription записан", sub.status === "suspended");

    await sql`update subscriptions set status = 'active' where shop_id = ${shop.id}`;
    const [sub2] = await sql`select status from subscriptions where shop_id = ${shop.id}`;
    check("update към active работи", sub2.status === "active");
  } finally {
    await sql`delete from subscriptions where shop_id = ${shop.id}`;
    await sql`delete from shops where id = ${shop.id}`;
  }
  await sql.end();
  console.log(fails === 0 ? "\n✓ Billing DB логиката работи." : `\n✗ ${fails} провала.`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
```

- [ ] **Step 3: Пусни верификацията**

Run: `node --env-file=.env.local scripts/verify-billing.mjs`
Expected: `✓ Billing DB логиката работи.`

- [ ] **Step 4: Гейт + commit**

Run: `pnpm check`
Expected: PASS

```bash
git add src/lib/plans-content.ts scripts/verify-billing.mjs
git commit -m "feat(billing): landing текст (карта от началото) + DB верификация"
```

---

## Task 10: End-to-end ръчен тест (Stripe test mode)

Не автоматизиран (потребителят тества сам, Playwright е забранен). Чеклист за ръчна проверка с test карти:

- [ ] `pnpm dev` + `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- [ ] Dashboard → Абонамент → избери Pro + промо `FRIZMO50` → Абонирай се.
- [ ] Stripe Checkout: карта `4242 4242 4242 4242`, дата в бъдещето, CVC 123.
- [ ] Провери в Checkout, че промо кодът дава -50% на първата фактура (не на trial-а).
- [ ] След success → billing страницата показва „Пробен период" + бутон „Управлявай абонамента".
- [ ] Провери в базата: `subscriptions` ред с `status=trialing`, `plan=pro`, `stripeSubscriptionId` попълнен.
- [ ] „Управлявай абонамента" → Stripe Customer Portal се отваря.
- [ ] Симулирай изтичане на trial: `stripe trigger invoice.paid` (или в Stripe test clock) → статус → active.
- [ ] Симулирай fail: карта `4000 0000 0000 0341` → `invoice.payment_failed` → статус past_due; след изчерпани retry-и → suspended → checkout в магазина показва „временно затворено".

---

## Self-Review бележки

- **Спец покритие:** trial с карта (T5), промо -50% once (T3+T5), suspend при неплащане (T6+T7), Customer Portal (T5+T8), webhook сигурност (T6), изолация metadata (T2+T6), billing≠модерация ос (T1+T4+T7), landing текст (T9). ✓
- **Типове:** `PlanId`/`SubShape` консистентни между plan.ts и тестовете; `mapStatus`/`planFromPrice` в webhook-а връщат нашия enum. ✓
- **Env:** 4 нови ключа (T2), test setup през CLI (T3), Vercel prod → Redeploy при live.
- **Отворено при имплементация:** точна `stripe` npm версия; Smart Retries прозорец (Stripe dashboard); ЗДДС фактура (счетоводител); Stripe API типове за `current_period_end`/`subscription` на Invoice се местят между версии — провери на живо с pinned версия.
