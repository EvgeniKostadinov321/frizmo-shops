# Complexity Mode Implementation Plan (Фаза 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Прогресивно разкриване на dashboard функциите чрез 3 режима на сложност (Хоби/Малък бизнес/Пълна), които скриват nav секции и продуктови полета.

**Architecture:** Централен чист модул `complexity.ts` (MODE_LEVEL + isVisible) е източникът на истината. Нова колона `shops.complexityMode` пази избора per магазин. Layout-ът (server) чете режима и подава на nav компонентите (филтрират NAV_ITEMS по minMode) + на хедър дропдаун. Продуктовата форма чете режима като prop (маха се localStorage тогълът). Чисто презентационно — никога не трие/спира данни.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle + Supabase Postgres, Zod, Tailwind 4 (токени), Vitest, TypeScript (строг).

## Global Constraints

- UI текстове на български; типографски кавички „…“ (прав `"` чупи стрингове/lint).
- Само дизайн токени; никакви inline hex/px; никакви `dark:` варианти.
- Touch targets ≥ 44px (`h-11`).
- Строг TypeScript, без `as any`.
- Мутации САМО в `src/actions/`, през `requireShop()` wrapper (auth + собственост + Zod).
- Чисти функции до server action → отделен неутрален `@/lib` модул (не в `"use server"` файл).
- Режимът е UI помощ, НЕ security gate: не блокира достъп по URL, не трие/спира данни.
- Default на колоната = `full` (съществуващите магазини не губят нищо при `db:push`).
- `db:push` иска `DATABASE_URL_MIGRATIONS` (само локално). Гейт: `pnpm check`. Push към `dev`
  (=prod) само след изрично разрешение.

## File Structure

- `src/lib/complexity.ts` (NEW) — `ComplexityMode`, `MODE_LEVEL`, `MODE_META`, `isVisible`.
- `src/lib/complexity.test.ts` (NEW) — Vitest тестове.
- `src/db/schema.ts` (MODIFY) — `complexityModeEnum` + `shops.complexityMode` колона.
- `src/schemas/shop.ts` (MODIFY) — Zod `complexityModeSchema` (enum).
- `src/actions/shop.ts` (MODIFY) — `setComplexityMode` action + `createShop` чете полето.
- `src/components/dashboard/nav-items.ts` (MODIFY) — `minMode` на всеки NavItem.
- `src/components/dashboard/nav.tsx` (MODIFY) — `mode` prop + филтър.
- `src/components/dashboard/mobile-menu-button.tsx` (MODIFY) — `mode` prop + филтър + switcher.
- `src/components/dashboard/complexity-mode-switcher.tsx` (NEW) — хедър дропдаун.
- `src/app/(dashboard)/dashboard/layout.tsx` (MODIFY) — подава режима на nav + switcher.
- `src/components/dashboard/shop-wizard.tsx` (MODIFY) — стъпка „Сложност".
- `src/components/dashboard/product-form.tsx` (MODIFY) — `complexityMode` prop, филтрира табове.
- `src/app/(dashboard)/dashboard/products/new/page.tsx` + `[id]/page.tsx` (MODIFY) — подават режима.
- `src/lib/product-form-mode.ts` (DELETE) — заменен от режима.

---

### Task 1: `complexity.ts` централен модул

**Files:**
- Create: `src/lib/complexity.ts`
- Create: `src/lib/complexity.test.ts`

**Interfaces:**
- Produces:
  - `type ComplexityMode = "hobby" | "business" | "full"`
  - `const MODE_LEVEL: Record<ComplexityMode, number>` (hobby=0, business=1, full=2)
  - `interface ModeMeta { value: ComplexityMode; label: string; description: string }`
  - `const MODE_META: ModeMeta[]` (3 записа, ред hobby→business→full)
  - `function isVisible(itemMinMode: number, currentMode: ComplexityMode): boolean`

- [ ] **Step 1: Write the failing test**

