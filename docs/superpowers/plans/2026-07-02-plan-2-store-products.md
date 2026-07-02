# Plan 2: Магазин и продукти — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Inline режим — изборът на потребителя). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Търговецът създава магазина си през onboarding wizard и управлява продукти с характеристики, опционни оси (цвят/размер), варианти (цена/наличност/снимки per вариант) и категории — със снимки в Supabase Storage и пълна ownership защита на всяка мутация.

**Architecture:** Разширяваме Drizzle схемата с 5 таблици (categories, products, product_attributes, product_options, product_variants). Всички мутации минават през `requireShop()` (auth + собственост) в Server Actions, връщащи унифициран `ActionResult<T>`. Снимките се качват директно от браузъра към Supabase Storage чрез подписани upload URL-и, издавани от сървъра след проверка на собственост; bucket-ът има вградени лимити (5MB, само изображения). Вариантите се генерират като декартово произведение на опционните оси, с per-вариант override на цена/наличност/снимки.

**Tech Stack:** Наличният от План 1 + `sonner` (toasts) + Supabase Storage (нов bucket `shop-media`) + `SUPABASE_SECRET_KEY` (server-only, за storage операции).

---

## Ключови решения (заковани тук, преди кода)

1. **Един магазин на потребител в MVP** — unique index на `shops.ownerId`. Опростява всичко (никакво „избери магазин"); спецификацията никъде не изисква повече. Много магазини = бъдещо разширение.
2. **План лимити**: до План 6 (Stripe) няма `subscriptions` таблица → `src/lib/plan.ts` връща `"pro"` за всички магазини (реално поведение: всеки нов магазин е в trial = Pro достъп, точно по спец §10). Лимитът от 8 снимки/продукт обаче се прилага винаги (storage разход).
3. **Select компонент** = стилизиран wrapper около native `<select>` — на мобилно native picker-ът е по-добрият UX, а правилото „без голи елементи в страници" е спазено.
4. **Запис на варианти**: при save на продукт — `db.transaction`: update на продукта + delete/re-insert на attributes/options/variants. Просто и коректно (няма външни referencing FK-та към тези редове в този план).
5. **Цена на вариант**: `priceCents = null` → наследява цената на продукта; попълнена → override. Същото за `stock`.
6. **Категории**: max 1 ниво дълбочина (parent → child), подредба със стрелки нагоре/надолу (`sortOrder`), без drag&drop в този план. Изтриване на категория → продуктите ѝ остават без категория (`set null`), подкатегориите стават коренни.
7. **Storage пътища**: `shops/{shopId}/products/{uuid}.{ext}` — bucket `shop-media`, публичен за четене (снимките са публични на storefront-а), запис само през подписани URL-и.
8. **Working hours / social links**: единични текстови полета в MVP (jsonb `{ text: string }` / `{ facebook?, instagram?, tiktok? }`) — без сложен per-ден редактор.

---

## Предпоставки (ръчни стъпки)

1. В `.env.local` се добавя `SUPABASE_SECRET_KEY=sb_secret_...` (Settings → API Keys → Secret keys → default). **Server-only** — никога `NEXT_PUBLIC_`.
2. Същата променлива се добавя във Vercel (Production + Preview) преди deploy-а на плана.

---

### Task 1: Схема — 5 нови таблици + един магазин на потребител

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `.env.example` (SUPABASE_SECRET_KEY ред)

- [ ] **Step 1: Добави в `src/db/schema.ts`** (след `shops`):

```ts
import { integer, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core"; // добавят се към съществуващия import

export const productStatusEnum = pgEnum("product_status", ["active", "inactive"]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categories_shop_idx").on(t.shopId)],
).enableRLS();

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    promoPriceCents: integer("promo_price_cents"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    status: productStatusEnum("status").notNull().default("active"),
    stock: integer("stock"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_shop_slug_idx").on(t.shopId, t.slug),
    index("products_shop_idx").on(t.shopId),
    index("products_category_idx").on(t.categoryId),
    index("products_status_idx").on(t.status),
  ],
).enableRLS();

export const productAttributes = pgTable(
  "product_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_attributes_product_idx").on(t.productId)],
).enableRLS();

export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    values: jsonb("values").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_options_product_idx").on(t.productId)],
).enableRLS();

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    options: jsonb("options").$type<Record<string, string>>().notNull(),
    priceCents: integer("price_cents"),
    stock: integer("stock"),
    sku: text("sku"),
    imagePaths: jsonb("image_paths").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
).enableRLS();

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductAttribute = typeof productAttributes.$inferSelect;
export type ProductOption = typeof productOptions.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
```

- [ ] **Step 2: Един магазин на потребител** — в дефиницията на `shops` замени `index("shops_owner_idx")` с `uniqueIndex("shops_owner_idx")`.

- [ ] **Step 3:** `pnpm db:push` (със заредени env). Expected: `Changes applied`. Провери в Supabase Table Editor: 5 нови таблици, всички с RLS.

- [ ] **Step 4:** Добави в `.env.example`: `SUPABASE_SECRET_KEY=sb_secret_...` с коментар "server-only, за Storage".

- [ ] **Step 5:** Commit: `feat: extend schema with categories, products, attributes, options and variants`

---

### Task 2: UI примитиви — партида 2

**Files:**
- Create: `src/components/ui/textarea.tsx`, `select.tsx`, `checkbox.tsx`, `modal.tsx`, `confirm-dialog.tsx`, `empty-state.tsx`, `table.tsx`, `price-input.tsx`
- Create: `src/components/ui/select.test.tsx`, `modal.test.tsx`
- Modify: `src/components/ui/index.ts`, `src/app/(dashboard)/dashboard/layout.tsx` (Toaster)

Всички следват патърна от План 1: типизирани props, токени, 44px, error/hint като Input.

- [ ] **Step 1:** `pnpm add sonner`

- [ ] **Step 2: Компонентите** (спецификация; кодът следва патърна на `input.tsx`):
  - `Textarea` — като Input, но `<textarea>` с `rows` prop (default 4), auto `resize-y`.
  - `Select` — label + стилизиран native `<select>` (същите класове като Input, + chevron икона), `options: { value: string; label: string }[]`, `placeholder` (disabled option), error/hint. `"use client"` (useId).
  - `Checkbox` — label отдясно, `size-5`, токен цветове.
  - `Modal` — `"use client"`; props: `open`, `onClose`, `title`, `children`, `footer?`. Рендерира се в portal; backdrop (`bg-ink-900/40`) затваря при клик; `Escape` затваря; фокусът влиза в модала при отваряне; `aria-modal`, `role="dialog"`, `aria-labelledby` към заглавието. На мобилно: долепен до дъното (bottom sheet), на десктоп: центриран, `max-w-lg`.
  - `ConfirmDialog` — обвивка на Modal: `message`, `confirmLabel` (default „Изтрий"), `onConfirm` (async — бутонът е с loading), danger вариант.
  - `EmptyState` — икона (emoji prop), заглавие, описание, optional CTA (`action?: ReactNode`). Центриран в Card.
  - `Table` — семантична `<table>` с токен стилове: `Table`, `THead`, `TRow`, `TCell` подкомпоненти; wrapper с `overflow-x-auto`; редовете `hover:bg-surface-50`.
  - `PriceInput` — Input с суфикс „€", `inputMode="decimal"`; държи string; валидацията е през Zod/`toCents` на сървъра.

- [ ] **Step 3: Тестове** — `select.test.tsx`: label свързан, рендерира опциите, error → `aria-invalid`. `modal.test.tsx`: не рендерира при `open=false`; рендерира title/children при `open`; Escape вика `onClose`.

- [ ] **Step 4:** В dashboard layout добави `<Toaster position="top-right" richColors />` от sonner (клиентски остров — малък `dashboard/toaster.tsx` с `"use client"`).

- [ ] **Step 5:** `pnpm test` → PASS. Commit: `feat: add UI primitives batch 2 (Textarea, Select, Modal, Table, EmptyState...)`

---

### Task 3: Action инфраструктура — ActionResult, requireShop, уникални slug-ове

**Files:**
- Create: `src/lib/action-result.ts`, `src/lib/shop-slug.ts`, `src/lib/shop-slug.test.ts`, `src/lib/plan.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: `src/lib/action-result.ts`**

```ts
import type { ZodError } from "zod";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = null>(error: string): ActionResult<T> {
  return { ok: false, error };
}

export function zodFail<T = null>(error: ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: "Провери полетата с грешки.", fieldErrors };
}
```

(Съществуващият `AuthFormState` в `actions/auth.ts` остава — auth формите са преди да има магазин.)

- [ ] **Step 2: В `src/lib/auth.ts` добави:**

```ts
import { eq } from "drizzle-orm";
import { shops } from "@/db";

/** Магазинът на текущия потребител или null (за UI разклонения). */
export async function getOwnShop() {
  const user = await requireUser();
  const shop = await db.query.shops.findFirst({ where: eq(shops.ownerId, user.id) });
  return { user, shop: shop ?? null };
}

/** За мутации/страници, изискващи магазин: няма магазин → onboarding. */
export async function requireShop() {
  const { user, shop } = await getOwnShop();
  if (!shop) redirect("/dashboard/onboarding");
  return { user, shop };
}
```

- [ ] **Step 3: `src/lib/plan.ts`**

```ts
/**
 * До План 6 (Stripe) няма subscriptions таблица: всеки магазин е в trial,
 * а trial = пълен Pro достъп (спец §10). Тук е ЕДИНСТВЕНОТО място, което
 * План 6 ще замени с реална проверка.
 */
export type PlanId = "starter" | "pro";

export const PLAN_LIMITS = {
  starter: { maxProducts: 50 },
  pro: { maxProducts: Infinity },
} as const;

export async function getShopPlan(_shopId: string): Promise<PlanId> {
  return "pro";
}
```

- [ ] **Step 4: `src/lib/shop-slug.ts`** (+ TDD тест преди имплементацията)

```ts
import { eq } from "drizzle-orm";
import { db, shops } from "@/db";
import { slugify } from "@/lib/slug";

export const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "dashboard", "shops", "products",
  "blog", "pricing", "s", "www", "onboarding", "cart", "checkout",
]);

