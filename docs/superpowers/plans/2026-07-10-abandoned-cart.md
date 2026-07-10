# Abandoned cart recovery имейл — план за имплементация

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (INLINE изпълнение — проектното правило забранява паралелни субагенти). Стъпките ползват checkbox (`- [ ]`) синтаксис за проследяване.

**Goal:** Купувач, който стигне checkout, отметне „Напомни ми" и не завърши поръчката, да получи 1 имейл след 1ч с продуктите + линк обратно.

**Architecture:** Нова таблица `abandoned_carts` (state машина pending/sent/converted). Улавяне: opt-in checkbox + server action на checkout (snapshot през pricing engine). Vercel Cron всеки час → зрелите pending → имейл → sent. Завършена поръчка → converted.

**Tech Stack:** Next.js 16 (Server Actions, route handlers), Drizzle ORM + Supabase Postgres, Resend, Vitest, pnpm.

**Източник (спец):** `docs/superpowers/specs/2026-07-10-abandoned-cart-design.md`

## Global Constraints

- **Multi-tenant:** `shopId` е тенант ключът; всяка заявка филтрира по него.
- **Пари = integer центове**; snapshot цените се преизчисляват на СЪРВЪРА (`priceCart`) — никакво доверие на клиента.
- **Публичен endpoint** (`saveAbandonedCart`): rate limit (`checkRateLimit`, Postgres) + Zod + `sanitizeText` на имейла. Никакви stack traces към клиента.
- **Имейл lowercase** навсякъде (улавяне, convert, unique индекс) — консистентност.
- **GDPR:** имейл се пази/праща САМО при изрична отметка (opt-in, неотметнат по подразбиране).
- **UI текст на български**, типографски кавички „…“ (прав `"` чупи lint). Storefront ползва `--sf-*` променливи + `SfCheckbox` (вече във формата).
- **Всички таблици `.enableRLS()`** (без policies — direct Postgres).
- **Единствена външна настройка:** `CRON_SECRET` env var (локално + Vercel) — иска се от потребителя в Task 7.
- **Гейт преди commit:** `pnpm check`. Сканирай контролни символи `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`.
- **Git:** dev (= production). Push само след разрешение. Commit завършва с `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Без Playwright визуални тестове** — UI ръчно от потребителя; Vitest само за логика.
- **`pnpm db:push`** прилага схемата (иска `DATABASE_URL_MIGRATIONS` в `.env.local`).

---

### Task 1: Схема — таблица `abandoned_carts` + enum

**Files:**
- Modify: `src/db/schema.ts`

**Interfaces:**
- Produces: `abandonedCartStatusEnum`, таблица `abandonedCarts`, тип `AbandonedLine`, `AbandonedCart = typeof abandonedCarts.$inferSelect`.

- [ ] **Стъпка 1: Добави типа `AbandonedLine`, enum и таблицата**

Намери мястото до `subscribers`/`stockAlerts` (`grep -n "subscriberStatusEnum\|export const subscribers" src/db/schema.ts`). Добави:
```ts
export const abandonedCartStatusEnum = pgEnum("abandoned_cart_status", [
  "pending",
  "sent",
  "converted",
]);

/** Snapshot на един ред в изоставена количка (рендерируем в имейла). */
export interface AbandonedLine {
  productId: string;
  variantKey: string | null;
  qty: number;
  name: string;
  priceCents: number;
  imagePath: string | null;
  productSlug: string;
}

export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    lines: jsonb("lines").$type<AbandonedLine[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    status: abandonedCartStatusEnum("status").notNull().default("pending"),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("abandoned_carts_shop_email_idx").on(t.shopId, t.email),
    index("abandoned_carts_status_updated_idx").on(t.status, t.updatedAt),
  ],
).enableRLS();

export type AbandonedCart = typeof abandonedCarts.$inferSelect;
```
`pgEnum`, `jsonb`, `uniqueIndex`, `index`, `integer`, `text`, `timestamp`, `uuid` вече са импортирани.

- [ ] **Стъпка 2: Typecheck**

Run: `pnpm exec tsc --noEmit 2>&1 | grep schema.ts || echo "schema clean"`
Expected: clean.

- [ ] **Стъпка 3: Приложи към базата**

Run: `export DATABASE_URL_MIGRATIONS="$(grep '^DATABASE_URL_MIGRATIONS=' .env.local | cut -d= -f2- | tr -d '"'"'"'"')" && pnpm db:push`
Expected: добавя таблица `abandoned_carts` + enum, без загуба. Ако `DATABASE_URL_MIGRATIONS` липсва → спри, питай потребителя.

