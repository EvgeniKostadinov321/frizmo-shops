# Self-service изтриване на акаунт (GDPR чл.17) — Implementation Plan

> **For agentic workers:** Изпълнява се **inline** (проектно правило: без паралелни субагенти). Стъпките са с чекбокс (`- [ ]`) за проследяване.

**Goal:** Търговец може необратимо да изтрие акаунта и магазина си сам, от настройките.

**Architecture:** Клиентски „Опасна зона" компонент с Modal + typed confirmation → `deleteAccount()` server action (requireShop) → best-effort Stripe cancel (guarded) → best-effort Storage cleanup → `delete shops` (каскада) → `delete profiles` (каскада push_subscriptions) → `auth.admin.deleteUser` → signOut → клиентът пренасочва към landing. Обективен verify скрипт доказва каскадата срещу реалната база.

**Tech Stack:** Next.js 16 Server Actions, Drizzle, Supabase Admin (SUPABASE_SECRET_KEY), Stripe (lazy, guarded), Vitest, sonner toasts.

**Спец:** `docs/superpowers/specs/2026-07-09-account-deletion-design.md` (сверен 2026-07-11).

## Global Constraints

- **Multi-tenant:** мутацията минава през `requireShop()` (auth + ownership) — `src/lib/auth.ts`.
- **Ред на триене (задължителен):** Stripe cancel (guarded) → Storage (best-effort) → `delete shops` → `delete profiles` → `auth.admin.deleteUser` → signOut. **Shop ПРЕДИ profile** (FK `shops.ownerId → profiles.id` е RESTRICT, без cascade). `push_subscriptions` каскадят към `profiles` (не към shops) → падат на profile delete.
- **Best-effort стъпки (Stripe, Storage, auth delete, signOut) НЕ блокират** триенето; провал се логва като JSON (`console.error(JSON.stringify(...))`).
- **Guarded Stripe:** отказ само ако `isStripeConfigured()` И има `stripeSubscriptionId`. Спящ билинг → пропуска се тихо.
- Необратимо: без grace период, без износ на данни.
- BG UI текст, типографски кавички „…“; валута n/a. Строг TS, без `as any`.
- Дизайн токени (`danger-*`), reusable `ui` компоненти (`Modal`, `Button`, `Input`, `Card`).
- Гейт `pnpm check` (lint + unit + build) преди commit към `dev`.

---

## Файлова структура

- **Create** `src/lib/account-deletion.ts` — чиста логика (`confirmNameMatches`).
- **Create** `src/lib/account-deletion.test.ts` — unit тестове.
- **Modify** `src/lib/stripe.ts` — добавя `isStripeConfigured()`.
- **Create** `src/actions/account.ts` — `deleteAccount()` action + локални storage хелпъри.
- **Create** `src/components/dashboard/delete-account-section.tsx` — „Опасна зона" (client).
- **Modify** `src/app/(dashboard)/dashboard/store/page.tsx` — монтира секцията.
- **Create** `scripts/verify-account-deletion.mjs` — обективен verify скрипт.
- **Create** `src/components/marketing/deleted-account-toast.tsx` — toast на landing (client).
- **Modify** `src/app/(marketing)/page.tsx` — монтира toast-а.

---

### Task 1: Чисти хелпъри + тестове

**Files:**
- Create: `src/lib/account-deletion.ts`
- Test: `src/lib/account-deletion.test.ts`
- Modify: `src/lib/stripe.ts` (добавя функция в края)

**Interfaces:**
- Produces: `confirmNameMatches(input: string, shopName: string): boolean`; `isStripeConfigured(): boolean`.

- [ ] **Стъпка 1: Напиши падащия тест** — `src/lib/account-deletion.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { confirmNameMatches } from "./account-deletion";

describe("confirmNameMatches", () => {
  it("точно съвпадение → true", () =>
    expect(confirmNameMatches("Моят магазин", "Моят магазин")).toBe(true));
  it("trim от двете страни → true", () =>
    expect(confirmNameMatches("  Моят магазин  ", "Моят магазин")).toBe(true));
  it("различно име → false", () =>
    expect(confirmNameMatches("Друг", "Моят магазин")).toBe(false));
  it("различен регистър → false (защитна бариера)", () =>
    expect(confirmNameMatches("моят магазин", "Моят магазин")).toBe(false));
  it("само празни символи → false", () =>
    expect(confirmNameMatches("   ", "Моят магазин")).toBe(false));
  it("частично съвпадение → false", () =>
    expect(confirmNameMatches("Моят", "Моят магазин")).toBe(false));
});
```

- [ ] **Стъпка 2: Пусни теста — трябва да падне**