Създай `src/lib/complexity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MODE_LEVEL, MODE_META, isVisible, type ComplexityMode } from "./complexity";

describe("complexity", () => {
  it("нивата са наредени hobby < business < full", () => {
    expect(MODE_LEVEL.hobby).toBeLessThan(MODE_LEVEL.business);
    expect(MODE_LEVEL.business).toBeLessThan(MODE_LEVEL.full);
  });

  it("hobby вижда само minMode 0", () => {
    expect(isVisible(0, "hobby")).toBe(true);
    expect(isVisible(1, "hobby")).toBe(false);
    expect(isVisible(2, "hobby")).toBe(false);
  });

  it("business вижда minMode 0 и 1, не 2", () => {
    expect(isVisible(0, "business")).toBe(true);
    expect(isVisible(1, "business")).toBe(true);
    expect(isVisible(2, "business")).toBe(false);
  });

  it("full вижда всичко", () => {
    expect(isVisible(0, "full")).toBe(true);
    expect(isVisible(1, "full")).toBe(true);
    expect(isVisible(2, "full")).toBe(true);
  });

  it("MODE_META покрива и трите режима в ред hobby→business→full", () => {
    expect(MODE_META.map((m) => m.value)).toEqual<ComplexityMode[]>([
      "hobby",
      "business",
      "full",
    ]);
    for (const m of MODE_META) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- complexity`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

Създай `src/lib/complexity.ts`:

```ts
/**
 * Режим на сложност — прогресивно разкриване на dashboard функциите. Чисто
 * презентационен: определя КОИ секции/полета се показват, никога не трие/спира
 * данни. Разделен от плановата система (безплатен за всеки магазин).
 */

export type ComplexityMode = "hobby" | "business" | "full";

/** Числово ниво — елемент с minMode се показва при currentMode ≥ minMode. */
export const MODE_LEVEL: Record<ComplexityMode, number> = {
  hobby: 0,
  business: 1,
  full: 2,
};

export interface ModeMeta {
  value: ComplexityMode;
  label: string;
  description: string;
}

/** Метаданни за дропдауна/onboarding — ред hobby → business → full. */
export const MODE_META: ModeMeta[] = [
  { value: "hobby", label: "Хоби", description: "Само основното — продукти, поръчки, магазин." },
  {
    value: "business",
    label: "Малък бизнес",
    description: "Основното + категории, промо кодове, ревюта, аналитика.",
  },
  {
    value: "full",
    label: "Пълна настройка",
    description: "Всички функции — реферали, product feed, SEO, варианти и още.",
  },
];

/** Видим ли е елемент с даден minMode при текущия режим. */
export function isVisible(itemMinMode: number, currentMode: ComplexityMode): boolean {
  return MODE_LEVEL[currentMode] >= itemMinMode;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- complexity`