/** Чиста функция за тестване: следващ кандидат при колизия. */
export function nextSlugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

export async function generateUniqueShopSlug(name: string): Promise<string> {
  let base = slugify(name) || "magazin";
  if (RESERVED_SLUGS.has(base)) base = `${base}-shop`;
  for (let attempt = 0; ; attempt++) {
    const candidate = nextSlugCandidate(base, attempt);
    const existing = await db.query.shops.findFirst({ where: eq(shops.slug, candidate) });
    if (!existing) return candidate;
  }
}
```

Тестове (`shop-slug.test.ts`, без db — само чистите части): `nextSlugCandidate("ferma", 0) === "ferma"`, `nextSlugCandidate("ferma", 1) === "ferma-2"`; `RESERVED_SLUGS.has("dashboard")`.
Аналогична функция за продуктови slug-ове се добавя в Task 6 (уникалност per магазин, проверка срещу `products` с `and(eq(shopId), eq(slug))`).

- [ ] **Step 5:** `pnpm test` → PASS. Commit: `feat: add action infrastructure (ActionResult, requireShop, unique slugs, plan stub)`

---

### Task 4: Supabase Storage — bucket, admin клиент, upload поток, ImageUploader

**Files:**
- Create: `src/lib/supabase/admin.ts`, `scripts/setup-storage.mjs`, `src/lib/storage.ts`, `src/actions/uploads.ts`, `src/components/dashboard/image-uploader.tsx`
- Modify: `next.config.ts`, `.env.local` (ръчна стъпка), `package.json`

- [ ] **Step 1:** `pnpm add server-only`

- [ ] **Step 2: `src/lib/supabase/admin.ts`** — server-only клиент със secret key:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

/** САМО за Storage операции. Никога не изтича към клиента. */
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 3: `scripts/setup-storage.mjs`** — еднократен setup (изпълнява се локално със заредени env):

```js
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const { error } = await admin.storage.createBucket("shop-media", {
  public: true,
  fileSizeLimit: "5MB",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
});
if (error && !error.message.includes("already exists")) throw error;
console.log("bucket shop-media OK");
```

Script в package.json: `"storage:setup": "node scripts/setup-storage.mjs"`. Run → `bucket shop-media OK`.

- [ ] **Step 4: `src/lib/storage.ts`**

```ts
export const SHOP_MEDIA_BUCKET = "shop-media";
export const MAX_PRODUCT_IMAGES = 8;
export const ALLOWED_IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "avif"] as const;

