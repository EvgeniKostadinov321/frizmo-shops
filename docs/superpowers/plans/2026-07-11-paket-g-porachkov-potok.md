# Пакет Г „Поръчков поток“ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder („Поръчай пак същото“) от страницата с потвърждение на поръчка + печатна складова бележка (packing slip) за търговеца.

**Architecture:** Reorder е публично action по `publicToken` (никакво доверие на клиента), което връща наличните артикули като cart редове; клиентската количка ги мержва. Печатът е нов route `/dashboard/orders/[id]/print` — server component с `requireShop()` + print CSS.

**Tech Stack:** Next.js 16 App Router, Drizzle + Supabase Postgres, Zod, EUR интегер центове.

## Global Constraints

- Публичните действия: Zod + rate-limit + никакво доверие на клиентски данни; `publicToken` = достъп.
- Търговски страници през `requireShop()` + tenant проверка (`order.shopId === shop.id`).
- Пари в центове; `formatPrice`. Cart line формат = `{ productId: uuid, variantKey: string | null, quantity: number }` (виж `linesSchema` в src/actions/cart.ts).
- Количката е клиентска (localStorage) — action-ите връщат данни, клиентът мержва.
- BG UI с „…“; **никакви емоджита в печата** (правило: SVG икони/текст). Токени, без inline стойности.
- `pnpm check` е гейтът. Няма schema промени → **няма `db:push`** в този пакет.

---

### Task 1: `reorderToCart` action — връща наличните артикули

**Files:**
- Create: `src/actions/reorder.ts`
- Test: `src/actions/reorder.test.ts` (чистата part-availability логика като helper)

**Interfaces:**
- Consumes: `orders` + `orderItems` (по `publicToken`); текущи `products`/`productVariants` за наличност.
- Produces: `reorderToCart(shopSlug, orderId, token) → ActionResult<{ lines: ReorderLine[]; skipped: string[] }>` където `ReorderLine = { productId: string; variantKey: string | null; quantity: number }`.

- [ ] **Step 1: Write the failing test** (чистата логика „какво да скипна“)

Изнеси решаващата функция като чист helper, за да е тестваема без база:

```ts
// src/actions/reorder.test.ts
import { describe, expect, it } from "vitest";
import { resolveReorderLine, type ReorderCandidate } from "./reorder";

const base: ReorderCandidate = {
  productId: "p1", variantKey: null, quantity: 2,
  productExists: true, productActive: true, stock: null,
};

describe("resolveReorderLine", () => {
  it("наличен продукт без лимит → пълно количество", () => {
    expect(resolveReorderLine(base)).toEqual({ productId: "p1", variantKey: null, quantity: 2 });
  });
  it("липсващ продукт → null (скип)", () => {
    expect(resolveReorderLine({ ...base, productExists: false })).toBeNull();
  });
  it("неактивен продукт → null", () => {
    expect(resolveReorderLine({ ...base, productActive: false })).toBeNull();
  });
  it("наличност 0 → null", () => {
    expect(resolveReorderLine({ ...base, stock: 0 })).toBeNull();
  });
  it("наличност под желаното → cap до наличността", () => {
    expect(resolveReorderLine({ ...base, stock: 1 })).toEqual({ productId: "p1", variantKey: null, quantity: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/actions/reorder.test.ts`
Expected: FAIL — модулът не съществува.

- [ ] **Step 3: Write the helper + action**