Run: `pnpm test -- src/lib/account-deletion.test.ts`
Expected: FAIL — „Cannot find module './account-deletion'“.

- [ ] **Стъпка 3: Имплементирай** — `src/lib/account-deletion.ts`

```ts
/**
 * Typed confirmation за изтриване на акаунт: въведеното трябва да съвпада ТОЧНО
 * с името на магазина (след trim). Case-sensitive — това е защитна бариера срещу
 * случаен клик, не UX удобство.
 */
export function confirmNameMatches(input: string, shopName: string): boolean {
  const trimmed = input.trim();
  return trimmed.length > 0 && trimmed === shopName.trim();
}
```

- [ ] **Стъпка 4: Добави Stripe guard** — в края на `src/lib/stripe.ts`

```ts
/** Дали Stripe е конфигуриран (има secret ключ). Гард за „спящ" билинг. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
```

- [ ] **Стъпка 5: Пусни теста — трябва да мине**

Run: `pnpm test -- src/lib/account-deletion.test.ts`
Expected: PASS (6 теста).

- [ ] **Стъпка 6: Commit**

```bash
git add src/lib/account-deletion.ts src/lib/account-deletion.test.ts src/lib/stripe.ts
git commit -m "feat(account-deletion): confirmNameMatches + isStripeConfigured хелпъри"
```

---

### Task 2: `deleteAccount` server action

**Files:**
- Create: `src/actions/account.ts`

**Interfaces:**
- Consumes: `requireShop()`, `confirmNameMatches`, `isStripeConfigured`, `stripe`, `createSupabaseAdmin`, `createSupabaseServer`, `ok`/`fail`/`ActionResult`, `SHOP_MEDIA_BUCKET`, `shopCacheTag`, `db`+`shops`/`profiles`/`subscriptions`, `eq`, `z`.
- Produces: `deleteAccount(rawInput: unknown): Promise<ActionResult<null>>`.

**Тест стратегия:** Действието е чисто интеграционно (Supabase auth admin + Storage + DB каскада). Съзнателно НЕ пишем mock-нат unit тест (mock на всичко = крехко и доказва нищо); обективната проверка е verify скриптът в Task 4 (както `verify-order-concurrency.mjs`). Верификацията тук = `pnpm check` компилира/lint-ва чисто.

- [ ] **Стъпка 1: Имплементирай** — `src/actions/account.ts`

```ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, profiles, shops, subscriptions } from "@/db";
import { shopCacheTag } from "@/db/queries/storefront";
import { confirmNameMatches } from "@/lib/account-deletion";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { SHOP_MEDIA_BUCKET } from "@/lib/storage";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

const schema = z.object({ confirmName: z.string().min(1).max(80) });
const GENERIC_FAIL = "Изтриването не бе успешно. Опитай пак или се свържи с нас.";

type AdminClient = ReturnType<typeof createSupabaseAdmin>;

/** Рекурсивно събира всички файлови пътища под даден префикс (папките нямат id). */
async function listAllFiles(admin: AdminClient, prefix: string): Promise<string[]> {
  const { data, error } = await admin.storage
    .from(SHOP_MEDIA_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const files: string[] = [];
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) files.push(...(await listAllFiles(admin, path)));
    else files.push(path);
  }
  return files;
}

/** Best-effort триене на всички медия файлове на магазина. */
async function deleteShopMedia(admin: AdminClient, shopId: string): Promise<void> {
  const paths = await listAllFiles(admin, `shops/${shopId}`);
  if (paths.length > 0) await admin.storage.from(SHOP_MEDIA_BUCKET).remove(paths);
}

export async function deleteAccount(rawInput: unknown): Promise<ActionResult<null>> {
  const { user, shop } = await requireShop();

  const parsed = schema.safeParse(rawInput);
  if (!parsed.success || !confirmNameMatches(parsed.data.confirmName, shop.name)) {
    return fail("Името на магазина не съвпада.");
  }

  const logCtx = { action: "deleteAccount", shopId: shop.id, userId: user.id };

  try {
    // 1) Best-effort отказ на Stripe абонамент ПРЕДИ триене (после губим id-то).
    if (isStripeConfigured()) {
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.shopId, shop.id),
        columns: { stripeSubscriptionId: true },
      });
      if (sub?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        } catch (e) {
          console.error(JSON.stringify({ ...logCtx, step: "stripeCancel", error: String(e) }));
        }
      }
    }

    // 2) Best-effort триене на Storage файловете.
    const admin = createSupabaseAdmin();
    try {
      await deleteShopMedia(admin, shop.id);
    } catch (e) {
      console.error(JSON.stringify({ ...logCtx, step: "storage", error: String(e) }));
    }

    // 3) Триене на магазина → каскадно всичките зависими таблици.
    await db.delete(shops).where(eq(shops.id, shop.id));
    // 4) Триене на профила → каскадно push_subscriptions.
    await db.delete(profiles).where(eq(profiles.id, user.id));
    // 5) Триене на auth записа (best-effort — данните вече ги няма).
    const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
    if (authErr) {
      console.error(JSON.stringify({ ...logCtx, step: "authDelete", error: authErr.message }));
    }

    // Инвалидирай публичния магазин (вече не съществува → 404).
    revalidateTag(shopCacheTag(shop.slug), "max");
    revalidatePath(`/s/${shop.slug}`, "layout");

    // Изчисти сесийната бисквитка (best-effort — сесията вече е невалидна).
    try {
      const supabase = await createSupabaseServer();
      await supabase.auth.signOut();
    } catch {
      /* игнорирай */
    }

    console.log(JSON.stringify({ ...logCtx, step: "done" }));
    return ok(null);
  } catch (e) {
    console.error(JSON.stringify({ ...logCtx, step: "fatal", error: String(e) }));
    return fail(GENERIC_FAIL);
  }
}
```