export function publicImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${SHOP_MEDIA_BUCKET}/${path}`;
}
```

- [ ] **Step 5: `src/actions/uploads.ts`** — подписан upload URL след ownership проверка:

```ts
"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireShop } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALLOWED_IMAGE_EXT, SHOP_MEDIA_BUCKET } from "@/lib/storage";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const requestSchema = z.object({ ext: z.enum(ALLOWED_IMAGE_EXT) });

export async function requestProductImageUpload(input: {
  ext: string;
}): Promise<ActionResult<{ path: string; token: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail("Неподдържан формат на файла.");

  const { shop } = await requireShop();
  const path = `shops/${shop.id}/products/${randomUUID()}.${parsed.data.ext}`;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(SHOP_MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return fail("Качването е недостъпно в момента. Опитай пак.");

  return ok({ path: data.path, token: data.token });
}

export async function deleteProductImage(path: string): Promise<ActionResult> {
  const { shop } = await requireShop();
  if (!path.startsWith(`shops/${shop.id}/`)) return fail("Нямаш достъп до този файл.");
  const admin = createSupabaseAdmin();
  await admin.storage.from(SHOP_MEDIA_BUCKET).remove([path]);
  return ok(null);
}
```

- [ ] **Step 6: `ImageUploader`** (`"use client"`): props `{ images: string[]; onChange(images: string[]): void; max?: number }`. Поведение: grid от thumbnail-и (`next/image` + `publicImageUrl`... клиентска версия чете `NEXT_PUBLIC_SUPABASE_URL` — изнеси хелпъра така, че да работи и в клиента: в `storage.ts` няма `server-only` import) + „Добави снимка" плочка (`<input type="file" accept="image/*" multiple>`); за всеки файл: клиентска проверка (тип/размер ≤5MB, брой ≤ max) → `requestProductImageUpload({ ext })` → `createSupabaseBrowser().storage.from("shop-media").uploadToSignedUrl(path, token, file)` → добавя path в списъка. Всяка снимка: бутон „✕" (вика `onChange` без нея; реалното триене от Storage става при save на формата — списъкът е source of truth) и стрелки ←/→ за подредба (първата снимка е корица). Loading състояние per файл; грешките → toast.

- [ ] **Step 7: `next.config.ts`** — позволи Supabase host за next/image:

```ts
import type { NextConfig } from "next";

const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co").hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 8:** Ръчно: добави `SUPABASE_SECRET_KEY` в `.env.local` (и във Vercel). `pnpm storage:setup` → OK. Commit: `feat: add Supabase Storage upload flow with signed URLs and ImageUploader`

---

### Task 5: Магазин — schemas, actions, таб „Магазин", onboarding стъпка 1

**Files:**
- Create: `src/schemas/shop.ts`, `src/actions/shop.ts`
- Create: `src/components/dashboard/shop-form.tsx`
- Create: `src/app/(dashboard)/dashboard/store/page.tsx`
- Create: `src/app/(dashboard)/dashboard/onboarding/page.tsx`

- [ ] **Step 1: `src/schemas/shop.ts`**

```ts
import { z } from "zod";

export const BUSINESS_CATEGORIES = [
  "Дрехи и мода", "Обувки", "Храни и напитки", "Козметика",
  "Ръчна изработка", "Електроника", "Строителни материали", "За дома", "Друго",
] as const;

export const shopSchema = z.object({
  name: z.string().trim().min(2, "Въведи име на магазина").max(80),
  businessCategory: z.enum(BUSINESS_CATEGORIES, "Избери категория"),
  description: z.string().trim().max(2000).default(""),
  city: z.string().trim().max(60).default(""),
  address: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(30).default(""),
  email: z.union([z.email("Невалиден имейл"), z.literal("")]).default(""),
  workingHoursText: z.string().trim().max(300).default(""),
  facebook: z.union([z.url("Невалиден линк"), z.literal("")]).default(""),
  instagram: z.union([z.url("Невалиден линк"), z.literal("")]).default(""),
});

export type ShopInput = z.infer<typeof shopSchema>;
```

- [ ] **Step 2: `src/actions/shop.ts`** — `createShop` и `updateShop`:
  - `createShop(input)`: Zod → санитизация (`sanitizeText` на всички текстови, `sanitizeMultiline` за description) → ако `getOwnShop()` вече има магазин → `fail("Вече имаш магазин.")` → `generateUniqueShopSlug(name)` → insert (status `draft`, `workingHours: { text }`, `socialLinks: { facebook, instagram }`) → `ok({ slug })`.
  - `updateShop(input)`: Zod → санитизация → `requireShop()` → update по `shop.id` + `updatedAt: new Date()` → `revalidatePath("/dashboard/store")` → `ok(null)`. (Името се сменя, slug-ът НЕ се променя след създаване — стабилни URL-и; отбележи го като hint в UI.)
  - Логото: отделно поле в тази форма не влиза — качва се в Плана 3 таб „Уебсайт" (там е визуалната идентичност).

- [ ] **Step 3: `ShopForm`** (`"use client"`) — обща за create (onboarding) и edit (store таб): props `{ mode: "create" | "edit"; initial?: ShopInput; onSubmit: server action }`. `useActionState` върху подадения action; полета: име, категория (Select от BUSINESS_CATEGORIES), описание (Textarea), град, адрес, телефон, имейл, работно време (Textarea 2 реда), facebook, instagram. Field-level грешки от `fieldErrors`; toast при успех (edit) / redirect (create — вика `router.push("/dashboard/onboarding?step=2")`).

- [ ] **Step 4: Таб „Магазин"** (`/dashboard/store`): `requireShop()` → ShopForm mode=edit с текущите стойности + Card отгоре със статус Badge (draft → „Чернова — още не е публикуван", tone neutral) и бъдещия публичен URL (`/s/{slug}`, сив текст).

- [ ] **Step 5: Onboarding стъпка 1** (`/dashboard/onboarding`): ако вече има магазин → стъпка 2. Прогрес индикатор „1/2 Магазин → 2/2 Първи продукт"; заглавие „Да създадем магазина ти"; ShopForm mode=create (само задължителните + град; останалите полета в `<details>` „Още детайли").

- [ ] **Step 6:** Ръчна проверка: нов акаунт → dashboard → onboarding → създаване → форма edit в /dashboard/store. Commit: `feat: add shop creation and editing with onboarding step 1`

---

### Task 6: Категории — schemas, actions, таб „Категории"

**Files:**
- Create: `src/schemas/category.ts`, `src/actions/categories.ts`, `src/db/queries/categories.ts`
- Create: `src/app/(dashboard)/dashboard/categories/page.tsx`, `src/components/dashboard/categories-manager.tsx`

- [ ] **Step 1: Schema:** `categorySchema = { name: min 1 max 60, parentId: uuid nullable }`.

- [ ] **Step 2: `src/db/queries/categories.ts`:** `getCategoriesTree(shopId)` — един SELECT, подреден по `sortOrder`; в паметта се сглобява `{ ...root, children: [] }[]`.

- [ ] **Step 3: Actions** (всички през `requireShop()`, връщат `ActionResult`):
  - `createCategory`: Zod → санитизация → ако `parentId`: проверка, че parent съществува, е на ТОЗИ магазин и самият той няма parent (max 1 ниво) → insert със `sortOrder = max + 1` в своето ниво.
  - `updateCategory(id, input)`: ownership проверка на категорията (`category.shopId === shop.id`) → update (само име в MVP).
  - `deleteCategory(id)`: ownership → транзакция: подкатегориите → `parentId = null`; продуктите се оправят от FK `set null`; delete.
  - `moveCategory(id, direction: "up" | "down")`: ownership → размяна на `sortOrder` със съседа в същото ниво.
  - Всички: `revalidatePath("/dashboard/categories")`.

- [ ] **Step 4: UI** (`categories-manager.tsx`, `"use client"`): списък на дървото — коренна категория (име, брой продукти, стрелки ↑↓, ✎, 🗑) с подкатегориите ѝ отместени; „Добави категория" бутон горе (Modal с име + Select за родител „— Без родител —"); ✎ → същият Modal с предпопълнено; 🗑 → ConfirmDialog с текст „Продуктите ще останат без категория." EmptyState при 0 категории.

- [ ] **Step 5:** Ръчна проверка + commit: `feat: add category management with one-level subcategories`

---

### Task 7: Продукти — schemas, queries, actions (сърцето на плана)

**Files:**
- Create: `src/schemas/product.ts`, `src/actions/products.ts`, `src/db/queries/products.ts`, `src/lib/product-slug.ts`
- Create: `src/lib/variants.ts`, `src/lib/variants.test.ts`

- [ ] **Step 1: `src/lib/variants.ts` (TDD)** — чиста логика за вариантите:

```ts
export interface OptionAxis { name: string; values: string[] }

/** Формата държи вариантите като string полета (както Zod схемата); сървърът конвертира с toCents. */
export interface VariantDraft {
  options: Record<string, string>;
  price: string;
  stock: string;
  sku: string;
  imagePaths: string[];
}