```ts
// src/actions/reorder.ts
"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, orderItems, orders, products, shops } from "@/db";
import { clientIp } from "@/actions/cart";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { checkRateLimit } from "@/lib/rate-limit";

export interface ReorderLine {
  productId: string;
  variantKey: string | null;
  quantity: number;
}

export interface ReorderCandidate {
  productId: string;
  variantKey: string | null;
  quantity: number;
  productExists: boolean;
  productActive: boolean;
  /** null = без следене на наличност (неограничено). */
  stock: number | null;
}

/** Чиста логика: наличен ли е артикулът и с какво количество. null = скип. */
export function resolveReorderLine(c: ReorderCandidate): ReorderLine | null {
  if (!c.productExists || !c.productActive) return null;
  if (c.stock !== null && c.stock <= 0) return null;
  const qty = c.stock !== null ? Math.min(c.quantity, c.stock) : c.quantity;
  if (qty <= 0) return null;
  return { productId: c.productId, variantKey: c.variantKey, quantity: qty };
}

const inputSchema = z.object({ orderId: z.uuid(), token: z.uuid() });

/**
 * Reorder: по publicToken зарежда наличните артикули на поръчка обратно като
 * cart редове. Скипва липсващи/неактивни/изчерпани. Цените НЕ идват от snapshot —
 * количката ги преизчислява от текущия продукт (сървърът е ценовият източник).
 */
export async function reorderToCart(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult<{ lines: ReorderLine[]; skipped: string[] }>> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Невалидна заявка.");
  const { orderId, token } = parsed.data;

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail("Магазинът не е достъпен.");

  const ip = await clientIp();
  if (!(await checkRateLimit(`reorder:${ip}`, 10, 3600))) {
    return fail("Твърде много опити. Опитай по-късно.");
  }

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.shopId, shop.id), eq(orders.publicToken, token)),
  });
  if (!order) return fail("Поръчката не е намерена.");

  const items = await db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) });

  const lines: ReorderLine[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    if (!item.productId) { skipped.push(item.productName); continue; }
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, item.productId), eq(products.shopId, shop.id)),
    });
    /* Наличността се проверява на ниво продукт (product.stock). Вариантът се носи
       като snapshot variantKey — валидира се повторно от pricing-а на количката
       (priceCartAction). Reorder е удобство, не гаранция. */
    const line = resolveReorderLine({
      productId: item.productId,
      variantKey: item.variantKey || null,
      quantity: item.quantity,
      productExists: !!product,
      productActive: product?.status === "active",
      stock: product?.stock ?? null,
    });
    if (line) lines.push(line);
    else skipped.push(item.productName);
  }

  if (lines.length === 0) return fail("Нито един артикул не е наличен вече.");
  return ok({ lines, skipped });
}
```

Забележка: `productVariants` НЯМА колона `key` — има `options` (Record<string,string>) + собствен `stock`. Затова reorder проверява наличност на ниво продукт (`product.stock`) и носи `variantKey` snapshot без re-lookup; количката преизчислява при мерджване. Това е нарочно опростяване (edge случай „вариантът е изтрит, но продуктът е активен“ → добавя се, pricing-ът го хваща).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/actions/reorder.test.ts`
Expected: PASS (6 теста).

- [ ] **Step 5: Commit**

```bash
git add src/actions/reorder.ts src/actions/reorder.test.ts
git commit -m "feat(orders): reorderToCart — налични артикули по publicToken + TDD"
```

---

### Task 2: Reorder бутон на страницата с потвърждение

**Files:**
- Create: `src/components/storefront/reorder-button.tsx`
- Modify: `src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx` (монтира бутона)

**Interfaces:**
- Consumes: `reorderToCart` (Task 1); клиентския cart store (същия, който `add-to-cart` ползва).

- [ ] **Step 1: Намери cart store API-то**

Run: grep за начина, по който продуктовата страница добавя в количката (напр. `useCart`, `addItem`, `cart-storage`). Reorder бутонът ще ползва СЪЩИЯ store, за да мержне върнатите редове. Запиши точното име на hook/функцията.

- [ ] **Step 2: Build the button** (`"use client"`, огледало на `ReturnRequest`)

```tsx
// src/components/storefront/reorder-button.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reorderToCart } from "@/actions/reorder";
// import { <cartHook> } from "<път от Step 1>";

