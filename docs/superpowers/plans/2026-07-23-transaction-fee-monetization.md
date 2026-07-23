# Транзакционна такса (монетизация) — имплементационен план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, по избор на потребителя) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Смяна на монетизацията от flat абонамент към безплатен вход + такса на транзакция (5%, мин 0.30€, таван 50€), фактурирана месечно през Stripe авто-теглене, с immutable fee ledger и card-gate след първата продажба.

**Architecture:** Всяка завършена поръчка начислява `charge` в immutable `fee_events` ledger; връщане начислява `credit`. Месечен cron сумира ledger-а по магазин и издава Stripe фактура с `charge_automatically`. Търговецът запазва карта чак след първата завършена продажба (card-gate). Целият план-концепт (`plan.ts`) се изтрива и заменя от тънък `selling-gate.ts` + заявки в `db/queries/fees.ts`. Парите от продажбите НЕ минават през платформата (Модел А).

**Tech Stack:** Next.js 16, Drizzle ORM (Supabase Postgres), Stripe (`apiVersion: 2026-06-24.dahlia`), Zod, Vitest, Vercel Cron.

**Спец (източник на истината):** `docs/superpowers/specs/2026-07-23-transaction-fee-monetization-design.md`

## Global Constraints

- **Пари = integer евроценти (EUR)**, никога float. `round` (не floor/ceil) при процент. Аритметиката само в `src/lib/fee.ts`.
- **Заключени конфиг стойности** (всички в `src/lib/fee.ts`): `FEE_RATE = 0.05`, `FEE_MIN_CENTS = 30`, `FEE_CAP_CENTS = 5000`, `AUTO_COMPLETE_DAYS = 30`, `FEE_GRACE_DAYS = 14`.
- **База на таксата** = `max(0, subtotalCents − discountCents)`. Изключва доставка и опаковка. База ≤ 0 → такса 0.
- **Строг TypeScript** — без `as any`. UI текст на български, типографски кавички „…“ (прав `"` чупи lint).
- **Multi-tenant:** всяка заявка филтрира по `shopId`. Мутации през wrapper-ите в `src/actions/`.
- **`"use server"` файлове експортират само async функции** — чисти функции/константи живеят извън тях (в `lib/`).
- **db:push** прилага `src/db/schema.ts` (drizzle-kit push, без migration файлове). На прод — таргетиран SQL (пази pg_trgm индексите), НЕ `drizzle-kit push`.
- **Gate:** `pnpm check` (lint + unit + build) преди всеки commit. Node 24 (prepend `C:\Users\stoic\AppData\Local\nvm\v24.18.0` към PATH на Windows).
- **Идемпотентност:** всеки ledger insert + фактурен insert е `onConflictDoNothing` на естествен ключ.
- **Push само след изрично разрешение** от потребителя (`main`=prod, `dev`=preview).

## Файлова структура

**Нови файлове:**
- `src/lib/fee.ts` — чисти функции + конфиг константи (аритметика на таксата). Единствен източник.
- `src/lib/fee.test.ts` — unit тестове за `fee.ts`.
- `src/db/queries/fees.ts` — всички заявки за ledger/invoices/gate (`recordFeeCharge`, `recordFeeCredit`, `getBillableBalanceForPeriod`, `hasOverdueFees`, `requiresCard`, `getFeeInvoices`).
- `src/db/queries/fees.test.ts` — unit тестове за заявките (charge/credit/агрегация/идемпотентност).
- `src/lib/selling-gate.ts` — тънък публичен gate `canAcceptOrders(shopId)`. Заменя `plan.ts`.
- `src/lib/selling-gate.test.ts` — unit тестове за gate йерархията.
- `src/app/api/cron/auto-complete-orders/route.ts` — авто-completed cron.
- `src/app/api/cron/bill-fees/route.ts` — месечен billing cron.
- `src/actions/card-setup.ts` — SetupIntent action за запазване на карта.
- `docs/decisions/2026-07-23-transaction-fee-monetization.md` — ADR.

**Изтрити файлове:**
- `src/lib/plan.ts` + `src/lib/plan.test.ts` (ако съществува) — целият план-концепт.

**Променени файлове:**
- `src/db/schema.ts` — `orders.completedAt` + `orders.returnedAt`; `feeEventTypeEnum`; `feeInvoiceStatusEnum`; `feeEvents` таблица; `feeInvoices` таблица.
- `src/actions/orders.ts` — charge при `→completed`, credit при `→returned` (в съществуващата транзакция); `createOrder` gate → `canAcceptOrders`; махни `isShopActive` импорта.
- `src/actions/products.ts` — махни `maxProducts` enforce + `plan.ts` импорта.
- `src/actions/billing.ts` — махни `inSignupTrial`; пренапиши/премахни subscription checkout.
- `src/app/(storefront)/s/[slug]/checkout/page.tsx` + `layout.tsx` — `isShopActive(id, createdAt)` → `canAcceptOrders(id)`.
- `src/app/api/webhooks/stripe/route.ts` — `invoice.paid`/`invoice.payment_failed` → `fee_invoices.status`.
- `src/lib/platform-legal.ts`, `src/app/(marketing)/page.tsx`, `src/lib/plans-content.ts` — текстове.
- `vercel.json` — два нови cron записа.

---

## Task 1: Аритметика на таксата (`fee.ts`)

**Files:**
- Create: `src/lib/fee.ts`
- Test: `src/lib/fee.test.ts`

**Interfaces:**
- Produces:
  - `FEE_RATE: number` (0.05), `FEE_MIN_CENTS: number` (30), `FEE_CAP_CENTS: number` (5000), `AUTO_COMPLETE_DAYS: number` (30), `FEE_GRACE_DAYS: number` (14) — exported const.
  - `feeBaseCents(order: { subtotalCents: number; discountCents: number }): number` — `max(0, subtotal − discount)`.
  - `feeCents(baseCents: number): number` — `baseCents <= 0 ? 0 : clamp(round(baseCents * FEE_RATE), FEE_MIN_CENTS, FEE_CAP_CENTS)`.

