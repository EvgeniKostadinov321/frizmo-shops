# Пакет В „Растеж“ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Welcome купон (авто при потвърждение на абонат), купон-базирани реферали, и 4 нови analytics разреза за `/dashboard/analytics`.

**Architecture:** Надграждаме съществуващите `coupons` + `subscribers` + `newsletter.ts` + `analytics.ts`. Welcome/referral настройките са колони в `shops` (1:1 с магазина). Кодовете се издават в `confirmNewsletter` (при confirm) и се показват на confirm страницата + пращат в имейл. Рефералите са нова лека таблица `referrals`. Analytics разрезите са чисти агрегати (нула нови таблици).

**Tech Stack:** Next.js 16 App Router, Drizzle + Supabase Postgres, Zod, Resend, EUR интегер центове.

## Global Constraints

- Всяка мутация на търговец през `requireShop()` (src/lib/auth.ts). Публичните действия не важат тук — confirm е по token.
- Пари: интегер евроцентове, `formatPrice`/`toCents` от src/lib/money.ts. Аритметика само върху центове.
- `shopId` е тенант ключът; всяка заявка се филтрира по него.
- BG UI текст с типографски „…“ — прав `"` чупи lint. Числово съгласуване през `count(n, NOUNS.x)` (src/lib/plural.ts).
- Токени, без inline hex/px. `pnpm check` (lint+unit+build) е гейтът преди push.
- `db:push` изисква `DATABASE_URL_MIGRATIONS` зареден в shell (не се printва стойността).
- Един `db:push` за целия пакет (колони в shops + таблица referrals заедно), в края преди check.

---

### Task 1: Схема — welcome/referral колони в `shops` + таблица `referrals`

**Files:**
- Modify: `src/db/schema.ts` (добавя колони към `shops` ~ред 60; нова таблица `referrals` след `subscribers` ~ред 509)

**Interfaces:**
- Produces: `shops.welcomeCouponEnabled/Type/Value/MinSubtotalCents`, `shops.referralEnabled/Type/Value/MinSubtotalCents`; таблица `referrals` (id, shopId, subscriberId, code, referredCount, createdAt, updatedAt); тип `Referral = typeof referrals.$inferSelect`.

- [ ] **Step 1: Добави welcome+referral колони към `shops`**

В `src/db/schema.ts`, вътре в `shops` дефиницията (след `returnWindowDays`, преди `status`):

```ts
    /** В1: Welcome купон за нови абонати (авто при потвърждение). Използва couponTypeEnum. */
    welcomeCouponEnabled: boolean("welcome_coupon_enabled").notNull().default(false),
    welcomeCouponType: couponTypeEnum("welcome_coupon_type").notNull().default("percent"),
    welcomeCouponValue: integer("welcome_coupon_value").notNull().default(10),
    welcomeCouponMinSubtotalCents: integer("welcome_coupon_min_subtotal_cents").notNull().default(0),
    /** В2: Реферален купон (за приятел на абоната). */
    referralEnabled: boolean("referral_enabled").notNull().default(false),
    referralType: couponTypeEnum("referral_type").notNull().default("percent"),
    referralValue: integer("referral_value").notNull().default(10),
    referralMinSubtotalCents: integer("referral_min_subtotal_cents").notNull().default(0),
```

Забележка: `couponTypeEnum` е дефиниран по-долу в файла (ред ~450). Drizzle позволява референция към enum, дефиниран по-късно в същия модул, стига да е импортиран/деклариран преди `db:push`. Ако TS се оплаче за ред на деклариране, премести `couponTypeEnum` дефиницията НАД `shops` (заедно с другите enum-и ~ред 72).

- [ ] **Step 2: Добави таблицата `referrals`** (след `subscribers`, ~ред 509)

```ts
/** В2: купон-базирани реферали — всеки абонат има личен реф. код (= coupons.code). */
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    /** Личен реферален код — съществува и като запис в coupons. */
    code: text("code").notNull(),
    /** Брой поръчки, направени с този код. */
    referredCount: integer("referred_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("referrals_shop_code_idx").on(t.shopId, t.code),
    index("referrals_shop_idx").on(t.shopId),
    index("referrals_subscriber_idx").on(t.subscriberId),
  ],
).enableRLS();

export type Referral = typeof referrals.$inferSelect;
```