- [ ] **Стъпка 2: Провери компилацията**

Run: `pnpm check`
Expected: lint + unit + build минават (exit 0). (Функционалната проверка идва в Task 4.)

- [ ] **Стъпка 3: Commit**

```bash
git add src/actions/account.ts
git commit -m "feat(account-deletion): deleteAccount action (Stripe cancel + каскада + auth delete)"
```

---

### Task 3: „Опасна зона" UI + монтиране

**Files:**
- Create: `src/components/dashboard/delete-account-section.tsx`
- Modify: `src/app/(dashboard)/dashboard/store/page.tsx`

**Interfaces:**
- Consumes: `deleteAccount`, `confirmNameMatches`, `Modal`/`Button`/`Input`/`Card`.
- Produces: `<DeleteAccountSection shopName={string} />`.

- [ ] **Стъпка 1: Имплементирай компонента** — `src/components/dashboard/delete-account-section.tsx`

```tsx
"use client";

import { useState } from "react";
import { deleteAccount } from "@/actions/account";
import { confirmNameMatches } from "@/lib/account-deletion";
import { Button, Card, Input, Modal } from "@/components/ui";

interface DeleteAccountSectionProps {
  shopName: string;
}

export function DeleteAccountSection({ shopName }: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmNameMatches(confirmName, shopName);

  function close() {
    if (submitting) return;
    setOpen(false);
    setConfirmName("");
    setError(null);
  }

  async function handleDelete() {
    if (!matches) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await deleteAccount({ confirmName });
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      // Твърдо пренасочване към landing — чисти клиентското състояние на изтрития акаунт.
      window.location.href = "/?deleted=1";
    } catch {
      setError("Изтриването не бе успешно. Опитай пак.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-danger-200">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-danger-700">Опасна зона</h2>
        <p className="text-sm text-ink-500">
          Изтриването на акаунта е необратимо. Всички продукти, поръчки и данни на
          магазина ще бъдат премахнати завинаги.
        </p>
      </div>
      <div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Изтрий акаунта
        </Button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title="Изтриване на акаунта"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Отказ
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={!matches}
              loading={submitting}
            >
              Разбирам, изтрий завинаги
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-ink-700">
            Действието е необратимо. За да потвърдиш, въведи точното име на магазина си:{" "}
            <strong className="text-ink-900">{shopName}</strong>
          </p>
          <Input
            label="Име на магазина"
            hideLabel
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Име на магазина"
            autoComplete="off"
            error={error ?? undefined}
          />
        </div>
      </Modal>
    </Card>
  );
}
```

- [ ] **Стъпка 2: Монтирай в settings страницата** — `src/app/(dashboard)/dashboard/store/page.tsx`

Добави импорта (при другите import-и най-горе):

```tsx
import { DeleteAccountSection } from "@/components/dashboard/delete-account-section";
```

Добави секцията като ПОСЛЕДНО дете на външния `<div className="flex flex-col gap-4">`, веднага след `<ShopForm ... />`:

```tsx
      <DeleteAccountSection shopName={shop.name} />
    </div>
  );
}
```

- [ ] **Стъпка 3: Гейт**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Стъпка 4: Commit**

```bash
git add src/components/dashboard/delete-account-section.tsx "src/app/(dashboard)/dashboard/store/page.tsx"
git commit -m "feat(account-deletion): Опасна зона в настройките (modal + typed confirm)"
```

---

