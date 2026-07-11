# Конверсионно трио — Implementation Plan

> **For agentic workers:** Изпълнява се **inline** (проектно правило: без паралелни субагенти). Чекбокс (`- [ ]`) стъпки за проследяване.

**Goal:** Три евтини високоефектни storefront подобрения: търсене в site-wide хедъра, доставка/срок на продуктовата страница, авто trust badges на checkout.

**Architecture:** Всичко реюзва съществуващо. A: нов client `HeaderSearch` (икона → `fixed` overlay лента) в 3-те header варианта, submit-ва към готовата `/products?search=`. B: нов server `ProductDelivery` блок от `getShippingMethods`. C: нов server `CheckoutTrustBadges` от тествана чиста функция `buildCheckoutBadges`.

**Tech Stack:** Next.js 16, storefront `--sf-*` токени, Vitest.

**Спец:** `docs/superpowers/specs/2026-07-11-conversion-trio-design.md`

## Global Constraints

- Storefront: само `--sf-*` токени (не „Пазарен ден"); mobile-first; един компонент за всички теми.
- BG копи, типографски кавички „…“; touch targets ≥44px (`size-11`/`h-11`).
- **COD = payment метод с `type === "cod"`**; безплатна доставка = `priceCents === 0`.
- **Без промяна** по съществуващата `/products` търсачка / `getActiveProducts` (param `search`).
- Реюз: `getShippingMethods` (`db/queries/fulfillment.ts`), `deliveryHoursLines` (`working-hours.ts`),
  `formatPrice` (`money.ts`), `Icon`/`IconName` (`components/ui`). Икони: `search`, `x`, `truck`,
  `return`, `shield-check`, `check` — всички валидни (ползвани в `trust-badges.tsx`/`products` page).
- Гейт `pnpm check` преди commit.

---

## Файлова структура

- **Create** `src/lib/checkout-badges.ts` + `src/lib/checkout-badges.test.ts` — чиста логика C.
- **Create** `src/components/storefront/checkout-trust-badges.tsx`; **Modify** checkout page.
- **Create** `src/components/storefront/product-delivery.tsx`; **Modify** продуктова страница.
- **Create** `src/components/storefront/header/header-search.tsx`; **Modify** `header/shared.tsx`
  (re-export) + 3-те варианта.

---

### Task 1: `buildCheckoutBadges` чиста логика + тестове (C ядро)

**Files:**
- Create: `src/lib/checkout-badges.ts`
- Test: `src/lib/checkout-badges.test.ts`

**Interfaces:**
- Produces: `CheckoutBadge = { icon: IconName; text: string }`;
  `buildCheckoutBadges(returnWindowDays: number, hasCod: boolean): CheckoutBadge[]`.

- [ ] **Стъпка 1: Напиши падащия тест** — `src/lib/checkout-badges.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildCheckoutBadges } from "./checkout-badges";

describe("buildCheckoutBadges", () => {
  it("винаги включва сигурна поръчка + без регистрация", () => {
    expect(buildCheckoutBadges(0, false).map((b) => b.text)).toEqual([
      "Сигурна поръчка",
      "Без регистрация",
    ]);
  });
  it("COD → добавя „Плащане при доставка" отпред", () => {
    expect(buildCheckoutBadges(0, true)[0]).toEqual({
      icon: "truck",
      text: "Плащане при доставка",
    });
  });
  it("връщане > 0 → badge с броя дни", () => {
    expect(buildCheckoutBadges(14, false).some((b) => b.text === "Връщане до 14 дни")).toBe(true);
  });
  it("връщане = 0 → без return badge", () => {
    expect(buildCheckoutBadges(0, false).some((b) => b.icon === "return")).toBe(false);
  });
  it("всичко включено → ред COD, връщане, сигурна, без регистрация", () => {
    expect(buildCheckoutBadges(30, true).map((b) => b.text)).toEqual([
      "Плащане при доставка",
      "Връщане до 30 дни",
      "Сигурна поръчка",
      "Без регистрация",
    ]);
  });
});
```

- [ ] **Стъпка 2: Пусни — трябва да падне**

Run: `pnpm exec vitest run src/lib/checkout-badges.test.ts`
Expected: FAIL — „Cannot find module './checkout-badges'“.

- [ ] **Стъпка 3: Имплементирай** — `src/lib/checkout-badges.ts`

```ts
import type { IconName } from "@/components/ui";

export interface CheckoutBadge {
  icon: IconName;
  text: string;
}

/**
 * Авто trust badges за checkout — деривирани от реални данни (без конфигурация).
 * Ред: плащане при доставка (ако COD) → връщане (ако има срок) → сигурна поръчка
 * → без регистрация (последните две са винаги).
 */
export function buildCheckoutBadges(returnWindowDays: number, hasCod: boolean): CheckoutBadge[] {
  const badges: CheckoutBadge[] = [];
  if (hasCod) badges.push({ icon: "truck", text: "Плащане при доставка" });
  if (returnWindowDays > 0) {
    badges.push({ icon: "return", text: `Връщане до ${returnWindowDays} дни` });
  }
  badges.push({ icon: "shield-check", text: "Сигурна поръчка" });
  badges.push({ icon: "check", text: "Без регистрация" });
  return badges;
}
```

- [ ] **Стъпка 4: Пусни — трябва да мине**

Run: `pnpm exec vitest run src/lib/checkout-badges.test.ts`
Expected: PASS (5 теста).

- [ ] **Стъпка 5: Commit**

```bash
git add src/lib/checkout-badges.ts src/lib/checkout-badges.test.ts
git commit -m "feat(trust-badges): buildCheckoutBadges чиста логика + тестове"
```

---

### Task 2: `CheckoutTrustBadges` компонент + монтиране (C)

**Files:**
- Create: `src/components/storefront/checkout-trust-badges.tsx`
- Modify: `src/app/(storefront)/s/[slug]/checkout/page.tsx`

- [ ] **Стъпка 1: Имплементирай компонента** — `src/components/storefront/checkout-trust-badges.tsx`

```tsx
import { Icon } from "@/components/ui";
import { buildCheckoutBadges } from "@/lib/checkout-badges";

interface CheckoutTrustBadgesProps {
  returnWindowDays: number;
  hasCod: boolean;
}

/** Тиха hairline лента с авто trust badges — реюз на стила от trust-badges вариант 2. */
export function CheckoutTrustBadges({ returnWindowDays, hasCod }: CheckoutTrustBadgesProps) {
  const badges = buildCheckoutBadges(returnWindowDays, hasCod);
  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 border-y border-(--sf-border) py-4">
      {badges.map((badge, i) => (
        <span key={badge.text} className="flex items-center gap-x-2">
          {i > 0 && <span aria-hidden className="mx-3 size-1 rounded-full bg-(--sf-border)" />}
          <span aria-hidden className="text-(--sf-primary)">
            <Icon name={badge.icon} size={17} />
          </span>
          <span className="text-sm font-medium text-(--sf-text)">{badge.text}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Стъпка 2: Монтирай в checkout страницата** — `src/app/(storefront)/s/[slug]/checkout/page.tsx`

Добави импорта най-горе:

```tsx
import { CheckoutTrustBadges } from "@/components/storefront/checkout-trust-badges";
```

Замени `else` клона (където се рендира формата) — добави лентата НАД `CheckoutForm`:

```tsx
      ) : (
        <>
          <CheckoutTrustBadges
            returnWindowDays={shop.returnWindowDays}
            hasCod={activePayment.some((m) => m.type === "cod")}
          />
          <CheckoutForm
            shopId={shop.id}
            slug={shop.slug}
            base={`/s/${shop.slug}`}
            shippingMethods={activeShipping}
            paymentMethods={activePayment}
            giftWrapEnabled={shop.giftWrapEnabled}
            giftWrapFeeCents={shop.giftWrapFeeCents}
            giftCardEnabled={shop.giftCardEnabled}
          />
        </>
      )}