- [ ] **Step 3: Провери типовете компилират**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки от schema.ts (couponTypeEnum разрешен). Ако има ред-на-деклариране грешка → премести enum-а нагоре (Step 1 забележка).

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(growth): схема за welcome/referral настройки + таблица referrals"
```

---

### Task 2: Генератор на купон код (чиста функция + TDD)

**Files:**
- Create: `src/lib/coupon-code.ts`
- Test: `src/lib/coupon-code.test.ts`

**Interfaces:**
- Produces: `generateCouponCode(prefix: string): string` — връща `${prefix}-XXXXXX` с 6 base32 символа от безопасната азбука (без 0/O/1/I/L). Не гарантира уникалност (това е грижа на action-а с retry).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/coupon-code.test.ts
import { describe, expect, it } from "vitest";
import { COUPON_CODE_ALPHABET, generateCouponCode } from "./coupon-code";

describe("generateCouponCode", () => {
  it("има префикс, тире и 6 символа от безопасната азбука", () => {
    const code = generateCouponCode("WELCOME");
    expect(code).toMatch(/^WELCOME-[0-9A-Z]{6}$/);
    const suffix = code.split("-")[1];
    for (const ch of suffix) expect(COUPON_CODE_ALPHABET).toContain(ch);
  });

  it("не съдържа объркващи символи 0 O 1 I L", () => {
    expect(COUPON_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("uppercase префикс се запазва", () => {
    expect(generateCouponCode("REF")).toMatch(/^REF-/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/coupon-code.test.ts`
Expected: FAIL — модулът не съществува.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/coupon-code.ts
import { randomInt } from "node:crypto";

/** Безопасна base32 азбука — без 0/O/1/I/L (лесни за объркване при препис). */
export const COUPON_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Генерира код `PREFIX-XXXXXX` (6 случайни символа). Уникалността се гарантира от викащия (retry). */
export function generateCouponCode(prefix: string): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += COUPON_CODE_ALPHABET[randomInt(COUPON_CODE_ALPHABET.length)];
  }
  return `${prefix.toUpperCase()}-${suffix}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/coupon-code.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coupon-code.ts src/lib/coupon-code.test.ts
git commit -m "feat(growth): generateCouponCode — безопасна азбука + TDD"
```

---

### Task 3: Издаване на welcome/referral кодове в `confirmNewsletter`

**Files:**
- Modify: `src/actions/newsletter.ts` (разшири `confirmNewsletter` + `ConfirmResult`)
- Modify: `src/components/storefront/newsletter-confirm.tsx` (покажи кода/кодовете)

**Interfaces:**
- Consumes: `generateCouponCode` (Task 2); `shops.welcome*/referral*` (Task 1); `referrals` (Task 1).
- Produces: `confirmNewsletter` връща `ConfirmOutcome` = `{ result: ConfirmResult; welcomeCode?: string; referralCode?: string; welcomeLabel?: string; referralLabel?: string }`. `ConfirmResult` остава същият enum.

- [ ] **Step 1: Write the failing test** (издаване при confirm; идемпотентност)

```ts
// src/actions/newsletter.issue.test.ts
import { describe, expect, it, vi } from "vitest";

// Мокваме db за да тестваме само логиката на издаване без реална база.
// (Ако проектът няма конвенция за мок на db в action тестове, този тест е
// integration — маркирай describe.skip и разчитай на ръчна проверка; TDD тук
// покрива само форматирането на етикета.)
import { welcomeCouponLabel } from "@/actions/newsletter";

describe("welcomeCouponLabel", () => {
  it("percent → „−10%“", () => {
    expect(welcomeCouponLabel("percent", 10)).toBe("−10%");
  });
  it("fixed → форматирана сума", () => {
    expect(welcomeCouponLabel("fixed", 500)).toBe("−5,00 €");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/actions/newsletter.issue.test.ts`