### Task 4: Обективен verify скрипт

**Files:**
- Create: `scripts/verify-account-deletion.mjs`

**Цел:** Доказва срещу РЕАЛНАТА база, че триенето на shop каскадно чисти всички зависими таблици (вкл. `subscriptions`, `abandoned_carts`) и триенето на profile чисти `push_subscriptions`, и че auth записът се маха. Създава ХВЪРЛЯЕМ акаунт (не пипа демо данните) и чисти след себе си.

- [ ] **Стъпка 1: Имплементирай** — `scripts/verify-account-deletion.mjs`

```js
/**
 * Обективна проверка на self-service изтриване на акаунт (GDPR чл.17).
 * НЕ е Playwright — тества DB каскадата + auth delete директно, срещу реалната
 * база. Създава ХВЪРЛЯЕМ auth user + profile + shop + редове във всички рискови
 * зависими таблици → изпълнява същия ред на триене като deleteAccount() → проверява,
 * че НИЩО не е останало. Не пипа реалните/демо данни.
 *
 * Употреба: node --env-file=.env.local scripts/verify-account-deletion.mjs
 * Изход 0 = пълно триене; 1 = остатъчни данни (регресия).
 */
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const stamp = Date.now();
  const email = `frizmo.verify.del+${stamp}@gmail.com`;
  const slug = `__verify_del_${stamp}`;

  // --- Създай хвърляем auth user ---
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: `Vd_${stamp}_x!`,
    email_confirm: true,
  });
  if (createErr || !created?.user) throw new Error(`createUser fail: ${createErr?.message}`);
  const userId = created.user.id;

  let shopId;
  try {
    // --- Насей данни във всички рискови таблици ---
    await sql`insert into profiles (id, full_name) values (${userId}, '__verify_del__')`;
    const [shop] = await sql`
      insert into shops (owner_id, name, slug, business_category, status)
      values (${userId}, '__verify_del__', ${slug}, 'other', 'draft')
      returning id`;
    shopId = shop.id;

    const [product] = await sql`
      insert into products (shop_id, name, slug, price_cents, stock, status)
      values (${shopId}, '__vd_product__', ${slug + "_p"}, 1000, 5, 'active')
      returning id`;

    await sql`
      insert into orders (shop_id, order_number, customer_name, customer_phone,
        shipping_name, shipping_price_cents, payment_name, payment_type,
        subtotal_cents, total_cents, status)
      values (${shopId}, 1, '__vd_order__', '+359888000000', 'Куриер', 0,
        'Наложен платеж', 'cod', 1000, 1000, 'new')`;

    await sql`
      insert into subscriptions (shop_id, stripe_customer_id, plan, status)
      values (${shopId}, ${"cus_vd_" + stamp}, 'starter', 'trialing')`;

    await sql`
      insert into abandoned_carts (shop_id, email, lines, subtotal_cents, status)
      values (${shopId}, ${email}, ${sql.json([])}, 1000, 'pending')`;

    await sql`
      insert into push_subscriptions (user_id, endpoint, p256dh, auth)
      values (${userId}, ${"https://push.example/" + stamp}, 'p256', 'authkey')`;

    // --- Изпълни СЪЩИЯ ред на триене като deleteAccount() ---
    await sql`delete from shops where id = ${shopId}`;      // каскада
    await sql`delete from profiles where id = ${userId}`;   // каскада push_subscriptions
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    check("auth user изтрит без грешка", !delErr, delErr?.message ?? "");

    // --- Провери, че НИЩО не е останало ---
    const tables = [
      ["products", sql`select count(*)::int as n from products where shop_id = ${shopId}`],
      ["orders", sql`select count(*)::int as n from orders where shop_id = ${shopId}`],
      ["subscriptions", sql`select count(*)::int as n from subscriptions where shop_id = ${shopId}`],
      ["abandoned_carts", sql`select count(*)::int as n from abandoned_carts where shop_id = ${shopId}`],
    ];
    for (const [name, q] of tables) {
      const [{ n }] = await q;
      check(`${name}: 0 останали реда (shop каскада)`, n === 0, `n=${n}`);
    }

    const [{ n: pushN }] = await sql`
      select count(*)::int as n from push_subscriptions where user_id = ${userId}`;
    check("push_subscriptions: 0 останали (profile каскада)", pushN === 0, `n=${pushN}`);

    const [{ n: profN }] = await sql`select count(*)::int as n from profiles where id = ${userId}`;
    check("profiles: изтрит", profN === 0, `n=${profN}`);

    const [{ n: shopN }] = await sql`select count(*)::int as n from shops where id = ${shopId}`;
    check("shops: изтрит", shopN === 0, `n=${shopN}`);

    const { data: gotUser } = await admin.auth.admin.getUserById(userId);
    check("auth user вече не съществува", !gotUser?.user);
    shopId = undefined; // почистено успешно
  } finally {
    // Best-effort почистване, ако тестът е гръмнал по средата.
    if (shopId) {
      await sql`delete from shops where id = ${shopId}`;
      await sql`delete from profiles where id = ${userId}`;
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    }
  }

  await sql.end();
  console.log(failures === 0 ? "\n✓ Изтриването е пълно." : `\n✗ ${failures} проверки се провалиха.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});
