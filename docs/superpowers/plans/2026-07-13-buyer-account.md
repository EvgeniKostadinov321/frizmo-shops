# Купувачески профил — имплементационен план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline изпълнение). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Логнат купувач вижда историята на поръчките си, пази адресна книга за бърз checkout и синхронизира любимите между устройства; вход/регистрация с toggle купувач/продавач.

**Architecture:** `profiles` остава една таблица (търговец/купувач = един Supabase user); ролята е производна от „имаш ли магазин". Нов `requireBuyer()` wrapper по аналогия с `requireShop()`. Поръчките получават nullable `buyerId`; нови таблици `buyerAddresses` + `buyerFavorites`. Любимите за логнати минават от localStorage към сървъра (merge при вход). Профилът живее под `/s/{slug}/account` (per-магазин поръчки).

**Tech Stack:** Next.js 16 (App Router), Supabase Auth, Drizzle ORM (`db:push`, без migration файлове), Zod, Tailwind 4 (само `--sf-*` токени в storefront), Vitest, Playwright, pnpm.

## Global Constraints

- Спец: `docs/superpowers/specs/2026-07-13-buyer-account-design.md` (одобрен 2026-07-13).
- Изолация правило №1: всяка купувачка заявка/мутация филтрира по `buyerId = profile.id`; cross-buyer теч = критичен бъг (клас cross-tenant).
- Мутации САМО в `src/actions/`; всяка минава през wrapper (`requireBuyer()`), Zod parse и санитизация.
- Пари = integer евроцентове (не важи тук пряко, но не се пипа).
- UI текстове на български с типографски кавички „…“ (прав `"` в BG стринг чупи lint/JS).
- Storefront стилизация САМО през `--sf-*` токени (не „Пазарен ден", без hardcoded hex/px).
- Форми в `<Drawer>` (не модал); Drawer не се затваря при клик отвън.
- `loading.tsx` НЕ на CRUD страници с drawer форми (remount при `router.refresh()` затваря drawer-и).
- Всички нови таблици `.enableRLS()`. Всички нови колони nullable/с default → `db:push` безопасен.
- Гейт преди всеки commit: `pnpm check` (lint + unit + build).
- Push към `dev` (=prod): само след изрично разрешение — НЕ е част от плана.
- `preferredRole` = само redirect памет, НЕ гард. Истинската роля винаги производна.
- Стари гост-поръчки → авто-обвързване по потвърден телефон = минала поръчка + КЛИК (без SMS).

## Файлова структура (какво създаваме/пипаме)

**Създаваме:**
- `src/schemas/buyer.ts` — Zod схеми (адрес, профил)
- `src/db/queries/buyer.ts` — четене (orders/addresses/favorites)
- `src/actions/buyer.ts` — мутации (адреси, любими, свързване, профил)
- `src/lib/buyer-favorites-storage.ts` — сървърен режим на любимите (клиентски слой)
- `src/components/storefront/account/` — профилни UI компоненти
- `src/app/(storefront)/s/[slug]/account/` — профилни страници
- `tests/` — unit тестове per задача; `e2e/buyer-account.spec.ts`

**Модифицираме:**
- `src/db/schema.ts` — `profiles` (+2 полета), `orders` (+`buyerId`), 2 нови таблици
- `src/lib/auth.ts` — `requireBuyer()`, `ensureProfile` (пише телефон при OAuth по избор)
- `src/actions/auth.ts` — `signUp`/`signIn` приемат роля → redirect
- `src/schemas/auth.ts` — `role` поле
- `src/components/auth/auth-form.tsx` — toggle купувач/продавач
- `src/app/(auth)/auth/login/page.tsx` + `register/page.tsx` — четат `?role`
- `src/actions/orders.ts` — `createOrder` попълва `buyerId` при логнат купувач
- `src/components/storefront/checkout-form.tsx` — autofill от адресна книга
- `src/components/storefront/header/shared.tsx` + вариантите — профил икона
- `src/app/(storefront)/s/[slug]/layout.tsx` — резолюира viewer (auth user)
- `src/lib/favorites-storage.ts` — не се пипа (гост пътят остава); новият слой го надгражда

---

### Task 1: Данен модел — profiles полета, orders.buyerId, нови таблици

**Files:**
- Modify: `src/db/schema.ts` (profiles ~34-40, orders ~451-499; нови таблици в края преди типовете ~787)
- Test: `tests/buyer-schema.test.ts` (нов — smoke import на новите таблици/типове)

**Interfaces:**
- Produces: `profiles.preferredRole`, `profiles.phoneVerified`; `orders.buyerId`; таблици `buyerAddresses`, `buyerFavorites`; типове `BuyerAddress = typeof buyerAddresses.$inferSelect`, `BuyerFavorite = typeof buyerFavorites.$inferSelect`.

- [ ] **Step 1: Write the failing test**

`tests/buyer-schema.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buyerAddresses, buyerFavorites, orders, profiles } from "@/db";

describe("купувачески данен модел", () => {
  it("profiles има preferredRole + phoneVerified", () => {
    expect(profiles.preferredRole).toBeDefined();
    expect(profiles.phoneVerified).toBeDefined();
  });
  it("orders има buyerId", () => {
    expect(orders.buyerId).toBeDefined();
  });
  it("buyerAddresses има куриерски офис полета", () => {
    expect(buyerAddresses.courierProvider).toBeDefined();
    expect(buyerAddresses.courierOfficeId).toBeDefined();
  });
  it("buyerFavorites е дефинирана", () => {
    expect(buyerFavorites.productId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/buyer-schema.test.ts`
Expected: FAIL — `buyerAddresses`/`buyerFavorites`/`orders.buyerId` undefined.

- [ ] **Step 3: Add fields to `profiles`**

В `src/db/schema.ts`, `profiles` (ред ~34), преди `createdAt`:
```ts
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull().default(""),
  phone: text("phone"),
  /* S3: само redirect памет (последен избор на toggle-а); НЕ е гард — истинската
     роля е производна от „има ли магазин". */
  preferredRole: text("preferred_role"),
  /* S3: true след клик-свързване на минали гост-поръчки по телефон. */
  phoneVerified: boolean("phone_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
```

- [ ] **Step 4: Add `buyerId` to `orders`**

В `orders` (ред ~489, до `publicToken`), добави колоната:
```ts
    /* S3: свързва поръчката с купувачески акаунт (NULL = гост, както преди).
       Попълва се при checkout ако купувачът е логнат, или при клик-свързване. */
    buyerId: uuid("buyer_id").references(() => profiles.id, { onDelete: "set null" }),
```
И в индексния масив на orders (`(t) => [...]`, ред ~500) добави:
```ts
    index("orders_buyer_idx").on(t.buyerId, t.createdAt),
```
(Провери че `index` вече е импортнат от drizzle-orm/pg-core — да, използва се другаде във файла.)

- [ ] **Step 5: Add new tables `buyerAddresses` + `buyerFavorites`**

Преди блока с типовете (`export type Profile = ...`, ред ~787):
```ts
/* S3: адресна книга на купувача — покрива адрес-до-врата И запазен куриерски офис. */
export const buyerAddresses = pgTable(
  "buyer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    receiverName: text("receiver_name").notNull(),
    receiverPhone: text("receiver_phone").notNull(),
    city: text("city").notNull().default(""),
    address: text("address").notNull().default(""),
    /* Ако е запазен ОФИС вместо адрес до врата — тези се попълват. */
    courierProvider: courierProviderEnum("courier_provider"),
    courierOfficeId: text("courier_office_id"),
    courierOfficeName: text("courier_office_name"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("buyer_addresses_buyer_idx").on(t.buyerId)],
).enableRLS();

/* S3: любими per-акаунт (синхрон между устройства; заместник на localStorage за логнати). */
export const buyerFavorites = pgTable(
  "buyer_favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("buyer_favorites_uid").on(t.buyerId, t.productId),
    index("buyer_favorites_buyer_idx").on(t.buyerId),
  ],
).enableRLS();
```
Добави типовете при другите (`ред ~787+`):
```ts
export type BuyerAddress = typeof buyerAddresses.$inferSelect;
export type BuyerFavorite = typeof buyerFavorites.$inferSelect;
```
(Провери импортите: `uniqueIndex` вече се ползва — да, `courier_offices_uid`. `boolean`, `index`, `text`, `uuid`, `timestamp` също.)

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- tests/buyer-schema.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 7: Apply schema to DB**

Run: `pnpm db:push`
Expected: drizzle прилага 2 нови колони на profiles, 1 на orders, 2 нови таблици + индекси. Без загуба (всичко nullable/ново).

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts tests/buyer-schema.test.ts
git commit -m "feat(buyer): схема — profiles роля/verified, orders.buyerId, адреси+любими"
```

---

### Task 2: `requireBuyer()` + `ensureProfile` разширение

**Files:**
- Modify: `src/lib/auth.ts`
- Test: `tests/require-buyer.test.ts` (нов)

**Interfaces:**
- Consumes: `requireUser()`, `ensureProfile(userId, fullName?)` (съществуват), `createSupabaseServer()`.
- Produces: `requireBuyer(): Promise<{ user, profile }>` — auth + гарантиран profile ред. `ensureProfile(userId, fullName?, phone?)` — приема телефон (пише при insert).

- [ ] **Step 1: Write the failing test**

`tests/require-buyer.test.ts` (мокваме supabase + db слоя):
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: async () => ({ auth: { getUser } }),
}));
const redirect = vi.fn((p: string) => { throw new Error(`REDIRECT:${p}`); });
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));

const findFirst = vi.fn();
const onConflictDoNothing = vi.fn();
const values = vi.fn(() => ({ onConflictDoNothing }));
vi.mock("@/db", () => ({
  db: { query: { profiles: { findFirst } }, insert: () => ({ values }) },
  profiles: {}, shops: {},
}));
vi.mock("@/lib/sanitize", () => ({ sanitizeText: (s: string) => s }));

import { requireBuyer } from "@/lib/auth";

describe("requireBuyer", () => {
  beforeEach(() => { getUser.mockReset(); findFirst.mockReset(); values.mockClear(); });

  it("нелогнат → redirect към login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireBuyer()).rejects.toThrow("REDIRECT:/auth/login");
  });

  it("логнат → връща user + profile (гарантира ред)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.bg" } } });
    findFirst.mockResolvedValue({ id: "u1", fullName: "Иван" });
    const res = await requireBuyer();
    expect(res.user.id).toBe("u1");
    expect(res.profile.id).toBe("u1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/require-buyer.test.ts`
Expected: FAIL — `requireBuyer` не е експортната.

- [ ] **Step 3: Implement**

В `src/lib/auth.ts`:
- Разшири `ensureProfile` да приема телефон:
```ts
export async function ensureProfile(userId: string, fullName?: string, phone?: string) {
  await db
    .insert(profiles)
    .values({
      id: userId,
      fullName: fullName ? sanitizeText(fullName, 100) : "",
      phone: phone ? sanitizeText(phone, 30) : null,
    })
    .onConflictDoNothing();
}
```
- Добави `requireBuyer` (след `requireShop`):
```ts
/** За купувачки страници/мутации: auth + гарантиран profile ред (без магазин изискване). */
export async function requireBuyer() {
  const user = await requireUser();
  await ensureProfile(user.id, user.user_metadata?.full_name as string | undefined);
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, user.id) });
  /* ensureProfile гарантира реда; при рядка гонка findFirst пак може да върне null → минимален fallback. */
  return { user, profile: profile ?? { id: user.id, fullName: "", phone: null, preferredRole: null, phoneVerified: false } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/require-buyer.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/require-buyer.test.ts
git commit -m "feat(buyer): requireBuyer() wrapper + ensureProfile с телефон"
```

---

### Task 3: Zod схеми (адрес + профил)

**Files:**
- Create: `src/schemas/buyer.ts`
- Test: `tests/buyer-schemas.test.ts` (нов)

**Interfaces:**
- Consumes: `parseBgPhone` (`src/lib/phone.ts`), zod.
- Produces: `addressSchema` → `{ label, receiverName, receiverPhone, city, address, courierProvider?, courierOfficeId?, courierOfficeName?, isDefault }`; `buyerProfileSchema` → `{ fullName, phone }`. Типове `AddressInput`, `BuyerProfileInput`.

- [ ] **Step 1: Write the failing test**

`tests/buyer-schemas.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { addressSchema, buyerProfileSchema } from "@/schemas/buyer";

describe("addressSchema", () => {
  it("приема валиден адрес до врата", () => {
    const r = addressSchema.safeParse({
      label: "Вкъщи", receiverName: "Иван Иванов", receiverPhone: "0888123456",
      city: "София", address: "ул. Тест 1", isDefault: true,
    });
    expect(r.success).toBe(true);
  });
  it("отхвърля празно име на получател", () => {
    const r = addressSchema.safeParse({
      receiverName: "", receiverPhone: "0888123456", city: "София", address: "ул. Тест 1",
    });
    expect(r.success).toBe(false);
  });
  it("отхвърля невалиден телефон", () => {
    const r = addressSchema.safeParse({
      receiverName: "Иван", receiverPhone: "123", city: "София", address: "ул. Тест 1",
    });
    expect(r.success).toBe(false);
  });
});

describe("buyerProfileSchema", () => {
  it("приема име + телефон", () => {
    expect(buyerProfileSchema.safeParse({ fullName: "Иван Иванов", phone: "0888123456" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/buyer-schemas.test.ts`
Expected: FAIL — модулът не съществува.

- [ ] **Step 3: Implement**

`src/schemas/buyer.ts`:
```ts
import { z } from "zod";
import { parseBgPhone } from "@/lib/phone";

const phone = z.string().refine((v) => parseBgPhone(v).ok, "Невалиден телефонен номер.");

export const addressSchema = z.object({
  label: z.string().max(40).optional().default(""),
  receiverName: z.string().min(2, "Въведи име.").max(100),
  receiverPhone: phone,
  city: z.string().max(60).optional().default(""),
  address: z.string().max(200).optional().default(""),
  courierProvider: z.enum(["econt", "speedy"]).optional(),
  courierOfficeId: z.string().max(60).optional(),
  courierOfficeName: z.string().max(200).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const buyerProfileSchema = z.object({
  fullName: z.string().min(2, "Въведи име.").max(100),
  phone: phone,
});

export type AddressInput = z.infer<typeof addressSchema>;
export type BuyerProfileInput = z.infer<typeof buyerProfileSchema>;
```
(Провери сигнатурата на `parseBgPhone` — връща `{ ok: boolean, e164?, ... }`; ползвана в orders.ts.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/buyer-schemas.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/schemas/buyer.ts tests/buyer-schemas.test.ts
git commit -m "feat(buyer): Zod схеми адрес + профил"
```

---

### Task 4: Query слой (`src/db/queries/buyer.ts`)

**Files:**
- Create: `src/db/queries/buyer.ts`
- Test: `tests/buyer-queries.test.ts` (нов — проверява WHERE филтъра по buyerId)

**Interfaces:**
- Consumes: `db`, `orders`, `orderItems`, `buyerAddresses`, `buyerFavorites`, `products` (`@/db`).
- Produces:
  - `getBuyerOrders(buyerId, shopId): Promise<Order[]>` — по buyerId И shopId (per-магазин), desc по дата.
  - `getBuyerAddresses(buyerId): Promise<BuyerAddress[]>` — default първи.
  - `getBuyerFavoriteIds(buyerId): Promise<string[]>`.
  - `getBuyerFavoriteProducts(buyerId, shopId): Promise<Product[]>` — активни, per-магазин.

- [ ] **Step 1: Write the failing test**

`tests/buyer-queries.test.ts` (проверяваме че се вика с правилните условия чрез мок на db):
```ts
import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn().mockResolvedValue([]);
vi.mock("@/db", () => ({
  db: { query: { orders: { findMany }, buyerAddresses: { findMany }, buyerFavorites: { findMany } } },
  orders: { buyerId: "buyerId", shopId: "shopId", createdAt: "createdAt" },
  orderItems: {}, buyerAddresses: { buyerId: "buyerId", isDefault: "isDefault" },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" }, products: {},
}));

import { getBuyerAddresses, getBuyerOrders } from "@/db/queries/buyer";

describe("buyer queries", () => {
  it("getBuyerOrders вика findMany (филтрирано)", async () => {
    await getBuyerOrders("b1", "s1");
    expect(findMany).toHaveBeenCalled();
  });
  it("getBuyerAddresses вика findMany", async () => {
    await getBuyerAddresses("b1");
    expect(findMany).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/buyer-queries.test.ts`
Expected: FAIL — модулът не съществува.

- [ ] **Step 3: Implement**

`src/db/queries/buyer.ts`:
```ts
import { and, desc, eq, inArray } from "drizzle-orm";
import { buyerAddresses, buyerFavorites, db, orders, products, type BuyerAddress, type Order, type Product } from "@/db";

/** Поръчките на купувача В ТОЗИ магазин (per-магазин по дизайн), най-новите първи. */
export async function getBuyerOrders(buyerId: string, shopId: string): Promise<Order[]> {
  return db.query.orders.findMany({
    where: and(eq(orders.buyerId, buyerId), eq(orders.shopId, shopId)),
    orderBy: [desc(orders.createdAt)],
    limit: 50,
  });
}

/** Адресната книга на купувача — default адресът първи. */
export async function getBuyerAddresses(buyerId: string): Promise<BuyerAddress[]> {
  return db.query.buyerAddresses.findMany({
    where: eq(buyerAddresses.buyerId, buyerId),
    orderBy: [desc(buyerAddresses.isDefault), desc(buyerAddresses.createdAt)],
  });
}

/** ID-тата на любимите продукти на купувача (за сърце състоянието). */
export async function getBuyerFavoriteIds(buyerId: string): Promise<string[]> {
  const rows = await db.query.buyerFavorites.findMany({
    where: eq(buyerFavorites.buyerId, buyerId),
    columns: { productId: true },
  });
  return rows.map((r) => r.productId);
}

/** Активните любими продукти на купувача В ТОЗИ магазин (данни за показване). */
export async function getBuyerFavoriteProducts(buyerId: string, shopId: string): Promise<Product[]> {
  const ids = await getBuyerFavoriteIds(buyerId);
  if (ids.length === 0) return [];
  return db.query.products.findMany({
    where: and(eq(products.shopId, shopId), eq(products.status, "active"), inArray(products.id, ids)),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/buyer-queries.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/buyer.ts tests/buyer-queries.test.ts
git commit -m "feat(buyer): query слой — поръчки/адреси/любими (филтрирани по buyerId)"
```

---

### Task 5: Мутации — адреси (`src/actions/buyer.ts`, част 1)

**Files:**
- Create: `src/actions/buyer.ts`
- Test: `tests/buyer-address-actions.test.ts` (нов)

**Interfaces:**
- Consumes: `requireBuyer()`, `addressSchema`, `buyerAddresses`, `db`, `ActionResult`/`ok`/`fail`/`zodFail`, `parseBgPhone`, `sanitizeText`, `checkRateLimit`.
- Produces:
  - `saveAddress(rawInput, addressId?): Promise<ActionResult<{ id: string }>>` — създава/обновява (own only).
  - `deleteAddress(addressId): Promise<ActionResult>` — own only.
  - `setDefaultAddress(addressId): Promise<ActionResult>` — маха default от другите на купувача.

- [ ] **Step 1: Write the failing test**

`tests/buyer-address-actions.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireBuyer: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));

const insertValues = vi.fn(() => ({ returning: () => [{ id: "a1" }] }));
const updateWhere = vi.fn().mockResolvedValue(undefined);
const del = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    update: () => ({ set: () => ({ where: updateWhere }) }),
    delete: del,
    query: { buyerAddresses: { findFirst: vi.fn().mockResolvedValue({ id: "a1", buyerId: "b1" }) } },
  },
  buyerAddresses: { id: "id", buyerId: "buyerId", isDefault: "isDefault" },
}));

import { requireBuyer } from "@/lib/auth";
import { saveAddress } from "@/actions/buyer";

describe("saveAddress", () => {
  beforeEach(() => {
    (requireBuyer as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" }, profile: { id: "b1" },
    });
  });
  it("създава адрес при валиден вход", async () => {
    const res = await saveAddress({
      receiverName: "Иван Иванов", receiverPhone: "0888123456", city: "София", address: "ул. Тест 1",
    });
    expect(res.ok).toBe(true);
  });
  it("отхвърля невалиден вход", async () => {
    const res = await saveAddress({ receiverName: "", receiverPhone: "x", city: "", address: "" });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/buyer-address-actions.test.ts`
Expected: FAIL — модулът/`saveAddress` липсва.

- [ ] **Step 3: Implement**

`src/actions/buyer.ts`:
```ts
"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { clientIp } from "@/actions/cart";
import { buyerAddresses, db } from "@/db";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireBuyer } from "@/lib/auth";
import { parseBgPhone } from "@/lib/phone";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { addressSchema } from "@/schemas/buyer";

/** Създава или обновява адрес на купувача (own only). Санитизира текста, нормализира телефона. */
export async function saveAddress(
  rawInput: unknown,
  addressId?: string,
): Promise<ActionResult<{ id: string }>> {
  const { profile } = await requireBuyer();
  const ip = await clientIp();
  if (!(await checkRateLimit(`buyer-addr:${ip}`, 20, 60))) {
    return fail("Твърде много заявки. Опитай след минута.");
  }
  const parsed = addressSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;
  const phone = parseBgPhone(d.receiverPhone);
  const values = {
    buyerId: profile.id,
    label: sanitizeText(d.label ?? "", 40),
    receiverName: sanitizeText(d.receiverName, 100),
    receiverPhone: phone.ok ? phone.e164 : sanitizeText(d.receiverPhone, 30),
    city: sanitizeText(d.city ?? "", 60),
    address: sanitizeText(d.address ?? "", 200),
    courierProvider: d.courierProvider ?? null,
    courierOfficeId: d.courierOfficeId || null,
    courierOfficeName: d.courierOfficeName ? sanitizeText(d.courierOfficeName, 200) : null,
    isDefault: d.isDefault ?? false,
    updatedAt: new Date(),
  };

  if (addressId) {
    const owned = await db.query.buyerAddresses.findFirst({ where: eq(buyerAddresses.id, addressId) });
    if (!owned || owned.buyerId !== profile.id) return fail("Адресът не е намерен.");
    await db.update(buyerAddresses).set(values).where(eq(buyerAddresses.id, addressId));
    if (values.isDefault) await clearOtherDefaults(profile.id, addressId);
    return ok({ id: addressId });
  }

  const [row] = await db.insert(buyerAddresses).values(values).returning({ id: buyerAddresses.id });
  if (values.isDefault) await clearOtherDefaults(profile.id, row!.id);
  return ok({ id: row!.id });
}

async function clearOtherDefaults(buyerId: string, keepId: string) {
  await db
    .update(buyerAddresses)
    .set({ isDefault: false })
    .where(and(eq(buyerAddresses.buyerId, buyerId), ne(buyerAddresses.id, keepId)));
}

/** Трие адрес на купувача (own only). */
export async function deleteAddress(addressId: string): Promise<ActionResult> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(addressId).success) return fail("Невалидна заявка.");
  const owned = await db.query.buyerAddresses.findFirst({ where: eq(buyerAddresses.id, addressId) });
  if (!owned || owned.buyerId !== profile.id) return fail("Адресът не е намерен.");
  await db.delete(buyerAddresses).where(eq(buyerAddresses.id, addressId));
  return ok(null);
}

/** Прави адрес default (маха флага от другите на купувача). */
export async function setDefaultAddress(addressId: string): Promise<ActionResult> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(addressId).success) return fail("Невалидна заявка.");
  const owned = await db.query.buyerAddresses.findFirst({ where: eq(buyerAddresses.id, addressId) });
  if (!owned || owned.buyerId !== profile.id) return fail("Адресът не е намерен.");
  await db.update(buyerAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(buyerAddresses.id, addressId));
  await clearOtherDefaults(profile.id, addressId);
  return ok(null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/buyer-address-actions.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/actions/buyer.ts tests/buyer-address-actions.test.ts
git commit -m "feat(buyer): адресни мутации (save/delete/setDefault, own only)"
```

---

### Task 6: Мутации — любими синхрон + merge + профил (`src/actions/buyer.ts`, част 2)

**Files:**
- Modify: `src/actions/buyer.ts`
- Test: `tests/buyer-favorites-actions.test.ts` (нов)

**Interfaces:**
- Consumes: `requireBuyer()`, `buyerFavorites`, `buyerProfileSchema`, `getBuyerFavoriteIds`.
- Produces:
  - `toggleBuyerFavorite(productId): Promise<ActionResult<{ favorited: boolean }>>`.
  - `mergeFavoritesOnLogin(localIds: string[]): Promise<ActionResult<{ ids: string[] }>>` — вливa localStorage ID-тата (upsert без дубли), връща обединения списък.
  - `updateBuyerProfile(rawInput): Promise<ActionResult>` — име/телефон (own).

- [ ] **Step 1: Write the failing test**

`tests/buyer-favorites-actions.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireBuyer: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));

const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const insertValues = vi.fn(() => ({ onConflictDoNothing }));
const delWhere = vi.fn().mockResolvedValue(undefined);
const findFirst = vi.fn();
const findManyFav = vi.fn().mockResolvedValue([{ productId: "p1" }]);
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    delete: () => ({ where: delWhere }),
    query: { buyerFavorites: { findFirst, findMany: findManyFav } },
  },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" },
}));
vi.mock("@/db/queries/buyer", () => ({ getBuyerFavoriteIds: vi.fn().mockResolvedValue(["p1"]) }));