Expected: FAIL — `welcomeCouponLabel` не е експортиран.

- [ ] **Step 3: Добави helper + логика за издаване**

В `src/actions/newsletter.ts`, добави импорти в началото:
```ts
import { coupons, referrals } from "@/db";
import { generateCouponCode } from "@/lib/coupon-code";
import { formatPrice } from "@/lib/money";
import type { CouponTypeEnum } from "@/db"; // ако липсва, ползвай "percent" | "fixed" литерал
```

Добави експортиран helper (форматира човешки етикет за отстъпката):
```ts
/** Човешки етикет за купон: „−10%“ или „−5,00 €“. */
export function welcomeCouponLabel(type: "percent" | "fixed", value: number): string {
  return type === "percent" ? `−${value}%` : `−${formatPrice(value)}`;
}
```

Добави вътрешен helper за издаване на уникален код (retry при колизия):
```ts
/**
 * Издава купон + връща кода. Уникален per магазин (retry до 5 при колизия).
 * maxUses: 1 за welcome (еднократен), null за referral (многократен).
 */
async function issueCoupon(
  shopId: string,
  prefix: string,
  type: "percent" | "fixed",
  value: number,
  minSubtotalCents: number,
  maxUses: number | null,
  expiresAt: Date | null,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCouponCode(prefix);
    try {
      await db.insert(coupons).values({
        shopId,
        code,
        discountType: type,
        discountValue: value,
        minSubtotalCents,
        maxUses,
        expiresAt,
        active: true,
      });
      return code;
    } catch {
      /* Колизия по unique (shopId, code) → нов опит. */
    }
  }
  throw new Error("Неуспешно генериране на уникален код");
}
```

Преработи блока `if (action !== "unsubscribe")` в `confirmNewsletter`: смени връщания тип на нова структура и издай кодовете при първо потвърждение:

```ts
export interface ConfirmOutcome {
  result: ConfirmResult;
  welcomeCode?: string;
  welcomeLabel?: string;
  referralCode?: string;
  referralLabel?: string;
}

export async function confirmNewsletter(rawInput: unknown): Promise<ConfirmOutcome> {
  const parsed = confirmSchema.safeParse(rawInput);
  if (!parsed.success) return { result: "invalid" };
  const { shopSlug, token, action } = parsed.data;

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop) return { result: "invalid" };

  const row = await db.query.subscribers.findFirst({
    where: and(eq(subscribers.shopId, shop.id), eq(subscribers.token, token)),
  });
  if (!row) return { result: "invalid" };

  if (action === "unsubscribe") {
    await db.update(subscribers).set({ status: "unsubscribed", updatedAt: new Date() })
      .where(eq(subscribers.id, row.id));
    return { result: "unsubscribed" };
  }

  /* Вече потвърден → НЕ издаваме втори код (идемпотентност). */
  if (row.status === "confirmed") return { result: "already" };

  const now = new Date();
  await db.update(subscribers)
    .set({ status: "confirmed", confirmedAt: now, updatedAt: now })
    .where(eq(subscribers.id, row.id));

  const out: ConfirmOutcome = { result: "confirmed" };

  if (shop.welcomeCouponEnabled) {
    const expires = new Date(now.getTime() + 30 * 86_400_000);
    out.welcomeCode = await issueCoupon(
      shop.id, "WELCOME", shop.welcomeCouponType, shop.welcomeCouponValue,
      shop.welcomeCouponMinSubtotalCents, 1, expires,
    );
    out.welcomeLabel = welcomeCouponLabel(shop.welcomeCouponType, shop.welcomeCouponValue);
  }

  if (shop.referralEnabled) {
    const refCode = await issueCoupon(
      shop.id, "REF", shop.referralType, shop.referralValue,
      shop.referralMinSubtotalCents, null, null,
    );
    await db.insert(referrals).values({ shopId: shop.id, subscriberId: row.id, code: refCode });
    out.referralCode = refCode;
    out.referralLabel = welcomeCouponLabel(shop.referralType, shop.referralValue);
  }

  return out;
}
```