- [ ] **Step 1: Write the failing test** — `src/lib/fee.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { feeCents, feeBaseCents, FEE_RATE, FEE_MIN_CENTS, FEE_CAP_CENTS } from "./fee";

describe("feeBaseCents", () => {
  it("вади отстъпката от subtotal", () => {
    expect(feeBaseCents({ subtotalCents: 2000, discountCents: 500 })).toBe(1500);
  });
  it("не пада под 0 при отстъпка > subtotal", () => {
    expect(feeBaseCents({ subtotalCents: 1000, discountCents: 1500 })).toBe(0);
  });
});

describe("feeCents", () => {
  it("прилага процента при средна база", () => {
    // 2000 * 0.05 = 100
    expect(feeCents(2000)).toBe(100);
  });
  it("вдига до минимума при малка база", () => {
    // 300 * 0.05 = 15 → под 30 → 30
    expect(feeCents(300)).toBe(FEE_MIN_CENTS);
  });
  it("реже до тавана при голяма база", () => {
    // 200000 * 0.05 = 10000 → над 5000 → 5000
    expect(feeCents(200000)).toBe(FEE_CAP_CENTS);
  });
  it("база 0 → такса 0 (не минимума)", () => {
    expect(feeCents(0)).toBe(0);
  });
  it("отрицателна база → 0", () => {
    expect(feeCents(-100)).toBe(0);
  });
  it("закръгля с round, не floor", () => {
    // 250 * 0.05 = 12.5 → round → 13, но под мин 30 → 30
    expect(feeCents(250)).toBe(FEE_MIN_CENTS);
    // 610 * 0.05 = 30.5 → round → 31 (над мин 30)
    expect(feeCents(610)).toBe(31);
  });
  it("монотонност: по-голяма база → по-голяма или равна такса", () => {
    let prev = 0;
    for (let base = 0; base <= 300000; base += 137) {
      const fee = feeCents(base);
      expect(fee).toBeGreaterThanOrEqual(prev);
      prev = fee;
    }
  });
  it("връща цели центове (integer)", () => {
    for (const base of [123, 999, 4567, 88888]) {
      expect(Number.isInteger(feeCents(base))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/fee.test.ts`
Expected: FAIL — "Failed to resolve import ./fee" / feeCents is not a function.

- [ ] **Step 3: Write minimal implementation** — `src/lib/fee.ts`:

```ts
/**
 * Аритметика на транзакционната такса — ЕДИНСТВЕНИЯТ източник (по модела на pricing.ts).
 * Integer евроценти навсякъде; round (не floor/ceil). Всички стойности са конфиг тук.
 */

export const FEE_RATE = 0.05; // 5%
export const FEE_MIN_CENTS = 30; // 0.30€ минимум на продажба
export const FEE_CAP_CENTS = 5000; // 50€ таван на продажба
export const AUTO_COMPLETE_DAYS = 30; // авто-completed на заседнали shipped
export const FEE_GRACE_DAYS = 14; // grace преди спиране при неплатена фактура

/** База на таксата = само стоката (subtotal − отстъпка), без доставка/опаковка; не под 0. */
export function feeBaseCents(order: { subtotalCents: number; discountCents: number }): number {
  return Math.max(0, order.subtotalCents - order.discountCents);
}

/** Такса за една продажба. База ≤ 0 → 0. Иначе clamp(round(база*rate), min, cap). */
export function feeCents(baseCents: number): number {
  if (baseCents <= 0) return 0;
  const raw = Math.round(baseCents * FEE_RATE);
  return Math.min(Math.max(raw, FEE_MIN_CENTS), FEE_CAP_CENTS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/fee.test.ts`
Expected: PASS (всичките случая).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fee.ts src/lib/fee.test.ts
git commit -m "feat(fee): аритметика на транзакционната такса (5%+мин+таван, чиста функция)"
```

---

## Task 2: Схема — колони + таблици на ledger-а

**Files:**
- Modify: `src/db/schema.ts` (orders колони ~ред 577–585; нови enum-и до `orderStatusEnum` ~ред 289; нови таблици след `orders`/`orderItems`)
- Test: (миграция се верифицира с db:push + query, не unit тест)

**Interfaces:**
- Produces (Drizzle обекти, достъпни през `@/db` заради `export * from "./schema"`):
  - `orders.completedAt: timestamp | null`, `orders.returnedAt: timestamp | null`
  - `feeEventTypeEnum` (`'charge' | 'credit'`), `feeInvoiceStatusEnum` (`'draft' | 'issued' | 'paid' | 'uncollectible'`)
  - `feeEvents` таблица: `id, shopId, orderId, type, amountCents, baseCents, occurredAt, createdAt`
  - `feeInvoices` таблица: `id, shopId, periodStart, periodEnd, chargesCents, creditsCents, amountDueCents, stripeInvoiceId, status, createdAt, updatedAt`

- [ ] **Step 1: Добави двете колони на `orders`** — в `src/db/schema.ts`, в `orders` таблицата, до `returnRequestedAt` (ред ~565):

```ts
    /* Транзакционна такса: моментът, в който продажбата става таксуема (ръчно или
       авто-completed). НЕ ползваме updatedAt — той се презаписва и е зает от return window. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /* Моментът на ПРИЕМАНЕ на връщане (не заявката) — occurredAt на кредита. */
    returnedAt: timestamp("returned_at", { withTimezone: true }),
```

- [ ] **Step 2: Добави индекс за месечната агрегация** — в `orders` таблицата, в масива с индекси (след `orders_shop_created_idx`, ред ~590):

```ts
    index("orders_shop_completed_idx").on(t.shopId, t.completedAt),