- [ ] **Стъпка 4: Commit**

```bash
git add src/db/schema.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(abandoned-cart): таблица abandoned_carts + enum + AbandonedLine

State машина pending/sent/converted, snapshot на редовете (jsonb),
unique (shopId,email) за upsert дедуп, индекс (status,updatedAt) за cron.
db:push изпълнен.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 2: Чиста логика `dueAbandonedCarts` (TDD)

**Files:**
- Create: `src/lib/abandoned-cart.ts`
- Test: `src/lib/abandoned-cart.test.ts`

**Interfaces:**
- Produces: `dueAbandonedCarts(carts, now, thresholdMs?)` → зрелите за имейл.

- [ ] **Стъпка 1: Напиши failing тестове**

Create `src/lib/abandoned-cart.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dueAbandonedCarts } from "./abandoned-cart";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-07-10T12:00:00Z");

function cart(status: string, minutesAgo: number) {
  return { status, updatedAt: new Date(now.getTime() - minutesAgo * 60 * 1000) };
}

describe("dueAbandonedCarts", () => {
  it("pending по-стар от 1ч → зрял", () => {
    expect(dueAbandonedCarts([cart("pending", 90)], now)).toHaveLength(1);
  });
  it("pending по-млад от 1ч → не", () => {
    expect(dueAbandonedCarts([cart("pending", 30)], now)).toHaveLength(0);
  });
  it("точно на 1ч → зрял (>=)", () => {
    expect(dueAbandonedCarts([cart("pending", 60)], now)).toHaveLength(1);
  });
  it("sent се пропуска", () => {
    expect(dueAbandonedCarts([cart("sent", 120)], now)).toHaveLength(0);
  });
  it("converted се пропуска", () => {
    expect(dueAbandonedCarts([cart("converted", 120)], now)).toHaveLength(0);
  });
  it("смесен списък → само зрелите pending", () => {
    const list = [cart("pending", 90), cart("pending", 10), cart("sent", 200), cart("converted", 300)];
    expect(dueAbandonedCarts(list, now)).toHaveLength(1);
  });
});
```

- [ ] **Стъпка 2: Пусни — трябва да СЕ ПРОВАЛЯТ**

Run: `pnpm exec vitest run src/lib/abandoned-cart.test.ts`
Expected: FAIL — `dueAbandonedCarts is not a function`.

- [ ] **Стъпка 3: Имплементирай `src/lib/abandoned-cart.ts`**

```ts
/**
 * Кои pending колички са зрели за напомнящ имейл (изоставени > thresholdMs).
 * Чиста функция — тества се без DB. Заявката в queries прави същия филтър в SQL
 * за ефективност; тук е референтната логика + за тестове.
 */
export function dueAbandonedCarts<T extends { status: string; updatedAt: Date }>(
  carts: T[],
  now: Date,
  thresholdMs = 60 * 60 * 1000,
): T[] {
  return carts.filter(
    (c) => c.status === "pending" && now.getTime() - c.updatedAt.getTime() >= thresholdMs,
  );
}
```

- [ ] **Стъпка 4: Пусни — трябва да минат**

Run: `pnpm exec vitest run src/lib/abandoned-cart.test.ts`
Expected: PASS (6 теста).

- [ ] **Стъпка 5: Сканирай + commit**

Grep `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` → 0.
```bash
git add src/lib/abandoned-cart.ts src/lib/abandoned-cart.test.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(abandoned-cart): dueAbandonedCarts чиста логика + тестове

Филтрира зрелите pending колички (>1ч). Тества се без DB.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 3: Queries — upsert / due / convert (`src/db/queries/abandoned-cart.ts`)

**Files:**
- Create: `src/db/queries/abandoned-cart.ts`

**Interfaces:**
- Consumes: `db`, `abandonedCarts`, `shops`, `AbandonedLine` от `@/db`; drizzle операторите.
- Produces:
  - `upsertAbandonedCart(shopId, email, lines, subtotalCents)` — upsert по (shopId, email), status→pending.
  - `deleteAbandonedCart(shopId, email)` — трие pending (при махнат checkbox).
  - `getDueAbandonedCarts(thresholdIso, limit)` → редове + магазин (name, slug) за имейла.
  - `markAbandonedCartSent(id)` / `markConvertedByEmail(shopId, email)`.