- [ ] **Step 4: Обнови `newsletter-confirm.tsx` да показва кодовете**

В `src/components/storefront/newsletter-confirm.tsx`:
- Смени state типа: `useState<ConfirmOutcome | null>(null)` и импортирай `ConfirmOutcome`.
- `run()`: `setResult(await confirmNewsletter({ shopSlug, token, action }))`.
- `const view = result ? MESSAGES[result.result] : PROMPT[action];`
- След `<p>{view.text}</p>`, ако `result?.welcomeCode` или `result?.referralCode` → покажи блок с кода/кодовете (моноширинен, копируем текст) с етикета:

```tsx
{result?.welcomeCode && (
  <div className="mt-2 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-5 py-4">
    <p className="text-sm text-(--sf-muted)">Твоят код за {result.welcomeLabel}:</p>
    <p className="mt-1 font-mono text-lg font-bold tracking-wider text-(--sf-text)">
      {result.welcomeCode}
    </p>
    <p className="mt-1 text-xs text-(--sf-muted)">Валиден 30 дни. Въведи го при поръчка.</p>
  </div>
)}
{result?.referralCode && (
  <div className="mt-2 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-5 py-4">
    <p className="text-sm text-(--sf-muted)">Код за приятел ({result.referralLabel}):</p>
    <p className="mt-1 font-mono text-lg font-bold tracking-wider text-(--sf-text)">
      {result.referralCode}
    </p>
    <p className="mt-1 text-xs text-(--sf-muted)">Сподели го — приятелят ти получава отстъпка.</p>
  </div>
)}
```

Провери `--sf-surface` съществува като токен; ако не → ползвай `bg-(--sf-bg)` (виж други storefront компоненти за наличния токен).

- [ ] **Step 5: Run test to verify it passes + typecheck**

Run: `pnpm exec vitest run src/actions/newsletter.issue.test.ts && pnpm exec tsc --noEmit`
Expected: тестът PASS; без TS грешки (проверителите на `confirmNewsletter` виждат новия тип).

- [ ] **Step 6: Commit**

```bash
git add src/actions/newsletter.ts src/components/storefront/newsletter-confirm.tsx src/actions/newsletter.issue.test.ts
git commit -m "feat(growth): welcome/referral код при потвърждение + показване на страницата"
```

---

### Task 4: Настройки за welcome/referral купон (dashboard action + UI)

**Files:**
- Create: `src/schemas/growth-settings.ts`
- Modify: `src/actions/shop.ts` (нов action `saveGrowthSettings`)
- Create: `src/components/dashboard/growth-settings-form.tsx`
- Modify: `src/app/(dashboard)/dashboard/subscribers/page.tsx` (монтира формата)

**Interfaces:**
- Consumes: `requireShop()`, `shops.welcome*/referral*` (Task 1).
- Produces: `saveGrowthSettings(rawInput) → ActionResult<{}>`; Zod схема `growthSettingsSchema`.

- [ ] **Step 1: Write the failing test** (Zod схема)

```ts
// src/schemas/growth-settings.test.ts
import { describe, expect, it } from "vitest";
import { growthSettingsSchema } from "./growth-settings";

describe("growthSettingsSchema", () => {
  it("percent приема 1..100", () => {
    const r = growthSettingsSchema.safeParse({
      welcomeCouponEnabled: true, welcomeCouponType: "percent", welcomeCouponValue: 15,
      welcomeCouponMinSubtotalCents: 0, referralEnabled: false, referralType: "percent",
      referralValue: 10, referralMinSubtotalCents: 0,
    });
    expect(r.success).toBe(true);
  });
  it("percent над 100 се отхвърля", () => {
    const r = growthSettingsSchema.safeParse({
      welcomeCouponEnabled: true, welcomeCouponType: "percent", welcomeCouponValue: 150,
      welcomeCouponMinSubtotalCents: 0, referralEnabled: false, referralType: "percent",
      referralValue: 10, referralMinSubtotalCents: 0,
    });
    expect(r.success).toBe(false);
  });
  it("отрицателна стойност се отхвърля", () => {
    const r = growthSettingsSchema.safeParse({
      welcomeCouponEnabled: true, welcomeCouponType: "fixed", welcomeCouponValue: -5,
      welcomeCouponMinSubtotalCents: 0, referralEnabled: false, referralType: "percent",
      referralValue: 10, referralMinSubtotalCents: 0,
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/schemas/growth-settings.test.ts`
Expected: FAIL — схемата не съществува.

