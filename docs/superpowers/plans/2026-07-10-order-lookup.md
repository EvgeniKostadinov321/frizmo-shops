# „Провери поръчка" от купувача — план за имплементация

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (INLINE изпълнение — проектното правило забранява паралелни субагенти). Стъпките ползват checkbox (`- [ ]`) синтаксис за проследяване.

**Goal:** Купувач (гост) да провери статуса на поръчката си чрез номер + телефон на публична страница, без акаунт — и да бъде пренасочен към готовата confirmation страница.

**Architecture:** Нова публична страница `/s/{slug}/order-status` с клиентска форма → нов `lookupOrder` server action (rate-limit + `parseBgPhone` + заявка) → при съвпадение връща path към confirmation страницата, клиентът навигира. Преизползва confirmation UI (DRY). Без нови колони/таблици.

**Tech Stack:** Next.js 16 (Server Actions, App Router), Drizzle ORM + Supabase Postgres, Zod, Vitest, pnpm.

**Източник (спец):** `docs/superpowers/specs/2026-07-10-order-lookup-design.md`

## Global Constraints

- **Сигурност:** номерът е познаваем (пореден) → телефонът е тайната. **Обща грешка** и при несъществуващ номер, и при грешен телефон (не разкрива дали номер съществува). **Rate-limit преди всяка работа** — `checkRateLimit(order-lookup:${ip}, 5, 900)` (5 опита / 15 мин на IP).
- **Multi-tenant:** заявката винаги филтрира по `shopId` (+ orderNumber + phone). Confirmation страницата пак валидира `publicToken` отделно.
- **Телефон:** `parseBgPhone()` нормализира вход към e164 (както е записан `customerPhone`) преди сравнение. Телефонът НЕ влиза в URL (POST body на action-а).
- **UI текст на български**, типографски кавички „…“ (прав `"` чупи lint). Storefront ползва `--sf-*` променливи; touch targets ≥44px; mobile-first.
- **Никакви stack traces** към клиента; общи съобщения.
- **Гейт преди commit:** `pnpm check` (lint + unit + build). Сканирай контролни символи `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`.
- **Git:** dev (= production). Push само след разрешение. Commit завършва с `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Без Playwright визуални тестове** — UI ръчно от потребителя; Vitest само за логика.
- **Node/pnpm:** машината ползва Node 24 (`nvm use 24`) — pnpm 11 иска ≥22.13. `pnpm check` през PowerShell.

---

### Task 1: `parseOrderNumber` чиста логика (TDD)

**Files:**
- Create: `src/lib/order-number.ts`
- Test: `src/lib/order-number.test.ts`

**Interfaces:**
- Produces: `parseOrderNumber(input: string): number | null` — „#0042"/„42"/„ 42 " → 42; невалиден → null.

- [ ] **Стъпка 1: Напиши failing тестове**

Create `src/lib/order-number.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseOrderNumber } from "./order-number";

