# Доверие + AOV пакет — Implementation Plan

> **For agentic workers:** Изпълнява се **inline** (проектно правило). Чекбокс (`- [ ]`) стъпки.

**Goal:** Verified purchase ревюта + cross-sell в количката + „Нов" badge.

**Architecture:** C — чиста `isNewProduct` + бадж в `ProductCard`. A — нова колона `reviews.verified`, опционален телефон във формата → match срещу поръчки (`hasPurchasedProduct`), бадж на продукта. B — `getCartSuggestions` action от категориите на количката → `CartSuggestions` лента в `CartView`.

**Tech Stack:** Next.js 16, Drizzle, storefront `--sf-*` токени, Vitest.

**Спец:** `docs/superpowers/specs/2026-07-11-trust-aov-bundle-design.md`

## Global Constraints

- Storefront: само `--sf-*` токени; mobile-first.
- „Нов" праг = **14 дни**; verified ревюта: **всеки може, телефон опционален**; телефонът **не се пази**.
- Purchase match = поръчка в магазина с `customerPhone === e164`, статус ∈ {`confirmed`,`shipped`,`completed`}, съдържаща продукта (`order_items.productId`).
- Cross-sell = по категория, до 4, извън количката; празно → нищо.
- Модерацията и `priceCart` НЕ се променят. Реюз навсякъде.
- Гейт `pnpm check`; `db:push` за новата колона (общата база; nullable default → безопасно).

---

### Task 1: `isNewProduct` чиста логика + тестове (C)

**Files:** Create `src/lib/product-badges.ts` + `src/lib/product-badges.test.ts`

- [ ] **Стъпка 1: Тест** — `src/lib/product-badges.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isNewProduct } from "./product-badges";

const now = Date.UTC(2026, 6, 11); // фиксиран „сега" за детерминизъм

describe("isNewProduct", () => {
  it("създаден днес → нов", () =>
    expect(isNewProduct(new Date(now), now)).toBe(true));
  it("създаден преди 13 дни → нов", () =>
    expect(isNewProduct(new Date(now - 13 * 86400000), now)).toBe(true));
  it("създаден преди 15 дни → не е нов", () =>
    expect(isNewProduct(new Date(now - 15 * 86400000), now)).toBe(false));
  it("точна граница 14 дни → нов (включително)", () =>
    expect(isNewProduct(new Date(now - 14 * 86400000), now)).toBe(true));
  it("персонализиран праг 7 дни", () =>
    expect(isNewProduct(new Date(now - 10 * 86400000), now, 7)).toBe(false));
});
```

- [ ] **Стъпка 2: Пусни — падне.** `pnpm exec vitest run src/lib/product-badges.test.ts` → FAIL.

- [ ] **Стъпка 3: Имплементирай** — `src/lib/product-badges.ts`

```ts
/** Дали продукт е „нов" — създаден в последните `days` дни спрямо `now` (ms). */
export function isNewProduct(createdAt: Date, now: number, days = 14): boolean {
  return now - createdAt.getTime() <= days * 86_400_000;
}
```

- [ ] **Стъпка 4: Пусни — мине.** Expected: PASS (5 теста).

- [ ] **Стъпка 5: Commit**

```bash
git add src/lib/product-badges.ts src/lib/product-badges.test.ts
git commit -m "feat(new-badge): isNewProduct чиста логика + тестове"
```

---

### Task 2: „Нов" badge в `ProductCard` (C)

**Files:** Modify `src/components/storefront/product-card.tsx`

- [ ] **Стъпка 1: Имплементирай.** Добави импорта:

```tsx
import { isNewProduct } from "@/lib/product-badges";
```

Изчисли (след `const promo = ...`):

```tsx
  const isNew = isNewProduct(product.createdAt, Date.now());
```

Замени единичния промо-бадж span (`{promo !== null && (...)}` върху снимката) с колона от баджове top-left:

```tsx
        <span className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {promo !== null && (
            <span className="rounded-full bg-(--sf-accent) px-2.5 py-1 text-xs font-bold text-(--sf-on-accent)">
              −{discountPercent(product.priceCents, promo)}%
            </span>
          )}
          {isNew && (
            <span className="rounded-full bg-(--sf-primary) px-2.5 py-1 text-xs font-bold text-(--sf-on-primary)">
              Нов
            </span>
          )}
        </span>
```

- [ ] **Стъпка 2: Гейт.** `pnpm check` → exit 0.

- [ ] **Стъпка 3: Commit**

```bash
git add src/components/storefront/product-card.tsx
git commit -m "feat(new-badge): „Нов" бадж на продуктовата карта (14 дни)"
```

---

### Task 3: A backend — `verified` колона + `db:push` + purchase match + `submitReview` (A)

**Files:** Modify `src/db/schema.ts`, `src/db/queries/reviews.ts`, `src/actions/reviews.ts`

- [ ] **Стъпка 1: Добави колоната** — в `reviews` таблицата (`src/db/schema.ts`), след реда `status:`:

```ts
    verified: boolean("verified").notNull().default(false),
```

(`boolean` вече е импортиран в schema.ts.)

- [ ] **Стъпка 2: Приложи към базата**

Run (PowerShell): `pnpm db:push`
Expected: колоната `verified` се добавя (default false за съществуващите редове).

- [ ] **Стъпка 3: Добави purchase-match заявката** — в `src/db/queries/reviews.ts`:

Разшири импортите:

```ts
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db, orderItems, orders, products, reviews } from "@/db";
```

Добави функцията:

```ts
/**
 * Има ли този телефон (e164) реална поръчка на дадения продукт в магазина —
 * за verified ревю. Статуси: confirmed/shipped/completed (реална покупка).
 */
export async function hasPurchasedProduct(
  shopId: string,
  phoneE164: string,
  productId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.shopId, shopId),
        eq(orders.customerPhone, phoneE164),
        inArray(orders.status, ["confirmed", "shipped", "completed"]),
        eq(orderItems.productId, productId),
      ),
    )
    .limit(1);
  return Boolean(row);
}
```

- [ ] **Стъпка 4: Разшири `submitReview`** — `src/actions/reviews.ts`:

Добави импортите:

```ts
import { parseBgPhone } from "@/lib/phone";
import { hasPurchasedProduct } from "@/db/queries/reviews";
```

Добави `phone` в схемата (след `text`):

```ts
  phone: z.string().max(30).optional(),
```

Преди `await db.insert(reviews)...`, изчисли `verified` и го подай:

```ts
  let verified = false;
  if (input.phone) {
    const parsedPhone = parseBgPhone(input.phone);
    if (parsedPhone.ok) {
      verified = await hasPurchasedProduct(shop.id, parsedPhone.e164, product.id);
    }
  }

  await db.insert(reviews).values({
    shopId: shop.id,
    productId: product.id,
    authorName: sanitizeText(input.authorName, 60),
    rating: input.rating,
    text: sanitizeMultiline(input.text, 1000),
    verified,
  });
```

- [ ] **Стъпка 5: Гейт.** `pnpm check` → exit 0.

- [ ] **Стъпка 6: Commit**

```bash
git add src/db/schema.ts src/db/queries/reviews.ts src/actions/reviews.ts
git commit -m "feat(verified-reviews): verified колона + purchase match + submitReview"
```

---

### Task 4: A frontend — телефон във формата + бадж на продукта (A)

**Files:** Modify `src/components/storefront/review-form.tsx`, `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`

- [ ] **Стъпка 1: Телефон в ревю формата** — `review-form.tsx`:

Добави state (при другите):

```tsx
  const [phone, setPhone] = useState("");
```

Подай `phone` в `submitReview(...)` (в обекта, до `text`):

```tsx
        text,
        phone,
        website: "",
```

Добави поле СЛЕД `textarea`-та (преди `{error && ...}`):