```

- [ ] **Step 3: Добави двата enum-а** — до `orderStatusEnum` (ред ~289):

```ts
export const feeEventTypeEnum = pgEnum("fee_event_type", ["charge", "credit"]);
export const feeInvoiceStatusEnum = pgEnum("fee_invoice_status", [
  "draft",
  "issued",
  "paid",
  "uncollectible",
]);
```

- [ ] **Step 4: Добави `feeEvents` таблица** — след `orderItems` дефиницията:

```ts
/** Immutable, event-dated ledger на таксовите събития. Append-only — балансът е производен. */
export const feeEvents = pgTable(
  "fee_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: feeEventTypeEnum("type").notNull(),
    /* Винаги положително; знакът идва от type (charge=+, credit=−). */
    amountCents: integer("amount_cents").notNull(),
    /* feeBaseCents(order) към момента (subtotal−discount) — snapshot за възпроизводимост. */
    baseCents: integer("base_cents").notNull(),
    /* Бизнес дата на събитието (completedAt за charge / returnedAt за credit). */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* Идемпотентност: макс 1 charge + 1 credit на поръчка. onConflictDoNothing разчита на това. */
    uniqueIndex("fee_events_order_type_idx").on(t.orderId, t.type),
    /* Месечна агрегация по магазин. */
    index("fee_events_shop_occurred_idx").on(t.shopId, t.occurredAt),
  ],
).enableRLS();
```

- [ ] **Step 5: Добави `feeInvoices` таблица** — след `feeEvents`:

```ts
/** Месечен фактурен запис — идемпотентност на billing job-а + огледало на Stripe статуса. */
export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    /* Начало/край на фактурирания месец (UTC). */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    chargesCents: integer("charges_cents").notNull(),
    creditsCents: integer("credits_cents").notNull(),
    /* charges − credits. Може да е ≤ 0 (тогава без Stripe фактура). */
    amountDueCents: integer("amount_due_cents").notNull(),
    stripeInvoiceId: text("stripe_invoice_id"),
    status: feeInvoiceStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* Един фактурен ред на магазин на месец — onConflictDoNothing разчита на това. */
    uniqueIndex("fee_invoices_shop_period_idx").on(t.shopId, t.periodStart),
  ],
).enableRLS();
```

- [ ] **Step 6: Провери, че нужните импорти са налични** — в горната част на `schema.ts` увери се, че `pgEnum`, `uniqueIndex`, `index`, `integer`, `text`, `uuid`, `timestamp` са импортирани (вече би трябвало да са — провери с):

Run: `grep -nE "pgEnum|uniqueIndex|import" src/db/schema.ts | head -5`
Expected: import ред от `drizzle-orm/pg-core` съдържащ тези. Ако липсва някой → добави го.

- [ ] **Step 7: Приложи схемата към DEV базата**

Run: `pnpm db:push`
Expected: drizzle прилага 2-те колони + 2-те таблици + 2-те enum-а. Отговори „да" на промените. (⚠️ Ако drizzle предложи да ТРИЕ pg_trgm индекси — откажи цялото push и виж `docs/WORKLOG.md` за таргетиран SQL; на dev обикновено не се случва.)

- [ ] **Step 8: Верифицирай, че таблиците съществуват**

Run: `node --env-file=.env.local -e "import('postgres').then(async(p)=>{const sql=p.default(process.env.DATABASE_URL_MIGRATIONS,{prepare:false});const r=await sql\`select table_name from information_schema.tables where table_name in ('fee_events','fee_invoices')\`;console.log(r.map(x=>x.table_name));await sql.end();})"`
Expected: `[ 'fee_events', 'fee_invoices' ]`

- [ ] **Step 9: Gate + commit**

```bash
pnpm check
git add src/db/schema.ts
git commit -m "feat(schema): fee_events ledger + fee_invoices + orders.completedAt/returnedAt"
```

---

## Task 3: Заявки за ledger + агрегация (`fees.ts`)

**Files:**
- Create: `src/db/queries/fees.ts`
- Test: `src/db/queries/fees.test.ts`

**Interfaces:**
- Consumes: `feeEvents`, `feeInvoices`, `orders` от `@/db`; `feeBaseCents`, `feeCents` от `@/lib/fee`.
- Produces:
  - `recordFeeCharge(tx, order: { id; shopId; subtotalCents; discountCents; completedAt: Date }): Promise<void>` — идемпотентен insert на `charge`.
  - `recordFeeCredit(tx, order: { id; shopId; returnedAt: Date }): Promise<void>` — идемпотентен insert на `credit` (само ако има charge).
  - `getBillableBalanceForPeriod(shopId: string, from: Date, to: Date): Promise<{ chargesCents: number; creditsCents: number; amountDueCents: number }>`
  - `hasOverdueFees(shopId: string): Promise<boolean>` — има ли `issued` фактура извън grace.
  - `getFeeInvoices(shopId: string): Promise<FeeInvoice[]>` — за dashboard.
  - `Tx` type (Drizzle transaction client) — реюзван от orders.ts pattern.

- [ ] **Step 1: Write the failing test** — `src/db/queries/fees.test.ts` (unit срещу dev база, по модела на съществуващи query тестове; ако проектът няма DB-integration тестове, виж бележката след стъпката):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { db, feeEvents, shops, orders } from "@/db";
import { eq } from "drizzle-orm";
import {
  recordFeeCharge,
  recordFeeCredit,
  getBillableBalanceForPeriod,
} from "./fees";

// Помощник: създава магазин + поръчка за теста, връща id-та. Чисти след себе си.
async function seed(subtotal: number, discount: number) {
  const [shop] = await db.insert(shops).values({
    name: "__fee_test__", slug: `__fee_${Date.now()}_${Math.floor(Math.random()*1e6)}`,
    ownerId: null as unknown as string, status: "published",
  }).returning();
  const [order] = await db.insert(orders).values({
    shopId: shop.id, orderNumber: 1, customerName: "x", customerPhone: "+359888000000",
    shippingName: "y", shippingPriceCents: 0, paymentName: "z", paymentType: "cod",
    subtotalCents: subtotal, discountCents: discount, totalCents: subtotal - discount, status: "new",
  }).returning();
  return { shopId: shop.id, order };
}

describe("recordFeeCharge / recordFeeCredit", () => {
  it("charge = feeCents(subtotal−discount); идемпотентен", async () => {
    const { shopId, order } = await seed(2000, 0);
    const completedAt = new Date();
    await db.transaction(async (tx) => {
      await recordFeeCharge(tx, { ...order, shopId, completedAt });
      await recordFeeCharge(tx, { ...order, shopId, completedAt }); // втори път → без дубъл
    });
    const rows = await db.select().from(feeEvents).where(eq(feeEvents.orderId, order.id));
    expect(rows.length).toBe(1);
    expect(rows[0].type).toBe("charge");
    expect(rows[0].amountCents).toBe(100); // 2000*0.05
    expect(rows[0].baseCents).toBe(2000);
    await db.delete(shops).where(eq(shops.id, shopId));
  });

  it("credit само ако има charge; същата сума", async () => {
    const { shopId, order } = await seed(2000, 0);
    await db.transaction(async (tx) => {
      await recordFeeCredit(tx, { id: order.id, shopId, returnedAt: new Date() }); // без charge → нищо
    });
    let rows = await db.select().from(feeEvents).where(eq(feeEvents.orderId, order.id));
    expect(rows.length).toBe(0);
    await db.transaction(async (tx) => {
      await recordFeeCharge(tx, { ...order, shopId, completedAt: new Date() });
      await recordFeeCredit(tx, { id: order.id, shopId, returnedAt: new Date() });
    });
    rows = await db.select().from(feeEvents).where(eq(feeEvents.orderId, order.id));
    expect(rows.length).toBe(2);
    const credit = rows.find((r) => r.type === "credit")!;
    expect(credit.amountCents).toBe(100);
    await db.delete(shops).where(eq(shops.id, shopId));
  });
});

describe("getBillableBalanceForPeriod", () => {
  it("сумира charge − credit за периода", async () => {
    const { shopId, order } = await seed(2000, 0);
    const now = new Date();
    await db.transaction(async (tx) => {
      await recordFeeCharge(tx, { ...order, shopId, completedAt: now });
    });
    const from = new Date(now.getTime() - 1000);
    const to = new Date(now.getTime() + 1000);
    const bal = await getBillableBalanceForPeriod(shopId, from, to);
    expect(bal.chargesCents).toBe(100);
    expect(bal.creditsCents).toBe(0);
    expect(bal.amountDueCents).toBe(100);
    await db.delete(shops).where(eq(shops.id, shopId));
  });
});
```

> **Бележка за реализатора:** Проектът има DB-integration verify скриптове (`scripts/verify-*.mjs`), но unit тестовете обикновено са чисти. Ако Vitest setup-ът не дава DB достъп (`DATABASE_URL` липсва в test env), премести тези проверки в нов `scripts/verify-fees.mjs` (по модела на `scripts/verify-order-concurrency.mjs`, който ползва `postgres` директно + `DATABASE_URL_MIGRATIONS`) и остави в `fees.test.ts` само чисто-функционалните части. Провери с: `grep -rn "DATABASE_URL" vitest.config.ts vitest.setup.ts 2>/dev/null` — ако няма DB в test env, ползвай verify скрипт.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/db/queries/fees.test.ts`
Expected: FAIL — "Failed to resolve ./fees".

- [ ] **Step 3: Write implementation** — `src/db/queries/fees.ts`:

```ts
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, feeEvents, feeInvoices } from "@/db";
import { feeBaseCents, feeCents, FEE_GRACE_DAYS } from "@/lib/fee";