describe("parseOrderNumber", () => {
  it("маха # и водещи нули", () => expect(parseOrderNumber("#0042")).toBe(42));
  it("приема голо число", () => expect(parseOrderNumber("42")).toBe(42));
  it("трим-ва интервали", () => expect(parseOrderNumber(" 42 ")).toBe(42));
  it("приема # без нули", () => expect(parseOrderNumber("#42")).toBe(42));
  it("отхвърля текст", () => expect(parseOrderNumber("abc")).toBeNull());
  it("отхвърля нула", () => expect(parseOrderNumber("0")).toBeNull());
  it("отхвърля отрицателни", () => expect(parseOrderNumber("-5")).toBeNull());
  it("отхвърля празно", () => expect(parseOrderNumber("")).toBeNull());
  it("отхвърля смесено", () => expect(parseOrderNumber("4a")).toBeNull());
});
```

- [ ] **Стъпка 2: Пусни — трябва да СЕ ПРОВАЛЯТ**

Run (PowerShell): `pnpm exec vitest run src/lib/order-number.test.ts`
Expected: FAIL — `parseOrderNumber is not a function`.

- [ ] **Стъпка 3: Имплементирай `src/lib/order-number.ts`**

```ts
/** "#0042" / "42" / " 42 " → 42. Невалиден (текст, ≤0, празно) → null. */
export function parseOrderNumber(input: string): number | null {
  const cleaned = input.trim().replace(/^#/, "").replace(/\s/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = parseInt(cleaned, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
```

- [ ] **Стъпка 4: Пусни — трябва да минат**

Run: `pnpm exec vitest run src/lib/order-number.test.ts`
Expected: PASS (9 теста).

- [ ] **Стъпка 5: Сканирай + commit**

Grep `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` върху двата файла → 0.
```bash
git add src/lib/order-number.ts src/lib/order-number.test.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(order-lookup): parseOrderNumber чиста логика + тестове

"#0042"/"42" → 42; невалиден → null. Тества се без DB.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 2: `lookupOrder` server action

**Files:**
- Modify: `src/actions/orders.ts`

**Interfaces:**
- Consumes: `parseOrderNumber` (Task 1); `checkRateLimit`, `clientIp` (вече в orders.ts), `parseBgPhone` (`@/lib/phone`), `db`, `orders`, `shops`, `eq`, `and`, `ok`, `fail`.
- Produces: `lookupOrder(shopSlug: string, rawInput: unknown): Promise<ActionResult<{ path: string }>>`.

- [ ] **Стъпка 1: Провери наличните импорти в orders.ts**

Run: `grep -nE "parseBgPhone|checkRateLimit|clientIp|import.*phone|import.*rate-limit" src/actions/orders.ts`
Expected: `clientIp`, `checkRateLimit` вече се ползват (в createOrder). `parseBgPhone` — провери дали е импортиран; ако не, добави `import { parseBgPhone } from "@/lib/phone";`. Добави и `import { parseOrderNumber } from "@/lib/order-number";`.

- [ ] **Стъпка 2: Добави action-а (в края на orders.ts, при другите поръчкови мутации)**

```ts
const ORDER_LOOKUP_GENERIC = "Няма поръчка с този номер и телефон. Провери ги и опитай пак.";

const lookupSchema = z.object({
  orderNumber: z.string().min(1).max(20),
  phone: z.string().min(1).max(30),
});

/**
 * Публична проверка на поръчка от купувача (номер + телефон). Номерът е
 * пореден (познаваем) → телефонът е тайната → строг rate-limit + обща грешка
 * (не разкрива дали номер съществува). При съвпадение връща path към готовата
 * confirmation страница (клиентът навигира — както createOrder).
 */
export async function lookupOrder(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult<{ path: string }>> {
  const parsed = lookupSchema.safeParse(rawInput);
  if (!parsed.success) return fail(ORDER_LOOKUP_GENERIC);

  const ip = await clientIp();
  if (!(await checkRateLimit(`order-lookup:${ip}`, 5, 900))) {
    return fail("Твърде много опити. Опитай по-късно.");
  }

  const n = parseOrderNumber(parsed.data.orderNumber);
  const phone = parseBgPhone(parsed.data.phone);
  if (n === null || !phone.ok) return fail(ORDER_LOOKUP_GENERIC);

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail(ORDER_LOOKUP_GENERIC);

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.shopId, shop.id),
      eq(orders.orderNumber, n),
      eq(orders.customerPhone, phone.e164),
    ),
    columns: { id: true, publicToken: true },
  });
  if (!order) return fail(ORDER_LOOKUP_GENERIC);

  return ok({ path: `/s/${shopSlug}/order/${order.id}?t=${order.publicToken}` });
}
```
**Забележка:** провери точния тип на `parseBgPhone` резултата — от phone.ts е `{ ok: true; e164: string } | { ok: false; reason: ... }`. `phone.e164` е достъпно само при `phone.ok`. Кодът горе го проверява (`!phone.ok` → fail). `z`, `ok`, `fail`, `ActionResult`, `and`, `eq`, `db`, `orders`, `shops` вече са импортирани в orders.ts (ползват се от createOrder).

- [ ] **Стъпка 3: Typecheck**

Run (PowerShell): `pnpm exec tsc --noEmit 2>&1 | Select-String "orders.ts"` (или bash grep) — очаквано: без нови грешки.

- [ ] **Стъпка 4: Commit**

```bash
git add src/actions/orders.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(order-lookup): lookupOrder action (rate-limit + телефон, обща грешка)

5 опита/15мин на IP; parseBgPhone e164 сравнение; съвпадение по shopId+
orderNumber+phone → path към confirmation. Обща грешка (не разкрива номер).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 3: Страница + форма

**Files:**
- Create: `src/app/(storefront)/s/[slug]/order-status/page.tsx`
- Create: `src/components/storefront/order-lookup-form.tsx`

**Interfaces:**
- Consumes: `lookupOrder` (Task 2); `getPublicShop` (`@/db/queries/storefront`).
- Produces: страница (SSR, noindex) + клиентска форма.

- [ ] **Стъпка 1: Провери storefront формен pattern (образец)**

Run: `grep -nE "useRouter|useState|setSubmitting|setError|router.push|inputClass|--sf-" src/components/storefront/checkout-form.tsx | head`
Виж как checkout-form: (а) държи `submitting`/`error` state, (б) вика action, (в) `router.push` при успех, (г) storefront input класове.

- [ ] **Стъпка 2: Създай формата `src/components/storefront/order-lookup-form.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { lookupOrder } from "@/actions/orders";

interface OrderLookupFormProps {
  slug: string;
}

export function OrderLookupForm({ slug }: OrderLookupFormProps) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await lookupOrder(slug, { orderNumber, phone });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.data.path);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-4 py-3 text-(--sf-text) outline-none focus-visible:border-(--sf-primary)";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--sf-text)">Номер на поръчка</span>
        <input
          className={inputClass}
          inputMode="numeric"
          placeholder="напр. 42"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--sf-text)">Телефон</span>
        <input
          className={inputClass}
          type="tel"
          autoComplete="tel"
          placeholder="напр. 0888 123 456"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-(--sf-accent)">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 items-center justify-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Проверявам…" : "Провери"}
      </button>
    </form>
  );
}
```
**Забележка:** съгласувай точните класове/променливи (`--sf-radius`, `--sf-border`, `--sf-surface-raised`, `--sf-primary`, `--sf-on-primary`, `--sf-accent`) с това, което checkout-form реално ползва (виж `inputClass` там и `SfCheckbox`). Ако някоя `--sf-*` променлива има друго име, ползвай реалната.

- [ ] **Стъпка 3: Създай страницата `src/app/(storefront)/s/[slug]/order-status/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderLookupForm } from "@/components/storefront/order-lookup-form";
import { getPublicShop } from "@/db/queries/storefront";

