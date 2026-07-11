# Пакет Д „Setup & доставка“ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IBAN валидация (mod-97 + BG формат) за банков превод · зони на доставка (цена по град/регион към courier метод) · дълбока категорийна йерархия до 3 нива · разширен онбординг чеклист на dashboard.

**Architecture:** IBAN е чиста функция + Zod superRefine върху `paymentMethodSchema`. Зоните са нова таблица `shipping_zones` към `shipping_methods`; pricing на сървъра (`pricing.ts`) избира цената от зоната. Категориите разхлабват сегашния 2-нивов гард (`createCategory:44`) до 3 нива с гард срещу цикъл/дълбочина. Онбордингът е компонент на `/dashboard`, който чете реални данни.

**Tech Stack:** Next.js 16 App Router, Drizzle + Supabase Postgres, Zod, EUR интегер центове.

## Global Constraints

- Всяка мутация през `requireShop()`; всяка заявка филтрира по `shopId`. Гардовете са на СЪРВЪРА.
- Пари в центове; `toCents`/`formatPrice`. Цените в pricing.ts са единственият ценови източник.
- BG UI с „…“; токени, без inline стойности (изключение: няма). Числово съгласуване през `count()`.
- `db:push` изисква `DATABASE_URL_MIGRATIONS` в shell (стойността не се printва). Един `db:push` за пакета.
- `pnpm check` е гейтът преди push.
- Съществуващо: `paymentMethodSchema.details` (max 300, тук е IBAN); `shippingMethodSchema`; `createCategory`/`updateCategory`/`moveCategory` в actions/categories.ts (гард 2 нива на ред 44); `getCategoriesTree` (2 нива).

---

### Task 1: IBAN валидация — чиста функция + TDD

**Files:**
- Create: `src/lib/iban.ts`
- Test: `src/lib/iban.test.ts`

**Interfaces:**
- Produces: `isValidBgIban(raw: string): boolean` (нормализира, проверява BG + дължина 22 + mod-97); `formatIban(raw: string): string` (групи по 4).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/iban.test.ts
import { describe, expect, it } from "vitest";
import { formatIban, isValidBgIban } from "./iban";

describe("isValidBgIban", () => {
  it("валиден BG IBAN", () => {
    expect(isValidBgIban("BG80BNBG96611020345678")).toBe(true);
  });
  it("валиден с интервали и малки букви", () => {
    expect(isValidBgIban("bg80 bnbg 9661 1020 3456 78")).toBe(true);
  });
  it("грешна чексума → невалиден", () => {
    expect(isValidBgIban("BG81BNBG96611020345678")).toBe(false);
  });
  it("грешна дължина → невалиден", () => {
    expect(isValidBgIban("BG80BNBG966110203456")).toBe(false);
  });
  it("друга държава → невалиден (само BG)", () => {
    expect(isValidBgIban("DE89370400440532013000")).toBe(false);
  });
  it("празен → невалиден", () => {
    expect(isValidBgIban("")).toBe(false);
  });
});

describe("formatIban", () => {
  it("групи по 4", () => {
    expect(formatIban("BG80BNBG96611020345678")).toBe("BG80 BNBG 9661 1020 3456 78");
  });
});
```

Забележка: `BG80BNBG96611020345678` е каноничен валиден BG IBAN пример (mod-97 = 1). Ако при имплементация се окаже с грешна чексума, замени с потвърдено валиден BG IBAN и обърни очакванията в теста (валиден ↔ невалиден вектор).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/iban.test.ts`
Expected: FAIL — модулът не съществува.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/iban.ts