/** Drizzle transaction client (същия shape като db за заявки). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Идемпотентен charge при завършена поръчка. baseCents = feeBaseCents(order);
 * amountCents = feeCents(base). onConflictDoNothing на (orderId,'charge').
 * Ако базата → такса 0, пак записваме реда (audit; balance е коректен).
 */
export async function recordFeeCharge(
  tx: Tx,
  order: { id: string; shopId: string; subtotalCents: number; discountCents: number; completedAt: Date },
): Promise<void> {
  const base = feeBaseCents(order);
  const amount = feeCents(base);
  await tx
    .insert(feeEvents)
    .values({
      shopId: order.shopId,
      orderId: order.id,
      type: "charge",
      amountCents: amount,
      baseCents: base,
      occurredAt: order.completedAt,
    })
    .onConflictDoNothing({ target: [feeEvents.orderId, feeEvents.type] });
}

/**
 * Идемпотентен credit при прието връщане — САМО ако поръчката има charge.
 * Сумата = сумата на charge-а (сторниране 1:1). occurredAt = returnedAt.
 */
export async function recordFeeCredit(
  tx: Tx,
  order: { id: string; shopId: string; returnedAt: Date },
): Promise<void> {
  const [charge] = await tx
    .select({ amountCents: feeEvents.amountCents, baseCents: feeEvents.baseCents })
    .from(feeEvents)
    .where(and(eq(feeEvents.orderId, order.id), eq(feeEvents.type, "charge")));
  if (!charge) return; // няма charge → няма какво да се сторнира
  await tx
    .insert(feeEvents)
    .values({
      shopId: order.shopId,
      orderId: order.id,
      type: "credit",
      amountCents: charge.amountCents,
      baseCents: charge.baseCents,
      occurredAt: order.returnedAt,
    })
    .onConflictDoNothing({ target: [feeEvents.orderId, feeEvents.type] });
}

/** Баланс за период: сума charge − сума credit по occurredAt в [from, to). */
export async function getBillableBalanceForPeriod(
  shopId: string,
  from: Date,
  to: Date,
): Promise<{ chargesCents: number; creditsCents: number; amountDueCents: number }> {
  const [row] = await db
    .select({
      charges: sql<number>`coalesce(sum(case when ${feeEvents.type} = 'charge' then ${feeEvents.amountCents} else 0 end), 0)`,
      credits: sql<number>`coalesce(sum(case when ${feeEvents.type} = 'credit' then ${feeEvents.amountCents} else 0 end), 0)`,
    })
    .from(feeEvents)
    .where(
      and(
        eq(feeEvents.shopId, shopId),
        gte(feeEvents.occurredAt, from),
        lt(feeEvents.occurredAt, to),
      ),
    );
  const chargesCents = Number(row?.charges ?? 0);
  const creditsCents = Number(row?.credits ?? 0);
  return { chargesCents, creditsCents, amountDueCents: chargesCents - creditsCents };
}

/** Има ли просрочена (issued) фактура извън grace периода → блокира продажби. */
export async function hasOverdueFees(shopId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - FEE_GRACE_DAYS * 86_400_000);
  const [row] = await db
    .select({ id: feeInvoices.id })
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.shopId, shopId),
        eq(feeInvoices.status, "issued"),
        lt(feeInvoices.createdAt, cutoff),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Фактурите на магазин (за dashboard billing секцията), най-новите първо. */
