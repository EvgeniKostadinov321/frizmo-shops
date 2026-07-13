# Глобален купувачески профил — имплементационен план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline изпълнение). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Купувачът има един глобален профил `/account` (всички поръчки/любими от всички магазини), любими магазини, изтриване на акаунт, профил икона в каталога/landing.

**Architecture:** Надгражда съществуващия per-магазин профил (вече на dev). Нов платформен route `/account` (route група `(catalog)`, платформени токени). Нова таблица `buyerFavoriteShops`. Глобални query варианти (без `shopId` филтър). Старите `/s/{slug}/account/*` → redirect. Профил икона в `SiteHeader`.

**Tech Stack:** Next.js 16 App Router, Supabase Auth (+ admin за delete), Drizzle (`db:push`), Zod, Tailwind 4 (платформени токени `ink-*`/`surface-*`/`brand-*`), Vitest, Playwright, pnpm.

## Global Constraints

- Спец: `docs/superpowers/specs/2026-07-13-global-buyer-account-design.md` (одобрен 2026-07-13); ADR `docs/decisions/2026-07-13-global-buyer-account.md`.
- Изолация правило №1: всяка купувачка заявка/мутация филтрира по `buyerId = profile.id`; cross-buyer теч = критичен бъг.
- Мутации САМО в `src/actions/`; всяка минава през `requireBuyer()` + Zod + санитизация.
- `/account` е **платформена** страница → токени `ink-*`/`surface-*`/`brand-*`/`danger-*`, компоненти от `@/components/ui` (Button/Input/Tabs/Drawer/ConfirmDialog/EmptyState). НЕ `--sf-*`.
- `"use server"` файл експортира САМО async функции (чистите → `src/lib/`).
- Тестове живеят до кода (`src/**/*.test.ts`), НЕ в `tests/`. Единичен тест: `npx vitest run <path>`.
- UI текстове на български с типографски кавички „…“ (прав `"` чупи lint/JS).
- `db:push`: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push` (drizzle-kit не чете `.env.local` сам).
- Нови таблици `.enableRLS()`. Нови колони/таблици nullable/нови → безопасен push.
- Гейт преди всеки commit: `pnpm check`. Push към `dev` (=prod) само след разрешение — НЕ в плана.
- Изтриване: анонимизира поръчките (`buyerId→null`, НЕ ги трие); гард за продавачи (има магазин → отказ).
- `z.uuid()` отхвърля невалидни placeholder UUID → в тестове реални v4 UUID.

## Файлова структура

**Създаваме:**
- `src/db/queries/buyer-global.ts` — глобални заявки (поръчки/любими продукти/любими магазини)
- `src/app/(catalog)/account/layout.tsx` + `page.tsx` + `orders/page.tsx` + `favorites/page.tsx` + `addresses/page.tsx` + `settings/page.tsx`
- `src/components/account/` — платформени профил компоненти (nav, address-manager, settings-form, delete-account, favorites-tabs, link-orders-banner)
- `src/components/storefront/shop-favorite-button.tsx` — сърце на магазина (storefront хедър)
- `src/components/marketing/shop-favorite-heart.tsx` — сърце на каталог картата

**Модифицираме:**
- `src/db/schema.ts` — таблица `buyerFavoriteShops`
- `src/actions/buyer.ts` — `toggleFavoriteShop`, `deleteBuyerAccount`
- `src/lib/account-deletion.ts` — `confirmDeleteWord`
- `src/lib/auth-redirect.ts` — купувач без next → `/account`
- `src/lib/auth-redirect.test.ts` — обновен
- `src/components/marketing/site-header.tsx` — `loggedIn` prop + профил икона
- `src/app/(catalog)/layout.tsx` + `src/app/(marketing)/layout.tsx` — подават `loggedIn`
- `src/components/storefront/header/shared.tsx` — `AccountButton` → глобален `/account`
- `src/app/(storefront)/s/[slug]/account/*` — → redirect
- `src/components/marketing/shop-card.tsx` — сърце (по избор prop)
- e2e: `e2e/buyer-account.spec.ts` (разширяваме) или нов `e2e/global-account.spec.ts`

---

### Task 1: Схема — `buyerFavoriteShops`

**Files:**
- Modify: `src/db/schema.ts` (до `buyerFavorites`, ~ред 787)
- Test: `src/db/buyer-favorite-shops-schema.test.ts`

**Interfaces:**
- Produces: таблица `buyerFavoriteShops`; тип `BuyerFavoriteShop = typeof buyerFavoriteShops.$inferSelect`.

- [ ] **Step 1: Write the failing test**

`src/db/buyer-favorite-shops-schema.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buyerFavoriteShops } from "@/db";

describe("buyerFavoriteShops схема", () => {
  it("има buyerId + shopId", () => {
    expect(buyerFavoriteShops.buyerId).toBeDefined();
    expect(buyerFavoriteShops.shopId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/buyer-favorite-shops-schema.test.ts`
Expected: FAIL — `buyerFavoriteShops` undefined.

- [ ] **Step 3: Add the table**

В `src/db/schema.ts`, веднага след дефиницията на `buyerFavorites` (търси `export const buyerFavorites = pgTable(`), добави:
```ts
/* S3-глобален: любими МАГАЗИНИ per-акаунт (по аналогия с buyerFavorites за продукти). */
export const buyerFavoriteShops = pgTable(
  "buyer_favorite_shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("buyer_favorite_shops_uid").on(t.buyerId, t.shopId),
    index("buyer_favorite_shops_buyer_idx").on(t.buyerId),
  ],
).enableRLS();
```
И при типовете (до `export type BuyerFavorite = ...`):
```ts
export type BuyerFavoriteShop = typeof buyerFavoriteShops.$inferSelect;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/buyer-favorite-shops-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply schema**

Run: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push`
Expected: „Changes applied" (нова таблица + 2 индекса).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/buyer-favorite-shops-schema.test.ts
git commit -m "feat(buyer): схема — buyer_favorite_shops (любими магазини)"
```

---

### Task 2: `confirmDeleteWord` (чиста функция)

**Files:**
- Modify: `src/lib/account-deletion.ts`
- Test: `src/lib/account-deletion.test.ts` (съществува — добавяме describe)

**Interfaces:**
- Produces: `confirmDeleteWord(input: string): boolean` — true само при `input.trim().toUpperCase() === "ИЗТРИЙ"`.

- [ ] **Step 1: Write the failing test (добави към съществуващия файл)**