/** Нормализира: маха интервали, uppercase. */
function normalize(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * BG IBAN валидация: точно 22 символа, префикс BG, ISO 7064 mod-97 = 1.
 * BG форматът е BGkk BBBB SSSS DD AAAAAAAA (22 символа общо).
 */
export function isValidBgIban(raw: string): boolean {
  const iban = normalize(raw);
  if (!/^BG\d{2}[A-Z]{4}\d{6}[A-Z0-9]{8}$/.test(iban)) return false;
  if (iban.length !== 22) return false;

  /* mod-97: премести първите 4 символа в края, буквите → числа (A=10..Z=35). */
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= "A" && ch <= "Z" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const digit of code) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/** Показва IBAN на групи по 4 (за четимост). Съхранението остава нормализирано. */
export function formatIban(raw: string): string {
  return normalize(raw).replace(/(.{4})/g, "$1 ").trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/iban.test.ts`
Expected: PASS. Ако тестовият вектор има грешна чексума → коригирай вектора (Step 1 забележка), не логиката.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iban.ts src/lib/iban.test.ts
git commit -m "feat(setup): isValidBgIban mod-97 + formatIban + TDD"
```

---

### Task 2: IBAN refine в `paymentMethodSchema`

**Files:**
- Modify: `src/schemas/fulfillment.ts`
- Test: `src/schemas/fulfillment.test.ts` (нов или разшири съществуващ)

**Interfaces:**
- Consumes: `isValidBgIban` (Task 1).
- Produces: `paymentMethodSchema` изисква валиден IBAN в `details` когато `type === "bank_transfer"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/schemas/fulfillment.test.ts
import { describe, expect, it } from "vitest";
import { paymentMethodSchema } from "./fulfillment";

describe("paymentMethodSchema — IBAN", () => {
  it("банков превод с валиден IBAN минава", () => {
    const r = paymentMethodSchema.safeParse({
      type: "bank_transfer", name: "Банка", details: "BG80 BNBG 9661 1020 3456 78",
    });
    expect(r.success).toBe(true);
  });
  it("банков превод с невалиден IBAN пада", () => {
    const r = paymentMethodSchema.safeParse({
      type: "bank_transfer", name: "Банка", details: "невалидно",
    });
    expect(r.success).toBe(false);
  });
  it("банков превод без IBAN пада", () => {
    const r = paymentMethodSchema.safeParse({ type: "bank_transfer", name: "Банка", details: "" });
    expect(r.success).toBe(false);
  });
  it("наложен платеж без IBAN минава (details свободен)", () => {
    const r = paymentMethodSchema.safeParse({ type: "cod", name: "Наложен платеж", details: "" });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/schemas/fulfillment.test.ts`
Expected: FAIL — refine още го няма.

- [ ] **Step 3: Добави superRefine**

В `src/schemas/fulfillment.ts`, добави импорт и разшири `paymentMethodSchema`:
```ts
import { isValidBgIban } from "@/lib/iban";

export const paymentMethodSchema = z.object({
  type: z.enum(["cod", "bank_transfer", "on_site"]),
  name: z.string().trim().min(2, "Въведи име").max(60),
  details: z.string().trim().max(300).default(""),
}).superRefine((v, ctx) => {
  if (v.type === "bank_transfer" && !isValidBgIban(v.details)) {
    ctx.addIssue({ code: "custom", path: ["details"], message: "Въведи валиден IBAN (напр. BG80 BNBG 9661 1020 3456 78)" });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/schemas/fulfillment.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Провери формата в UI показва IBAN четимо (по избор)**

В storefront checkout / order confirmation, където `paymentName`/details се показват — ако IBAN се показва на клиента, минавай през `formatIban()`. Провери `fulfillment-manager.tsx` полето „details“ да има подсказка „IBAN (BG…)“ за банков превод.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/fulfillment.ts src/schemas/fulfillment.test.ts src/components/dashboard/fulfillment-manager.tsx
git commit -m "feat(setup): IBAN валидация за банков превод (Zod refine)"
```

---

### Task 3: Схема — таблица `shipping_zones`

**Files:**
- Modify: `src/db/schema.ts` (нова таблица след `shippingMethods`, ~ред 284)

**Interfaces:**
- Produces: `shippingZones` (id, shopId, shippingMethodId, name, priceCents, sortOrder, timestamps); тип `ShippingZone`.

- [ ] **Step 1: Добави таблицата**

```ts
/** Д3: ръчни ценови зони към courier метод. Ако метод има ≥1 зона → цената идва от зоната. */
export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    shippingMethodId: uuid("shipping_method_id")
      .notNull()
      .references(() => shippingMethods.id, { onDelete: "cascade" }),
    /** Напр. „София“, „Областни градове“, „Села“. */
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shipping_zones_method_idx").on(t.shippingMethodId),
    index("shipping_zones_shop_idx").on(t.shopId),
  ],
).enableRLS();

export type ShippingZone = typeof shippingZones.$inferSelect;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(setup): схема shipping_zones"
```

---

### Task 4: Зони — заявки, action, dashboard UI

**Files:**
- Create: `src/db/queries/shipping-zones.ts`
- Modify: `src/actions/fulfillment.ts` (CRUD за зони)
- Modify: `src/schemas/fulfillment.ts` (zoneSchema)
- Modify: `src/components/dashboard/fulfillment-manager.tsx` (редактор на зони под courier метод)

**Interfaces:**
- Consumes: `shippingZones` (Task 3), `requireShop()`.
- Produces: `getZonesForMethod(methodId)`, `getZonesForShop(shopId)`; `saveShippingZone`/`deleteShippingZone` actions; `zoneSchema`.

- [ ] **Step 1: Zone Zod схема**

В `src/schemas/fulfillment.ts`:
```ts
export const zoneSchema = z.object({
  shippingMethodId: z.uuid(),
  name: z.string().trim().min(2, "Въведи име на зона").max(60),
  price: priceString,
});
export type ZoneInput = z.infer<typeof zoneSchema>;
```

- [ ] **Step 2: Заявки**

```ts
// src/db/queries/shipping-zones.ts
import { asc, eq } from "drizzle-orm";
import { db, shippingZones } from "@/db";

export async function getZonesForShop(shopId: string) {
  return db.query.shippingZones.findMany({
    where: eq(shippingZones.shopId, shopId),
    orderBy: [asc(shippingZones.sortOrder), asc(shippingZones.createdAt)],
  });
}
```

- [ ] **Step 3: Actions (create/delete зона)** в `src/actions/fulfillment.ts`

Огледало на съществуващите shipping-method actions: `requireShop()` + `zoneSchema.safeParse` + проверка че `shippingMethodId` принадлежи на магазина (`ownShippingMethod`), после insert/delete. `toCents(price)` за `priceCents`. `revalidatePath("/dashboard/fulfillment")` + revalidate storefront.

- [ ] **Step 4: UI редактор** в `fulfillment-manager.tsx`

Под всеки **courier** метод — списък зони (име + цена) с добавяне/триене. Огледало на UI-я за методите. Ако метод няма зони → показва „Фиксирана цена“ (сегашно поведение); с ≥1 зона → бележка „Клиентът избира зона на checkout“.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 6: Commit**

```bash
git add src/db/queries/shipping-zones.ts src/actions/fulfillment.ts src/schemas/fulfillment.ts src/components/dashboard/fulfillment-manager.tsx
git commit -m "feat(setup): зони на доставка — заявки, actions, dashboard редактор"
```

---

### Task 5: Зони в pricing + checkout

**Files:**
- Modify: `src/lib/pricing.ts` (цена от зона при courier метод със зони)
- Modify: `src/components/storefront/checkout-form.tsx` (select „Зона на доставка“)
- Modify: `src/actions/orders.ts` (валидира `shippingZoneId`, snapshot име+цена)

**Interfaces:**
- Consumes: `getZonesForShop` / зоните на метода.

- [ ] **Step 1: Разбери сегашния shipping pricing поток**

Run: grep `shippingPriceCents` / `freeOverCents` в `pricing.ts` и `orders.ts` — как методът дава цена сега. Зоната се вмъква там: ако избраният метод има зони → цената = избраната зона; иначе = `method.priceCents`. `freeOverCents` остава (безплатна над сума bere връх).

- [ ] **Step 2: Валидация на сървъра**

В `createOrder` (orders.ts): ако избраният метод има ≥1 зона, `shippingZoneId` е задължителен и трябва да принадлежи на метода+магазина. Липсва/чужд → грешка „Избери зона на доставка“. `shippingName` snapshot = `„{метод} — {зона}“`; `shippingPriceCents` = зоната (или 0 при free-over).

- [ ] **Step 3: Checkout UI**

В `checkout-form.tsx`: при избор на courier метод със зони → показва втори `<Select>` „Зона на доставка“ с опциите (име + цена). Изпраща `shippingZoneId`. Цената в резюмето идва от `priceCartAction`/сървъра (не се смята на клиента).

- [ ] **Step 4: Typecheck + пусни pricing тестове**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run src/lib/pricing.test.ts`
Expected: без грешки; съществуващите pricing тестове минават (добави тест за зона ако има pricing.test.ts).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/components/storefront/checkout-form.tsx src/actions/orders.ts
git commit -m "feat(setup): зони на доставка в pricing + checkout (сървърът е ценовият източник)"
```

---

### Task 6: Категории — 3 нива (заявка + гардове)

**Files:**
- Modify: `src/db/queries/categories.ts` (`getCategoriesTree` → 3 нива)
- Modify: `src/actions/categories.ts` (разхлаби гарда до 3 нива + цикъл гард)

**Interfaces:**
- Produces: `CategoryNode.children[].children[]` (3 нива).

- [ ] **Step 1: Write the failing test за дълбочината**

Изнеси гард логиката като чист helper за тестване:
```ts
// src/actions/category-depth.test.ts
import { describe, expect, it } from "vitest";
import { categoryDepth } from "@/actions/categories";

// depthOf(parentId) чрез map родител→ниво. Тества: корен=1, дете=2, внуче=3, правнуче забранено.
describe("categoryDepth guard", () => {
  it("корен без родител → допуска дете на ниво 2", () => {
    // parentLevel 1 → детето става 2 → ок
    expect(categoryDepth(1)).toBe(2);
  });
  it("родител на ниво 2 → детето става 3 → ок", () => {
    expect(categoryDepth(2)).toBe(3);
  });
  it("родител на ниво 3 → детето би било 4 → над лимита", () => {
    expect(categoryDepth(3)).toBe(4); // викащият отхвърля 4 > 3
  });
});
```
(Дефинирай `export function categoryDepth(parentLevel: number): number { return parentLevel + 1; }` — тривиален, но прави лимита явен и тестван; истинската проверка на нивото на родителя става чрез следване на `parentId` веригата в action-а.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/actions/category-depth.test.ts`
Expected: FAIL — `categoryDepth` не е експортиран.

- [ ] **Step 3: Разхлаби гарда в `createCategory` + добави цикъл/дълбочина гард**

Смени ред 44 (`if (parent.parentId) return fail("Подкатегория не може...")`) с проверка на дълбочината до 3:
```ts
/** Нивото на категория чрез следване на parentId веригата (1 = корен). */
async function categoryLevel(id: string, shopId: string): Promise<number> {
  let level = 1;
  let current = await ownCategory(id, shopId);
  while (current?.parentId) {
    level++;
    if (level > 3) break; // защита срещу счупена/циклична верига
    current = await ownCategory(current.parentId, shopId);
  }
  return level;
}

export function categoryDepth(parentLevel: number): number { return parentLevel + 1; }
```
В `createCategory`, замени ред 44:
```ts
if (parentId) {
  const parent = await ownCategory(parentId, shop.id);
  if (!parent) return fail("Родителската категория не съществува.");
  const parentLevel = await categoryLevel(parent.id, shop.id);
  if (categoryDepth(parentLevel) > 3) {
    return fail("Категориите могат да са най-много 3 нива дълбоко.");
  }
}
```

- [ ] **Step 4: Гард за преместване** (ако `moveCategory` премества между родители — сега мести само sortOrder между siblings, значи няма нужда). Ако добавиш „смени родител“ функция → същият дълбочина гард + цикъл гард (родителят не може да е наследник). За MVP: **не добавяме смяна на родител** — създаване + триене стигат. Документирай в план бележка.

- [ ] **Step 5: `getCategoriesTree` → 3 нива**

Разшири `CategoryNode` да има внуци:
```ts
export interface CategoryNode extends CategoryWithCount {
  children: (CategoryWithCount & { children: CategoryWithCount[] })[];
}
```
След строене на roots + level-2, добави трети проход за level-3: за всеки ред с `parentId`, чийто родител е level-2 (в byId на нивата), закачи като внук. Най-чисто: построй `Map<id, node>` за ВСИЧКИ нива, после закачи всеки към родителя му (или root ако липсва). Ограничи показването до 3 нива (по-дълбоки — качи като по-плитки/root, консистентно със сегашния fallback за изтрит родител).

- [ ] **Step 6: Run test + typecheck**

Run: `pnpm exec vitest run src/actions/category-depth.test.ts && pnpm exec tsc --noEmit`
Expected: PASS + без грешки.

- [ ] **Step 7: Commit**

```bash
git add src/db/queries/categories.ts src/actions/categories.ts src/actions/category-depth.test.ts
git commit -m "feat(setup): категорийна йерархия до 3 нива + гард срещу дълбочина"
```

---

### Task 7: Категории 3 нива — dashboard UI + storefront

**Files:**
- Modify: `src/components/dashboard/categories-manager.tsx` (избор на родител до ниво 2; показ на 3 нива)
- Modify: storefront места, които рендерират категории (footer, каталог филтър, навигация)

**Interfaces:**
- Consumes: `getCategoriesTree` (3 нива, Task 6).

- [ ] **Step 1: Dashboard — родител select до ниво 2**

В `categories-manager.tsx`: при създаване, родител-опциите включват корени + техните деца (ниво 1 и 2), но НЕ ниво 3 (иначе детето става 4). Показвай дървото с отстъп до 3 нива.

- [ ] **Step 2: Storefront — рендерирай 3 нива**

Провери местата от grep-а (footer, каталог, product филтър). Разшири рендера от 2 на 3 нива (рекурсивно или явно трето ниво). **Филтър по категория:** при избор на родител → включва продуктите от всички наследници (дизайн решение от спеца). Провери как продуктовият филтър събира categoryId-та — при родител вземи id-тата на цялото поддърво.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/categories-manager.tsx "src/app/(storefront)/s/[slug]/products/page.tsx" src/components/storefront/footer.tsx
git commit -m "feat(setup): категории 3 нива в dashboard + storefront (филтър включва наследници)"
```

---

### Task 8: Онбординг чеклист на dashboard

**Files:**
- Create: `src/db/queries/onboarding-status.ts`
- Create: `src/components/dashboard/onboarding-checklist.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (монтира чеклиста)

**Interfaces:**
- Produces: `getOnboardingStatus(shop) → { steps: ChecklistStep[]; done: number; total: number }`.

- [ ] **Step 1: Write the failing test за прогреса (чист helper)**

```ts
// src/db/queries/onboarding-status.test.ts
import { describe, expect, it } from "vitest";
import { computeChecklist } from "./onboarding-status";

describe("computeChecklist", () => {
  it("всичко готово → 6/6, complete", () => {
    const r = computeChecklist({
      hasProduct: true, hasContacts: true, hasShipping: true, hasPayment: true, published: true,
    });
    expect(r.done).toBe(6);
    expect(r.total).toBe(6);
    expect(r.complete).toBe(true);
  });
  it("само магазин+продукт → 2/6, не complete", () => {
    const r = computeChecklist({
      hasProduct: true, hasContacts: false, hasShipping: false, hasPayment: false, published: false,
    });
    expect(r.done).toBe(2); // магазин + продукт
    expect(r.complete).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/db/queries/onboarding-status.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the helper + query**

```ts
// src/db/queries/onboarding-status.ts
import { and, count, eq } from "drizzle-orm";
import { db, paymentMethods, products, shippingMethods, type Shop } from "@/db";

export interface ChecklistStep { key: string; label: string; done: boolean; href: string; }
export interface ChecklistResult { steps: ChecklistStep[]; done: number; total: number; complete: boolean; }

export interface ChecklistFlags {
  hasProduct: boolean; hasContacts: boolean; hasShipping: boolean; hasPayment: boolean; published: boolean;
}

/** Чиста логика: флагове → стъпки + прогрес. „Магазин създаден“ е винаги done тук. */
export function computeChecklist(f: ChecklistFlags): ChecklistResult {
  const steps: ChecklistStep[] = [
    { key: "shop", label: "Магазинът е създаден", done: true, href: "/dashboard/store" },
    { key: "product", label: "Добави първи продукт", done: f.hasProduct, href: "/dashboard/products/new" },
    { key: "contacts", label: "Попълни контакти и адрес", done: f.hasContacts, href: "/dashboard/store" },
    { key: "shipping", label: "Добави метод на доставка", done: f.hasShipping, href: "/dashboard/fulfillment" },
    { key: "payment", label: "Добави метод на плащане", done: f.hasPayment, href: "/dashboard/fulfillment" },
    { key: "publish", label: "Публикувай магазина", done: f.published, href: "/dashboard/store" },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}

export async function getOnboardingStatus(shop: Shop): Promise<ChecklistResult> {
  const [[prod], [ship], [pay]] = await Promise.all([
    db.select({ c: count() }).from(products).where(eq(products.shopId, shop.id)),
    db.select({ c: count() }).from(shippingMethods).where(and(eq(shippingMethods.shopId, shop.id), eq(shippingMethods.active, true))),
    db.select({ c: count() }).from(paymentMethods).where(and(eq(paymentMethods.shopId, shop.id), eq(paymentMethods.active, true))),
  ]);
  return computeChecklist({
    hasProduct: (prod?.c ?? 0) > 0,
    hasContacts: !!shop.phone && !!(shop.city || shop.address),
    hasShipping: (ship?.c ?? 0) > 0,
    hasPayment: (pay?.c ?? 0) > 0,
    published: shop.status === "published",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/db/queries/onboarding-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the checklist component**

`src/components/dashboard/onboarding-checklist.tsx` (server или client — server стига). Показва прогрес бар (N/6) + всеки ред: `Icon` (check при done / кръг при не) + label + линк „Добави“/„Провери“ при недовършените. Само токени (light+dark). **Ако `complete` → не рендерира нищо** (магазинът е готов).

- [ ] **Step 6: Монтирай в dashboard page**

В `src/app/(dashboard)/dashboard/page.tsx`: покажи чеклиста САМО ако магазинът има ≥1 продукт (иначе се показва `DashboardWelcome` както сега). Т.е. чеклистът е за фазата „имам продукт, но не съм готов“. Извикай `getOnboardingStatus(shop)` и рендерирай `<OnboardingChecklist result={...} />` над/до метриките.

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Step 8: Commit**

```bash
git add src/db/queries/onboarding-status.ts src/db/queries/onboarding-status.test.ts src/components/dashboard/onboarding-checklist.tsx "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(setup): онбординг чеклист на dashboard (авто-скрива при пълнота)"
```

---

### Task 9: db:push + пълен гейт

- [ ] **Step 1: Приложи схемата**

Зареди `DATABASE_URL_MIGRATIONS` (без printване), после:
Run: `pnpm db:push`
Expected: таблица `shipping_zones` приложена, без загуба на данни.

- [ ] **Step 2: Пълен гейт**

Run: `pnpm check`
Expected: lint + unit + build зелени.

- [ ] **Step 3: Спри за push разрешение**

Докладвай: пакет Д готов, `pnpm check` зелен, чака разрешение за push към `dev` (=prod). НЕ push-вай без изрично „да“.

---

## Self-Review (свери преди старт)

- **Спец покритие:** Д1 онбординг (Task 8) · Д2 категории 3 нива (Tasks 6,7) · Д3 зони (Tasks 3,4,5) · Д4 IBAN (Tasks 1,2). ✓
- **Гард на сървъра:** дълбочина (Task 6 action) + зона-принадлежност (Task 4/5) + IBAN refine (Task 2) — всички на сървъра, не скрит бутон. ✓
- **Pricing = сървър:** зоната се избира в pricing.ts/orders.ts, не на клиента (Task 5). ✓
- **Тенант изолация:** зони проверяват `shopId`+метод; категории `ownCategory`; онбординг филтрира по shop. ✓
- **Авто-скрива (спец):** чеклист `if (complete) return null` (Task 8 Step 5). ✓
- **Филтър включва наследници (спец):** Task 7 Step 2. ✓
- **Изисква IBAN за bank_transfer (спец):** Task 2 (празно → пада). ✓
- **Placeholder scan:** Task 5 Step 1 (shipping pricing поток) и Task 7 Step 2 (места за категории) са grep-стъпки за реалната структура — нарочни, не placeholder-и. IBAN тестовият вектор да се потвърди при имплементация (Task 1 Step 1 забележка).
- **Type consistency:** `categoryDepth`/`categoryLevel` имена съвпадат между Task 6 test и action. `computeChecklist`/`ChecklistResult` съвпадат между Task 8 test, query и компонент. ✓