export async function getFeeInvoices(shopId: string) {
  return db
    .select()
    .from(feeInvoices)
    .where(eq(feeInvoices.shopId, shopId))
    .orderBy(sql`${feeInvoices.periodStart} desc`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/db/queries/fees.test.ts` (или `node scripts/verify-fees.mjs` ако е преместено)
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
pnpm check
git add src/db/queries/fees.ts src/db/queries/fees.test.ts
git commit -m "feat(fees): ledger заявки — charge/credit идемпотентни + агрегация + overdue"
```

---

## Task 4: Начисляване в `updateOrderStatus` (charge + credit + timestamps)

**Files:**
- Modify: `src/actions/orders.ts` (`updateOrderStatus`, транзакцията ~ред 760)
- Test: разширение на `scripts/verify-order-concurrency.mjs`

**Interfaces:**
- Consumes: `recordFeeCharge`, `recordFeeCredit` от `@/db/queries/fees`.
- Produces: при `→completed` се задава `completedAt` + charge; при `→returned` се задава `returnedAt` + credit — в съществуващата `db.transaction`.

- [ ] **Step 1: Импортирай ledger функциите** — в началото на `src/actions/orders.ts` (до другите query импорти ~ред 27):

```ts
import { recordFeeCharge, recordFeeCredit } from "@/db/queries/fees";
```

- [ ] **Step 2: Разшири транзакцията в `updateOrderStatus`** — намери блока (ред ~760):

```ts
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    if (parsed.data.status === "cancelled" || parsed.data.status === "returned") {
      await restoreStock(tx, order.id);
    }
    ...
  });
```

Замени `.set({ status: ..., updatedAt: ... })` + добави ledger логиката така (пази съществуващите редове за `restoreStock` и `pending_payment→expired`):

```ts
  const now = new Date();
  await db.transaction(async (tx) => {
    /* Таксова колона + updatedAt заедно; completedAt/returnedAt се пълнят точно веднъж. */
    const patch: { status: typeof parsed.data.status; updatedAt: Date; completedAt?: Date; returnedAt?: Date } = {
      status: parsed.data.status,
      updatedAt: now,
    };
    if (parsed.data.status === "completed" && !order.completedAt) patch.completedAt = now;
    if (parsed.data.status === "returned" && !order.returnedAt) patch.returnedAt = now;

    await tx.update(orders).set(patch).where(eq(orders.id, order.id));

    if (parsed.data.status === "cancelled" || parsed.data.status === "returned") {
      await restoreStock(tx, order.id);
    }

    /* Транзакционна такса: charge при завършване, credit при връщане (идемпотентно). */
    if (parsed.data.status === "completed") {
      await recordFeeCharge(tx, {
        id: order.id,
        shopId: order.shopId,
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        completedAt: order.completedAt ?? now,
      });
    }
    if (parsed.data.status === "returned") {
      await recordFeeCredit(tx, {
        id: order.id,
        shopId: order.shopId,
        returnedAt: order.returnedAt ?? now,
      });
    }

    /* Съществуваща логика: pending_payment→expired при cancelled (пази я, ако е там). */
    if (parsed.data.status === "cancelled" && order.status === "pending_payment") {
      await tx
        .update(paymentIntents)
        .set({ status: "expired", updatedAt: now })
        .where(eq(paymentIntents.orderId, order.id));
    }
  });
```

> Бележка: `order` идва от `db.query.orders.findFirst` по-горе — той вече носи `subtotalCents`, `discountCents`, `shopId`, `completedAt`, `returnedAt` (последните две са нови от Task 2). Ако findFirst-ът има `columns:` селект, добави тези полета.

- [ ] **Step 3: Провери, че findFirst връща нужните колони** — намери `const order = await db.query.orders.findFirst(...)` в `updateOrderStatus`:

Run: `grep -n "findFirst" src/actions/orders.ts | head`
Ако има `columns: {...}` — добави `subtotalCents: true, discountCents: true, completedAt: true, returnedAt: true, shopId: true`. Ако няма `columns` (връща всичко) → нищо за правене.

- [ ] **Step 4: Разшири verify скрипта** — в `scripts/verify-order-concurrency.mjs`, добави нов блок (преди финалния cleanup), който симулира начисляване:

```js
    // ---- Транзакционна такса: charge при completed, идемпотентност ----
    const [feeProduct] = await sql`
      insert into products (shop_id, name, slug, price_cents, stock, status)
      values (${shopId}, '__fee__', ${"__fee_" + Date.now()}, 2000, 10, 'active') returning id`;
    const [feeOrder] = await sql`
      insert into orders (shop_id, order_number, customer_name, customer_phone,
        shipping_name, shipping_price_cents, payment_name, payment_type,
        subtotal_cents, discount_cents, total_cents, status)
      values (${shopId}, ${770000 + Math.floor(Math.random()*9000)}, '__fee_o__', '+359888000000',
        'Куриер', 0, 'Наложен платеж', 'cod', 2000, 0, 2000, 'shipped') returning id`;
    // Симулирай двойно completing (както updateOrderStatus прави charge под транзакция)
    const doComplete = () => sql.begin(async (tx) => {
      await tx`update orders set status='completed', completed_at=now() where id=${feeOrder.id} and status != 'completed'`;
      await tx`insert into fee_events (shop_id, order_id, type, amount_cents, base_cents, occurred_at)
               values (${shopId}, ${feeOrder.id}, 'charge', 100, 2000, now())
               on conflict (order_id, type) do nothing`;
    });
    await Promise.all([doComplete(), doComplete()]);
    const [{ n: chargeCount }] = await sql`select count(*)::int as n from fee_events where order_id=${feeOrder.id} and type='charge'`;
    check("Такса: двойно completing → точно 1 charge (идемпотентност)", Number(chargeCount) === 1, `charges=${chargeCount}`);
    await sql`delete from fee_events where order_id=${feeOrder.id}`;
    await sql`delete from orders where id=${feeOrder.id}`;
    await sql`delete from products where id=${feeProduct.id}`;
```

- [ ] **Step 5: Run verify**

Run: `node --env-file=.env.local scripts/verify-order-concurrency.mjs`
Expected: всички стари проверки + „Такса: двойно completing → точно 1 charge" минават.

- [ ] **Step 6: Gate + commit**

```bash
pnpm check
git add src/actions/orders.ts scripts/verify-order-concurrency.mjs
git commit -m "feat(fee): charge при completed + credit при returned в updateOrderStatus (идемпотентно)"
```

---

## Task 5: Auto-complete cron (anti-gaming)

**Files:**
- Create: `src/app/api/cron/auto-complete-orders/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `AUTO_COMPLETE_DAYS` от `@/lib/fee`; `recordFeeCharge` от `@/db/queries/fees`; `ALLOWED_TRANSITIONS` няма нужда (директен shipped→completed).
- Produces: GET route, гарден с `CRON_SECRET`, който completing-ва заседнали `shipped` поръчки + начислява charge.

- [ ] **Step 1: Създай route-а** — `src/app/api/cron/auto-complete-orders/route.ts` (по модела на `expire-payments/route.ts`):

```ts
import { and, eq, lt } from "drizzle-orm";
import { db, orders } from "@/db";
import { recordFeeCharge } from "@/db/queries/fees";
import { AUTO_COMPLETE_DAYS } from "@/lib/fee";

export const dynamic = "force-dynamic";

/**
 * Anti-gaming: поръчки заседнали в `shipped` над AUTO_COMPLETE_DAYS → авто-completed
 * + charge. Иначе търговец би държал поръчки в shipped, за да избегне таксата.
 * Гарден с CRON_SECRET (Bearer). Идемпотентно: charge е onConflictDoNothing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - AUTO_COMPLETE_DAYS * 86_400_000);
  const stuck = await db
    .select({
      id: orders.id,
      shopId: orders.shopId,
      subtotalCents: orders.subtotalCents,
      discountCents: orders.discountCents,
    })
    .from(orders)
    .where(and(eq(orders.status, "shipped"), lt(orders.updatedAt, cutoff)));

  let completed = 0;
  for (const order of stuck) {
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ status: "completed", completedAt: now, updatedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "shipped")));
      await recordFeeCharge(tx, { ...order, completedAt: now });
    });
    completed++;
  }

  return Response.json({ completed });
}
```

- [ ] **Step 2: Добави cron в `vercel.json`** — в масива `crons`:

```json
{
  "crons": [
    { "path": "/api/cron/abandoned-carts", "schedule": "0 * * * *" },
    { "path": "/api/cron/expire-payments", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/auto-complete-orders", "schedule": "0 3 * * *" }
  ]
}
```

(Ежедневно в 03:00 UTC — заседналите се мерят в дни, ежедневна проверка стига.)

- [ ] **Step 3: Ръчна проверка на route-а (build compile)**

Run: `pnpm build 2>&1 | grep -E "auto-complete-orders|error" | head`
Expected: route-ът се билдва без грешка (виждаш го в route списъка, без error).

- [ ] **Step 4: Verify логиката** — добави в `scripts/verify-order-concurrency.mjs` кратка проверка, че стар shipped би бил хванат:

```js
    // ---- Auto-complete: shipped стар над cutoff се хваща ----
    const [oldShipped] = await sql`
      insert into orders (shop_id, order_number, customer_name, customer_phone,
        shipping_name, shipping_price_cents, payment_name, payment_type,
        subtotal_cents, discount_cents, total_cents, status, updated_at)
      values (${shopId}, ${790000 + Math.floor(Math.random()*9000)}, '__old__', '+359888000000',
        'Куриер', 0, 'Наложен платеж', 'cod', 1000, 0, 1000, 'shipped', now() - interval '40 days')
      returning id`;
    const [{ n }] = await sql`
      select count(*)::int as n from orders
      where status='shipped' and updated_at < now() - interval '30 days' and id=${oldShipped.id}`;
    check("Auto-complete: 40-дневен shipped попада в 30-дневния cutoff", Number(n) === 1);
    await sql`delete from orders where id=${oldShipped.id}`;
```

- [ ] **Step 5: Run verify + commit**

```bash
node --env-file=.env.local scripts/verify-order-concurrency.mjs
pnpm check
git add src/app/api/cron/auto-complete-orders/route.ts vercel.json scripts/verify-order-concurrency.mjs
git commit -m "feat(cron): auto-complete на заседнали shipped поръчки + charge (anti-gaming)"
```

---

## Task 6: Изтриване на `plan.ts` + нов `selling-gate.ts`

**Files:**
- Create: `src/lib/selling-gate.ts`, `src/lib/selling-gate.test.ts`
- Delete: `src/lib/plan.ts` (+ `src/lib/plan.test.ts` ако има)
- Modify: `src/actions/orders.ts`, `src/actions/products.ts`, `src/actions/billing.ts`, `src/app/(storefront)/s/[slug]/checkout/page.tsx`, `src/app/(storefront)/s/[slug]/layout.tsx`

**Interfaces:**
- Consumes: `hasOverdueFees`, `requiresCard` от `@/db/queries/fees`.
- Produces: `canAcceptOrders(shopId: string): Promise<boolean>` = `!hasOverdueFees(shopId) && !requiresCard(shopId)`.

> **⚠️ Зависимост:** `requiresCard` изисква Stripe проверка (default_payment_method). За да не блокира тази задача, `requiresCard` се въвежда като DB-only проверка ТУК (има ли charge + няма запазен stripeCustomerId с карта), а Stripe частта се дозавършва в Task 7. Виж Step 3.

- [ ] **Step 1: Write the failing test** — `src/lib/selling-gate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/queries/fees", () => ({
  hasOverdueFees: vi.fn(),
  requiresCard: vi.fn(),
}));

import { canAcceptOrders } from "./selling-gate";
import { hasOverdueFees, requiresCard } from "@/db/queries/fees";

describe("canAcceptOrders", () => {
  beforeEach(() => vi.resetAllMocks());

  it("true за нов магазин без такси и без изискана карта", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(false);
    vi.mocked(requiresCard).mockResolvedValue(false);
    expect(await canAcceptOrders("shop-1")).toBe(true);
  });

  it("false при просрочена фактура", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(true);
    vi.mocked(requiresCard).mockResolvedValue(false);
    expect(await canAcceptOrders("shop-1")).toBe(false);
  });

  it("false когато се изисква карта (след първа продажба)", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(false);
    vi.mocked(requiresCard).mockResolvedValue(true);
    expect(await canAcceptOrders("shop-1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/selling-gate.test.ts`
Expected: FAIL — "Failed to resolve ./selling-gate".

- [ ] **Step 3: Добави `requiresCard` (DB-only засега) в `fees.ts`** — в `src/db/queries/fees.ts`:

```ts
import { db, feeEvents, feeInvoices, subscriptions } from "@/db"; // добави subscriptions към импорта

/**
 * Card-gate: магазинът трябва да запази карта СЛЕД първата завършена продажба.
 * requiresCard = имало е ≥1 charge И няма запазена карта.
 * ЗАСЕГА (Task 6): „няма карта" = няма stripeCustomerId в subscriptions.
 * Task 7 надгражда с реалната Stripe default_payment_method проверка.
 */
export async function requiresCard(shopId: string): Promise<boolean> {
  const [charge] = await db
    .select({ id: feeEvents.id })
    .from(feeEvents)
    .where(and(eq(feeEvents.shopId, shopId), eq(feeEvents.type, "charge")))
    .limit(1);
  if (!charge) return false; // няма още таксуема продажба → карта не се иска
  const [sub] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.shopId, shopId))
    .limit(1);
  return !sub?.customerId; // няма Customer/карта → иска карта
}
```

- [ ] **Step 4: Създай `selling-gate.ts`** — `src/lib/selling-gate.ts`:

```ts
import { hasOverdueFees, requiresCard } from "@/db/queries/fees";