```

- [ ] **Стъпка 3: Гейт**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Стъпка 4: Commit**

```bash
git add src/components/storefront/checkout-trust-badges.tsx "src/app/(storefront)/s/[slug]/checkout/page.tsx"
git commit -m "feat(trust-badges): авто trust лента на checkout"
```

---

### Task 3: `ProductDelivery` блок + монтиране (B)

**Files:**
- Create: `src/components/storefront/product-delivery.tsx`
- Modify: `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`

**Interfaces:**
- Consumes: `ShippingMethod` (`@/db`), `formatPrice`, `deliveryHoursLines`.
- Produces: `<ProductDelivery methods={ShippingMethod[]} />` (връща `null` при празен списък).

- [ ] **Стъпка 1: Имплементирай компонента** — `src/components/storefront/product-delivery.tsx`

```tsx
import type { ShippingMethod } from "@/db";
import { Icon } from "@/components/ui";
import { formatPrice } from "@/lib/money";
import { deliveryHoursLines } from "@/lib/working-hours";

/** Компактен блок „Доставка" на продуктовата страница — методи, цена, срок. */
export function ProductDelivery({ methods }: { methods: ShippingMethod[] }) {
  if (methods.length === 0) return null;
  return (
    <div className="mt-6 max-w-md rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-(--sf-primary)">
          <Icon name="truck" size={18} />
        </span>
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-(--sf-text)">Доставка</h2>
      </div>
      <ul className="flex flex-col divide-y divide-(--sf-border)">
        {methods.map((m) => {
          const lines = deliveryHoursLines(m.deliveryHours);
          return (
            <li key={m.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-(--sf-text)">{m.name}</span>
                <span className="shrink-0 text-sm text-(--sf-text)">
                  {m.priceCents === 0 ? "Безплатна" : formatPrice(m.priceCents)}
                </span>
              </div>
              {m.freeOverCents !== null && m.freeOverCents > 0 && m.priceCents > 0 && (
                <span className="text-xs text-(--sf-muted)">
                  Безплатна над {formatPrice(m.freeOverCents)}
                </span>
              )}
              {lines.map((line) => (
                <span key={line} className="text-xs text-(--sf-muted)">
                  {line}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Стъпка 2: Монтирай в продуктовата страница** — `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`

Добави импортите (при другите):

```tsx
import { ProductDelivery } from "@/components/storefront/product-delivery";
import { getShippingMethods } from "@/db/queries/fulfillment";
```

Добави `getShippingMethods` към `Promise.all` и филтрирай активните. Промени блока:

```tsx
  const [related, categories, productReviews, aggregates, shipping] = await Promise.all([
    getRelatedProducts(shop.id, product.id, product.categoryId),
    getPublicCategories(shop.id),
    getApprovedReviews(product.id, reviewsPage),
    getReviewAggregates([product.id]),
    getShippingMethods(shop.id),
  ]);
  const activeShipping = shipping.filter((m) => m.active);
```

Рендирай блока СЛЕД зоната за наличност (`StockAlertForm`), преди `Описание/Характеристики` — веднага след затварящия `)}` на `{product.stock === 0 && (...)}`:

```tsx
      {/* S14: изчерпан продукт (следи наличност) → „извести ме" */}
      {product.stock === 0 && (
        <div className="mt-6 max-w-md">
          <StockAlertForm shopSlug={shop.slug} productId={product.id} />
        </div>
      )}

      <ProductDelivery methods={activeShipping} />
```

- [ ] **Стъпка 3: Гейт**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Стъпка 4: Commit**

```bash
git add src/components/storefront/product-delivery.tsx "src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx"
git commit -m "feat(product-delivery): блок „Доставка" на продуктовата страница"
```

---

### Task 4: `HeaderSearch` компонент + монтиране в 3-те варианта (A)

**Files:**
- Create: `src/components/storefront/header/header-search.tsx`
- Modify: `src/components/storefront/header/shared.tsx` (re-export)
- Modify: `variant-1-inline.tsx`, `variant-2-split-bar.tsx`, `variant-3-minimal.tsx`

**Interfaces:**
- Produces: `<HeaderSearch base={string} />` (икона → `fixed` overlay лента → GET `/products?search=`).

- [ ] **Стъпка 1: Имплементирай компонента** — `src/components/storefront/header/header-search.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";

/** Лупа-икона → отваряща `fixed` търсеща лента (overlay), submit към /products?search=. */
export function HeaderSearch({ base }: { base: string }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Търсене"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-11 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70"
      >
        <Icon name="search" size={20} />
      </button>
      {open && (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-(--sf-border) bg-(--sf-bg) text-(--sf-text)">
          <form role="search" action={`${base}/products`} className="mx-auto flex h-19 max-w-6xl items-center gap-3 px-4">
            <span aria-hidden className="shrink-0 text-(--sf-muted)">
              <Icon name="search" size={20} />
            </span>
            <input
              ref={inputRef}
              type="search"
              name="search"
              required
              placeholder="Търси в магазина…"
              aria-label="Търсене на продукти"
              enterKeyHint="search"
              className="h-11 flex-1 bg-transparent text-(--sf-text) placeholder:text-(--sf-muted) focus:outline-none"
            />
            <button
              type="button"
              aria-label="Затвори търсенето"
              onClick={() => setOpen(false)}
              className="flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-(--sf-muted) transition-colors hover:text-(--sf-text)"
            >
              <Icon name="x" size={22} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Стъпка 2: Re-export от `shared.tsx`** — в края на `src/components/storefront/header/shared.tsx`, до другите re-export-и:

```tsx
export { CartButton };
export { FavoritesButton } from "../favorites-button";
export { HeaderSearch } from "./header-search";
```

- [ ] **Стъпка 3: Вариант 1** — `variant-1-inline.tsx`

Добави `HeaderSearch` в списъка с импорти от `"./shared"` (по азбучен ред, между `CartButton` и `FavoritesButton` — или където и да е в блока). Монтирай го ПРЕДИ `FavoritesButton` на ДВЕТЕ места:

Десктоп nav:
```tsx
          <NavOverflow items={overflow} />
          <HeaderSearch base={base} />
          <FavoritesButton shopId={shop.id} base={base} />
          <CartButton shopId={shop.id} base={base} />
```

Мобилен клъстер:
```tsx
        <div className="flex items-center gap-1 md:hidden">
          <HeaderSearch base={base} />
          <FavoritesButton shopId={shop.id} base={base} />
          <CartButton shopId={shop.id} base={base} />
          <MenuButton onOpen={() => setMenuOpen(true)} expanded={menuOpen} />
        </div>
```

- [ ] **Стъпка 4: Вариант 2** — `variant-2-split-bar.tsx`

Добави `HeaderSearch` в импортите от `"./shared"`. Монтирай в дясното крило, ПРЕДИ `FavoritesButton` (показва се на всички breakpoints — клъстерът не е `md:`-гейтнат):

```tsx
            <NavOverflow items={overflow} />
          </nav>
          <HeaderSearch base={base} />
          <FavoritesButton shopId={shop.id} base={base} />
          <CartButton shopId={shop.id} base={base} />
```

- [ ] **Стъпка 5: Вариант 3** — `variant-3-minimal.tsx`

Добави `HeaderSearch` в импортите от `"./shared"`. Монтирай ПРЕДИ `FavoritesButton`:

```tsx
          <div className="flex items-center gap-1">
            <HeaderSearch base={base} />
            <FavoritesButton shopId={shop.id} base={base} />
            <CartButton shopId={shop.id} base={base} />
            <MenuButton onOpen={() => setMenuOpen(true)} expanded={menuOpen} />
          </div>
```

- [ ] **Стъпка 6: Гейт**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Стъпка 7: Commit**

```bash
git add src/components/storefront/header/
git commit -m "feat(header-search): търсене в site-wide хедъра (3-те варианта, icon → overlay)"
```

---

### Task 5: Финален гейт + документация

- [ ] **Стъпка 1:** Пълен `pnpm check` → exit 0.
- [ ] **Стъпка 2:** Скан за контролни символи (Grep pattern `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`) върху новите файлове → няма съвпадения.
- [ ] **Стъпка 3:** Обнови WORKLOG (нов Дневник ред + „Листа за тестване") + памет (`conversion-trio-feature.md` + MEMORY.md ред).
- [ ] **Стъпка 4:** Питай за push към `dev` (= production). Push само при „да".

---

## Self-Review (сверено срещу спеца)

- **A:** icon → `fixed` overlay, submit към готовата `/products?search=`; 3-те варианта + всички breakpoints; без промяна по заявката. ✓
- **B:** server блок от `getShippingMethods`, реюз `formatPrice`/`deliveryHoursLines`; празно → `null`. ✓
- **C:** авто badges от `returnWindowDays` + `hasCod` (`type==="cod"`); чистата логика тествана. ✓
- **Type consistency:** `buildCheckoutBadges`/`CheckoutBadge`/`IconName` еднакви в Task 1/2; `ShippingMethod` от `@/db` в Task 3; `base: string` props в Task 4.
- **Реюз без дублиране:** нула промяна по `/products` search, `trust-badges` builder секцията, `getActiveProducts`.