import { requireBuyer } from "@/lib/auth";
import { mergeFavoritesOnLogin, toggleBuyerFavorite } from "@/actions/buyer";

describe("любими синхрон", () => {
  beforeEach(() => {
    (requireBuyer as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" }, profile: { id: "b1" },
    });
    findFirst.mockReset();
  });

  it("toggle добавя когато липсва", async () => {
    findFirst.mockResolvedValue(undefined);
    const res = await toggleBuyerFavorite("p2");
    expect(res.ok && res.data.favorited).toBe(true);
  });
  it("toggle маха когато има", async () => {
    findFirst.mockResolvedValue({ id: "f1", buyerId: "b1", productId: "p2" });
    const res = await toggleBuyerFavorite("p2");
    expect(res.ok && res.data.favorited).toBe(false);
  });
  it("merge връща обединения списък (без дубли)", async () => {
    const res = await mergeFavoritesOnLogin(["p1", "p2"]);
    expect(res.ok).toBe(true);
  });
  it("merge с празен вход е ок", async () => {
    const res = await mergeFavoritesOnLogin([]);
    expect(res.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/buyer-favorites-actions.test.ts`
Expected: FAIL — функциите липсват.

- [ ] **Step 3: Implement (append to `src/actions/buyer.ts`)**

Добави импорти горе: `buyerFavorites`, `getBuyerFavoriteIds` (`@/db/queries/buyer`), `buyerProfileSchema`, `profiles`.
```ts
import { buyerFavorites, profiles } from "@/db";
import { getBuyerFavoriteIds } from "@/db/queries/buyer";
import { buyerProfileSchema } from "@/schemas/buyer";
```
Функции:
```ts
/** Добавя/маха продукт от любимите на купувача (сървърен синхрон). */
export async function toggleBuyerFavorite(
  productId: string,
): Promise<ActionResult<{ favorited: boolean }>> {
  const { profile } = await requireBuyer();
  if (!z.uuid().safeParse(productId).success) return fail("Невалидна заявка.");
  const existing = await db.query.buyerFavorites.findFirst({
    where: and(eq(buyerFavorites.buyerId, profile.id), eq(buyerFavorites.productId, productId)),
  });
  if (existing) {
    await db
      .delete(buyerFavorites)
      .where(and(eq(buyerFavorites.buyerId, profile.id), eq(buyerFavorites.productId, productId)));
    return ok({ favorited: false });
  }
  await db.insert(buyerFavorites).values({ buyerId: profile.id, productId }).onConflictDoNothing();
  return ok({ favorited: true });
}

/** Влива localStorage любимите в акаунта при вход (upsert, uniqueIndex пази от дубли). */
export async function mergeFavoritesOnLogin(
  localIds: string[],
): Promise<ActionResult<{ ids: string[] }>> {
  const { profile } = await requireBuyer();
  const valid = z.array(z.uuid()).max(100).safeParse(localIds);
  if (!valid.success) return fail("Невалидна заявка.");
  if (valid.data.length > 0) {
    await db
      .insert(buyerFavorites)
      .values(valid.data.map((productId) => ({ buyerId: profile.id, productId })))
      .onConflictDoNothing();
  }
  const ids = await getBuyerFavoriteIds(profile.id);
  return ok({ ids });
}

/** Обновява име/телефон на купувача (own). */
export async function updateBuyerProfile(rawInput: unknown): Promise<ActionResult> {
  const { profile } = await requireBuyer();
  const parsed = buyerProfileSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const phone = parseBgPhone(parsed.data.phone);
  await db
    .update(profiles)
    .set({
      fullName: sanitizeText(parsed.data.fullName, 100),
      phone: phone.ok ? phone.e164 : sanitizeText(parsed.data.phone, 30),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));
  return ok(null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/buyer-favorites-actions.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/actions/buyer.ts tests/buyer-favorites-actions.test.ts
git commit -m "feat(buyer): любими синхрон (toggle/merge) + updateBuyerProfile"
```

---

### Task 7: Свързване на минали гост-поръчки (клик по телефон)

**Files:**
- Modify: `src/actions/buyer.ts`
- Modify: `src/db/queries/buyer.ts` (добавя `countGuestOrdersByPhone`)
- Test: `tests/buyer-link-orders.test.ts` (нов)

**Interfaces:**
- Consumes: `requireBuyer()`, `orders`, `profiles`, `parseBgPhone`.
- Produces:
  - `countLinkableGuestOrders(): Promise<ActionResult<{ count: number }>>` — брой гост-поръчки (buyerId NULL) с телефона на профила.
  - `linkGuestOrders(): Promise<ActionResult<{ linked: number }>>` — свързва тези поръчки към buyerId; вдига `phoneVerified`.

- [ ] **Step 1: Write the failing test**

`tests/buyer-link-orders.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireBuyer: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));

const updateWhere = vi.fn().mockResolvedValue({ rowCount: 2 });
const set = vi.fn(() => ({ where: updateWhere }));
vi.mock("@/db", () => ({
  db: { update: () => ({ set }), select: () => ({ from: () => ({ where: () => [{ value: 2 }] }) }) },
  orders: { buyerId: "buyerId", customerPhone: "customerPhone" },
  profiles: { id: "id" },
}));
vi.mock("@/lib/phone", () => ({ parseBgPhone: () => ({ ok: true, e164: "+359888123456" }) }));

import { requireBuyer } from "@/lib/auth";
import { linkGuestOrders } from "@/actions/buyer";

describe("linkGuestOrders", () => {
  beforeEach(() => {
    (requireBuyer as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" }, profile: { id: "b1", phone: "+359888123456" },
    });
  });
  it("свързва гост-поръчките по телефон", async () => {
    const res = await linkGuestOrders();
    expect(res.ok).toBe(true);
  });
  it("без телефон на профила → грешка", async () => {
    (requireBuyer as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" }, profile: { id: "b1", phone: null },
    });
    const res = await linkGuestOrders();
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/buyer-link-orders.test.ts`
Expected: FAIL — `linkGuestOrders` липсва.

- [ ] **Step 3: Implement**

В `src/db/queries/buyer.ts` добави:
```ts
import { count, isNull } from "drizzle-orm";
import { orders } from "@/db";

/** Брой гост-поръчки (без акаунт) с даден E.164 телефон — за „свържи минали поръчки". */
export async function countGuestOrdersByPhone(phoneE164: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .where(and(isNull(orders.buyerId), eq(orders.customerPhone, phoneE164)));
  return row?.value ?? 0;
}
```
(`and`, `eq` вече импортнати в buyer.ts queries; добави `count`, `isNull`.)

В `src/actions/buyer.ts` добави импорти `orders`, `isNull`, `count`, `countGuestOrdersByPhone` и функциите:
```ts
import { count, isNull } from "drizzle-orm";
import { orders } from "@/db";
import { countGuestOrdersByPhone } from "@/db/queries/buyer";

/** Колко минали гост-поръчки могат да се свържат (по телефона на профила). */
export async function countLinkableGuestOrders(): Promise<ActionResult<{ count: number }>> {
  const { profile } = await requireBuyer();
  if (!profile.phone) return ok({ count: 0 });
  const phone = parseBgPhone(profile.phone);
  if (!phone.ok) return ok({ count: 0 });
  const n = await countGuestOrdersByPhone(phone.e164);
  return ok({ count: n });
}

/** Свързва миналите гост-поръчки с акаунта (по потвърден телефон). Вдига phoneVerified.
    Броим ПРЕДИ update-а (колко ще свържем) — точен резултат за toast-а. */
export async function linkGuestOrders(): Promise<ActionResult<{ linked: number }>> {
  const { profile } = await requireBuyer();
  if (!profile.phone) return fail("Добави телефон в профила, за да свържеш минали поръчки.");
  const phone = parseBgPhone(profile.phone);
  if (!phone.ok) return fail("Телефонът в профила е невалиден.");
  const toLink = await countGuestOrdersByPhone(phone.e164);
  await db
    .update(orders)
    .set({ buyerId: profile.id, updatedAt: new Date() })
    .where(and(isNull(orders.buyerId), eq(orders.customerPhone, phone.e164)));
  await db.update(profiles).set({ phoneVerified: true, updatedAt: new Date() }).where(eq(profiles.id, profile.id));
  return ok({ linked: toLink });
}
```
(Бележка: `orders` в actions/buyer.ts — импортни от `@/db`. `and` вече импортнат в Task 5.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/buyer-link-orders.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/actions/buyer.ts src/db/queries/buyer.ts tests/buyer-link-orders.test.ts
git commit -m "feat(buyer): свързване на минали гост-поръчки по телефон (клик)"
```

---

### Task 8: Роля при вход/регистрация — actions + схема

**Files:**
- Modify: `src/schemas/auth.ts` (добавя `role`)
- Modify: `src/actions/auth.ts` (`signUp`/`signIn` четат роля → redirect)
- Test: `tests/auth-role-redirect.test.ts` (нов — чистата redirect функция)

**Interfaces:**
- Consumes: `getOwnShop`-подобна логика; `loginSchema`/`registerSchema`.
- Produces: `resolvePostAuthPath(hasShop, preferredRole, next?): string` (чиста функция) — за redirect след вход. `registerSchema` получава optional `role: 'buyer'|'seller'`.

- [ ] **Step 1: Write the failing test**

`tests/auth-role-redirect.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolvePostAuthPath } from "@/actions/auth";

describe("resolvePostAuthPath", () => {
  it("има магазин → dashboard", () => {
    expect(resolvePostAuthPath(true, null)).toBe("/dashboard");
  });
  it("продавач без магазин → onboarding", () => {
    expect(resolvePostAuthPath(false, "seller")).toBe("/dashboard");
  });
  it("купувач без магазин → account (или next)", () => {
    expect(resolvePostAuthPath(false, "buyer")).toBe("/account");
    expect(resolvePostAuthPath(false, "buyer", "/s/shop/checkout")).toBe("/s/shop/checkout");
  });
  it("непознат next се пренебрегва (open-redirect гард)", () => {
    expect(resolvePostAuthPath(false, "buyer", "https://evil.com")).toBe("/account");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/auth-role-redirect.test.ts`
Expected: FAIL — `resolvePostAuthPath` липсва.

- [ ] **Step 3: Implement**

В `src/schemas/auth.ts`, добави към `registerSchema` (намери обекта и добави поле):
```ts
  role: z.enum(["buyer", "seller"]).optional(),
```
В `src/actions/auth.ts`, добави чистата функция + я използвай:
```ts
import { safeNextPath } from "@/lib/safe-redirect";

/** Дестинация след вход: магазин или продавач → dashboard; купувач → account или валиден next. */
export function resolvePostAuthPath(
  hasShop: boolean,
  preferredRole: "buyer" | "seller" | null,
  next?: string,
): string {
  if (hasShop || preferredRole === "seller") return "/dashboard";
  const safe = safeNextPath(next);
  return safe !== "/dashboard" ? safe : "/account";
}
```
В `signUp`: прочети `role` от формата, запиши го в profile `preferredRole`, и redirect по него:
```ts
  const role = formData.get("role") === "buyer" ? "buyer" : formData.get("role") === "seller" ? "seller" : null;
  // ... след успешен signUp + insert:
  await db.insert(profiles).values({
    id: data.user.id,
    fullName: sanitizeText(parsed.data.fullName, 100),
    preferredRole: role,
  }).onConflictDoNothing();
  redirect(resolvePostAuthPath(false, role));
```
В `signIn`: след успешен вход, зареди магазина + preferredRole и redirect:
```ts
  // след успешен signInWithPassword:
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  let hasShop = false;
  let preferredRole: "buyer" | "seller" | null = null;
  if (uid) {
    const shop = await db.query.shops.findFirst({ where: eq(shops.ownerId, uid), columns: { id: true } });
    hasShop = Boolean(shop);
    const prof = await db.query.profiles.findFirst({ where: eq(profiles.id, uid), columns: { preferredRole: true } });
    preferredRole = (prof?.preferredRole as "buyer" | "seller" | null) ?? null;
  }
  redirect(resolvePostAuthPath(hasShop, preferredRole));
```
(Добави импорти: `eq` от drizzle-orm, `shops` от `@/db`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/auth-role-redirect.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/schemas/auth.ts src/actions/auth.ts tests/auth-role-redirect.test.ts
git commit -m "feat(buyer): роля при вход/регистрация → resolvePostAuthPath redirect"
```

---

### Task 9: AuthForm toggle купувач/продавач (UI)

**Files:**
- Modify: `src/components/auth/auth-form.tsx`
- Modify: `src/app/(auth)/auth/login/page.tsx` + `src/app/(auth)/auth/register/page.tsx` (четат `?role`)

**Interfaces:**
- Consumes: `AuthForm` props (`mode`, `action`, `oauthError`); добавя `role?: "buyer"|"seller"`.
- Produces: визуален toggle (сегментиран контрол) + различен copy; hidden `role` поле в формата; `signInWithProvider` bind с правилен `next`.

- [ ] **Step 1: Extend AuthForm props + toggle (визуална промяна, ръчна проверка)**

В `src/components/auth/auth-form.tsx`:
- Добави към `AuthFormProps`: `role?: "buyer" | "seller";`
- В компонента: `const activeRole = role ?? "seller";` (default продавач — запазва сегашния екран).
- Добави сегментиран toggle НАД hero блока (само линкове, сменят `?role`):
```tsx
{/* Toggle роля — купувач/продавач. Сменя copy + къде отива след вход. Линкове
    (не state) → работи и без JS, и SEO-чисто; активният е подчертан. */}
<div className="flex rounded-control border border-surface-200 bg-surface-0 p-1 text-sm font-medium">
  <Link
    href={`/auth/${mode === "register" ? "register" : "login"}?role=buyer`}
    className={`flex-1 rounded-[calc(var(--radius-control)-2px)] py-2 text-center transition-colors ${
      activeRole === "buyer" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"
    }`}
  >
    Пазарувам
  </Link>
  <Link
    href={`/auth/${mode === "register" ? "register" : "login"}?role=seller`}
    className={`flex-1 rounded-[calc(var(--radius-control)-2px)] py-2 text-center transition-colors ${
      activeRole === "seller" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900"
    }`}
  >
    Продавам
  </Link>
</div>
```
- Замени статичните заглавия/подзаглавия да зависят от `activeRole` (купувач copy vs продавач copy). Пример за desktop H1 подзаглавие:
```tsx
<p className="text-pretty text-ink-500">
  {activeRole === "buyer"
    ? "Влез, за да следиш поръчките си, адресите и любимите."
    : isRegister
      ? "Няколко полета и си готов да продаваш. Без ангажимент, без договори."
      : "Радваме се да те видим отново."}
</p>
```
(Аналогично за мобилния hero блок и kicker-а: „Пазарувай" vs „Нов магазин".)
- Добави hidden поле в имейл формата (`<form action={formAction}>`):
```tsx
<input type="hidden" name="role" value={activeRole} />
```
- Промени Google бутона да носи роля в `next` (купувач → `/account`):
```tsx
<form action={signInWithProvider.bind(null, activeRole === "buyer" ? "/account" : undefined)}>
```

- [ ] **Step 2: Pages четат `?role`**

В `src/app/(auth)/auth/login/page.tsx` и `register/page.tsx` — прочети searchParam и подай:
```tsx
interface PageProps { searchParams: Promise<{ role?: string; error?: string }>; }

export default async function LoginPage({ searchParams }: PageProps) {
  const { role, error } = await searchParams;
  const safeRole = role === "buyer" ? "buyer" : role === "seller" ? "seller" : undefined;
  return <AuthForm mode="login" action={signIn} role={safeRole} oauthError={error === "oauth" ? "Входът с Google не бе успешен. Опитай пак." : undefined} />;
}
```
(Аналогично register с `action={signUp}`. Ако page-ът вече чете `error`, само добави `role`.)

- [ ] **Step 3: Verify build/lint**

Run: `pnpm check`
Expected: lint + unit + build зелени (без нови unit тестове тук — визуалната проверка е ръчна на живо).

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/auth-form.tsx "src/app/(auth)/auth/login/page.tsx" "src/app/(auth)/auth/register/page.tsx"
git commit -m "feat(buyer): toggle купувач/продавач на вход/регистрация (различен copy)"
```

---

### Task 10: Checkout попълва buyerId + autofill от адресна книга

**Files:**
- Modify: `src/actions/orders.ts` (`createOrder` чете логнат купувач → `buyerId`)
- Modify: `src/components/storefront/checkout-form.tsx` (избор на запазен адрес)
- Test: `tests/create-order-buyer.test.ts` (нов — buyerId се подава при логнат)

**Interfaces:**
- Consumes: `createSupabaseServer()` (за auth в публичния createOrder), `getBuyerAddresses`.
- Produces: поръчката носи `buyerId` при логнат купувач; checkout dropdown „Използвай запазен адрес".

- [ ] **Step 1: Write the failing test**

`tests/create-order-buyer.test.ts` — минимален: чистата helper функция, която резолюира buyerId:
```ts
import { describe, expect, it, vi } from "vitest";
import { resolveBuyerId } from "@/actions/orders";

describe("resolveBuyerId", () => {
  it("връща user id при логнат", async () => {
    const supabase = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) } };
    expect(await resolveBuyerId(supabase as never)).toBe("u1");
  });
  it("връща null при гост", async () => {
    const supabase = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } };
    expect(await resolveBuyerId(supabase as never)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/create-order-buyer.test.ts`
Expected: FAIL — `resolveBuyerId` липсва.

- [ ] **Step 3: Implement (сървър)**

В `src/actions/orders.ts`:
- Добави хелпъра (близо до върха, след импортите):
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

/** buyerId за поръчката: логнат купувач → неговото id; гост → null (както преди). */
export async function resolveBuyerId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
```
- В `createOrder`, преди транзакцията, вземи buyerId:
```ts
  const supabase = await createSupabaseServer();
  const buyerId = await resolveBuyerId(supabase);
```
- Подай `buyerId` в `insertOrderWithNumber` values обекта (до `courierOfficeName`):
```ts
          buyerId,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/create-order-buyer.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Checkout autofill (визуална промяна, ръчна проверка)**

В `src/components/storefront/checkout-form.tsx`:
- Приеми нов optional prop `savedAddresses?: BuyerAddress[]` (подава се от checkout страницата — Task 11 връзка; за сега страницата подава `[]` за гост).
- Ако `savedAddresses.length > 0`, покажи горе селект „Използвай запазен адрес" (стилизиран с `--sf-*`); при избор попълни `form` state (`customerName`←receiverName, `customerPhone`←receiverPhone, `city`, `address`; ако адресът е офис → сет на courierOffice).
```tsx
{savedAddresses.length > 0 && (
  <div className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-(--sf-text)">Запазен адрес</span>
    <select
      className="w-full rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 py-2.5 text-sm text-(--sf-text)"
      defaultValue=""
      onChange={(e) => {
        const a = savedAddresses.find((x) => x.id === e.target.value);
        if (!a) return;
        setForm((f) => ({ ...f, customerName: a.receiverName, customerPhone: a.receiverPhone, city: a.city, address: a.address }));
        if (a.courierProvider && a.courierOfficeId) {
          setCourierOffice({ officeId: a.courierOfficeId, officeName: a.courierOfficeName ?? "" });
        }
      }}
    >
      <option value="">— Нов адрес —</option>
      {savedAddresses.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label || a.receiverName} · {a.courierOfficeName || a.address || a.city}
        </option>
      ))}
    </select>
  </div>
)}
```
(Провери реалните имена на state setter-ите в компонента — `setForm`, `setCourierOffice`; ако се различават, ползвай реалните.)

- [ ] **Step 6: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add src/actions/orders.ts src/components/storefront/checkout-form.tsx tests/create-order-buyer.test.ts
git commit -m "feat(buyer): checkout попълва buyerId + autofill от адресна книга"
```

---

### Task 11: Профилни страници + storefront хедър икона

**Files:**
- Modify: `src/app/(storefront)/s/[slug]/layout.tsx` (резолюира viewer user id)
- Modify: `src/components/storefront/header/shared.tsx` (+ вариантите) — профил икона
- Create: `src/components/storefront/account/account-nav.tsx` (Tabs навигация)
- Create: `src/components/storefront/account/address-manager.tsx` (CRUD drawer)
- Create: `src/app/(storefront)/s/[slug]/account/layout.tsx` (гард: requireBuyer)
- Create: `src/app/(storefront)/s/[slug]/account/page.tsx` (табло)
- Create: `src/app/(storefront)/s/[slug]/account/orders/page.tsx`
- Create: `src/app/(storefront)/s/[slug]/account/addresses/page.tsx`
- Create: `src/app/(storefront)/s/[slug]/account/settings/page.tsx`

**Interfaces:**
- Consumes: `requireBuyer()`, `getBuyerOrders`, `getBuyerAddresses`, `getPublicShop`, `saveAddress`/`deleteAddress`/`setDefaultAddress`, `countLinkableGuestOrders`/`linkGuestOrders`, `updateBuyerProfile`, `Tabs` (`@/components/ui`), `Drawer`, `reorder-button`.
- Produces: работещи профилни страници под `/s/{slug}/account`.

- [ ] **Step 1: Layout резолюира viewer (сървър)**

В `src/app/(storefront)/s/[slug]/layout.tsx`, добави auth резолюция и подай на хедъра:
```ts
import { createSupabaseServer } from "@/lib/supabase/server";
// ... вътре в layout:
const supabase = await createSupabaseServer();
const { data: { user } } = await supabase.auth.getUser();
// подай на <StorefrontHeader ... viewerLoggedIn={Boolean(user)} />
```
Разшири `StorefrontHeader` + `HeaderVariantProps` с `viewerLoggedIn?: boolean` (прокарва се до вариантите).

- [ ] **Step 2: Профил икона в хедъра**

В `src/components/storefront/header/shared.tsx` добави reusable `AccountButton`:
```tsx
export function AccountButton({ base, loggedIn }: { base: string; loggedIn: boolean }) {
  return (
    <Link
      href={loggedIn ? `${base}/account` : `/auth/login?role=buyer&next=${encodeURIComponent(`${base}/account`)}`}
      aria-label={loggedIn ? "Моят профил" : "Вход"}
      className="flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70"
    >
      <Icon name="user" size={22} />
    </Link>
  );
}
```
Постави `<AccountButton base={base} loggedIn={viewerLoggedIn ?? false} />` до `<FavoritesButton>` във всеки вариант (variant-1/2/3). Провери че `user` иконата съществува в Icon set-а; ако липсва — добави я в `src/components/ui/icon.tsx` (Lucide „user": кръг глава + рамене path).

- [ ] **Step 3: Account layout гард + nav**

`src/app/(storefront)/s/[slug]/account/layout.tsx`:
```tsx
import { requireBuyer } from "@/lib/auth";
import { AccountNav } from "@/components/storefront/account/account-nav";

export default async function AccountLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  await requireBuyer(); // нелогнат → redirect login
  const { slug } = await params;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <AccountNav base={`/s/${slug}`} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
```
`src/components/storefront/account/account-nav.tsx` — прост клиентски таб ред (линкове с `usePathname`, `--sf-*`):
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { seg: "", label: "Табло" },
  { seg: "/orders", label: "Поръчки" },
  { seg: "/addresses", label: "Адреси" },
  { seg: "/settings", label: "Настройки" },
];

export function AccountNav({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-(--sf-border)">
      {ITEMS.map((it) => {
        const href = `${base}/account${it.seg}`;
        const active = path === href;
        return (
          <Link key={it.seg} href={href}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "border-b-2 border-(--sf-primary) text-(--sf-text)" : "text-(--sf-muted) hover:text-(--sf-text)"
            }`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Табло + Поръчки + Настройки страници (сървър)**

`account/page.tsx` (табло): `requireBuyer` → поздрав + последна поръчка + `countLinkableGuestOrders` банер „Намерихме N минали поръчки — свържи ги" (client бутон вика `linkGuestOrders`, после `router.refresh`).

`account/orders/page.tsx`:
```tsx
import { getPublicShop } from "@/db/queries/storefront";
import { getBuyerOrders } from "@/db/queries/buyer";
import { requireBuyer } from "@/lib/auth";
// вземи shop по slug → getBuyerOrders(profile.id, shop.id); списък: номер, статус, дата, formatPrice(total),
// линк към `${base}/order/${o.id}?t=${o.publicToken}`, + <ReorderButton> (реюз).
// EmptyState ако няма.
```

`account/settings/page.tsx`: форма (client) с `updateBuyerProfile` (име/телефон) + линк „Отвори магазин" (`/dashboard/onboarding`) + изтриване (реюз на съществуващия account-deletion компонент).

- [ ] **Step 5: Адреси страница (CRUD drawer)**

`account/addresses/page.tsx` (сървър) зарежда `getBuyerAddresses(profile.id)` → рендерира `<AddressManager addresses={...} />`.
`src/components/storefront/account/address-manager.tsx` (client): списък с карти + „Добави адрес" отваря `<Drawer>` с форма (`saveAddress`); „Направи основен" (`setDefaultAddress`); „Изтрий" (`deleteAddress`, `ConfirmDialog`). Toast + локален refresh. **НЕ добавяй `loading.tsx` към account/addresses** (drawer remount правило).

- [ ] **Step 6: Verify build/lint**

Run: `pnpm check`
Expected: зелено.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(storefront)/s/[slug]/account" "src/app/(storefront)/s/[slug]/layout.tsx" src/components/storefront/account src/components/storefront/header
git commit -m "feat(buyer): профилни страници + профил икона в storefront хедъра"
```

---

### Task 12: Любими — сървърен режим за логнати + e2e

**Files:**
- Create: `src/lib/buyer-favorites-storage.ts` (client слой — избира източник)
- Modify: `src/components/storefront/favorite-button.tsx` + `favorites-view.tsx` (logged-in режим)
- Create: `e2e/buyer-account.spec.ts`
- Test: `tests/buyer-favorites-storage.test.ts` (нов — избор на източник)

**Interfaces:**
- Consumes: `toggleFavorite` (localStorage, гост), `toggleBuyerFavorite` (сървър, логнат), `mergeFavoritesOnLogin`.
- Produces: `useFavoriteSource(loggedIn, shopId)` хук/хелпър, който за логнати чете сървърни id-та и пише през action-а; за гости остава localStorage.

- [ ] **Step 1: Write the failing test**

`tests/buyer-favorites-storage.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { pickFavoriteMode } from "@/lib/buyer-favorites-storage";

describe("pickFavoriteMode", () => {
  it("логнат → server", () => expect(pickFavoriteMode(true)).toBe("server"));
  it("гост → local", () => expect(pickFavoriteMode(false)).toBe("local"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/buyer-favorites-storage.test.ts`
Expected: FAIL — модулът липсва.

- [ ] **Step 3: Implement client слой**

`src/lib/buyer-favorites-storage.ts`:
```ts
"use client";
/** Избор на източник за любимите: логнат купувач → сървър (buyerFavorites); гост → localStorage. */
export function pickFavoriteMode(loggedIn: boolean): "server" | "local" {
  return loggedIn ? "server" : "local";
}
```
(Пълната wiring на сървърните id-та в компонентите: `favorite-button.tsx` получава `loggedIn` + начални `serverFavoriteIds`; при `server` режим toggle-ва през `toggleBuyerFavorite` и оптимистично обновява локален state вместо localStorage. `favorites-view.tsx` за логнат чете `getBuyerFavoriteProducts` вместо localStorage id-тата. Гост пътят остава непроменен.)

- [ ] **Step 4: Merge при вход**

Добави клиентски ефект (напр. в account layout client boundary или малък `<FavoritesMerger>` в storefront layout за логнати): при първо зареждане на логнат купувач извикай `mergeFavoritesOnLogin(readFavorites(shopId))`, после изчисти localStorage за този shopId (`window.localStorage.removeItem`). Извиква се веднъж (guard флаг в `sessionStorage`).

- [ ] **Step 5: Run unit test**

Run: `pnpm test -- tests/buyer-favorites-storage.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 6: E2e тест**

`e2e/buyer-account.spec.ts` (следвай съществуващите e2e паттерни — `@gmail.com` алиас, cookie банер през `addInitScript` → `localStorage frizmo-cookie-notice=1`):
```ts
import { expect, test } from "@playwright/test";

test.describe("купувачески профил", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => localStorage.setItem("frizmo-cookie-notice", "1"));
  });

  test("регистрация като купувач → профил е достъпен", async ({ page }) => {
    const email = `buyer.${Date.now()}@gmail.com`;
    await page.goto("/auth/register?role=buyer");
    await expect(page.getByText("Пазарувам")).toBeVisible();
    await page.getByLabel("Име и фамилия").fill("Тест Купувач");
    await page.getByLabel("Имейл").fill(email);
    await page.getByLabel("Парола").fill("Parola123!");
    await page.getByRole("button", { name: "Регистрирай се" }).click();
    // купувач без магазин → /account
    await expect(page).toHaveURL(/\/account/);
  });

  test("адрес CRUD в профила", async ({ page }) => {
    // логни съществуващ e2e купувач, отиди на /s/{demoSlug}/account/addresses,
    // добави адрес през drawer, увери се че се показва, изтрий го.
    // (използвай демо магазина от seed-demo-shops.mjs)
  });
});
```
(Втория тест се допълва спрямо реалния e2e login helper в проекта — виж съществуващите spec-ове за паттерна на вход.)

- [ ] **Step 7: Run e2e изолирано**

Run: `pnpm test:e2e -- buyer-account`
Expected: PASS (регистрационният тест минава; адрес CRUD спрямо демо магазина).

- [ ] **Step 8: Финален гейт + commit**

Run: `pnpm check`
Expected: lint + всички unit + build зелени.
```bash
git add src/lib/buyer-favorites-storage.ts src/components/storefront/favorite-button.tsx src/components/storefront/favorites-view.tsx e2e/buyer-account.spec.ts tests/buyer-favorites-storage.test.ts
git commit -m "feat(buyer): любими сървърен синхрон за логнати + e2e"
```

---

## Финал (след всички задачи)

- [ ] Пълен `pnpm check` (гейт).
- [ ] `pnpm test:e2e -- buyer-account` изолирано.
- [ ] Обнови `docs/WORKLOG.md` (нов ред в Дневника) + паметта.
- [ ] Докладвай на потребителя: готово локално, чака ръчна проверка на живо + push разрешение. **НЕ push-вай без изрично „да".**