export function ReorderButton({
  shopSlug, orderId, token,
}: { shopSlug: string; orderId: string; token: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // const cart = <cartHook>();

  function run() {
    startTransition(async () => {
      const res = await reorderToCart(shopSlug, { orderId, token });
      if (!res.ok) { setMsg(res.error); return; }
      // за всеки ред: cart.add(line.productId, line.variantKey, line.quantity)
      const added = res.data.lines.length;
      const skipped = res.data.skipped.length;
      setMsg(
        skipped > 0
          ? `Добавени ${added} артикула; ${skipped} вече не са налични.`
          : `Добавени ${added} артикула в количката.`,
      );
      router.push(`/s/${shopSlug}/cart`); // адаптирай към реалния cart route
    });
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex h-11 items-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Момент…" : "Поръчай пак същото"}
      </button>
      {msg && <p className="text-sm text-(--sf-muted)">{msg}</p>}
    </div>
  );
}
```

Важно: числата минават през `count(n, NOUNS.x)` (plural.ts) за правилна форма („1 артикул“ / „3 артикула“) — замени грубото „N артикула“. Провери `NOUNS` за подходяща дума (или добави `item: { one: "артикул", many: "артикула" }`).

- [ ] **Step 3: Монтирай бутона** в order confirmation page-а

В `src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx`, след блока с артикулите (или до „Обратно към магазина“):
```tsx
<ReorderButton shopSlug={shop.slug} orderId={order.id} token={token} />
```
(`token` вече е в scope — валидиран по-горе.)

- [ ] **Step 4: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки (cart hook импортиран правилно).

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/reorder-button.tsx "src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx" src/lib/plural.ts
git commit -m "feat(orders): бутон „Поръчай пак същото" на потвърждението"
```

---

### Task 3: Печатна складова бележка

**Files:**
- Create: `src/app/(dashboard)/dashboard/orders/[id]/print/page.tsx`
- Create: `src/components/dashboard/print-button.tsx` (малък client бутон `window.print()`)
- Modify: `src/app/(dashboard)/dashboard/orders/[id]/page.tsx` (линк/бутон „Печат“)

**Interfaces:**
- Consumes: `getOrderWithItems` (вече съществува) + `requireShop()`.

- [ ] **Step 1: Print бутон компонент**

```tsx
// src/components/dashboard/print-button.tsx
"use client";
import { Button } from "@/components/ui";
export function PrintButton() {
  return <Button type="button" variant="secondary" onClick={() => window.print()}>Печат</Button>;
}
```

- [ ] **Step 2: Print страница** (server component, tenant проверка, БЕЗ емоджи)

```tsx
// src/app/(dashboard)/dashboard/orders/[id]/print/page.tsx
import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintButton } from "@/components/dashboard/print-button";
import { getOrderWithItems } from "@/db/queries/orders";
import { requireShop } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Складова бележка — Frizmo Shops" };

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" });

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { shop } = await requireShop();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await getOrderWithItems(id);
  if (!order || order.shopId !== shop.id) notFound();

  const number = `№${String(order.orderNumber).padStart(4, "0")}`;

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-black print:p-0">
      {/* Скрива се при печат */}
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-black/20 pb-4">
        <p className="text-sm text-black/60">{shop.name}</p>
        <h1 className="font-display text-2xl font-extrabold">Складова бележка {number}</h1>
        <p className="text-sm text-black/60">{dateFormat.format(order.createdAt)}</p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h2 className="mb-1 font-bold">Клиент</h2>
          <p>{order.customerName}</p>
          <p>{order.customerPhone}</p>
          {(order.address || order.city) && (
            <p>{[order.address, order.city].filter(Boolean).join(", ")}</p>
          )}
        </div>
        <div>
          <h2 className="mb-1 font-bold">Доставка</h2>
          <p>{order.shippingName}</p>
          <p>{order.paymentName}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/40 text-left">
            <th className="py-1">Артикул</th>
            <th className="py-1 text-center">Бр.</th>
            <th className="py-1 text-right">Сума</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-black/10">
              <td className="py-1.5">
                {item.productName}
                {item.variantLabel && ` (${item.variantLabel})`}
              </td>
              <td className="py-1.5 text-center tabular-nums">{item.quantity}</td>
              <td className="py-1.5 text-right tabular-nums">{formatPrice(item.lineTotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-col items-end gap-1 text-sm">
        <p>Доставка: {formatPrice(order.shippingPriceCents)}</p>
        <p className="text-lg font-bold">Общо: {formatPrice(order.totalCents)}</p>
      </div>

      {order.note && (
        <p className="mt-4 rounded border border-black/20 p-3 text-sm">Бележка: {order.note}</p>
      )}
    </div>
  );
}
```

Забележки:
- Печатът е нарочно **черно на бяло** (`text-black bg-white`) — печат-friendly, не зависи от dashboard тъмната тема. Това е изключение от токен-правилото, оправдано за print (документирай в кратък коментар).
- `print:hidden` крие бутона; ако dashboard layout-ът добавя nav/sidebar около тази страница, добави глобален print stylesheet или локален `<style>` който крие layout chrome-а при `@media print`. Провери дали route-ът е под dashboard layout — ако да, най-чисто е тази страница да е извън layout-а (own route без sidebar) ИЛИ да добави `@media print { нежеланите елементи → display:none }`.

- [ ] **Step 3: Реши layout chrome въпроса**

Провери `src/app/(dashboard)/dashboard/layout.tsx` — има ли sidebar/nav, който ще излезе на печата. Ако да: добави в print страницата локален `<style>{"@media print{body *{visibility:hidden} .print-slip,.print-slip *{visibility:visible} .print-slip{position:absolute;inset:0}}"}</style>` и увий документа в `<div className="print-slip">`. Това е най-надеждният начин да скриеш всичко около бележката без да пипаш layout-а.

- [ ] **Step 4: Добави „Печат“ бутон/линк на order детайла**

В `src/app/(dashboard)/dashboard/orders/[id]/page.tsx`, до „← Всички поръчки“:
```tsx
<Link href={`/dashboard/orders/${order.id}/print`} className="text-sm text-brand-600 hover:underline">
  Печат
</Link>
```

- [ ] **Step 5: Verify build**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/dashboard/orders/[id]/print/page.tsx" src/components/dashboard/print-button.tsx "src/app/(dashboard)/dashboard/orders/[id]/page.tsx"
git commit -m "feat(orders): печатна складова бележка (packing slip)"
```

---

### Task 4: Пълен гейт

- [ ] **Step 1: Пълен гейт**

Run: `pnpm check`
Expected: lint + unit + build зелени. (Няма `db:push` — пакетът е без schema промени.)

- [ ] **Step 2: Спри за push разрешение**

Докладвай: пакет Г готов, `pnpm check` зелен, чака разрешение за push към `dev` (=prod). НЕ push-вай без изрично „да“.

---

## Self-Review (свери преди старт)

- **Спец покритие:** Г1 reorder (Tasks 1,2) · Г2 печат (Task 3). ✓
- **Пари „сървърът е източникът“:** reorder връща само редове, количката преизчислява цените (Task 1 docstring). ✓
- **Edge case „всичко недостъпно“:** `if (lines.length === 0) return fail(...)` (Task 1). ✓
- **Без емоджи в печата:** таблицата е чист текст (Task 3). Съществуващият `🏷` в order детайла НЕ се пипа (извън обхват). ✓
- **Tenant изолация:** print + reorder проверяват `shopId`; reorder освен това `publicToken`. ✓
- **Placeholder scan:** Task 2 Step 1 (cart hook) е grep-стъпка за реалното име — не placeholder, а нарочна проверка. Cart route (`/cart`) в Task 2 да се потвърди срещу реалния route. `productVariants.key` НЕ съществува — план коригиран да проверява продукт-ниво наличност (Task 1).
- **Числово съгласуване:** Task 2 Step 2 — „N артикула“ през `count()`/`NOUNS`. ✓