- [ ] **Стъпка 1: Създай файла**

```ts
import { and, eq, lt, sql } from "drizzle-orm";
import { abandonedCarts, db, shops, type AbandonedLine } from "@/db";

/** Upsert по (shopId, email): нова активност презаписва редовете и връща pending. */
export async function upsertAbandonedCart(
  shopId: string,
  email: string,
  lines: AbandonedLine[],
  subtotalCents: number,
): Promise<void> {
  await db
    .insert(abandonedCarts)
    .values({ shopId, email, lines, subtotalCents, status: "pending" })
    .onConflictDoUpdate({
      target: [abandonedCarts.shopId, abandonedCarts.email],
      set: {
        lines,
        subtotalCents,
        status: "pending",
        remindedAt: null,
        updatedAt: new Date(),
      },
    });
}

/** Трие изоставена количка (при махнат checkbox). */
export async function deleteAbandonedCart(shopId: string, email: string): Promise<void> {
  await db
    .delete(abandonedCarts)
    .where(and(eq(abandonedCarts.shopId, shopId), eq(abandonedCarts.email, email)));
}

/** Зрелите pending (изоставени преди thresholdMs) + данни за магазина. */
export async function getDueAbandonedCarts(thresholdMs: number, limit: number) {
  const cutoff = new Date(Date.now() - thresholdMs);
  return db
    .select({
      id: abandonedCarts.id,
      email: abandonedCarts.email,
      lines: abandonedCarts.lines,
      subtotalCents: abandonedCarts.subtotalCents,
      shopName: shops.name,
      shopSlug: shops.slug,
    })
    .from(abandonedCarts)
    .innerJoin(shops, eq(shops.id, abandonedCarts.shopId))
    .where(and(eq(abandonedCarts.status, "pending"), lt(abandonedCarts.updatedAt, cutoff)))
    .limit(limit);
}

export async function markAbandonedCartSent(id: string): Promise<void> {
  await db
    .update(abandonedCarts)
    .set({ status: "sent", remindedAt: new Date(), updatedAt: new Date() })
    .where(eq(abandonedCarts.id, id));
}

/** При завършена поръчка: маркира изоставената количка на купувача като converted. */
export async function markConvertedByEmail(shopId: string, email: string): Promise<void> {
  await db
    .update(abandonedCarts)
    .set({ status: "converted", updatedAt: new Date() })
    .where(and(eq(abandonedCarts.shopId, shopId), eq(abandonedCarts.email, email)));
}
```
Забележка: `Date.now()` е позволен тук (нормален runtime; ограничението за `Date.now` е само в workflow скриптове). Провери, че `abandonedCarts`/`AbandonedLine` са export-нати от `@/db` (barrel) — schema.ts ги дефинира; ако barrel-ът реекспортира схемата, налични са.

- [ ] **Стъпка 2: Провери barrel export**

Run: `grep -n "abandonedCarts\|AbandonedLine\|export \*" src/db/index.ts | head`
Expected: `src/db/index.ts` реекспортира schema (`export * from "./schema"` или подобно). Ако не — добави `abandonedCarts`, `AbandonedLine` към export-ите.

- [ ] **Стъпка 3: Typecheck**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "abandoned-cart" || echo clean`
Expected: clean.

- [ ] **Стъпка 4: Commit**

```bash
git add src/db/queries/abandoned-cart.ts src/db/index.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(abandoned-cart): queries — upsert/delete/due/sent/convert

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 4: Server action `saveAbandonedCart` (`src/actions/abandoned-cart.ts`)

**Files:**
- Create: `src/actions/abandoned-cart.ts`

**Interfaces:**
- Consumes: `checkRateLimit`, `clientIp` (от `@/actions/cart` или дублирай), `getPricingProducts` (`@/db/queries/cart`), `priceCart` (`@/lib/pricing`), `upsertAbandonedCart`/`deleteAbandonedCart` (Task 3), `sanitizeText`, `ok`/`fail`.
- Produces: `saveAbandonedCart(rawInput)` action.