Expected: PASS (5 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/complexity.ts src/lib/complexity.test.ts
git commit -F - <<'EOF'
feat(complexity): централен модул за режим на сложност

ComplexityMode + MODE_LEVEL + MODE_META + isVisible (minMode праг).
Чист неутрален модул, TDD.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Схема — enum + колона

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/schemas/shop.ts`

**Interfaces:**
- Consumes: `ComplexityMode` от Task 1.
- Produces: `complexityModeEnum` (pgEnum), `shops.complexityMode` колона, `complexityModeSchema` (Zod).

- [ ] **Step 1: Add pgEnum**

В `src/db/schema.ts`, до `couponTypeEnum` (ред 24), добави:

```ts
/** Режим на сложност на dashboard-а (прогресивно разкриване). Default full → съществуващите не губят нищо. */
export const complexityModeEnum = pgEnum("complexity_mode", ["hobby", "business", "full"]);
```

- [ ] **Step 2: Add column to shops**

В `shops` таблицата (`src/db/schema.ts`), след `status` колоната (ред 76) и преди `createdAt`, добави:

```ts
    /** Ф2: режим на сложност — скрива напреднали nav секции/полета. Default full (стари магазини не губят нищо). */
    complexityMode: complexityModeEnum("complexity_mode").notNull().default("full"),
```

- [ ] **Step 3: Add Zod schema**

Прочети `src/schemas/shop.ts` за стила. Добави exported схема (обикновено с `z`):

```ts
export const complexityModeSchema = z.enum(["hobby", "business", "full"]);
```

(Ако `z` не е импортиран там — виж как е в другите схеми; повечето ползват `import { z } from "zod"`.)

- [ ] **Step 4: Push schema to DB**

Run: `pnpm db:push`
Expected: прилага новата колона `complexity_mode` (enum) с default `full`. Потвърди, че съществуващите редове получават `full`.

Ако `db:push` иска потвърждение за enum — приеми. Ако `DATABASE_URL_MIGRATIONS` липсва → спри и питай потребителя.

- [ ] **Step 5: Verify типове**

Run: `pnpm build`
Expected: PASS — `shops` типът вече включва `complexityMode`.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/schemas/shop.ts
git commit -F - <<'EOF'
feat(complexity): схема — complexity_mode enum + shops.complexityMode

Default full (db:push не променя съществуващи магазини). Zod complexityModeSchema.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Action + createShop чете режима

**Files:**
- Modify: `src/actions/shop.ts`

**Interfaces:**
- Consumes: `complexityModeSchema` (Task 2), `shops` таблица, `requireShop`, `getOwnShop`.
- Produces: `setComplexityMode(mode: ComplexityMode): Promise<ActionResult>`.

- [ ] **Step 1: Add setComplexityMode action**

В `src/actions/shop.ts`, добави (внимавай — файлът е `"use server"`, значи само async exports). Импортирай `complexityModeSchema` и `ComplexityMode`:

```ts
import { complexityModeSchema, shopSchema, type ShopInput } from "@/schemas/shop";
import type { ComplexityMode } from "@/lib/complexity";
```

Нов action. `ActionResult`/`ok`/`fail` са вече импортирани в този файл (ред 13:
`import { ok, zodFail, type ActionResult } from "@/lib/action-result"`). Добави `fail` към
импорта. Точната сигнатура (от `src/lib/action-result.ts`): `ok<T>(data: T)` — ИЗИСКВА
аргумент → `ok(null)`; `fail(error: string)`.

```ts
export async function setComplexityMode(mode: ComplexityMode): Promise<ActionResult> {
  const parsed = complexityModeSchema.safeParse(mode);
  if (!parsed.success) return fail("Невалиден режим.");
  const { shop } = await requireShop();
  await db.update(shops).set({ complexityMode: parsed.data }).where(eq(shops.id, shop.id));
  /* Nav-ът се рендерира в dashboard layout-а → инвалидирай го. */
  revalidatePath("/dashboard", "layout");
  return ok(null);
}
```

Обнови импорта на ред 13:
```ts
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
```

Забележка: `ActionResult` default-ва към `ActionResult<null>` → `result.ok` е дискриминантът;
switcher-ът (Task 5) проверява `if (!result.ok) { toast.error(result.error) }`.

- [ ] **Step 2: createShop reads complexityMode**

В `createShop` (`src/actions/shop.ts:81`), след успешния parse и преди/по време на `insertShopWithUniqueSlug`, прочети режима от FormData (default `business` за нови):

```ts
  const modeRaw = formData.get("complexityMode");
  const modeParsed = complexityModeSchema.safeParse(modeRaw);
  const complexityMode = modeParsed.success ? modeParsed.data : "business";
```

После добави го към стойностите подадени на `insertShopWithUniqueSlug`:

```ts
  await insertShopWithUniqueSlug(values.name, (slug) => ({
    ...values,
    slug,
    ownerId: user.id,
    complexityMode,
  }));
```

- [ ] **Step 3: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/actions/shop.ts
git commit -F - <<'EOF'
feat(complexity): setComplexityMode action + createShop чете режима

createShop чете complexityMode от wizard-а (default business за нови).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Nav филтриране (minMode + layout)

**Files:**
- Modify: `src/components/dashboard/nav-items.ts`
- Modify: `src/components/dashboard/nav.tsx`
- Modify: `src/components/dashboard/mobile-menu-button.tsx`
- Modify: `src/app/(dashboard)/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `isVisible`, `ComplexityMode` (Task 1); `shop.complexityMode` (Task 2).
- Produces: `NavItem.minMode: number`; nav компонентите приемат `mode: ComplexityMode`.

- [ ] **Step 1: Add minMode to NavItem + NAV_ITEMS**

В `src/components/dashboard/nav-items.ts`, добави `minMode: number` към `NavItem` интерфейса и стойност на всеки запис (по feature-матрицата от спеца):

```ts
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  /** Ф2: минимален режим на сложност, при който секцията се показва (0=hobby, 1=business, 2=full). */
  minMode: number;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Табло", icon: "trending-up", exact: true, minMode: 0 },
  { href: "/dashboard/analytics", label: "Аналитика", icon: "trending-up", minMode: 1 },
  { href: "/dashboard/store", label: "Магазин", icon: "store", minMode: 0 },
  { href: "/dashboard/products", label: "Продукти", icon: "store", minMode: 0 },
  { href: "/dashboard/size-guides", label: "Таблици размери", icon: "ruler", minMode: 2 },
  { href: "/dashboard/orders", label: "Поръчки", icon: "receipt", minMode: 0 },
  { href: "/dashboard/reviews", label: "Ревюта", icon: "star", minMode: 1 },
  { href: "/dashboard/questions", label: "Въпроси", icon: "help-circle", minMode: 2 },
  { href: "/dashboard/categories", label: "Категории", icon: "palette", minMode: 1 },
  { href: "/dashboard/website", label: "Уебсайт", icon: "image", minMode: 0 },
  { href: "/dashboard/subscribers", label: "Абонати", icon: "megaphone", minMode: 2 },
  { href: "/dashboard/coupons", label: "Промо кодове", icon: "tag", minMode: 1 },
  { href: "/dashboard/fulfillment", label: "Плащане и доставка", icon: "trending-up", minMode: 0 },
  { href: "/dashboard/billing", label: "Абонамент", icon: "wallet", minMode: 0 },
];
```

- [ ] **Step 2: Filter in DashboardNav**

В `src/components/dashboard/nav.tsx`: добави `mode` prop и филтрирай. Импортирай `isVisible`, `ComplexityMode`:

```ts
import { NAV_ITEMS, isActive } from "@/components/dashboard/nav-items";
import { isVisible, type ComplexityMode } from "@/lib/complexity";
```

Промени сигнатурата + `.map`:

```tsx
export function DashboardNav({
  mode,
  pendingReviews = 0,
  pendingQuestions = 0,
}: {
  mode: ComplexityMode;
  pendingReviews?: number;
  pendingQuestions?: number;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => isVisible(item.minMode, mode));
  // ... badgeFor непроменено ...
  return (
    <nav aria-label="Основна навигация" className="hidden flex-col gap-1 md:flex">
      {items.map((item) => {
        // ... тялото непроменено ...
```

- [ ] **Step 3: Filter in MobileMenuButton**

В `src/components/dashboard/mobile-menu-button.tsx`: същото — `mode` prop + филтър. Импортирай `isVisible`, `ComplexityMode`. Промени сигнатурата да приема `mode: ComplexityMode` и замени `NAV_ITEMS.map` с `items.map`, където `const items = NAV_ITEMS.filter((item) => isVisible(item.minMode, mode))`.

(Switcher-ът за режим на мобилно се добавя в Task 5.)

- [ ] **Step 4: Pass mode from layout**

В `src/app/(dashboard)/dashboard/layout.tsx`, подай `shop.complexityMode` на двата компонента:

```tsx
<MobileMenuButton
  mode={shop.complexityMode}
  pendingReviews={pendingReviews}
  pendingQuestions={pendingQuestions}
/>
```

и

```tsx
<DashboardNav
  mode={shop.complexityMode}
  pendingReviews={pendingReviews}
  pendingQuestions={pendingQuestions}
/>
```

- [ ] **Step 5: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. (mode е задължителен prop → TypeScript ще гарантира, че layout-ът го подава.)

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/nav-items.ts src/components/dashboard/nav.tsx src/components/dashboard/mobile-menu-button.tsx "src/app/(dashboard)/dashboard/layout.tsx"
git commit -F - <<'EOF'
feat(complexity): nav филтриране по режим на сложност

NavItem.minMode + DashboardNav/MobileMenuButton филтрират NAV_ITEMS.
Layout подава shop.complexityMode.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Хедър дропдаун `ComplexityModeSwitcher`

**Files:**
- Create: `src/components/dashboard/complexity-mode-switcher.tsx`
- Modify: `src/app/(dashboard)/dashboard/layout.tsx`
- Modify: `src/components/dashboard/mobile-menu-button.tsx`

**Interfaces:**
- Consumes: `MODE_META`, `ComplexityMode` (Task 1); `setComplexityMode` (Task 3).
- Produces: `<ComplexityModeSwitcher mode variant />` компонент.

- [ ] **Step 1: Create the switcher component**

Създай `src/components/dashboard/complexity-mode-switcher.tsx`. Client компонент; дропдаун бутон „Режим: {label} ▾" → меню с 3-те `MODE_META`; избор → `setComplexityMode` + `router.refresh()`. `variant` за десктоп (компактен бутон) vs мобилно (пълен ред в менюто).

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { setComplexityMode } from "@/actions/shop";
import { Icon } from "@/components/ui";
import { MODE_META, type ComplexityMode } from "@/lib/complexity";

interface Props {
  mode: ComplexityMode;
  /** desktop = компактен бутон в хедъра; mobile = ред в burger менюто. */
  variant?: "desktop" | "mobile";
  /** Извиква се след успешна смяна (напр. затвори мобилното меню). */
  onChanged?: () => void;
}

export function ComplexityModeSwitcher({ mode, variant = "desktop", onChanged }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel = MODE_META.find((m) => m.value === mode)?.label ?? "Режим";

  /* Клик извън → затвори. */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function choose(next: ComplexityMode) {
    setOpen(false);
    if (next === mode) return;
    startTransition(async () => {
      const result = await setComplexityMode(next);
      if (!result.ok) {
        toast.error(result.error ?? "Грешка при смяна на режима.");
        return;
      }
      toast.success(`Режим: ${MODE_META.find((m) => m.value === next)?.label}`);
      onChanged?.();
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        className={
          variant === "mobile"
            ? "flex h-12 w-full items-center gap-2 rounded-control px-4 text-base font-medium text-ink-700 hover:bg-surface-100"
            : "flex h-9 items-center gap-1.5 rounded-control border border-surface-200 px-3 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900"
        }
      >
        <Icon name="filter" size={16} className="text-ink-500" />
        <span className="whitespace-nowrap">
          Режим: <span className="text-ink-900">{currentLabel}</span>
        </span>
        <Icon name="chevron-down" size={14} className="text-ink-500" />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 mt-1 w-72 rounded-card border border-surface-200 bg-surface-0 p-1 shadow-float ${
            variant === "mobile" ? "left-0" : "right-0"
          }`}
        >
          {MODE_META.map((m) => (
            <button
              key={m.value}
              type="button"
              role="menuitemradio"
              aria-checked={m.value === mode}
              onClick={() => choose(m.value)}
              className={`flex w-full flex-col gap-0.5 rounded-control px-3 py-2 text-left transition-colors hover:bg-surface-100 ${
                m.value === mode ? "bg-surface-50" : ""
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
                {m.label}
                {m.value === mode && <Icon name="check" size={14} className="text-brand-600" />}
              </span>
              <span className="text-xs text-ink-500">{m.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Иконите `filter`, `chevron-down`, `check` са потвърдени налични в `src/components/ui/icon.tsx`.
`Icon` приема `name: IconName` (типизиран) → TypeScript ще хване невалидно име при build.

- [ ] **Step 2: Add to desktop header**

В `src/app/(dashboard)/dashboard/layout.tsx`, в дясната част на хедъра (до `ThemeToggle`, ред 41-47), добави (само при `shop`, само десктоп):

```tsx
<div className="flex items-center gap-2 md:flex-1 md:justify-end">
  {shop && <span className="hidden text-sm text-ink-500 sm:block">{shop.name}</span>}
  {shop && (
    <div className="hidden md:block">
      <ComplexityModeSwitcher mode={shop.complexityMode} />
    </div>
  )}
  <ThemeToggle />
  <div className="hidden md:block">
    <SignOutButton />
  </div>
</div>
```

Импортирай: `import { ComplexityModeSwitcher } from "@/components/dashboard/complexity-mode-switcher";`

- [ ] **Step 3: Add to mobile menu**

В `src/components/dashboard/mobile-menu-button.tsx`, в мобилното меню (напр. над „Изход" секцията, преди `border-t` блока), добави switcher с `variant="mobile"` и `onChanged`/onClick да затваря менюто:

```tsx
<div className="border-t border-surface-200 p-2">
  <ComplexityModeSwitcher mode={mode} variant="mobile" onChanged={() => setOpen(false)} />
</div>
```

Импортирай компонента. (`mode` prop-ът вече е наличен от Task 4.)

- [ ] **Step 4: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/complexity-mode-switcher.tsx "src/app/(dashboard)/dashboard/layout.tsx" src/components/dashboard/mobile-menu-button.tsx
git commit -F - <<'EOF'
feat(complexity): хедър дропдаун за смяна на режим

ComplexityModeSwitcher (десктоп хедър + мобилно burger меню). Избор →
setComplexityMode + router.refresh(). Клик-извън затваря.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: Onboarding wizard стъпка „Сложност"

**Files:**
- Modify: `src/components/dashboard/shop-wizard.tsx`

**Interfaces:**
- Consumes: `MODE_META`, `ComplexityMode` (Task 1). `createShop` вече чете `complexityMode` (Task 3).
- Produces: 4-та стъпка в wizard-а; скрито поле `complexityMode` в FormData.

- [ ] **Step 1: Add step + state**

В `src/components/dashboard/shop-wizard.tsx`:

Импортирай:
```ts
import { MODE_META, type ComplexityMode } from "@/lib/complexity";
```

Разшири `STEPS` и `StepIndex`:
```ts
const STEPS = [
  { label: "Основно", required: true },
  { label: "Контакти", required: false },
  { label: "Работно време", required: false },
  { label: "Сложност", required: false },
] as const;

type StepIndex = 0 | 1 | 2 | 3;
```

Добави state (default `business`):
```ts
const [complexityMode, setComplexityMode] = useState<ComplexityMode>("business");
```

Промени `isLast` и навигацията: `const isLast = step === 3;`. В `goNext`/`goBack` границите стават `Math.min(3, ...)`.

- [ ] **Step 2: Add hidden input + step panel**

Добави скритото поле до другите (след `workingHours` hidden input, ред 150):
```tsx
<input type="hidden" name="complexityMode" value={complexityMode} />
```

Добави 4-тата стъпка панел (след стъпка 3 „Работно време", преди грешката/навигацията):
```tsx
{/* Стъпка 4 — Сложност */}
<div className={step === 3 ? "flex flex-col gap-3" : "hidden"}>
  <div className="flex flex-col gap-1">
    <span className="text-sm font-medium text-ink-900">Колко подробен да е панелът?</span>
    <span className="text-sm text-ink-500">
      Можеш да смениш това по всяко време от менюто горе. Започни просто.
    </span>
  </div>
  {MODE_META.map((m) => (
    <button
      key={m.value}
      type="button"
      onClick={() => setComplexityMode(m.value)}
      aria-pressed={complexityMode === m.value}
      className={`flex flex-col gap-0.5 rounded-card border p-4 text-left transition-colors ${
        complexityMode === m.value
          ? "border-brand-500 bg-brand-50"
          : "border-surface-200 bg-surface-0 hover:border-surface-300"
      }`}
    >
      <span className="text-sm font-bold text-ink-900">{m.label}</span>
      <span className="text-xs text-ink-500">{m.description}</span>
    </button>
  ))}
</div>
```

- [ ] **Step 3: Update step indicator note**

Стъпка 4 е по избор (default business е предизбран) → съществуващата подсказка „По избор…" (ред 284) вече покрива `step > 0`. Няма промяна нужна там.

- [ ] **Step 4: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. Провери, че индикаторът показва 4 стъпки и „Създай магазина" е на стъпка 4.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/shop-wizard.tsx
git commit -F - <<'EOF'
feat(complexity): onboarding стъпка „Сложност"

4-та стъпка в wizard-а — избор на режим (default Малък бизнес). Скрито поле
complexityMode → createShop го записва.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Продуктова форма чете режима + маха localStorage тогъл + гейт

**Files:**
- Modify: `src/components/dashboard/product-form.tsx`
- Modify: `src/app/(dashboard)/dashboard/products/new/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/products/[id]/page.tsx`
- Delete: `src/lib/product-form-mode.ts`

**Interfaces:**
- Consumes: `isVisible`, `ComplexityMode` (Task 1); `shop.complexityMode` (Task 2).
- Produces: `ProductForm` приема `complexityMode: ComplexityMode` prop.

Продуктовата форма днес чете `mode` от localStorage (`useSyncExternalStore`) и има Бързо/Детайлно бутони. Заменяме с `complexityMode` prop. Мапинг:
- `simple` prop (onboarding) → третирай като най-прост (без табове, само 3 базови карти) — както днес.
- Иначе: `hobby` → без табове (3 карти); `business` → 2 таба (main + logistics); `full` → 4 таба.

Полетата по minMode (от спеца): Характеристики + Тегло/размер = minMode 1; Кодове/SEO/Варианти/Промоция + Size guide = minMode 2.

- [ ] **Step 1: Replace mode source in ProductForm**

В `src/components/dashboard/product-form.tsx`:

Премахни импортите на `product-form-mode` и `useSyncExternalStore`:
```ts
// ПРЕМАХНИ:
// import { useState, useSyncExternalStore } from "react";
// import { getModeSnapshot, getServerModeSnapshot, onModeChange, setMode } from "@/lib/product-form-mode";
// ДОБАВИ:
import { useState } from "react";
import { isVisible, type ComplexityMode } from "@/lib/complexity";
```

Добави `complexityMode` към props:
```tsx
interface ProductFormProps {
  productId?: string;
  initial?: ProductFormInitial;
  categories: { value: string; label: string }[];
  sizeGuides: { value: string; label: string }[];
  /** Опростен режим за onboarding: без характеристики и варианти. */
  simple?: boolean;
  /** Ф2: режим на сложност — определя кои табове/полета се показват. */
  complexityMode?: ComplexityMode;
  redirectTo?: string;
}
```

В сигнатурата на компонента добави `complexityMode = "full"` (default full → безопасно при липса).

Замени `mode`/`showDetailed` логиката. Дефинирай нивата:
```tsx
  /* simple (onboarding) = най-прост изглед. Иначе по режима. */
  const effectiveMode: ComplexityMode = simple ? "hobby" : complexityMode;
  const showLogistics = isVisible(1, effectiveMode); // Характеристики, Тегло/размер
  const showAdvanced = isVisible(2, effectiveMode);  // Кодове, SEO, Варианти, Промоция, Size guide
  const showTabs = showLogistics; // business+ → табове; hobby → колона
```

Премахни целия Бързо/Детайлно тогъл `<div>` блок (бутоните `setMode`).

- [ ] **Step 2: Rebuild the tab items + render by mode**

Продуктовите карти вече са извлечени в променливи (`cardBasics`…`cardVariants`) от Фаза 1. Пренапиши `productTabs` и рендер частта да зависят от режима:

```tsx
  const fe = fieldErrors;
  const productTabs: TabItem[] = [
    {
      key: "main",
      label: "Основно",
      marker: !!(fe.name || fe.categoryId || fe.description || fe.price || fe.promoPrice || fe.stock || fe.images),
    },
    { key: "logistics", label: "Логистика", marker: !!(fe.weight || fe.length || fe.width || fe.height) },
    ...(showAdvanced
      ? ([
          {
            key: "codes",
            label: "Кодове и SEO",
            marker: !!(fe.sku || fe.gtin || fe.brand || fe.cost || fe.seoTitle || fe.seoDescription),
          },
          { key: "variants", label: "Варианти", marker: !!fe.deal },
        ] as TabItem[])
      : []),
  ];
```

Рендер:
```tsx
      {!showTabs ? (
        <>
          {cardBasics}
          {cardPricing}
          {cardImages}
        </>
      ) : (
        <Tabs ariaLabel="Продукт" tabs={productTabs}>
          <TabPanel tabKey="main">
            <div className="flex flex-col gap-4">
              {cardBasics}
              {cardPricing}
              {cardImages}
              {cardAttributes}
            </div>
          </TabPanel>
          <TabPanel tabKey="logistics">
            <div className="flex flex-col gap-4">
              {cardWeight}
              {showAdvanced && cardSizeGuide}
            </div>
          </TabPanel>
          {showAdvanced && (
            <TabPanel tabKey="codes">
              <div className="flex flex-col gap-4">
                {cardCodes}
                {cardSeo}
              </div>
            </TabPanel>
          )}
          {showAdvanced && (
            <TabPanel tabKey="variants">
              <div className="flex flex-col gap-4">
                {cardVariants}
                {cardDeal}
              </div>
            </TabPanel>
          )}
        </Tabs>
      )}
```

**Важно:** `Tabs` съпоставя панели по позиция → броят `<TabPanel>` деца трябва да съвпада с броя `tabs`. Когато `showAdvanced` е false, и `productTabs` (2 записа) и панелите (2) намаляват заедно — консистентно. Провери го внимателно.

- [ ] **Step 2b: Guard size guide in logistics**

Забележка: в business режим `cardSizeGuide` (minMode 2) НЕ трябва да се показва → `{showAdvanced && cardSizeGuide}` (вече е в кода горе). Провери, че в business логистика показва само `cardWeight`.

- [ ] **Step 3: Pass complexityMode from product pages**

В `src/app/(dashboard)/dashboard/products/new/page.tsx`:
```tsx
<ProductForm complexityMode={shop.complexityMode} categories={categoryOptions} sizeGuides={sizeGuideOptions} />
```

В `src/app/(dashboard)/dashboard/products/[id]/page.tsx` — добави `complexityMode={shop.complexityMode}` към `<ProductForm ...>` (shop е наличен от `requireShop()`).

Onboarding (`onboarding/page.tsx`) остава `<ProductForm simple ... />` — `simple` мапва към hobby в компонента; НЕ подавай complexityMode там (default full е презаписан от simple).

- [ ] **Step 4: Delete product-form-mode.ts**

```bash
git rm src/lib/product-form-mode.ts
```

Провери, че няма други вносители: `grep -rn "product-form-mode" src` → трябва да е празно (само product-form.tsx го ползваше). Ако има друг → оправи преди изтриване.

- [ ] **Step 5: Full gate**

Run: `pnpm check`
Expected: PASS (lint + всички unit тестове вкл. новите complexity тестове + build). Ако гърми — оправи.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/product-form.tsx "src/app/(dashboard)/dashboard/products/new/page.tsx" "src/app/(dashboard)/dashboard/products/[id]/page.tsx" src/lib/product-form-mode.ts
git commit -F - <<'EOF'
feat(complexity): продуктова форма следва режима на сложност

ProductForm чете complexityMode prop (маха се localStorage Бързо/Детайлно
тогъл). hobby=3 карти без табове; business=main+logistics; full=4 таба.
Продуктовите страници подават shop.complexityMode.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

- [ ] **Step 7: Ръчна визуална проверка (потребител)**

Съобщи на потребителя да провери на живо (`pnpm dev`), за 3-те режима × light/dark/375px:
- Смяна на режим от хедър дропдауна → nav секциите се появяват/изчезват веднага.
- Хоби: 7 nav секции; Малък бизнес: 11; Пълна: 14.
- Продуктова форма: hobby=3 карти без табове; business=2 таба (Основно+Логистика, без size guide); full=4 таба.
- Onboarding: нова стъпка „Сложност" (default Малък бизнес); създаване записва режима.
- Съществуващ магазин (преди миграцията) → режим „Пълна" (нищо не липсва).
- Директен URL към скрита страница (напр. `/dashboard/subscribers` в hobby) → работи.
- Мобилно (375px): режим switcher в burger менюто.

Push към `dev` (=prod) само след разрешение от потребителя.

---

## Notes for the implementer

- Режимът е UI помощ, НЕ security gate — никога не блокирай достъп по URL, никога не трий данни.
- `Tabs` съпоставя панели по позиция → броят панели трябва да = броят tab items (Task 7).
- `db:push` иска `DATABASE_URL_MIGRATIONS` (само локално, не Vercel).
- Не добавяй `loading.tsx` на пипаните страници (drawer-remount капан).
- Всичко през токени; тъмната тема идва автоматично.