export const metadata: Metadata = { title: "Провери поръчка", robots: { index: false } };

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrderStatusPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl text-(--sf-text)">Провери поръчка</h1>
      <p className="mt-2 text-(--sf-muted)">
        Въведи номера на поръчката и телефона, с който направи поръчката.
      </p>
      <div className="mt-8">
        <OrderLookupForm slug={slug} />
      </div>
    </div>
  );
}
```
**Забележка:** съгласувай заглавния/текстовия стил и класове с другите storefront страници (напр. confirmation `order/[orderId]/page.tsx` — `max-w`, типография). `getPublicShop` връща `null` за не-published → `notFound()`.

- [ ] **Стъпка 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit` (провери order-status/order-lookup-form) + `pnpm exec eslint src/components/storefront/order-lookup-form.tsx "src/app/(storefront)/s/[slug]/order-status/page.tsx"`
Expected: clean.

- [ ] **Стъпка 5: Ръчна проверка (потребителят)**

`localhost:3000/s/{демо-slug}/order-status` → форма; валиден номер+телефон на реална поръчка → пренасочва към confirmation; грешни → обща грешка; мобилно 375px.

- [ ] **Стъпка 6: Сканирай + commit**

Grep контролни символи върху двата нови файла → 0.
```bash
git add "src/app/(storefront)/s/[slug]/order-status/page.tsx" src/components/storefront/order-lookup-form.tsx
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(order-lookup): страница /order-status + форма (client)

SSR noindex страница + клиентска форма (номер+телефон → lookupOrder →
router.push към confirmation). Storefront стил, touch targets ≥44px.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 4: Footer линк (2-та варианта)

**Files:**
- Modify: `src/components/storefront/footer.tsx`

**Interfaces:**
- Consumes: `base` (вече дефиниран в компонента като публичния префикс на магазина).

- [ ] **Стъпка 1: Вариант 2 (минимален) — добави в nav масива**

Намери `const nav = [` (ред ~61). Добави елемент след „Условия":
```ts
{ href: `${base}/order-status`, label: "Провери поръчка" },
```
(преди `...socials.map(...)`).

- [ ] **Стъпка 2: Вариант 1 (богат) — добави `<li>` в „Магазин" колоната**

Намери колоната `<nav aria-label="Магазин">` → `<ul>` (ред ~135-156). След `<li>` за „Условия за пазаруване" добави:
```tsx
<li>
  <Link href={`${base}/order-status`} className="inline-flex min-h-10 items-center opacity-80 transition-opacity hover:opacity-100">
    Провери поръчка
  </Link>
</li>
```
Съгласувай класовете с точно този, който другите `<li><Link>` в колоната ползват (копирай от съседен `<li>`).

- [ ] **Стъпка 3: Typecheck + сканирай**

Run: `pnpm exec tsc --noEmit 2>&1 | Select-String "footer"` → без грешки. Grep контролни символи → 0.

- [ ] **Стъпка 4: Ръчна проверка (потребителят)**

Отвори магазин с всеки footer вариант → линкът „Провери поръчка" се вижда и води до `/order-status`. (footerVariant се сменя от настройките на магазина.)

- [ ] **Стъпка 5: Commit**

```bash
git add src/components/storefront/footer.tsx
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(order-lookup): footer линк „Провери поръчка" (2-та варианта)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 5: Финален гейт + ръчна проверка

**Files:** няма промени по код.

- [ ] **Стъпка 1: Сканирай всички пипнати файлове за контролни символи**

Grep `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` върху: `order-number.ts`(+test), `orders.ts`, `order-status/page.tsx`, `order-lookup-form.tsx`, `footer.tsx` → 0.

- [ ] **Стъпка 2: Пълен гейт**

Run (PowerShell): `pnpm check`
Expected: lint + unit + build минават (тестовете включват новите `order-number` тестове).

- [ ] **Стъпка 3: Ръчна проверка (потребителят, не Playwright)**

- `/s/{демо-slug}/order-status` → форма
- Реална поръчка (номер + телефона от нея) → пренасочва към confirmation с токена
- Грешен телефон → обща грешка (не разкрива дали номерът съществува)
- Грешен номер → същата обща грешка
- 6+ бързи опита → „Твърде много опити" (rate-limit)
- Footer линк в двата варианта
- Мобилно 375px — формата четима, бутон ≥44px

- [ ] **Стъпка 4: Питай за push**

Съобщи, че `pnpm check` минава. Питай за push към `dev` (= production). Push само при „да".

- [ ] **Стъпка 5: Обнови WORKLOG + памет**

Нов ред в „Дневник“ + memory (`order-lookup` статус: код готов, чака проверка/push). Отбележи, че е 4-та pure-code функция.

---

## Self-Review (проверено спрямо спеца)

- **Секция 2 (поток/action)** → Task 2 ✅ (`lookupOrder`, rate-limit, parseBgPhone, обща грешка, path към confirmation).
- **Секция 3 (parseOrderNumber)** → Task 1 ✅ (чист модул + тестове).
- **Секция 4 (страница+форма+footer)** → Task 3 (страница+форма) + Task 4 (footer 2 варианта) ✅.
- **Секция 5 (грешки)** → обща грешка (Task 2), rate-limit съобщение (Task 2), notFound (Task 3).
- **Секция 6 (сигурност)** → rate-limit преди всичко, e164 сравнение, tenant филтър, POST body (Task 2).
- **Секция 7 (тестове)** → Task 1 (parseOrderNumber); UI ръчно (Task 3/5).

**Type consistency:** `parseOrderNumber(string): number | null` — еднакво в Task 1 (деф) и Task 2 (употреба). `lookupOrder(shopSlug, rawInput): ActionResult<{path}>` — Task 2 (деф) → Task 3 форма (`result.data.path`). `parseBgPhone` резултат `{ok, e164}` — достъпът до `phone.e164` е гейтнат зад `phone.ok` (Task 2). Footer `base` префикс — еднакъв в двата варианта (Task 4).

**Отбелязан риск:** точните `--sf-*` променливи имена (Task 3) — съгласуват се с реалните от checkout-form при имплементация (забележка в стъпката).