- [ ] **Стъпка 1: Създай action-а**

```ts
"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, shops, type AbandonedLine } from "@/db";
import { getPricingProducts } from "@/db/queries/cart";
import { deleteAbandonedCart, upsertAbandonedCart } from "@/db/queries/abandoned-cart";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { priceCart } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/actions/cart";
import { sanitizeText } from "@/lib/sanitize";

const schema = z.object({
  shopSlug: z.string().min(1).max(120),
  email: z.string().trim().email().max(120),
  remind: z.boolean(),
  lines: z
    .array(
      z.object({
        productId: z.uuid(),
        variantKey: z.union([z.string().max(300), z.null()]),
        qty: z.number().int().min(1).max(999),
      }),
    )
    .max(50),
});

export async function saveAbandonedCart(rawInput: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return fail("Невалидни данни.");
  const { shopSlug, email: rawEmail, remind, lines } = parsed.data;

  const ip = await clientIp();
  if (!(await checkRateLimit(`abandoned:${ip}`, 30, 60))) {
    return ok(null); // тихо — не чупи checkout при rate limit
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return ok(null);

  const email = sanitizeText(rawEmail, 120).toLowerCase();

  if (!remind) {
    await deleteAbandonedCart(shop.id, email);
    return ok(null);
  }

  if (lines.length === 0) return ok(null);

  /* Snapshot: цените се преизчисляват на сървъра (никакво доверие на клиента). */
  const products = await getPricingProducts(
    shop.id,
    lines.map((l) => l.productId),
  );
  const priced = priceCart(
    lines,
    new Map([...products].map(([id, p]) => [id, p])),
  );
  const snapshot: AbandonedLine[] = priced.lines
    .filter((l) => products.has(l.productId))
    .map((l) => {
      const view = products.get(l.productId)!;
      return {
        productId: l.productId,
        variantKey: l.variantKey,
        qty: l.qty,
        name: l.productName,
        priceCents: l.unitPriceCents,
        imagePath: view.imagePath,
        productSlug: view.slug,
      };
    });

  if (snapshot.length === 0) return ok(null);

  await upsertAbandonedCart(shop.id, email, snapshot, priced.subtotalCents);
  return ok(null);
}
```
**Забележка за плана:** `priceCart` приема `Map<string, PricingProduct>`, а `getPricingProducts` връща `Map<string, CartProductView>`. Провери реалните типове — `CartProductView` вероятно extends/съдържа `PricingProduct` полетата + slug/imagePath. Ако `priceCart` иска точния `PricingProduct` shape, подай директно `products` (CartProductView е superset). Приведи типа коректно при имплементация; целта: `priced.lines` носи `productName`/`unitPriceCents`/`qty`, а slug/imagePath идват от `products.get()`.

- [ ] **Стъпка 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "abandoned-cart" || echo clean` и `pnpm exec eslint src/actions/abandoned-cart.ts`
Expected: clean. (Ако `clientIp` не е export-нат от `@/actions/cart` → провери с grep; ако не е, дублирай малката функция локално.)

- [ ] **Стъпка 3: Commit**

```bash
git add src/actions/abandoned-cart.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(abandoned-cart): saveAbandonedCart action (opt-in, server snapshot)

Rate limit + Zod + sanitize. remind=false трие; иначе snapshot през
priceCart (сървърни цени) + upsert. Празна/невалидна количка → тихо ok.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 5: Checkout checkbox + тригер (`checkout-form.tsx`)

**Files:**
- Modify: `src/components/storefront/checkout-form.tsx`

**Interfaces:**
- Consumes: `saveAbandonedCart` (Task 4), съществуващия `SfCheckbox`, `cart` state (PricedCart), `form.customerEmail`.
- Produces: opt-in UI + дебоунснат тригер.

- [ ] **Стъпка 1: Прочети точните места**

Run: `grep -n "SfCheckbox\|customerEmail\|useState\|const cart\|readCart\|shopSlug\|shop.slug\|slug" src/components/storefront/checkout-form.tsx | head -25`
Намери: (а) props (има ли `shopSlug`/`slug`), (б) `cart` state, (в) email полето (ред ~334), (г) къде да сложиш checkbox + state.

- [ ] **Стъпка 2: Добави state за checkbox**

До другите `useState`:
```ts
const [remindMe, setRemindMe] = useState(false);
```