```tsx
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={30}
        placeholder="Телефон (по избор — за бадж „Потвърдена покупка")"
        aria-label="Телефон (по избор)"
        autoComplete="tel"
        className="h-11 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />
```

- [ ] **Стъпка 2: Бадж на продуктовата страница** — `.../p/[productSlug]/page.tsx`:

Увери се, че `Icon` е импортиран (добави ако липсва):

```tsx
import { Icon } from "@/components/ui";
```

В списъка с ревюта, след `authorName` span-а, добави:

```tsx
                        <span className="font-medium text-(--sf-text)">{review.authorName}</span>
                        {review.verified && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-(--sf-primary)">
                            <Icon name="shield-check" size={13} />
                            Потвърдена покупка
                          </span>
                        )}
```

- [ ] **Стъпка 3: Гейт.** `pnpm check` → exit 0.

- [ ] **Стъпка 4: Commit**

```bash
git add src/components/storefront/review-form.tsx "src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx"
git commit -m "feat(verified-reviews): телефон във формата + бадж „Потвърдена покупка"
```

---

### Task 5: B backend — cross-sell заявка + action (B)

**Files:** Modify `src/db/queries/storefront.ts`, `src/actions/cart.ts`

- [ ] **Стъпка 1: Заявка** — в `src/db/queries/storefront.ts` (до `getRelatedProducts`):

Увери се, че `notInArray` е импортиран от `drizzle-orm` (добави към import-а, ако липсва).

```ts
/** Cross-sell: активни продукти от категориите на количката, извън нея (до 4, най-нови). */
export async function getCrossSellProducts(shopId: string, productIds: string[]) {
  if (productIds.length === 0) return [];
  const inCart = await db.query.products.findMany({
    where: and(eq(products.shopId, shopId), inArray(products.id, productIds)),
    columns: { categoryId: true },
  });
  const categoryIds = [
    ...new Set(inCart.map((p) => p.categoryId).filter((c): c is string => c !== null)),
  ];
  if (categoryIds.length === 0) return [];
  return db.query.products.findMany({
    where: and(
      eq(products.shopId, shopId),
      eq(products.status, "active"),
      inArray(products.categoryId, categoryIds),
      notInArray(products.id, productIds),
    ),
    orderBy: [desc(products.createdAt)],
    limit: 4,
  });
}
```

- [ ] **Стъпка 2: Action** — в `src/actions/cart.ts`:

Добави импорта на заявката (при другите) и `z` ако липсва; ползвай съществуващите `clientIp`, `checkRateLimit`, `db`, `shops`, `eq`.

```ts
export interface SuggestionCard {
  id: string;
  name: string;
  slug: string;
  imagePath: string | null;
  priceCents: number;
  promoPriceCents: number | null;
}

/** Cross-sell предложения за количката (публично; лек rate limit; празно при нищо). */
export async function getCartSuggestions(
  slug: string,
  rawIds: unknown,
): Promise<SuggestionCard[]> {
  const parsed = z.array(z.uuid()).max(50).safeParse(rawIds);
  if (!parsed.success || parsed.data.length === 0) return [];
  const ip = await clientIp();
  if (!(await checkRateLimit(`cart-suggest:${ip}`, 30, 60))) return [];
  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, slug) });
  if (!shop || shop.status !== "published") return [];
  const rows = await getCrossSellProducts(shop.id, parsed.data);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    imagePath: p.images[0] ?? null,
    priceCents: p.priceCents,
    promoPriceCents: p.promoPriceCents,
  }));
}
```

(Ако `getCrossSellProducts`/`z`/`shops`/`eq` не са импортирани в `cart.ts` — добави ги.)

- [ ] **Стъпка 3: Гейт.** `pnpm check` → exit 0.

- [ ] **Стъпка 4: Commit**

```bash
git add src/db/queries/storefront.ts src/actions/cart.ts
git commit -m "feat(cross-sell): getCrossSellProducts заявка + getCartSuggestions action"
```