/**
 * Единственият checkout gate. Магазинът приема поръчки само ако:
 *  - няма просрочена такса (Gate 1), И
 *  - не се изисква карта след първата продажба (Gate 2 / card-gate).
 * Заменя стария plan.ts billingAllowsSelling/isShopActive изцяло.
 */
export async function canAcceptOrders(shopId: string): Promise<boolean> {
  const [overdue, needsCard] = await Promise.all([hasOverdueFees(shopId), requiresCard(shopId)]);
  return !overdue && !needsCard;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/lib/selling-gate.test.ts`
Expected: PASS.

- [ ] **Step 6: Мигрирай `createOrder` gate** — в `src/actions/orders.ts`, махни `import { isShopActive } from "@/lib/plan";` (ред 37), добави `import { canAcceptOrders } from "@/lib/selling-gate";`. Намери употребата на `isShopActive` в `createOrder` и я замени:

```ts
// беше: if (!(await isShopActive(shop.id, shop.createdAt))) { ...błок }
if (!(await canAcceptOrders(shop.id))) {
  return fail("Магазинът временно не приема поръчки.");
}
```

Run: `grep -n "isShopActive" src/actions/orders.ts` — потвърди, че няма останали.

- [ ] **Step 7: Мигрирай checkout page + layout** — в двата файла смени импорта и извикването:

`src/app/(storefront)/s/[slug]/checkout/page.tsx` (ред 10 + 34):
```ts
import { canAcceptOrders } from "@/lib/selling-gate"; // беше @/lib/plan isShopActive
// ...
    canAcceptOrders(shop.id), // беше isShopActive(shop.id, shop.createdAt)
```

`src/app/(storefront)/s/[slug]/layout.tsx` (ред 14 + 46): същата смяна.

- [ ] **Step 8: Мигрирай `products.ts`** — махни `import { getShopPlan, PLAN_LIMITS } from "@/lib/plan";` (ред 23) и премахни `maxProducts` enforce блоковете (редове ~161-164, 423-424, 532). Няма продуктов лимит вече.

Run: `grep -n "getShopPlan\|PLAN_LIMITS\|maxProducts" src/actions/products.ts`
Expected: нищо — всички премахнати.

- [ ] **Step 9: Мигрирай `billing.ts`** — махни `import { inSignupTrial } from "@/lib/plan";` (ред 8). В `getBillingStatus` (ред ~94) премахни `inSignupTrial` употребата; временно нека връща базов статус (Task 8 го пренаписва напълно). Минимална промяна, за да компилира:

```ts
// в getBillingStatus, замени inTrial логиката с прост placeholder до Task 8:
const inTrial = false;
```

- [ ] **Step 10: Изтрий `plan.ts`**

```bash
rm src/lib/plan.ts
rm -f src/lib/plan.test.ts
```

Run: `grep -rn 'from "@/lib/plan"' src`
Expected: нищо — всички вносители мигрирани.

- [ ] **Step 11: Gate + commit**

```bash
pnpm check
git add -A
git commit -m "refactor(gate): изтрий plan.ts → selling-gate.ts (canAcceptOrders) + card-gate DB част"
```

---

## Task 7: Card setup (SetupIntent) + пълен `requiresCard`

**Files:**
- Create: `src/actions/card-setup.ts`
- Modify: `src/db/queries/fees.ts` (`requiresCard` → реална Stripe проверка), `src/lib/stripe.ts` (helper за Customer)
- Modify: dashboard billing UI (компонент за „Запази карта")

**Interfaces:**
- Consumes: `stripe` от `@/lib/stripe`; `subscriptions.stripeCustomerId`.
- Produces:
  - `createSetupIntent(): Promise<ActionResult<{ clientSecret: string }>>` — създава/намира Customer + SetupIntent.
  - `requiresCard` надградена: проверява реалния `default_payment_method` в Stripe.

- [ ] **Step 1: Helpers за Customer** — `billing.ts` вече има `ensureCustomer(shopId, email, name): Promise<string>` (ред 19; намира/създава Customer + пази `subscriptions.stripeCustomerId`; `subscriptions` има unique на shopId — `subscriptions_shop_idx`). **Извади го в `src/lib/stripe.ts`** като споделен `ensureStripeCustomer(shopId, email, name)` (премести тялото както е), за да го ползват и card-setup, и billing cron. Импортирай го обратно в `billing.ts`. Добави и:

```ts
/** Има ли Customer запазена default карта? */
export async function customerHasDefaultCard(customerId: string): Promise<boolean> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return false;
  return Boolean(customer.invoice_settings?.default_payment_method);
}
```

> Ключово: НЕ пиши нов Customer helper — преизползвай съществуващия `ensureCustomer` от `billing.ts` (само го премести в `stripe.ts` и преименувай на `ensureStripeCustomer` с 3 аргумента: `shopId, email, name`).

- [ ] **Step 2: SetupIntent action** — `src/actions/card-setup.ts`. `requireShop()` връща `{ user, shop }` (НЕ приема callback); резултатът ползва `ok`/`fail` от `@/lib/action-result`:

```ts
"use server";