- [ ] **Стъпка 3: Добави checkbox под имейл полето**

След `Field` за имейла (ред ~328-336):
```tsx
<SfCheckbox checked={remindMe} onChange={setRemindMe}>
  Напомни ми с имейл, ако не завърша поръчката
</SfCheckbox>
```
(Съгласувай точния JSX с това как `SfCheckbox` се ползва другаде във файла — ред ~431.)

- [ ] **Стъпка 4: Дебоунснат тригер**

Добави ефект, който при промяна на (`remindMe`, `form.customerEmail`, `cart`) с валиден имейл извиква action-а дебоунснато (800ms). Ползвай съществуващия `shopSlug`/`slug` от props/данните и текущите редове на количката (raw lines — `productId/variantKey/qty`):
```ts
useEffect(() => {
  const email = form.customerEmail.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) return;

  const t = setTimeout(() => {
    const rawLines = /* текущите редове от количката: {productId, variantKey, qty}[] */;
    void saveAbandonedCart({ shopSlug, email, remind: remindMe, lines: rawLines });
  }, 800);
  return () => clearTimeout(t);
}, [remindMe, form.customerEmail, /* cart lines dep */, shopSlug]);
```
**Забележка:** намери откъде идват raw редовете (вероятно `readCart(shopId)` или `cart.lines` мапнати обратно към `{productId, variantKey, qty}`). Ако `PricedCart.lines` не носи raw `variantKey` във вход-форма — вземи от `cart-storage` (`readCart`). Спазвай react-compiler lint (стабилни deps; при нужда `useLatest` от `src/lib/use-latest.ts`). Ако `shopSlug` не е наличен като prop — виж как формата знае магазина (props или context) и ползвай това.

- [ ] **Стъпка 5: Typecheck + lint**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "checkout-form" || echo clean` и `pnpm exec eslint src/components/storefront/checkout-form.tsx`
Expected: clean.

- [ ] **Стъпка 6: Ръчна проверка (потребителят)**

Съобщи: на checkout отметни checkbox + въведи имейл → без грешки; в базата се появява `abandoned_carts` ред (`status=pending`). Мобилно 375px — checkbox четим.

- [ ] **Стъпка 7: Commit**

```bash
git add src/components/storefront/checkout-form.tsx
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(abandoned-cart): opt-in checkbox „Напомни ми“ + дебоунснат тригер

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 6: Имейл `sendAbandonedCartEmail` (`src/lib/email.ts`)

**Files:**
- Modify: `src/lib/email.ts`

**Interfaces:**
- Consumes: `AbandonedLine` (`@/db`), `formatPrice`, `publicImageUrl`, `BASE_URL`, `FROM`, Resend клиент (вече във файла).
- Produces: `sendAbandonedCartEmail(input)`.

- [ ] **Стъпка 1: Добави функцията**

По образец на `sendBackInStockEmail` (същия Resend pattern, липсващ ключ само логва):
```ts
export async function sendAbandonedCartEmail(input: {
  toEmail: string;
  shopName: string;
  shopSlug: string;
  lines: AbandonedLine[];
  subtotalCents: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(JSON.stringify({ event: "resend_missing_key", email: "abandoned_cart" }));
    return;
  }
  const resend = new Resend(apiKey);
  const checkoutUrl = `${BASE_URL}/s/${input.shopSlug}/checkout`;

  const rows = input.lines
    .map(
      (l) => `<tr>
        <td style="padding:8px 0">${escapeHtml(l.name)} × ${l.qty}</td>
        <td style="padding:8px 0;text-align:right">${formatPrice(l.priceCents * l.qty)}</td>
      </tr>`,
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to: input.toEmail,
    subject: "Забрави ли нещо в количката?",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Още е тук за теб 🛍️</h2>
      <p>Здравей! Продуктите от ${escapeHtml(input.shopName)} те чакат в количката.</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="text-align:right;font-weight:bold">Общо: ${formatPrice(input.subtotalCents)}</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${checkoutUrl}" style="background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Върни се към количката</a>
      </p>
    </div>`,
  });
}
```
**Забележка:** провери дали `email.ts` вече има `escapeHtml`/подобен helper (grep). Ако не — добави малка локална `escapeHtml` (или ползвай съществуващия escape pattern на файла). НЕ вкарвай сурови стойности в HTML без escape (XSS). Емоджито в heading-а е ок в имейл (не е платформен UI); ако предпочиташ без — махни го. Провери `AbandonedLine` импорта в email.ts.

- [ ] **Стъпка 2: Typecheck**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "email.ts" || echo clean`
Expected: clean.