В `src/lib/account-deletion.test.ts` добави:
```ts
import { confirmDeleteWord } from "@/lib/account-deletion";

describe("confirmDeleteWord", () => {
  it("приема ИЗТРИЙ (главни)", () => expect(confirmDeleteWord("ИЗТРИЙ")).toBe(true));
  it("приема с интервали и малки букви", () => expect(confirmDeleteWord("  изтрий ")).toBe(true));
  it("отхвърля празно", () => expect(confirmDeleteWord("")).toBe(false));
  it("отхвърля друга дума", () => expect(confirmDeleteWord("изтриване")).toBe(false));
});
```
(Ако файлът няма `import { describe, expect, it }` за новите — provери; съществуващият го има.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/account-deletion.test.ts`
Expected: FAIL — `confirmDeleteWord` не е експортната.

- [ ] **Step 3: Implement**

В `src/lib/account-deletion.ts` добави:
```ts
/**
 * Купувачко изтриване: потвърждението трябва да е думата „ИЗТРИЙ" (регистър и
 * интервали без значение). Купувачът няма магазин → не ползваме confirmNameMatches.
 */
export function confirmDeleteWord(input: string): boolean {
  return input.trim().toUpperCase() === "ИЗТРИЙ";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/account-deletion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/account-deletion.ts src/lib/account-deletion.test.ts
git commit -m "feat(buyer): confirmDeleteWord (потвърждение с „ИЗТРИЙ")"
```

---

### Task 3: Глобални queries (`src/db/queries/buyer-global.ts`)

**Files:**
- Create: `src/db/queries/buyer-global.ts`
- Test: `src/db/queries/buyer-global.test.ts`

**Interfaces:**
- Consumes: `db`, `orders`, `shops`, `products`, `buyerFavorites`, `buyerFavoriteShops` (`@/db`).
- Produces:
  - `getBuyerOrdersGlobal(buyerId): Promise<Array<Order & { shopName: string; shopSlug: string }>>`
  - `getBuyerFavoriteProductsGlobal(buyerId): Promise<Array<Product & { shopName: string; shopSlug: string }>>`
  - `getBuyerFavoriteShopsList(buyerId): Promise<Shop[]>`
  - `getBuyerFavoriteShopIds(buyerId): Promise<string[]>`

- [ ] **Step 1: Write the failing test**

`src/db/queries/buyer-global.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

const { ordersFindMany, favShopFindMany } = vi.hoisted(() => ({
  ordersFindMany: vi.fn().mockResolvedValue([]),
  favShopFindMany: vi.fn().mockResolvedValue([{ shopId: "s1" }]),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: () => [] }) }) }) }),
    query: {
      orders: { findMany: ordersFindMany },
      buyerFavoriteShops: { findMany: favShopFindMany },
    },
  },
  orders: { buyerId: "buyerId", shopId: "shopId", createdAt: "createdAt" },
  shops: { id: "id", name: "name", slug: "slug" },
  products: { id: "id", shopId: "shopId", status: "status" },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" },
  buyerFavoriteShops: { buyerId: "buyerId", shopId: "shopId" },
}));

import { getBuyerFavoriteShopIds } from "@/db/queries/buyer-global";