- [ ] **Step 3: Write the schema**

```ts
// src/schemas/growth-settings.ts
import { z } from "zod";

/** Стойност: 1..100 при percent, ≥1 цент при fixed. Валидира се спрямо типа. */
const couponConfig = (prefix: string) =>
  z.object({
    enabled: z.boolean(),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int(),
    minSubtotalCents: z.number().int().min(0).max(1_000_000),
  }).refine(
    (c) => (c.type === "percent" ? c.value >= 1 && c.value <= 100 : c.value >= 1),
    { message: "Невалидна стойност на отстъпката", path: ["value"] },
  );

/** Плосък вход от формата → валидиран. */
export const growthSettingsSchema = z.object({
  welcomeCouponEnabled: z.boolean(),
  welcomeCouponType: z.enum(["percent", "fixed"]),
  welcomeCouponValue: z.number().int(),
  welcomeCouponMinSubtotalCents: z.number().int().min(0).max(1_000_000),
  referralEnabled: z.boolean(),
  referralType: z.enum(["percent", "fixed"]),
  referralValue: z.number().int(),
  referralMinSubtotalCents: z.number().int().min(0).max(1_000_000),
}).refine(
  (c) => (c.welcomeCouponType === "percent" ? c.welcomeCouponValue >= 1 && c.welcomeCouponValue <= 100 : c.welcomeCouponValue >= 1),
  { message: "Невалидна стойност за welcome купон", path: ["welcomeCouponValue"] },
).refine(
  (c) => (c.referralType === "percent" ? c.referralValue >= 1 && c.referralValue <= 100 : c.referralValue >= 1),
  { message: "Невалидна стойност за реферален купон", path: ["referralValue"] },
);

export type GrowthSettingsInput = z.infer<typeof growthSettingsSchema>;
```