```

- [ ] **Стъпка 2: Пусни скрипта**

Run: `node --env-file=.env.local scripts/verify-account-deletion.mjs`
Expected: всички ✓, изход 0. Ако `business_category 'other'` не е валиден (свободен текст е — няма enum), остава. Ако гръмне на липсваща колона → сверявай със `src/db/schema.ts` и оправи insert-а.

- [ ] **Стъпка 3: Commit**

```bash
git add scripts/verify-account-deletion.mjs
git commit -m "test(account-deletion): обективен verify скрипт (каскада + auth delete)"
```

---

### Task 5: Toast на landing „Акаунтът е изтрит" (полиране)

**Files:**
- Create: `src/components/marketing/deleted-account-toast.tsx`
- Modify: `src/app/(marketing)/page.tsx`

**Бележка:** `Toaster` (sonner) е монтиран глобално в `src/app/layout.tsx:88` → `toast.success()` работи и на landing. Четем `?deleted=1` от `window.location` (без `useSearchParams` → без Suspense), после чистим URL-а.

- [ ] **Стъпка 1: Имплементирай** — `src/components/marketing/deleted-account-toast.tsx`

```tsx
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Показва еднократен toast след успешно изтриване на акаунт (redirect към „/?deleted=1"). */
export function DeletedAccountToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("deleted") === "1") {
      toast.success("Акаунтът е изтрит.");
      window.history.replaceState(null, "", "/");
    }
  }, []);
  return null;
}
```

- [ ] **Стъпка 2: Монтирай на landing** — `src/app/(marketing)/page.tsx`

Добави импорта най-горе:

```tsx
import { DeletedAccountToast } from "@/components/marketing/deleted-account-toast";
```

Рендирай `<DeletedAccountToast />` като първо дете на връщания фрагмент/контейнер на страницата (връща `null`, позицията е без значение за оформлението).

- [ ] **Стъпка 3: Гейт**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Стъпка 4: Commit**

```bash
git add src/components/marketing/deleted-account-toast.tsx "src/app/(marketing)/page.tsx"
git commit -m "feat(account-deletion): toast „Акаунтът е изтрит" на landing"
```

---

### Task 6: Финален гейт + документация

- [ ] **Стъпка 1: Пълен гейт**

Run: `pnpm check` → exit 0 (всички unit тестове + build).

- [ ] **Стъпка 2: Скан за контролни символи**

Run (Grep tool): pattern `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` върху новите файлове → няма съвпадения.

- [ ] **Стъпка 3: Пусни verify скрипта отново** (потвърждение на чисто дърво)

Run: `node --env-file=.env.local scripts/verify-account-deletion.mjs` → изход 0.

- [ ] **Стъпка 4: Обнови WORKLOG + памет** — нов ред в „Дневник" (дата, commit-и, „5-та pure-code функция; чака ръчна проверка + push“); памет `account-deletion-feature.md` + MEMORY.md ред.

- [ ] **Стъпка 5: Питай за push** — съобщи, че `pnpm check` + verify скриптът минават; питай за push към `dev` (= production). Push само при изрично „да".

---

## Self-Review (сверено срещу спеца)

- **Обхват:** typed confirmation ✓, danger zone ✓, Stripe cancel guarded ✓, storage cleanup ✓, каскада shop→profile→auth ✓, signOut+redirect ✓, verify скрипт ✓. Без grace/износ (извън обхват) ✓.
- **Ред на триене:** shop преди profile (FK RESTRICT) ✓; Stripe cancel преди shop delete (иначе губим id) ✓; push_subscriptions падат на profile delete ✓.
- **Type consistency:** `confirmNameMatches`/`isStripeConfigured` еднакви в Task 1/2/3; `deleteAccount({ confirmName })` еднакво в action и компонент; `ActionResult<null>` + `ok(null)`/`fail(msg)`.
- **Тестова хигиена:** unit тест само за чистата логика; интеграцията през обективен verify скрипт (не mock-нат тест, който доказва нищо) — по спеца и модела `verify-order-concurrency`.