import { requireShop } from "@/lib/auth";
import { stripe, ensureStripeCustomer } from "@/lib/stripe";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/** Създава SetupIntent за запазване на карта (SCA-съвместимо, без реално теглене). */
export async function createSetupIntent(): Promise<ActionResult<{ clientSecret: string }>> {
  try {
    const { user, shop } = await requireShop();
    const customerId = await ensureStripeCustomer(shop.id, user.email ?? "", shop.name);
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session", // за бъдещо авто-теглене
    });
    if (!intent.client_secret) return fail("Неуспешно създаване на заявка за карта.");
    return ok({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error("createSetupIntent се провали:", error);
    return fail("Възникна грешка. Опитай пак.");
  }
}
```

> `ok(data)` / `fail(msg)` са helpers от `@/lib/action-result` (виж как ги ползват другите actions, напр. `src/actions/billing.ts`). `requireShop` пренасочва към onboarding, ако няма магазин — затова try/catch хваща само реални грешки.

- [ ] **Step 3: Надгради `requiresCard`** — в `src/db/queries/fees.ts`, замени DB-only частта с реалната Stripe проверка:

```ts
import { customerHasDefaultCard } from "@/lib/stripe";

export async function requiresCard(shopId: string): Promise<boolean> {
  const [charge] = await db
    .select({ id: feeEvents.id })
    .from(feeEvents)
    .where(and(eq(feeEvents.shopId, shopId), eq(feeEvents.type, "charge")))
    .limit(1);
  if (!charge) return false;
  const [sub] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.shopId, shopId))
    .limit(1);
  if (!sub?.customerId) return true; // има charge, няма Customer → иска карта
  return !(await customerHasDefaultCard(sub.customerId)); // има Customer но без карта → иска
}
```

- [ ] **Step 4: Dashboard UI за запазване на карта** — намери dashboard billing секцията (`grep -rln "getBillingStatus\|billing" src/app/\(dashboard\)`). Добави компонент, който при `requiresCard` показва Stripe Elements карта форма, вика `createSetupIntent`, потвърждава с `stripe.confirmCardSetup(clientSecret)`. Текст на български: „Запази карта, за да приемаш нови поръчки." (Точната композиция зависи от съществуващия dashboard layout — следвай pattern-а на другите dashboard форми с `useActionState`.)

- [ ] **Step 5: Gate + commit**

```bash
pnpm check
git add -A
git commit -m "feat(card): SetupIntent flow + реален requiresCard (Stripe default_payment_method)"
```

---

## Task 8: Месечно фактуриране (billing cron + Stripe + webhook)

**Files:**
- Create: `src/app/api/cron/bill-fees/route.ts`
- Modify: `vercel.json`, `src/app/api/webhooks/stripe/route.ts`, `src/actions/billing.ts`
- Modify: `src/db/queries/fees.ts` (helper `recordInvoiceForPeriod`)

**Interfaces:**
- Consumes: `getBillableBalanceForPeriod` от `@/db/queries/fees`; `stripe`, `ensureStripeCustomer` от `@/lib/stripe`.
- Produces: месечен cron, който за всеки магазин смята баланса, записва `fee_invoices` (идемпотентно), издава Stripe фактура с `charge_automatically`.

- [ ] **Step 1: Helper за фактурен запис** — в `src/db/queries/fees.ts`:

```ts
/** Идемпотентно записва фактурен ред за периода. Връща реда (нов или съществуващ). */
export async function recordInvoiceForPeriod(
  shopId: string,
  periodStart: Date,
  periodEnd: Date,
  balance: { chargesCents: number; creditsCents: number; amountDueCents: number },
) {
  await db
    .insert(feeInvoices)
    .values({
      shopId,
      periodStart,
      periodEnd,
      chargesCents: balance.chargesCents,
      creditsCents: balance.creditsCents,
      amountDueCents: balance.amountDueCents,
      status: "draft",
    })
    .onConflictDoNothing({ target: [feeInvoices.shopId, feeInvoices.periodStart] });
  const [row] = await db
    .select()
    .from(feeInvoices)
    .where(and(eq(feeInvoices.shopId, shopId), eq(feeInvoices.periodStart, periodStart)))
    .limit(1);
  return row;
}