export function emptyVariant(options: Record<string, string>): VariantDraft {
  return { options, price: "", stock: "", sku: "", imagePaths: [] };
}

/** Декартово произведение на осите → всички комбинации. */
export function generateCombinations(axes: OptionAxis[]): Record<string, string>[] {
  const valid = axes.filter((a) => a.name.trim() && a.values.length > 0);
  if (valid.length === 0) return [];
  return valid.reduce<Record<string, string>[]>(
    (acc, axis) => acc.flatMap((combo) => axis.values.map((v) => ({ ...combo, [axis.name]: v }))),
    [{}],
  );
}

export function variantKey(options: Record<string, string>): string {
  return Object.keys(options).sort().map((k) => `${k}:${options[k]}`).join("|");
}

/** Слива нови комбинации със съществуващи чернови — пази въведените цени/наличности. */
export function mergeVariants(
  combos: Record<string, string>[],
  existing: VariantDraft[],
): VariantDraft[] {
  const byKey = new Map(existing.map((v) => [variantKey(v.options), v]));
  return combos.map((options) => byKey.get(variantKey(options)) ?? emptyVariant(options));
}
```

Тестове: 2 оси × (2,3 стойности) → 6 комбинации; празни оси → []; `mergeVariants` пази цената на съществуваща комбинация и добавя новите с null; `variantKey` е стабилен при разместен ред на ключовете.

- [ ] **Step 2: `src/schemas/product.ts`** — цените пътуват като string (от PriceInput), сървърът ги обръща с `toCents`:

```ts
import { z } from "zod";
import { toCents } from "@/lib/money";