- [ ] **Стъпка 3: Commit**

```bash
git add src/lib/email.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(abandoned-cart): sendAbandonedCartEmail (Resend, escape, линк към checkout)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 7: Cron route + `vercel.json` + `CRON_SECRET`

**Files:**
- Create: `src/app/api/cron/abandoned-carts/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `getDueAbandonedCarts`, `markAbandonedCartSent` (Task 3), `sendAbandonedCartEmail` (Task 6).
- Produces: cron GET handler.

- [ ] **Стъпка 1: Създай route-а**

```ts
import { getDueAbandonedCarts, markAbandonedCartSent } from "@/db/queries/abandoned-cart";
import { sendAbandonedCartEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const due = await getDueAbandonedCarts(HOUR_MS, 100);
  let sent = 0;
  let failed = 0;

  for (const cart of due) {
    try {
      await sendAbandonedCartEmail({
        toEmail: cart.email,
        shopName: cart.shopName,
        shopSlug: cart.shopSlug,
        lines: cart.lines,
        subtotalCents: cart.subtotalCents,
      });
      await markAbandonedCartSent(cart.id);
      sent++;
    } catch (err) {
      failed++;
      console.error(JSON.stringify({ event: "abandoned_cart_send_failed", id: cart.id, err: String(err) }));
    }
  }

  return Response.json({ processed: due.length, sent, failed });
}
```

- [ ] **Стъпка 2: Създай `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/abandoned-carts", "schedule": "0 * * * *" }
  ]
}
```
Ако вече съществува `vercel.json` (grep/ls) → слей `crons` масива, не презаписвай.

- [ ] **Стъпка 3: Поискай `CRON_SECRET` от потребителя**

Спри и съобщи на потребителя:
> „Cron-ът иска една env var. Добави в `.env.local` (за локален тест) и по-късно във Vercel (Settings → Environment Variables) + Redeploy:
> `CRON_SECRET=<генерирана стойност>`
> Ще генерирам стойност: `openssl rand -hex 32` — или аз да я генерирам сега?"

Генерирай стойност с `openssl rand -hex 32` (или node crypto), покажи я, инструктирай да я сложи локално. НЕ commit-вай `.env.local`.

- [ ] **Стъпка 4: Локален тест (ръчно с потребителя)**

След като `CRON_SECRET` е в `.env.local` и dev сървърът върви:
```bash
curl -s -H "Authorization: Bearer <secret>" http://localhost:3000/api/cron/abandoned-carts
```
Expected: `{ "processed": N, "sent": M, "failed": 0 }`. Без header → `401`.

- [ ] **Стъпка 5: Typecheck + commit**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "cron" || echo clean`
```bash
git add "src/app/api/cron/abandoned-carts/route.ts" vercel.json
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(abandoned-cart): cron route + vercel.json (всеки час, CRON_SECRET гард)

Взима зрелите pending (>1ч, лимит 100), праща имейл, маркира sent.
Resend fail per ред → log, остава pending за следващия час.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 8: Convert при завършена поръчка (`src/actions/orders.ts`)

**Files:**
- Modify: `src/actions/orders.ts`

**Interfaces:**
- Consumes: `markConvertedByEmail` (Task 3).

- [ ] **Стъпка 1: Намери двата пътя на завършване**

Run: `grep -n "sendOrderEmails\|customerEmail\|return ok\|created =" src/actions/orders.ts | head`
Има два пътя (със/без варианти, ~ред 206 и ~410), и двата с `input.customerEmail` + `sendOrderEmails`.

- [ ] **Стъпка 2: Добави convert след успешен запис**

В `saveOrder`, СЛЕД като поръчката е записана и `sendOrderEmails` е извикан (и в двата пътя, или на общо място преди финалния `return ok`), добави неблокиращо:
```ts
void markConvertedByEmail(shop.id, input.customerEmail.trim().toLowerCase());
```
Импортирай: `import { markConvertedByEmail } from "@/db/queries/abandoned-cart";`
Ако двата пътя се събират в общ `return ok({ ... })` — сложи го веднъж там; иначе по веднъж на всеки път.