/** Маркира фактура като issued + пази Stripe id. */
export async function markInvoiceIssued(id: string, stripeInvoiceId: string) {
  await db
    .update(feeInvoices)
    .set({ status: "issued", stripeInvoiceId, updatedAt: new Date() })
    .where(eq(feeInvoices.id, id));
}
```

- [ ] **Step 2: Billing cron** — `src/app/api/cron/bill-fees/route.ts`:

```ts
import { db, shops } from "@/db";
import {
  getBillableBalanceForPeriod,
  recordInvoiceForPeriod,
  markInvoiceIssued,
} from "@/db/queries/fees";
import { stripe, ensureStripeCustomer } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Периодът на ИЗМИНАЛИЯ календарен месец (UTC). */
function previousMonthUtc(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // now се подава externally безопасно; тук ползваме реалното време на cron изпълнението.
  const now = new Date();
  const { start, end } = previousMonthUtc(now);

  const allShops = await db.select({ id: shops.id, ownerId: shops.ownerId, name: shops.name }).from(shops);
  let issued = 0;

  for (const shop of allShops) {
    const balance = await getBillableBalanceForPeriod(shop.id, start, end);
    const invoice = await recordInvoiceForPeriod(shop.id, start, end, balance);
    if (!invoice || invoice.status !== "draft" || invoice.amountDueCents <= 0) continue;

    /* Имейлът на собственика е в Supabase auth.users (не в profiles) → admin API по ownerId. */
    const admin = createSupabaseAdmin();
    const { data: authUser } = await admin.auth.admin.getUserById(shop.ownerId);
    const email = authUser?.user?.email ?? "";

    const customerId = await ensureStripeCustomer(shop.id, email, shop.name);

    await stripe.invoiceItems.create({
      customer: customerId,
      amount: invoice.amountDueCents,
      currency: "eur",
      description: `Такса за продажби (${start.toISOString().slice(0, 7)})`,
    });
    const stripeInvoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: "charge_automatically",
      auto_advance: true,
      metadata: { app: "frizmo-shops", feeInvoiceId: invoice.id },
    });
    await markInvoiceIssued(invoice.id, stripeInvoice.id!);
    issued++;
  }

  return Response.json({ issued });
}
```

> `createSupabaseAdmin` от `@/lib/supabase/admin` (server-only, `SUPABASE_SECRET_KEY`) — единственият начин да достигнеш имейла на собственика (`profiles` няма email колона; той е в `auth.users`). Добави импорта: `import { createSupabaseAdmin } from "@/lib/supabase/admin";`. Ако admin извикването на всеки магазин е скъпо при много магазини — batch-ни ги, но за старта per-shop е ок.

- [ ] **Step 3: Добави cron в `vercel.json`** — първо число на месеца, 04:00 UTC:

```json
{ "path": "/api/cron/bill-fees", "schedule": "0 4 1 * *" }
```

- [ ] **Step 4: Webhook обработка** — в `src/app/api/webhooks/stripe/route.ts`, разшири `invoice.paid`/`invoice.payment_failed` case-а (ред ~84), да обновява `fee_invoices` по `metadata.feeInvoiceId`:

```ts
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const feeInvoiceId = invoice.metadata?.feeInvoiceId;
      if (feeInvoiceId) {
        const newStatus = event.type === "invoice.paid" ? "paid" : "issued";
        await db
          .update(feeInvoices)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(feeInvoices.id, feeInvoiceId));
      }
      // (запази съществуващата subscription логика, ако има такава за invoice-и без feeInvoiceId)
      break;
    }
```

Добави `feeInvoices` към импорта от `@/db` в webhook файла.

- [ ] **Step 5: Пренапиши `getBillingStatus` в `billing.ts`** — да връща реалния таксов статус (фактури + дали се изисква карта) вместо trial/plan. Махни subscription checkout (`createCheckoutSession`/`createPortalSession` за subscription mode). Точната нова форма зависи от dashboard UI нуждите — минимум: върни `getFeeInvoices(shop.id)` + `requiresCard(shop.id)`.

- [ ] **Step 6: Build + commit**

```bash
pnpm check
git add -A
git commit -m "feat(billing): месечен fee cron + Stripe авто-теглене + webhook fee_invoices"
```

---

## Task 9: Легални + маркетинг текстове + ADR

**Files:**
- Modify: `src/lib/platform-legal.ts:27`, `src/app/(marketing)/page.tsx` (ред 62 FAQ + 27/162/187 hero), `src/lib/plans-content.ts:46`
- Create: `docs/decisions/2026-07-23-transaction-fee-monetization.md`

**Interfaces:** само текст — няма нови функции.

- [ ] **Step 1: Пренапиши правния текст** — `src/lib/platform-legal.ts:27`, смени „Платформата не удържа комисиони от продажбите на търговеца" на коректно описание:

```ts
"Платформата удържа такса от 5% върху стойността на всяка реализирана продажба (минимум 0.30 €, максимум 50 € на поръчка), фактурирана месечно. Таксата се начислява при завършена поръчка; при прието връщане се възстановява като кредит в следваща фактура.",
```

(Съгласувай точната формулировка с `docs/bulgarian-lang-guide.md` — типографски кавички, тон „на ти").

- [ ] **Step 2: Пренапиши FAQ + hero** — `src/app/(marketing)/page.tsx`:
  - FAQ (ред ~62): „Има ли комисиона? Не." → „Има ли такса? Регистрацията и месечният абонамент са безплатни. Взимаме 5% при реална продажба (мин. 0.30 €, макс. 50 € на поръчка) — плащаш само когато и ти печелиш."
  - Hero (редове 27/162/187): махни „Без комисиони" бадж/текст; замени с неутрално предимство („Безплатен старт" / „Плащаш при продажба"). НЕ набивай таксата в hero — само маха фалшивото обещание.

- [ ] **Step 3: Плановите карти** — `src/lib/plans-content.ts:46` (trust strip) + плановите карти: премахни Starter/Pro ценовите нива; един безплатен план „0 €/мес. + 5% при продажба".

- [ ] **Step 4: Напиши ADR** — `docs/decisions/2026-07-23-transaction-fee-monetization.md`:

```markdown
# ADR: Транзакционна такса вместо flat абонамент

**Дата:** 2026-07-23
**Статус:** Прието

## Контекст
MVP решението (2026-07-02) обеща „без комисиона" + flat абонамент Starter 10€ / Pro 20€.
0 регистрирани търговци → входната бариера (плащане отпред) вреди на adoption.

## Решение
Безплатен вход + такса на транзакция: 5% върху стоката (subtotal−discount), мин 0.30€,
таван 50€, фактурирана месечно през Stripe авто-теглене (Модел А — парите не минават
през платформата). Планове изобщо няма. Card-gate след първата продажба. Immutable
fee ledger за възпроизводимост. Пълен дизайн: specs/2026-07-23-transaction-fee-monetization-design.md.

## Последици
- „Без комисиона" обещанието се оттегля (0 търговци → без grandfather).
- plan.ts се изтрива; selling-gate.ts го заменя.
- Приход align-нат с реалните продажби на търговеца.
```

- [ ] **Step 5: Gate + commit**

```bash
pnpm check
git add -A
git commit -m "docs+copy: транзакционна такса — легални/маркетинг текстове + ADR"
```

---

## Финална верификация (след всички задачи)

- [ ] `pnpm check` — 478+ теста зелени, lint чист, build ок.
- [ ] `node --env-file=.env.local scripts/verify-order-concurrency.mjs` — всички проверки (вкл. новите fee) минават.
- [ ] `grep -rn 'from "@/lib/plan"' src` — празно (plan.ts напълно премахнат).
- [ ] Визуална проверка на dashboard billing (карта форма) + landing (нови текстове, без „без комисиона").
- [ ] **Прод db:push** — таргетиран SQL за `fee_events`/`fee_invoices`/`orders.completedAt`/`returnedAt` (НЕ drizzle push; пази pg_trgm; `verify-schema-parity.mjs`).
- [ ] Push разрешение от потребителя преди dev/main.
- [ ] Stripe live ресурси (webhook secret за fee invoices) + Vercel env — отделна външна стъпка.