const priceString = z
  .string()
  .trim()
  .refine((s) => toCents(s) !== null, "Невалидна цена (пример: 12,50)");

const optionalPriceString = z.union([priceString, z.literal("")]);

export const productSchema = z.object({
  name: z.string().trim().min(2, "Въведи име").max(120),
  description: z.string().trim().max(10_000).default(""),
  categoryId: z.union([z.uuid(), z.literal("")]).default(""),
  price: priceString,
  promoPrice: optionalPriceString.default(""),
  stock: z.union([z.coerce.number().int().min(0), z.literal("")]).default(""),
  status: z.enum(["active", "inactive"]).default("active"),
  images: z.array(z.string().max(300)).max(8, "Максимум 8 снимки"),
  attributes: z
    .array(z.object({ name: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) }))
    .max(20)
    .default([]),
  options: z
    .array(z.object({ name: z.string().trim().min(1).max(40), values: z.array(z.string().trim().min(1).max(60)).min(1).max(20) }))
    .max(3, "Максимум 3 опции")
    .default([]),
  variants: z
    .array(
      z.object({
        options: z.record(z.string(), z.string()),
        price: optionalPriceString.default(""),
        stock: z.union([z.coerce.number().int().min(0), z.literal("")]).default(""),
        sku: z.string().trim().max(60).default(""),
        imagePaths: z.array(z.string().max(300)).default([]),
      }),
    )
    .max(100)
    .default([]),
});