(Първият `couponConfig` е неизползван — премахни го; оставен само за яснота при писане. НЕ го commit-вай.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/schemas/growth-settings.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Добави `saveGrowthSettings` action**

В `src/actions/shop.ts` (следвай стила на съществуващите там action-и — `requireShop()` + Zod + update):

```ts
import { growthSettingsSchema } from "@/schemas/growth-settings";

/** В1/В2: настройки за welcome/referral купон. */
export async function saveGrowthSettings(rawInput: unknown): Promise<ActionResult<{}>> {
  const { shop } = await requireShop();
  const parsed = growthSettingsSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  await db.update(shops).set({
    welcomeCouponEnabled: v.welcomeCouponEnabled,
    welcomeCouponType: v.welcomeCouponType,
    welcomeCouponValue: v.welcomeCouponValue,
    welcomeCouponMinSubtotalCents: v.welcomeCouponMinSubtotalCents,
    referralEnabled: v.referralEnabled,
    referralType: v.referralType,
    referralValue: v.referralValue,
    referralMinSubtotalCents: v.referralMinSubtotalCents,
    updatedAt: new Date(),
  }).where(eq(shops.id, shop.id));
  revalidatePath("/dashboard/subscribers");
  return ok({});
}
```

(Провери импортите на `ok`/`zodFail`/`ActionResult`/`shops`/`db`/`eq`/`revalidatePath` вече ги има в shop.ts; добави липсващите.)

- [ ] **Step 6: Build the form component**

`src/components/dashboard/growth-settings-form.tsx` — `"use client"`, `useActionState` върху `saveGrowthSettings`. Използвай `<Toggle>`/`<Input>`/`<Select>`/`<Button>` от `src/components/ui` (провери barrel). Две секции (Welcome / Реферал), всяка: toggle enabled + Select тип (percent/fixed) + Input стойност + Input мин. сума (в €, конвертирай с toCents при submit). Стойностите идват от `shop` (props). Field-level грешки от Zod. Цените показвай/въвеждай в €, съхранявай центове.

- [ ] **Step 7: Монтирай формата в subscribers page**

В `src/app/(dashboard)/dashboard/subscribers/page.tsx` добави секция „Купони за растеж“ с `<GrowthSettingsForm shop={shop} />` (page-ът вече има `shop` от `requireShop()`).

- [ ] **Step 8: Verify build + typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 9: Commit**

```bash
git add src/schemas/growth-settings.ts src/schemas/growth-settings.test.ts src/actions/shop.ts src/components/dashboard/growth-settings-form.tsx "src/app/(dashboard)/dashboard/subscribers/page.tsx"
git commit -m "feat(growth): настройки за welcome/referral купон в dashboard"
```

---

### Task 5: Броене на реферали при поръчка

**Files:**
- Modify: `src/actions/orders.ts` (в транзакцията за създаване на поръчка, при приложен купон)

**Interfaces:**
- Consumes: `referrals` (Task 1); съществуващата логика за `coupons.usedCount++`.
- Produces: `referrals.referredCount++` когато `orders.couponCode` съвпада с реферер код.

- [ ] **Step 1: Намери мястото на купон-инкремента**

Run: grep за `usedCount` в `src/actions/orders.ts` — там където успешна поръчка увеличава `coupons.usedCount`. Реферер броенето отива в СЪЩАТА транзакция, веднага след него.

- [ ] **Step 2: Добави реферер инкремента**

След `coupons.usedCount++` (в транзакцията `tx`), ако има приложен купон код:
```ts
/* В2: ако приложеният код е реферер код — увеличи брояча (в същата транзакция). */
await tx.update(referrals)
  .set({ referredCount: sql`${referrals.referredCount} + 1`, updatedAt: new Date() })
  .where(and(eq(referrals.shopId, shop.id), eq(referrals.code, appliedCouponCode)));
```
(`appliedCouponCode` = кодът, който вече е валидиран/приложен в тази поръчка. Ако кодът не е реферер → 0 реда се обновяват, безопасно. Използвай `tx` инстанцията, не `db`.)

Импортирай `referrals` и `sql`/`and`/`eq` ако липсват.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 4: Commit**

```bash
git add src/actions/orders.ts
git commit -m "feat(growth): броене на реферали при поръчка с реферер код"
```

---

### Task 6: Изглед „Реферали“ за търговеца

**Files:**
- Create: `src/db/queries/referrals.ts`
- Modify: `src/app/(dashboard)/dashboard/subscribers/page.tsx` (секция „Реферали“)

**Interfaces:**
- Consumes: `referrals` + `subscribers` (join за имейл).
- Produces: `getShopReferrals(shopId) → { email: string; code: string; referredCount: number }[]` сортирано по `referredCount desc`.

- [ ] **Step 1: Write the query**

```ts
// src/db/queries/referrals.ts
import { desc, eq } from "drizzle-orm";
import { db, referrals, subscribers } from "@/db";

export interface ShopReferral {
  email: string;
  code: string;
  referredCount: number;
}

export async function getShopReferrals(shopId: string): Promise<ShopReferral[]> {
  const rows = await db
    .select({
      email: subscribers.email,
      code: referrals.code,
      referredCount: referrals.referredCount,
    })
    .from(referrals)
    .innerJoin(subscribers, eq(referrals.subscriberId, subscribers.id))
    .where(eq(referrals.shopId, shopId))
    .orderBy(desc(referrals.referredCount));
  return rows;
}
```

- [ ] **Step 2: Показвай секцията в subscribers page**

В subscribers page-а: `const referralsList = await getShopReferrals(shop.id);` и секция „Реферали“ — таблица (имейл · код · брой доведени) с `count(n, NOUNS.order)` за броя. Empty state „Още няма реферали“ (`EmptyState` иска `icon`+`description`).

- [ ] **Step 3: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 4: Commit**

```bash
git add src/db/queries/referrals.ts "src/app/(dashboard)/dashboard/subscribers/page.tsx"
git commit -m "feat(growth): изглед реферали за търговеца"
```

---

### Task 7: Analytics разрези — заявки

**Files:**
- Create: `src/db/queries/analytics-breakdowns.ts`
- Test: `src/db/queries/analytics-breakdowns.test.ts` (само чистите helper-и; заявките са integration → ръчна проверка)

**Interfaces:**
- Consumes: `orders`, `order_items`, `products`, `categories`, `subscribers`, `EXCLUDED_FROM_REVENUE`.
- Produces: `getAnalyticsBreakdowns(shopId, periodDays) → { sources, conversion, repeat, categories }` (типове по-долу).

- [ ] **Step 1: Дефинирай типовете + функцията**

```ts
// src/db/queries/analytics-breakdowns.ts
import { and, desc, eq, gte, lt, ne, notInArray, sql } from "drizzle-orm";
import { categories, db, orderItems, orders, products, subscribers } from "@/db";
import { EXCLUDED_FROM_REVENUE } from "@/db/queries/orders";
import type { AnalyticsPeriod } from "@/db/queries/analytics";

export interface NamedMetric { name: string; orderCount: number; revenueCents: number; }
export interface Breakdowns {
  sources: {
    byPayment: NamedMetric[];
    byCity: NamedMetric[];
    coupon: { withCoupon: NamedMetric; withoutCoupon: NamedMetric; totalDiscountCents: number };
  };
  conversion: { newSubscribers: number; subscribersWhoOrdered: number; welcomeOrders: number; welcomeRevenueCents: number };
  repeat: { repeatCustomers: number; totalCustomers: number; top: { phoneMasked: string; orderCount: number; totalCents: number }[] };
  categories: NamedMetric[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Наложен платеж", bank_transfer: "Банков превод", on_site: "На място",
};

export async function getAnalyticsBreakdowns(
  shopId: string, periodDays: AnalyticsPeriod,
): Promise<Breakdowns> {
  const from = new Date(Date.now() - periodDays * 86_400_000);
  const notExcluded = and(
    eq(orders.shopId, shopId),
    notInArray(orders.status, [...EXCLUDED_FROM_REVENUE]),
    gte(orders.createdAt, from),
  );
  // ... заявките по-долу (Step 2)
}
```

- [ ] **Step 2: Имплементирай четирите разреза (паралелни заявки)**

Вътре в функцията, `Promise.all` от заявките:

1. **byPayment:** `select paymentType, count, sum(totalCents)` group by paymentType. Мапни през `PAYMENT_LABELS`.
2. **byCity:** същото group by `orders.city` (празен град → „Неизвестен“), order by revenue desc, limit 5.
3. **coupon:** две суми — where `couponCode <> ''` и where `couponCode = ''`; отделно `sum(discountCents)`.
4. **conversion:** `newSubscribers` = confirmed в периода (както analytics.ts); `subscribersWhoOrdered` = distinct абонати, чийто email има поръчка (`inArray`/join по `customerEmail`); `welcomeOrders`/`welcomeRevenueCents` = поръчки с `couponCode ILIKE 'WELCOME-%'`.
5. **repeat:** подзаявка group by нормализиран `customerPhone` having count>1 → брой; `totalCustomers` = distinct телефони; top 5 (маскирай телефона: първи 4 + `***` + последни 2).
6. **categories:** join order_items→products→categories, sum lineTotalCents group by category name (null → „Без категория“), order desc, limit 5.

Всяка заявка филтрира по `shopId` (тенант). Числата минават през `Number(...)`.

- [ ] **Step 3: Write test за маскиране на телефон (чист helper)**

Изнеси маскирането в експортиран helper `maskPhone(phone: string): string` и тествай:
```ts
// analytics-breakdowns.test.ts
import { describe, expect, it } from "vitest";
import { maskPhone } from "./analytics-breakdowns";
describe("maskPhone", () => {
  it("маскира средата", () => expect(maskPhone("0877167172")).toBe("0877***72"));
  it("къс номер → без маскиране извън граница", () => expect(maskPhone("123")).toBe("123"));
});
```
Run: `pnpm exec vitest run src/db/queries/analytics-breakdowns.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/queries/analytics-breakdowns.ts src/db/queries/analytics-breakdowns.test.ts
git commit -m "feat(growth): analytics разрези — заявки (източници/конверсия/повторни/категории)"
```

---

### Task 8: Analytics разрези — UI секции

**Files:**
- Modify: `src/app/(dashboard)/dashboard/analytics/page.tsx`
- (по избор) Create: `src/components/dashboard/breakdown-table.tsx` (реюзабилна hairline таблица за NamedMetric[])

**Interfaces:**
- Consumes: `getAnalyticsBreakdowns` (Task 7).

- [ ] **Step 1: Извикай разрезите в page-а**

Добави `const breakdowns = await getAnalyticsBreakdowns(shop.id, period);` до `getAnalytics`.

- [ ] **Step 2: Рендерирай 4 нови секции** под текущите (топ продукти):

- „Източници на поръчки“ — три под-таблици (плащане · градове · с/без купон + обща отстъпка).
- „От абонати към клиенти“ — метрики (нови абонати · поръчали · welcome поръчки + приходи).
- „Повторни клиенти“ — брой + % + топ 5 (маскиран телефон · брой поръчки · сума). Бележка „за целия период“.
- „Топ категории“ — списък като топ продукти (категория · бройки/приходи).

Всяка секция: `rounded-card border border-surface-200 bg-surface-0`, `font-display` заглавие, `tabular-nums`, `formatPrice`, empty state при празно. Реюзни `BreakdownTable` за NamedMetric[] списъците (DRY).

- [ ] **Step 3: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/analytics/page.tsx" src/components/dashboard/breakdown-table.tsx
git commit -m "feat(growth): analytics разрези — UI секции"
```

---

### Task 9: db:push + пълен гейт

- [ ] **Step 1: Приложи схемата**

Зареди `DATABASE_URL_MIGRATIONS` в shell-а (без да printваш стойността), после:
Run: `pnpm db:push`
Expected: нови колони в `shops` + таблица `referrals` приложени, без загуба на данни.

- [ ] **Step 2: Пълен гейт**

Run: `pnpm check`
Expected: lint + всички unit тестове + build зелени.

- [ ] **Step 3: Финален commit (ако има форматиране/дребни фиксове)**

```bash
git add -A && git commit -m "chore(growth): db:push + pnpm check зелен"
```

- [ ] **Step 4: Спри за push разрешение**

НЕ push-вай без изрично „да“ от потребителя. Докладвай: пакет В готов, `pnpm check` зелен, чака разрешение за push към `dev` (=prod).

---

## Self-Review (свери преди старт)

- **Спец покритие:** В1 (Tasks 1,3,4) · В2 (Tasks 1,3,4,5,6) · В3 (Tasks 7,8). ✓
- **Идемпотентност welcome (спец edge case):** Task 3 Step 3 — `if (row.status === "confirmed") return "already"` преди издаване. ✓
- **Реферер многократен, welcome еднократен:** Task 3 — `maxUses: 1` vs `null`. ✓
- **Тенант изолация:** всяка заявка/мутация филтрира по `shopId`. ✓
- **Пари в центове:** формите въвеждат €, съхраняват центове (Task 4 Step 6). ✓
- **Известно ограничение (самореферал):** документирано в спеца, не се блокира. ✓
- **Placeholder scan:** неизползваният `couponConfig` в Task 4 Step 3 е маркиран за премахване. Провери `--sf-surface` токена (Task 3 Step 4). Провери точния ред на `usedCount` в orders.ts (Task 5 Step 1 е grep-стъпка, не placeholder).