- [ ] **Стъпка 3: Typecheck + пусни всички тестове**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "orders.ts" || echo clean` и `pnpm exec vitest run`
Expected: clean; всички тестове минават.

- [ ] **Стъпка 4: Commit**

```bash
git add src/actions/orders.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(abandoned-cart): завършена поръчка → converted (без напомняне на купил)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 9: Env документация + финален гейт

**Files:**
- Modify: `CLAUDE.md` (env списък) + memory env reference

- [ ] **Стъпка 1: Добави `CRON_SECRET` в env списъка**

В `CLAUDE.md` (`.env.local` ключове ред) добави `CRON_SECRET` (произволен таен низ; гард за Vercel cron). Отбележи, че е нужен и във **Vercel prod env vars** (за разлика от `DATABASE_URL_MIGRATIONS`).

- [ ] **Стъпка 2: Сканирай всички пипнати файлове за контролни символи**

Grep `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` върху: `schema.ts`, `abandoned-cart.ts`(+test), `queries/abandoned-cart.ts`, `actions/abandoned-cart.ts`, `checkout-form.tsx`, `email.ts`, `cron/.../route.ts`, `orders.ts`. → 0.

- [ ] **Стъпка 3: Пълен гейт**

Run: `pnpm check`
Expected: lint + unit + build минават.

- [ ] **Стъпка 4: Ръчна проверка (потребителят, не Playwright)**

- Checkout: отметни „Напомни ми" + имейл → ред в `abandoned_carts` (pending)
- Изчакай/симулирай 1ч (или временно намали прага) → cron curl → имейл пристига
- Завърши поръчка със същия имейл → редът става `converted`, не идва имейл
- Без checkbox → нищо не се записва
- Мобилно 375px — checkbox четим

- [ ] **Стъпка 5: Питай за push**

Съобщи, че `pnpm check` минава. Питай за push към `dev` (= production) + напомни за **Vercel env var `CRON_SECRET` + Redeploy** (cron няма да работи на prod без нея). Push само при „да".

- [ ] **Стъпка 6: Обнови WORKLOG + памет**

Нов ред в „Дневник“ + memory (`abandoned-cart` статус: код готов, чака проверка/push + Vercel `CRON_SECRET`).

---

## Self-Review (проверено спрямо спеца)

- **Секция 2 (данни)** → Task 1 ✅ (таблица + enum + AbandonedLine + db:push).
- **Секция 3 (улавяне)** → Task 4 (action, server snapshot) + Task 5 (checkbox+тригер) + Task 8 (convert) ✅.
- **Секция 4 (cron+имейл)** → Task 2 (dueAbandonedCarts) + Task 3 (queries) + Task 6 (email) + Task 7 (cron+vercel.json) ✅.
- **Секция 5 (грешки)** → 401 гард (Task 7), per-ред try/catch (Task 7), тихо ok при невалидно (Task 4).
- **Секция 6 (тестове)** → Task 2 (dueAbandonedCarts); UI ръчно (Task 5/9).
- **Секция 7 (файлове)** → всички покрити; `CRON_SECRET` doc в Task 9.

**Type consistency:** `AbandonedLine` еднакъв в schema (Task 1), queries (Task 3), action snapshot (Task 4), email (Task 6). `markConvertedByEmail(shopId, email)` сигнатурата съвпада между Task 3 (деф) и Task 8 (употреба). `getDueAbandonedCarts` връща `{id,email,lines,subtotalCents,shopName,shopSlug}` = точно входа на `sendAbandonedCartEmail` (Task 6/7). Имейл lowercase навсякъде (upsert/convert/unique).

**Рискове, отбелязани в плана:**
- `priceCart` иска `Map<PricingProduct>`, `getPricingProducts` връща `Map<CartProductView>` — приведи при имплементация (CartProductView е superset); Task 4 стъпка 1 забележка.
- Raw cart редове в checkout-form (Task 5) — намери източника (`readCart` vs `cart.lines`); Task 5 стъпка 4 забележка.
- `clientIp` export от `@/actions/cart` — провери; ако липсва, дублирай (Task 4 стъпка 2).
- `escapeHtml` в email.ts — провери/добави (Task 6 стъпка 1).