export type ProductInput = z.infer<typeof productSchema>;
```

- [ ] **Step 3: Сървърни проверки в `saveProduct` action** (create + update в едно, по optional `productId`):
  1. `requireShop()`; при update — продуктът е на този магазин.
  2. Zod + санитизация (име/атрибути/опции: `sanitizeText`; описание: `sanitizeMultiline`).
  3. Крос-валидации: `promoPrice < price`; всички `images`/`imagePaths` пътища започват със `shops/{shop.id}/` (анти-подмяна); `variants[].options` ключовете ⊆ имената на `options`; `variants[].imagePaths ⊆ images`; при create — `checkProductLimit` (брой продукти < PLAN_LIMITS[plan].maxProducts → иначе fail).
  4. Slug: при create `generateUniqueProductSlug(shopId, name)` (в `product-slug.ts`, аналог на shop версията, но с `and(eq(products.shopId), eq(products.slug))`); при update не се сменя.
  5. `db.transaction`: upsert на продукта → delete + insert на attributes/options/variants (вариантите с `toCents` приложен, `""` → null).
  6. `revalidatePath("/dashboard/products")` → `ok({ id })`.
  - `deleteProduct(id)`: ownership → транзакция: изтрий продукта (cascade чисти децата) → изтрий снимките му от Storage (admin client, `remove(images)`) → revalidate → ok.
  - `toggleProductStatus(id)`: ownership → превключва active/inactive.

- [ ] **Step 4: `src/db/queries/products.ts`:** `getProducts(shopId, { search?, categoryId?, status?, page })` — `ilike` по име, пагинация по 20, връща `{ items, total }`; `getProductWithRelations(productId)` — продукт + attributes + options + variants (relational query).

- [ ] **Step 5:** `pnpm test` → PASS (variants тестовете). Commit: `feat: add product actions with options, variants and server-side validation`

---

### Task 8: Продукти — списък и форма (UI)

**Files:**
- Create: `src/app/(dashboard)/dashboard/products/page.tsx` (списък)
- Create: `src/app/(dashboard)/dashboard/products/new/page.tsx`, `src/app/(dashboard)/dashboard/products/[id]/page.tsx`
- Create: `src/components/dashboard/product-form.tsx`, `product-list.tsx`, `attributes-editor.tsx`, `options-editor.tsx`, `variants-table.tsx`

- [ ] **Step 1: Списък** (`/dashboard/products`, server component + client филтри): Table — корица (48px, `next/image`), име, категория, цена (`formatPrice`; при промо: промо + зачертана стара), наличност („—" при null), статус Badge (кликаем → toggle), ✎ → edit. Търсене (Input, debounce 300ms през URL searchParams), Select филтри за категория/статус, Pagination. EmptyState с CTA „Добави първия си продукт". Бутон „Нов продукт" горе.

- [ ] **Step 2: `ProductForm`** (`"use client"`, обща за new/edit) — секции в Cards:
  1. **Основни**: име, категория (Select), описание (Textarea), статус (Checkbox „Активен").
  2. **Цена и наличност**: PriceInput цена, PriceInput промо цена (hint: „Оставя се празно, ако няма промоция"), наличност (number, празно = не се следи).
  3. **Снимки**: ImageUploader (max 8; hint „Първата снимка е корицата").
  4. **Характеристики**: AttributesEditor — редове име+стойност, „+ Добави характеристика", ✕ per ред.
  5. **Варианти**: OptionsEditor — до 3 оси: име (Input) + стойности (chips: Enter добавя, ✕ маха). При промяна: `mergeVariants(generateCombinations(axes), current)` → VariantsTable: ред per комбинация — етикет („М / Син"), PriceInput (placeholder = основната цена), наличност, SKU, снимки (мини-picker: thumbnail-ите от секция 3, toggle избор). Ако няма оси — секцията показва само обяснителен текст.
  - Submit: сглобява `ProductInput`, вика `saveProduct` (state през `useActionState`), fieldErrors по секции, toast + redirect към списъка при успех.

- [ ] **Step 3: Ръчна проверка на целия поток** (dev): продукт без варианти; продукт с 2 оси и per-вариант цена/снимка; edit на съществуващ пази вариантните стойности; промо цена < цена валидацията.

- [ ] **Step 4:** Commit: `feat: add product list and full product form with variants editor`

---

### Task 9: Dashboard навигация + onboarding стъпка 2 + Табло

**Files:**
- Modify: `src/app/(dashboard)/dashboard/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/components/dashboard/nav.tsx`, `src/app/(dashboard)/dashboard/onboarding/` (стъпка 2 в page-а от Task 5)

- [ ] **Step 1: Навигация:** layout-ът взима `getOwnShop()`; при магазин — sidebar (десктоп: лява колона; мобилно: horizontal scroll tabs под header-а): Табло, Магазин, Продукти, Категории (+ бъдещите табове се добавят в следващите планове). Активен таб — `usePathname()` в клиентски `nav.tsx`; стил: активен `bg-brand-50 text-brand-700`, иначе `text-ink-700`.

- [ ] **Step 2: Табло** (`/dashboard`): без магазин → EmptyState „Създай магазина си за 2 минути" + CTA към onboarding. С магазин: Cards — статус на магазина (draft: „Магазинът ти е чернова — попълни го и в План 3 ще го публикуваш"… формулирано за потребителя: „очаква публикуване"), брой продукти (+ линк), брой категории, бърз бутон „Нов продукт".

- [ ] **Step 3: Onboarding стъпка 2:** след създаване на магазин — екран „Добави първия си продукт" с ProductForm (опростен: само секции Основни + Цена + Снимки) и линк „Прескочи засега" → dashboard. След save → dashboard с toast „Магазинът ти е готов за настройка!".

- [ ] **Step 4:** Commit: `feat: add dashboard navigation, stats cards and onboarding step 2`

---

### Task 10: e2e + финален гейт + deploy

**Files:**
- Create: `e2e/store-products.spec.ts`, `e2e/fixtures/product.png` (1x1 PNG)
- Modify: `docs/superpowers/plans/2026-07-02-roadmap.md` (✅ на План 2)

- [ ] **Step 1: e2e сценарий** (един дълъг тест — нов акаунт всеки run):
  1. Регистрация → редирект към dashboard → EmptyState → „Създай магазина си".
  2. Onboarding стъпка 1: име „Е2Е Ферма", категория „Храни и напитки", град „Пловдив" → стъпка 2 → „Прескочи засега".
  3. Категории: създай „Млечни" → създай „Сирена" с родител „Млечни" → виждат се в дървото.
  4. Нов продукт: име „Краве сирене", категория „Сирена", цена „12,50", снимка (upload на fixture PNG), опция „Разфасовка" със стойности „500г", „1кг"; на вариант „1кг" цена „23"; save → списъкът показва продукта с „12,50 €".
  5. Edit на продукта → вариантът „1кг" пази цената „23".
  + втори кратък тест: втори акаунт НЕ вижда продуктите на първия (директен URL към edit страница на чужд продукт → redirect/грешка).

- [ ] **Step 2:** `pnpm test:e2e` → всички PASS.

- [ ] **Step 3:** `pnpm check` → зелен. Провери с бърз преглед: нула хардкоднати цветове извън tokens.css (`grep -rn "#[0-9a-f]\{6\}" src --include=*.tsx` → само в tokens.css/нищо).

- [ ] **Step 4:** Commit + push към `dev` → Vercel preview → ръчна проверка на preview URL-а (onboarding + продукт). Отбележи План 2 ✅ в roadmap. Потребителят merge-ва `dev → master` за production.

---

## Definition of Done (План 2)

- [ ] Нов потребител минава onboarding и има draft магазин с продукти и категории — без помощ
- [ ] Продукт с 2 опционни оси, per-вариант цена/наличност/снимки — създаване и редакция работят
- [ ] Снимки: upload ≤8, 5MB лимит на bucket ниво, пътищата са в `shops/{shopId}/`
- [ ] Чужд потребител не може да чете/пише чужди продукти/категории (e2e доказано)
- [ ] `pnpm check` + `pnpm test:e2e` зелени; deploy на Vercel preview проверен
- [ ] Никакви хардкоднати стойности извън tokens.css; всички нови UI елементи са компоненти