describe("buyer-global queries", () => {
  it("getBuyerFavoriteShopIds връща само shopId-тата", async () => {
    const ids = await getBuyerFavoriteShopIds("b1");
    expect(ids).toEqual(["s1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/queries/buyer-global.test.ts`
Expected: FAIL — модулът липсва.

- [ ] **Step 3: Implement**

`src/db/queries/buyer-global.ts`:
```ts
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  buyerFavoriteShops,
  buyerFavorites,
  db,
  orders,
  products,
  shops,
  type Order,
  type Product,
  type Shop,
} from "@/db";

/** ВСИЧКИ поръчки на купувача (всички магазини), най-новите първи, с име/slug на магазина. */
export async function getBuyerOrdersGlobal(
  buyerId: string,
): Promise<Array<Order & { shopName: string; shopSlug: string }>> {
  const rows = await db
    .select({ order: orders, shopName: shops.name, shopSlug: shops.slug })
    .from(orders)
    .innerJoin(shops, eq(orders.shopId, shops.id))
    .where(eq(orders.buyerId, buyerId))
    .orderBy(desc(orders.createdAt));
  return rows.map((r) => ({ ...r.order, shopName: r.shopName, shopSlug: r.shopSlug }));
}

/** Всички любими продукти (активни) с магазина им. */
export async function getBuyerFavoriteProductsGlobal(
  buyerId: string,
): Promise<Array<Product & { shopName: string; shopSlug: string }>> {
  const favs = await db.query.buyerFavorites.findMany({
    where: eq(buyerFavorites.buyerId, buyerId),
    columns: { productId: true },
  });
  const ids = favs.map((f) => f.productId);
  if (ids.length === 0) return [];
  const rows = await db
    .select({ product: products, shopName: shops.name, shopSlug: shops.slug })
    .from(products)
    .innerJoin(shops, eq(products.shopId, shops.id))
    .where(and(inArray(products.id, ids), eq(products.status, "active")));
  return rows.map((r) => ({ ...r.product, shopName: r.shopName, shopSlug: r.shopSlug }));
}

/** Любимите магазини на купувача (пълни редове). */
export async function getBuyerFavoriteShopsList(buyerId: string): Promise<Shop[]> {
  const rows = await db
    .select({ shop: shops })
    .from(buyerFavoriteShops)
    .innerJoin(shops, eq(buyerFavoriteShops.shopId, shops.id))
    .where(eq(buyerFavoriteShops.buyerId, buyerId))
    .orderBy(desc(buyerFavoriteShops.createdAt));
  return rows.map((r) => r.shop);
}

/** ID-тата на любимите магазини (за сърце състоянието). */
export async function getBuyerFavoriteShopIds(buyerId: string): Promise<string[]> {
  const rows = await db.query.buyerFavoriteShops.findMany({
    where: eq(buyerFavoriteShops.buyerId, buyerId),
    columns: { shopId: true },
  });
  return rows.map((r) => r.shopId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/queries/buyer-global.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/buyer-global.ts src/db/queries/buyer-global.test.ts
git commit -m "feat(buyer): глобални queries — поръчки/любими продукти/магазини"
```

---

### Task 4: `toggleFavoriteShop` мутация

**Files:**
- Modify: `src/actions/buyer.ts`
- Test: `src/actions/buyer-favorite-shop.test.ts`

**Interfaces:**
- Consumes: `requireBuyer()`, `buyerFavoriteShops`, `db`.
- Produces: `toggleFavoriteShop(shopId): Promise<ActionResult<{ favorited: boolean }>>`.

- [ ] **Step 1: Write the failing test**

`src/actions/buyer-favorite-shop.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, findFirst, insertValues } = vi.hoisted(() => ({
  requireBuyer: vi.fn(),
  findFirst: vi.fn(),
  insertValues: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("@/lib/auth", () => ({ requireBuyer }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));
vi.mock("@/db/queries/buyer", () => ({ getBuyerFavoriteIds: vi.fn(), countGuestOrdersByPhone: vi.fn() }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
    query: { buyerFavoriteShops: { findFirst } },
  },
  buyerFavoriteShops: { buyerId: "buyerId", shopId: "shopId" },
  buyerFavorites: {}, buyerAddresses: {}, profiles: {}, orders: {},
}));

import { requireBuyer as rb } from "@/lib/auth";
import { toggleFavoriteShop } from "@/actions/buyer";

const SHOP = "4e44b8df-51e0-4dfa-b8f4-acd59307efa5";

describe("toggleFavoriteShop", () => {
  beforeEach(() => {
    (rb as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" }, profile: { id: "b1" },
    });
    findFirst.mockReset();
  });
  it("добавя когато липсва", async () => {
    findFirst.mockResolvedValue(undefined);
    const res = await toggleFavoriteShop(SHOP);
    expect(res.ok && res.data.favorited).toBe(true);
  });
  it("маха когато има", async () => {
    findFirst.mockResolvedValue({ id: "f1", buyerId: "b1", shopId: SHOP });
    const res = await toggleFavoriteShop(SHOP);
    expect(res.ok && res.data.favorited).toBe(false);
  });
  it("отхвърля невалиден shopId", async () => {
    const res = await toggleFavoriteShop("bad");
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/actions/buyer-favorite-shop.test.ts`
Expected: FAIL — `toggleFavoriteShop` липсва.

- [ ] **Step 3: Implement (append to `src/actions/buyer.ts`)**

Добави `buyerFavoriteShops` към импорта от `@/db` (реда `import { buyerAddresses, buyerFavorites, db, orders, profiles } from "@/db";` → добави `buyerFavoriteShops`). После:
```ts
/** Добавя/маха магазин от любимите на купувача (own синхрон). */
export async function toggleFavoriteShop(
  shopId: string,
): Promise<ActionResult<{ favorited: boolean }>> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(shopId).success) return fail("Невалидна заявка.");
  const existing = await db.query.buyerFavoriteShops.findFirst({
    where: and(eq(buyerFavoriteShops.buyerId, profile.id), eq(buyerFavoriteShops.shopId, shopId)),
  });
  if (existing) {
    await db
      .delete(buyerFavoriteShops)
      .where(and(eq(buyerFavoriteShops.buyerId, profile.id), eq(buyerFavoriteShops.shopId, shopId)));
    return ok({ favorited: false });
  }
  await db.insert(buyerFavoriteShops).values({ buyerId: profile.id, shopId }).onConflictDoNothing();
  return ok({ favorited: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/actions/buyer-favorite-shop.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/actions/buyer.ts src/actions/buyer-favorite-shop.test.ts
git commit -m "feat(buyer): toggleFavoriteShop мутация (own)"
```

---

### Task 5: `deleteBuyerAccount` мутация

**Files:**
- Modify: `src/actions/buyer.ts`
- Test: `src/actions/buyer-delete.test.ts`

**Interfaces:**
- Consumes: `requireBuyer()`, `getOwnShop`-подобен гард (`shops.ownerId`), `confirmDeleteWord`, `createSupabaseAdmin`, `createSupabaseServer`, `orders`, `buyerAddresses`, `buyerFavorites`, `buyerFavoriteShops`, `profiles`.
- Produces: `deleteBuyerAccount(rawInput): Promise<ActionResult<null>>` — анонимизира поръчки, трие own данни + auth юзъра; гард: има магазин → отказ.

- [ ] **Step 1: Write the failing test**

`src/actions/buyer-delete.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, shopFindFirst, updateWhere, deleteWhere, deleteUser, signOut } = vi.hoisted(() => ({
  requireBuyer: vi.fn(),
  shopFindFirst: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
  deleteWhere: vi.fn().mockResolvedValue(undefined),
  deleteUser: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({ requireBuyer }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({ auth: { admin: { deleteUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: async () => ({ auth: { signOut } }),
}));
vi.mock("@/db", () => ({
  db: {
    query: { shops: { findFirst: shopFindFirst } },
    update: () => ({ set: () => ({ where: updateWhere }) }),
    delete: () => ({ where: deleteWhere }),
  },
  shops: { ownerId: "ownerId" },
  orders: { buyerId: "buyerId" },
  buyerAddresses: { buyerId: "buyerId" },
  buyerFavorites: { buyerId: "buyerId" },
  buyerFavoriteShops: { buyerId: "buyerId" },
  profiles: { id: "id" },
}));

import { requireBuyer as rb } from "@/lib/auth";
import { deleteBuyerAccount } from "@/actions/buyer";

describe("deleteBuyerAccount", () => {
  beforeEach(() => {
    (rb as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" }, profile: { id: "b1" },
    });
    shopFindFirst.mockReset();
    deleteUser.mockClear();
  });

  it("отхвърля грешна потвърдителна дума", async () => {
    shopFindFirst.mockResolvedValue(undefined);
    const res = await deleteBuyerAccount({ confirm: "не" });
    expect(res.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("гард: има магазин → отказ", async () => {
    shopFindFirst.mockResolvedValue({ id: "shop1" });
    const res = await deleteBuyerAccount({ confirm: "ИЗТРИЙ" });
    expect(res.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("валидно → трие auth юзъра", async () => {
    shopFindFirst.mockResolvedValue(undefined);
    const res = await deleteBuyerAccount({ confirm: "ИЗТРИЙ" });
    expect(res.ok).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("b1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/actions/buyer-delete.test.ts`
Expected: FAIL — `deleteBuyerAccount` липсва.

- [ ] **Step 3: Implement (append to `src/actions/buyer.ts`)**

Добави импорти: `buyerFavoriteShops`, `shops` (към `@/db`), `confirmDeleteWord` (`@/lib/account-deletion`), `createSupabaseAdmin` (`@/lib/supabase/admin`), `createSupabaseServer` (`@/lib/supabase/server`).
```ts
import { shops } from "@/db"; // (добави към съществуващия @/db импорт)
import { confirmDeleteWord } from "@/lib/account-deletion";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
```
Функцията:
```ts
/**
 * Изтрива купувачки акаунт: анонимизира поръчките (buyerId→null — търговецът ги пази),
 * трие адреси/любими/любими магазини + Supabase auth юзъра. Гард: акаунт с магазин
 * НЕ се трие оттук (иска триене на магазина първо). Потвърждение с думата „ИЗТРИЙ".
 */
export async function deleteBuyerAccount(rawInput: unknown): Promise<ActionResult<null>> {
  const { user, profile } = await requireBuyer();
  const parsed = z.object({ confirm: z.string().min(1).max(40) }).safeParse(rawInput);
  if (!parsed.success || !confirmDeleteWord(parsed.data.confirm)) {
    return fail("Напиши „ИЗТРИЙ" за потвърждение.");
  }
  const ownShop = await db.query.shops.findFirst({
    where: eq(shops.ownerId, user.id),
    columns: { id: true },
  });
  if (ownShop) {
    return fail("Имаш магазин — изтрий първо него от настройките на магазина.");
  }
  try {
    /* 1) Анонимизирай поръчките (търговецът ги пази за счетоводство). */
    await db.update(orders).set({ buyerId: null, updatedAt: new Date() }).where(eq(orders.buyerId, profile.id));
    /* 2) Изтрий купувачките данни. */
    await db.delete(buyerAddresses).where(eq(buyerAddresses.buyerId, profile.id));
    await db.delete(buyerFavorites).where(eq(buyerFavorites.buyerId, profile.id));
    await db.delete(buyerFavoriteShops).where(eq(buyerFavoriteShops.buyerId, profile.id));
    await db.delete(profiles).where(eq(profiles.id, profile.id));
    /* 3) Изтрий auth юзъра (best-effort). */
    const admin = createSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) console.error(JSON.stringify({ scope: "delete-buyer", userId: user.id, error: error.message }));
    /* 4) Изчисти сесията. */
    try {
      const supabase = await createSupabaseServer();
      await supabase.auth.signOut();
    } catch {
      /* игнорирай */
    }
    return ok(null);
  } catch (e) {
    console.error(JSON.stringify({ scope: "delete-buyer", userId: user.id, error: String(e) }));
    return fail("Изтриването не бе успешно. Опитай пак.");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/actions/buyer-delete.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/actions/buyer.ts src/actions/buyer-delete.test.ts
git commit -m "feat(buyer): deleteBuyerAccount (анонимизира поръчки + гард за продавачи)"
```

---

### Task 6: Redirect купувач → `/account`

**Files:**
- Modify: `src/lib/auth-redirect.ts`
- Modify: `src/lib/auth-redirect.test.ts`
- Modify: `src/components/auth/auth-form.tsx` (Google fallback `/shops` → `/account`)

**Interfaces:**
- Produces: `resolvePostAuthPath(hasShop, preferredRole, next?)` — купувач без next → `/account`.

- [ ] **Step 1: Update the test**

В `src/lib/auth-redirect.test.ts` замени двата купувачки теста:
```ts
  it("купувач без магазин → /account (или валиден next)", () => {
    expect(resolvePostAuthPath(false, "buyer")).toBe("/account");
    expect(resolvePostAuthPath(false, "buyer", "/s/shop/checkout")).toBe("/s/shop/checkout");
  });
  it("непознат next се пренебрегва (open-redirect гард)", () => {
    expect(resolvePostAuthPath(false, "buyer", "https://evil.com")).toBe("/account");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth-redirect.test.ts`
Expected: FAIL (връща `/shops`, очаква `/account`).

- [ ] **Step 3: Implement**

В `src/lib/auth-redirect.ts` смени fallback-а:
```ts
  return safe !== "/dashboard" ? safe : "/account";
```
(и обнови docstring-а: „купувач → `/account`").

В `src/components/auth/auth-form.tsx` смени Google fallback-а:
```tsx
          <form action={signInWithProvider.bind(null, isBuyer ? (next ?? "/account") : next)}>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth-redirect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-redirect.ts src/lib/auth-redirect.test.ts src/components/auth/auth-form.tsx
git commit -m "feat(buyer): купувач след вход → /account (глобален профил)"
```

---

### Task 7: Профил икона в `SiteHeader`

**Files:**
- Modify: `src/components/marketing/site-header.tsx` (`loggedIn` prop + икона)
- Modify: `src/app/(catalog)/layout.tsx` + `src/app/(marketing)/layout.tsx` (подават `loggedIn`)

**Interfaces:**
- Consumes: `createSupabaseServer()`.
- Produces: `SiteHeader` приема `loggedIn?: boolean`; показва профил икона (логнат → `/account`) или „Вход" (гост).

- [ ] **Step 1: SiteHeader приема loggedIn + икона (визуална промяна, ръчна проверка)**

В `src/components/marketing/site-header.tsx`:
- Промени сигнатурата: `export function SiteHeader({ loggedIn = false }: { loggedIn?: boolean }) {`
- В desktop nav-а, ПРЕДИ `<span className="ml-1"><LinkButton ...>`, добави:
```tsx
          {loggedIn ? (
            <Link
              href="/account"
              aria-label="Моят профил"
              className="flex size-11 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900"
            >
              <Icon name="user" size={22} />
            </Link>
          ) : (
            <Link
              href="/auth/login?role=buyer"
              className="flex h-11 items-center rounded-full px-3.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900"
            >
              Вход
            </Link>
          )}
```
- В mobile overlay nav-а, преди „Създай магазин" бутона, добави линк:
```tsx
            <Link
              href={loggedIn ? "/account" : "/auth/login?role=buyer"}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between rounded-2xl px-4 py-4 font-display text-2xl font-extrabold tracking-tight text-ink-900 transition-colors hover:bg-surface-100"
            >
              {loggedIn ? "Моят профил" : "Вход"}
              <Icon name={loggedIn ? "user" : "chevron-down"} size={20} className="text-ink-500" />
            </Link>
```

- [ ] **Step 2: Layout-ите подават loggedIn**

`src/app/(catalog)/layout.tsx` → направи го async + резолюирай:
```tsx
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader loggedIn={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
```
`src/app/(marketing)/layout.tsx` → аналогично: направи компонента async, резолюирай `user` със `createSupabaseServer`, подай `<SiteHeader loggedIn={Boolean(user)} />`. (Ако layout-ът вече е async / има друга структура — само добави резолюцията и prop-а.)

- [ ] **Step 3: Verify build/lint**

Run: `pnpm check`
Expected: lint + unit + build зелени.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/site-header.tsx "src/app/(catalog)/layout.tsx" "src/app/(marketing)/layout.tsx"
git commit -m "feat(buyer): профил икона в SiteHeader (каталог + landing)"
```

---

### Task 8: Глобален `/account` layout + табло

**Files:**
- Create: `src/app/(catalog)/account/layout.tsx`
- Create: `src/app/(catalog)/account/page.tsx`
- Create: `src/components/account/account-nav.tsx`
- Create: `src/components/account/link-orders-banner.tsx`

**Interfaces:**
- Consumes: `requireBuyer()`, `getBuyerOrdersGlobal`, `countLinkableGuestOrders`/`linkGuestOrders`, `Tabs`/UI.
- Produces: `/account` табло (платформени токени).

- [ ] **Step 1: Account nav (платформени токени)**

`src/components/account/account-nav.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { seg: "", label: "Табло" },
  { seg: "/orders", label: "Поръчки" },
  { seg: "/favorites", label: "Любими" },
  { seg: "/addresses", label: "Адреси" },
  { seg: "/settings", label: "Настройки" },
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Профил навигация" className="flex gap-1 overflow-x-auto border-b border-surface-200">
      {ITEMS.map((it) => {
        const href = `/account${it.seg}`;
        const active = path === href;
        return (
          <Link key={it.seg} href={href} aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "border-b-2 border-brand-600 text-ink-900" : "text-ink-500 hover:text-ink-900"
            }`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Link-orders banner (платформен)**

`src/components/account/link-orders-banner.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkGuestOrders } from "@/actions/buyer";
import { Button } from "@/components/ui";
import { count, NOUNS } from "@/lib/plural";

export function LinkOrdersBanner({ pending }: { pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (pending <= 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-brand-600/30 bg-surface-0 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-700">Намерихме {count(pending, NOUNS.order)} с твоя телефон отпреди акаунта.</p>
      <Button size="sm" loading={busy} onClick={async () => {
        setBusy(true); setMsg(null);
        try {
          const res = await linkGuestOrders();
          if (res.ok) router.refresh(); else setMsg(res.error);
        } finally { setBusy(false); }
      }}>Свържи с акаунта</Button>
      {msg && <p className="text-sm text-danger-600">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Account layout (гард + nav)**

`src/app/(catalog)/account/layout.tsx`:
```tsx
import { AccountNav } from "@/components/account/account-nav";
import { requireBuyer } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireBuyer();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <AccountNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Account табло**

`src/app/(catalog)/account/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { LinkOrdersBanner } from "@/components/account/link-orders-banner";
import { countLinkableGuestOrders } from "@/actions/buyer";
import { getBuyerOrdersGlobal } from "@/db/queries/buyer-global";
import { requireBuyer } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Моят профил — Frizmo Shops", robots: { index: false } };

export default async function AccountHomePage() {
  const { profile } = await requireBuyer();
  const [orders, linkable] = await Promise.all([
    getBuyerOrdersGlobal(profile.id),
    countLinkableGuestOrders(),
  ]);
  const last = orders[0];
  const pending = linkable.ok ? linkable.data.count : 0;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
          Здравей{profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}!
        </h1>
        <p className="mt-1 text-sm text-ink-500">Поръчките, адресите и любимите ти — на едно място.</p>
      </div>
      <LinkOrdersBanner pending={pending} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/account/orders" className="rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600">
          <p className="text-sm font-medium text-ink-900">Моите поръчки</p>
          {last ? (
            <p className="mt-1 text-sm text-ink-500">Последна: №{String(last.orderNumber).padStart(4, "0")} · {last.shopName} · {formatPrice(last.totalCents)}</p>
          ) : (
            <p className="mt-1 text-sm text-ink-500">Още нямаш поръчки.</p>
          )}
        </Link>
        <Link href="/account/favorites" className="rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600">
          <p className="text-sm font-medium text-ink-900">Любими</p>
          <p className="mt-1 text-sm text-ink-500">Продукти и магазини, които следиш.</p>
        </Link>
        <Link href="/account/addresses" className="rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600">
          <p className="text-sm font-medium text-ink-900">Адресна книга</p>
          <p className="mt-1 text-sm text-ink-500">Запазени адреси за бърз checkout.</p>
        </Link>
        <Link href="/account/settings" className="rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600">
          <p className="text-sm font-medium text-ink-900">Настройки</p>
          <p className="mt-1 text-sm text-ink-500">Име, телефон, изтриване на акаунт.</p>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add "src/app/(catalog)/account/layout.tsx" "src/app/(catalog)/account/page.tsx" src/components/account/account-nav.tsx src/components/account/link-orders-banner.tsx
git commit -m "feat(buyer): глобален /account layout + табло"
```

---

### Task 9: `/account/orders` (кросс-магазинно)

**Files:**
- Create: `src/app/(catalog)/account/orders/page.tsx`

**Interfaces:**
- Consumes: `requireBuyer()`, `getBuyerOrdersGlobal`, `formatPrice`.

- [ ] **Step 1: Orders страница**

`src/app/(catalog)/account/orders/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getBuyerOrdersGlobal } from "@/db/queries/buyer-global";
import { requireBuyer } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Моите поръчки — Frizmo Shops", robots: { index: false } };

const STATUS_LABELS: Record<string, string> = {
  new: "Приета", confirmed: "Потвърдена", shipped: "Изпратена", completed: "Завършена",
  cancelled: "Отказана", return_requested: "Заявено връщане", returned: "Върната",
};
const dateFmt = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" });

export default async function AccountOrdersPage() {
  const { profile } = await requireBuyer();
  const orders = await getBuyerOrdersGlobal(profile.id);
  if (orders.length === 0) {
    return (
      <div className="rounded-card border border-surface-200 bg-surface-0 p-8 text-center">
        <p className="text-sm text-ink-500">Още нямаш поръчки.</p>
        <Link href="/shops" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">Разгледай магазините</Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/s/${o.shopSlug}/order/${o.id}?t=${o.publicToken}`}
            className="flex items-center justify-between gap-3 rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-600">
            <div className="min-w-0">
              <p className="font-medium text-ink-900">Поръчка №{String(o.orderNumber).padStart(4, "0")}</p>
              <p className="mt-0.5 text-sm text-ink-500">{o.shopName} · {dateFmt.format(o.createdAt)} · {STATUS_LABELS[o.status] ?? "Приета"}</p>
            </div>
            <span className="shrink-0 font-medium text-ink-900">{formatPrice(o.totalCents)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add "src/app/(catalog)/account/orders/page.tsx"
git commit -m "feat(buyer): /account/orders — всички поръчки с бадж за магазина"
```

---

### Task 10: `/account/favorites` (продукти + магазини) + `/account/addresses` + `/account/settings`

**Files:**
- Create: `src/app/(catalog)/account/favorites/page.tsx`
- Create: `src/components/account/favorites-tabs.tsx`
- Create: `src/app/(catalog)/account/addresses/page.tsx`
- Create: `src/components/account/address-manager.tsx` (платформен вариант)
- Create: `src/app/(catalog)/account/settings/page.tsx`
- Create: `src/components/account/settings-form.tsx` (платформен + изтриване)
- Create: `src/components/account/delete-account.tsx`

**Interfaces:**
- Consumes: `getBuyerFavoriteProductsGlobal`, `getBuyerFavoriteShopsList`, `getBuyerAddresses`, `saveAddress`/`deleteAddress`/`setDefaultAddress`, `updateBuyerProfile`, `deleteBuyerAccount`, `signOut`, `toggleFavoriteShop`, `Tabs`/`Drawer`/`ConfirmDialog`/`Button`/`Input`.

- [ ] **Step 1: Favorites tabs (client — продукти/магазини)**

`src/components/account/favorites-tabs.tsx`:
```tsx
"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product, Shop } from "@/db";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

type FavProduct = Product & { shopName: string; shopSlug: string };

export function FavoritesTabs({ products, shops }: { products: FavProduct[]; shops: Shop[] }) {
  const [tab, setTab] = useState<"products" | "shops">("products");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("products")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${tab === "products" ? "bg-ink-900 text-white" : "bg-surface-100 text-ink-700"}`}>
          Продукти ({products.length})
        </button>
        <button type="button" onClick={() => setTab("shops")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${tab === "shops" ? "bg-ink-900 text-white" : "bg-surface-100 text-ink-700"}`}>
          Магазини ({shops.length})
        </button>
      </div>
      {tab === "products" ? (
        products.length === 0 ? (
          <p className="rounded-card border border-surface-200 bg-surface-0 p-6 text-center text-sm text-ink-500">Още нямаш любими продукти.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/s/${p.shopSlug}/p/${p.slug}`} className="flex gap-3 rounded-card border border-surface-200 bg-surface-0 p-3 transition-colors hover:border-brand-600">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{p.name}</p>
                    <p className="text-xs text-ink-500">{p.shopName}</p>
                    <p className="mt-1 text-sm font-medium text-ink-900">{formatPrice(p.priceCents)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : shops.length === 0 ? (
        <p className="rounded-card border border-surface-200 bg-surface-0 p-6 text-center text-sm text-ink-500">Още нямаш любими магазини.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shops.map((s) => (
            <li key={s.id}>
              <Link href={`/s/${s.slug}`} className="flex items-center gap-3 rounded-card border border-surface-200 bg-surface-0 p-3 transition-colors hover:border-brand-600">
                {s.logoPath ? (
                  <Image src={publicImageUrl(s.logoPath)} alt="" width={40} height={40} className="size-10 rounded-full object-cover" />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full bg-surface-100 font-bold text-ink-700">{s.name.slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-900">{s.name}</p>
                  {s.city && <p className="truncate text-xs text-ink-500">{s.city}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
(Провери реалното име на ценовото поле на продукта — `priceCents`; и slug полето — `slug`. Ако се различават, ползвай реалните от `Product` типа.)

- [ ] **Step 2: Favorites страница (server)**

`src/app/(catalog)/account/favorites/page.tsx`:
```tsx
import type { Metadata } from "next";
import { FavoritesTabs } from "@/components/account/favorites-tabs";
import { getBuyerFavoriteProductsGlobal, getBuyerFavoriteShopsList } from "@/db/queries/buyer-global";
import { requireBuyer } from "@/lib/auth";

export const metadata: Metadata = { title: "Моите любими — Frizmo Shops", robots: { index: false } };

export default async function AccountFavoritesPage() {
  const { profile } = await requireBuyer();
  const [products, shops] = await Promise.all([
    getBuyerFavoriteProductsGlobal(profile.id),
    getBuyerFavoriteShopsList(profile.id),
  ]);
  return <FavoritesTabs products={products} shops={shops} />;
}
```

- [ ] **Step 3: Address manager (платформен — реюз на действията)**

`src/components/account/address-manager.tsx` — същата логика като storefront версията (`src/components/storefront/account/address-manager.tsx`), но с платформени токени и `@/components/ui` компоненти (`Input`, `Button`, `Drawer`, `ConfirmDialog`, `Checkbox`). Пълен код:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/actions/buyer";
import { Button, Checkbox, ConfirmDialog, Drawer, Input } from "@/components/ui";
import type { BuyerAddress } from "@/db";

export function AddressManager({ addresses }: { addresses: BuyerAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BuyerAddress | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const res = await saveAddress({
        label: formData.get("label"),
        receiverName: formData.get("receiverName"),
        receiverPhone: formData.get("receiverPhone"),
        city: formData.get("city"),
        address: formData.get("address"),
        isDefault: formData.get("isDefault") === "on",
      }, editing?.id);
      if (res.ok) {
        toast.success(editing ? "Адресът е обновен." : "Адресът е запазен.");
        setDrawerOpen(false);
        router.refresh();
      } else toast.error(res.error);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button size="sm" className="self-start" onClick={() => { setEditing(null); setDrawerOpen(true); }}>Добави адрес</Button>
      {addresses.length === 0 ? (
        <p className="rounded-card border border-surface-200 bg-surface-0 p-6 text-center text-sm text-ink-500">Още нямаш запазени адреси.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-card border border-surface-200 bg-surface-0 p-4">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-ink-900">{a.label || a.receiverName}{a.isDefault && <span className="ml-2 text-xs font-normal text-brand-600">· основен</span>}</p>
                <p className="mt-0.5 text-ink-500">{a.receiverName} · {a.receiverPhone}</p>
                <p className="text-ink-500">{a.courierOfficeName || [a.address, a.city].filter(Boolean).join(", ")}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                <button type="button" onClick={() => { setEditing(a); setDrawerOpen(true); }} className="text-brand-600 hover:underline">Редактирай</button>
                {!a.isDefault && (
                  <button type="button" onClick={async () => { const r = await setDefaultAddress(a.id); if (r.ok) router.refresh(); else toast.error(r.error); }} className="text-ink-500 hover:text-ink-900">Основен</button>
                )}
                <button type="button" onClick={() => setConfirmId(a.id)} className="text-danger-600 hover:underline">Изтрий</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? "Редактирай адрес" : "Нов адрес"}>
        <form action={submit} className="flex flex-col gap-4">
          <Input label="Етикет (по избор)" name="label" defaultValue={editing?.label ?? ""} placeholder="Вкъщи" />
          <Input label="Име на получателя" name="receiverName" defaultValue={editing?.receiverName ?? ""} required />
          <Input label="Телефон" name="receiverPhone" defaultValue={editing?.receiverPhone ?? ""} required />
          <Input label="Град" name="city" defaultValue={editing?.city ?? ""} />
          <Input label="Адрес" name="address" defaultValue={editing?.address ?? ""} />
          <Checkbox name="isDefault" defaultChecked={editing?.isDefault ?? false} label="Основен адрес" />
          <Button type="submit" loading={busy}>Запази</Button>
        </form>
      </Drawer>
      <ConfirmDialog open={confirmId !== null} onClose={() => setConfirmId(null)}
        onConfirm={async () => { if (!confirmId) return; const r = await deleteAddress(confirmId); setConfirmId(null); if (r.ok) { toast.success("Адресът е изтрит."); router.refresh(); } else toast.error(r.error); }}
        title="Изтриване на адрес" message="Сигурен ли си, че искаш да изтриеш този адрес?" confirmLabel="Изтрий" />
    </div>
  );
}
```
(Провери реалните props на `Checkbox` — ако не приема `label`, сложи етикета отделно. Виж `src/components/ui/checkbox.tsx`.)

- [ ] **Step 4: Addresses страница**

`src/app/(catalog)/account/addresses/page.tsx`:
```tsx
import type { Metadata } from "next";
import { AddressManager } from "@/components/account/address-manager";
import { getBuyerAddresses } from "@/db/queries/buyer";
import { requireBuyer } from "@/lib/auth";

export const metadata: Metadata = { title: "Моите адреси — Frizmo Shops", robots: { index: false } };

export default async function AccountAddressesPage() {
  const { profile } = await requireBuyer();
  const addresses = await getBuyerAddresses(profile.id);
  return <AddressManager addresses={addresses} />;
}
```

- [ ] **Step 5: Delete account (client)**

`src/components/account/delete-account.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteBuyerAccount } from "@/actions/buyer";
import { Button, Input } from "@/components/ui";

export function DeleteAccount() {
  const router = useRouter();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-card border border-danger-600/30 bg-surface-0 p-4">
      <div>
        <p className="font-medium text-ink-900">Изтриване на акаунт</p>
        <p className="mt-1 text-sm text-ink-500">Данните ти се изтриват. Миналите поръчки остават при търговците (анонимизирани). Напиши „ИЗТРИЙ" за потвърждение.</p>
      </div>
      <Input label="Потвърждение" value={word} onChange={(e) => setWord(e.target.value)} placeholder="ИЗТРИЙ" />
      <Button variant="danger" size="sm" className="self-start" loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await deleteBuyerAccount({ confirm: word });
            if (res.ok) { toast.success("Акаунтът е изтрит."); router.push("/"); }
            else toast.error(res.error);
          } finally { setBusy(false); }
        }}>
        Изтрий акаунта
      </Button>
    </div>
  );
}
```
(Провери, че `Button` има `variant="danger"`; ако не — виж `src/components/ui/button.tsx` за реалните варианти и ползвай подходящия.)

- [ ] **Step 6: Settings form + страница**

`src/components/account/settings-form.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateBuyerProfile } from "@/actions/buyer";
import { signOut } from "@/actions/auth";
import { DeleteAccount } from "@/components/account/delete-account";
import { Button, Input } from "@/components/ui";

export function SettingsForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const res = await updateBuyerProfile({ fullName: formData.get("fullName"), phone: formData.get("phone") });
      if (res.ok) { toast.success("Профилът е обновен."); router.refresh(); } else toast.error(res.error);
    } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-6">
      <form action={submit} className="flex flex-col gap-4">
        <Input label="Име и фамилия" name="fullName" defaultValue={fullName} required />
        <Input label="Телефон" name="phone" defaultValue={phone} required />
        <Button type="submit" className="self-start" loading={busy}>Запази</Button>
      </form>
      <div className="flex flex-col gap-3 border-t border-surface-200 pt-4">
        <a href="/dashboard/onboarding" className="text-sm font-medium text-brand-600 hover:underline">Искам да продавам — отвори магазин</a>
        <form action={signOut}><button type="submit" className="text-sm text-ink-500 hover:text-ink-900">Изход</button></form>
      </div>
      <DeleteAccount />
    </div>
  );
}
```
`src/app/(catalog)/account/settings/page.tsx`:
```tsx
import type { Metadata } from "next";
import { SettingsForm } from "@/components/account/settings-form";
import { requireBuyer } from "@/lib/auth";

export const metadata: Metadata = { title: "Настройки — Frizmo Shops", robots: { index: false } };

export default async function AccountSettingsPage() {
  const { profile } = await requireBuyer();
  return <SettingsForm fullName={profile.fullName ?? ""} phone={profile.phone ?? ""} />;
}
```

- [ ] **Step 7: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add "src/app/(catalog)/account/favorites/page.tsx" "src/app/(catalog)/account/addresses/page.tsx" "src/app/(catalog)/account/settings/page.tsx" src/components/account
git commit -m "feat(buyer): /account любими (продукти+магазини) + адреси + настройки + изтриване"
```

---

### Task 11: Стари storefront account страници → redirect + AccountButton

**Files:**
- Modify: `src/components/storefront/header/shared.tsx` (AccountButton → `/account`)
- Modify: `src/app/(storefront)/s/[slug]/account/layout.tsx` + `page.tsx` + `orders/page.tsx` + `addresses/page.tsx` + `settings/page.tsx` → redirect
- Delete (по избор): старите `src/components/storefront/account/*` ако вече не се ползват (address-manager, settings-form, link-orders-banner, account-nav) — освен `favorites-merger.tsx` (остава).

**Interfaces:**
- Produces: storefront профил икона води към глобалния `/account`; старите per-магазин страници пренасочват.

- [ ] **Step 1: AccountButton → глобален /account**

В `src/components/storefront/header/shared.tsx`, `AccountButton`:
```tsx
export function AccountButton({ loggedIn }: { base?: string; loggedIn: boolean }) {
  const href = loggedIn ? "/account" : "/auth/login?role=buyer&next=/account";
  return (
    <Link href={href} aria-label={loggedIn ? "Моят профил" : "Вход"}
      className="flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70">
      <Icon name="user" size={22} />
    </Link>
  );
}
```
(`base` остава optional за да не чупи извикванията, но не се ползва.)

- [ ] **Step 2: Стария account layout → redirect**

Замени `src/app/(storefront)/s/[slug]/account/layout.tsx` изцяло:
```tsx
import { redirect } from "next/navigation";

/** S3-глобален: профилът се премести на платформено ниво (/account). Пренасочваме. */
export default function StorefrontAccountRedirect() {
  redirect("/account");
}
```
Изтрий подстраниците (вече ги покрива redirect-ът на layout-а — но за да няма мъртви route-ове, замени всяка `page.tsx` под `account/` с редирект ИЛИ ги изтрий):
```bash
git rm "src/app/(storefront)/s/[slug]/account/page.tsx" "src/app/(storefront)/s/[slug]/account/orders/page.tsx" "src/app/(storefront)/s/[slug]/account/addresses/page.tsx" "src/app/(storefront)/s/[slug]/account/settings/page.tsx"
```
(Layout-ът с `redirect` покрива всички вложени пътища — те стигат до него преди да рендерират.)

- [ ] **Step 3: Изчисти старите storefront account компоненти (ако са осиротели)**

Провери употреба: `grep -rn "storefront/account/address-manager\|storefront/account/settings-form\|storefront/account/account-nav\|storefront/account/link-orders-banner" src/`. Ако няма (освен изтритите страници) → изтрий ги:
```bash
git rm src/components/storefront/account/address-manager.tsx src/components/storefront/account/settings-form.tsx src/components/storefront/account/account-nav.tsx src/components/storefront/account/link-orders-banner.tsx
```
(ЗАПАЗИ `src/components/storefront/account/favorites-merger.tsx` — още се ползва в storefront layout-а.)

- [ ] **Step 4: Verify build/lint**

Run: `pnpm check`
Expected: зелено (без счупени импорти).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(buyer): storefront профил → глобален /account (redirect + изчистване)"
```

---

### Task 12: Сърце на магазина — storefront хедър + каталог карта

**Files:**
- Create: `src/components/storefront/shop-favorite-button.tsx`
- Modify: `src/components/storefront/header/shared.tsx` + вариантите (рендер на бутона)
- Modify: `src/app/(storefront)/s/[slug]/layout.tsx` (подава `shopFavorited` състояние)
- Modify: `src/components/marketing/shop-card.tsx` (опционално сърце)
- Test: `src/components/storefront/shop-favorite-button.test.ts` (по избор — логиката е тънка; покрива се от action теста + e2e)

**Interfaces:**
- Consumes: `toggleFavoriteShop`.
- Produces: сърце-бутон, което toggle-ва любим магазин (оптимистично).

- [ ] **Step 1: ShopFavoriteButton (client)**

`src/components/storefront/shop-favorite-button.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFavoriteShop } from "@/actions/buyer";
import { Icon } from "@/components/ui";

/** Сърце „любим магазин". Логнат → toggle (оптимистично); гост → към вход. */
export function ShopFavoriteButton({ shopId, initialFavorited, loggedIn }: { shopId: string; initialFavorited: boolean; loggedIn: boolean }) {
  const router = useRouter();
  const [fav, setFav] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" aria-label={fav ? "Премахни от любими магазини" : "Добави в любими магазини"} aria-pressed={fav}
      disabled={busy}
      onClick={async () => {
        if (!loggedIn) { router.push(`/auth/login?role=buyer&next=/account`); return; }
        setBusy(true);
        const next = !fav;
        setFav(next);
        const res = await toggleFavoriteShop(shopId);
        if (!res.ok) setFav(!next);
        setBusy(false);
      }}
      className="flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70">
      <Icon name="heart" size={22} className={fav ? "fill-current" : ""} />
    </button>
  );
}
```

- [ ] **Step 2: Рендер в storefront хедъра**

Разшири `HeaderVariantProps` (`src/components/storefront/header/shared.tsx`) с:
```ts
  /** S3-глобален: любим ли е магазинът за текущия купувач + логнат статус. */
  shopFavorited?: boolean;
```
(`viewerLoggedIn` вече го има.) В `AccountButton` реда на всеки вариант, добави преди него:
```tsx
<ShopFavoriteButton shopId={shop.id} initialFavorited={shopFavorited ?? false} loggedIn={viewerLoggedIn ?? false} />
```
Импортвай `ShopFavoriteButton` от `../shop-favorite-button` в трите варианта и destructure `shopFavorited = false` в сигнатурите (както `viewerLoggedIn`).

- [ ] **Step 3: Layout подава shopFavorited**

В `src/app/(storefront)/s/[slug]/layout.tsx`, до резолюцията на `user`, добави:
```ts
import { getBuyerFavoriteShopIds } from "@/db/queries/buyer-global";
// ... след като имаме user:
const favShopIds = user ? await getBuyerFavoriteShopIds(user.id) : [];
const shopFavorited = favShopIds.includes(shop.id);
// подай на <StorefrontHeader ... shopFavorited={shopFavorited} />
```

- [ ] **Step 4: (по избор) Сърце на каталог картата**

`src/components/marketing/shop-card.tsx` е `<Link>` обвивка. Вложен бутон вътре в Link чупи семантиката. Минимален подход: **пропусни** каталог сърцето в тази итерация ИЛИ добави абсолютно позициониран бутон с `e.preventDefault()`+`e.stopPropagation()`. За да не рискуваме — **отложи каталог сърцето**; storefront хедърът покрива основния случай. Логни решението:
```
// РЕШЕНИЕ: каталог сърцето е отложено (вложен интерактив в Link). Storefront хедърът
// покрива toggle-а. Бъдеща итерация: refactor на ShopCard да не е цял Link.
```

- [ ] **Step 5: Verify build/lint**

Run: `pnpm check`
Expected: зелено.

- [ ] **Step 6: Commit**

```bash
git add src/components/storefront/shop-favorite-button.tsx src/components/storefront/header "src/app/(storefront)/s/[slug]/layout.tsx"
git commit -m "feat(buyer): сърце „любим магазин" в storefront хедъра"
```

---

### Task 13: E2e — глобален профил

**Files:**
- Create: `e2e/global-account.spec.ts`

**Interfaces:**
- Consumes: съществуващия e2e паттерн (register buyer, `@gmail.com`, cookie банер).

- [ ] **Step 1: E2e тест**

`e2e/global-account.spec.ts`:
```ts
import { expect, test, type Page } from "@playwright/test";

async function markCookieSeen(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
}

async function registerBuyer(page: Page, email: string) {
  await markCookieSeen(page);
  await page.goto("/auth/register?role=buyer");
  await page.getByLabel("Име и фамилия").fill("Е2Е Глобал");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("parola123!");
  await page.getByRole("button", { name: "Регистрирай се" }).click();
  /* Купувач без next → глобален /account. */
  await expect(page).toHaveURL(/\/account/);
}

test("купувач → глобален профил с табове", async ({ page }) => {
  test.setTimeout(120_000);
  await registerBuyer(page, `frizmo.e2e+glob${Date.now()}@gmail.com`);
  await expect(page.getByRole("heading", { name: /Здравей/ })).toBeVisible();
  await page.getByRole("link", { name: "Любими", exact: true }).click();
  await expect(page.getByRole("button", { name: /Продукти/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Магазини/ })).toBeVisible();
});

test("любим магазин от storefront хедъра → показва се в профила", async ({ page }) => {
  test.setTimeout(120_000);
  await registerBuyer(page, `frizmo.e2e+favshop${Date.now()}@gmail.com`);
  await page.goto("/s/atelie-glina");
  await page.getByRole("button", { name: "Добави в любими магазини" }).click();
  await page.goto("/account/favorites");
  await page.getByRole("button", { name: /Магазини/ }).click();
  /* Демо магазинът трябва да се появи в таба. */
  await expect(page.getByText("Ателие Глина")).toBeVisible();
});
```
(Провери реалното име на демо магазина `atelie-glina` в `scripts/seed-demo-shops.mjs` — ако е различно от „Ателие Глина", ползвай точното.)

- [ ] **Step 2: Run e2e**

Run: `npx playwright test global-account --reporter=line`
Expected: PASS (2 теста). Ако локатор е двусмислен → стесни с `exact`/scope (както в buyer-account.spec.ts).

- [ ] **Step 3: Финален гейт + commit**

Run: `pnpm check`
Expected: lint + всички unit + build зелени.
```bash
git add e2e/global-account.spec.ts
git commit -m "feat(buyer): e2e — глобален профил + любим магазин"
```

---

## Финал (след всички задачи)

- [ ] Пълен `pnpm check`.
- [ ] `npx playwright test global-account buyer-account --reporter=line` (двата купувачки спека).
- [ ] Обнови `docs/WORKLOG.md` + паметта ([[buyer-account-feature]] → отбележи глобалното разширение).
- [ ] Ръчна проверка на живо (dev сървър): вход като купувач → профил икона в каталога → `/account` → всички поръчки/любими; сърце на магазин; изтриване с „ИЗТРИЙ".
- [ ] Докладвай: готово локално, чака push разрешение. **НЕ push-вай без изрично „да".**