---

### Task 6: B frontend — `CartSuggestions` + монтиране в `CartView` (B)

**Files:** Create `src/components/storefront/cart-suggestions.tsx`; Modify `src/components/storefront/cart-view.tsx`

- [ ] **Стъпка 1: Компонент** — `src/components/storefront/cart-suggestions.tsx`

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCartSuggestions, type SuggestionCard } from "@/actions/cart";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

interface CartSuggestionsProps {
  slug: string;
  base: string;
  productIds: string[];
  onNavigate?: () => void;
}

/** „Може да ти хареса" — cross-sell лента под редовете на количката. */
export function CartSuggestions({ slug, base, productIds, onNavigate }: CartSuggestionsProps) {
  const [items, setItems] = useState<SuggestionCard[]>([]);
  const idsKey = productIds.join(",");

  useEffect(() => {
    if (productIds.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    getCartSuggestions(slug, productIds).then((r) => {
      if (!cancelled) setItems(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, idsKey]);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-(--sf-text)">Може да ти хареса</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`${base}/p/${p.slug}`}
            onClick={onNavigate}
            className="flex w-28 shrink-0 flex-col gap-1.5"
          >
            <span className="relative aspect-square overflow-hidden rounded-(--sf-radius) bg-(--sf-surface)">
              {p.imagePath && (
                <Image
                  src={publicImageUrl(p.imagePath)}
                  alt={p.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              )}
            </span>
            <span className="truncate text-xs font-medium text-(--sf-text)">{p.name}</span>
            <span className="text-xs font-bold text-(--sf-text)">
              {formatPrice(p.promoPriceCents ?? p.priceCents)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Стъпка 2: Монтирай в `CartView`** — `cart-view.tsx`:

Добави импорта:

```tsx
import { CartSuggestions } from "@/components/storefront/cart-suggestions";
```

Веднага СЛЕД затварящия `</div>` на списъка с редове (`<div className="flex flex-col gap-3">{rows.map(...)}</div>`), преди сумарния блок, добави:

```tsx
      <CartSuggestions
        slug={slug}
        base={base}
        productIds={[...new Set(stored.map((l) => l.productId))]}
        onNavigate={onNavigate}
      />
```

- [ ] **Стъпка 3: Гейт.** `pnpm check` → exit 0.

- [ ] **Стъпка 4: Commit**

```bash
git add src/components/storefront/cart-suggestions.tsx src/components/storefront/cart-view.tsx
git commit -m "feat(cross-sell): „Може да ти хареса" лента в количката"
```

---

### Task 7: Финален гейт + документация

- [ ] **Стъпка 1:** Пълен `pnpm check` → exit 0 (вкл. `isNewProduct` теста).
- [ ] **Стъпка 2:** Скан за контролни символи (Grep `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`) върху новите файлове → няма.
- [ ] **Стъпка 3:** Обнови WORKLOG (Дневник + „Листа за тестване") + памет (`trust-aov-bundle-feature.md` + MEMORY.md).
- [ ] **Стъпка 4:** Питай за push към `dev` (= production). Push само при „да". (Забележка: `db:push` вече е приложен на общата база.)

---

## Self-Review (сверено срещу спеца)

- **A:** `verified` колона + опционален телефон → `hasPurchasedProduct` (confirmed/shipped/completed + продукта) → бадж; телефонът не се пази; модерация непроменена. ✓
- **B:** `getCartSuggestions` (категории на количката, извън нея, ≤4) → лента в `CartView` (drawer+/cart); празно → нищо. ✓
- **C:** `isNewProduct(createdAt, now, 14)` тествана → бадж top-left в `ProductCard` (стек с промо). ✓
- **Type consistency:** `isNewProduct` еднаква Task 1/2; `SuggestionCard` еднаква Task 5/6; `hasPurchasedProduct` Task 3→4; `review.verified` от findMany (всички колони).
- **db:push** приложен преди runtime-а на A (Task 3, стъпка 2).
