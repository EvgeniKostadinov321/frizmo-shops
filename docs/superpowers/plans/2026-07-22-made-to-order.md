# Ръчна изработка / По поръчка (Made-to-Order) — имплементационен план

> **За агентски работници:** REQUIRED SUB-SKILL: изпълни през superpowers:executing-plans
> (inline, с checkpoint-и). Стъпките са с checkbox (`- [ ]`) за проследяване.

**Goal:** Per-продукт „ръчна изработка" — при изчерпани готови бройки продуктът приема поръчки
по изработка (с срок 10–14 дни и опционален таван на опашката), вместо да е „изчерпан".

**Спец:** `docs/superpowers/specs/2026-07-22-made-to-order-design.md`

**Architecture:** Нови полета на `products` (флаг + срок + таван) и `order_items` (snapshot).
Made-to-order резолюцията живее в `priceCart` (чистата ценова функция) — единственият източник.
`decrementStock` получава „escape hatch" при недостиг за handmade продукти, със cap enforcement
под съществуващия `FOR UPDATE` lock (race-safe). Показване през дизайн език „Пазарен ден".

## Global Constraints (от спеца + проектните правила)

- **Валута EUR, integer центове.** Наличности integer. Made-to-order НЕ пипа парите.
- **`priceCart` е ЕДИНСТВЕНИЯТ ценови/наличностен източник** (количка + checkout викат с еднакви данни).
- **Race-safety задължителна:** cap проверката е под `SELECT ... FOR UPDATE` в транзакцията, като
  overselling guard-а. Verify скрипт добавка.
- **Два поръчкови пътя:** `createOrder` (публичен) И `manualOrder` (търговец) — и двата.
- **`order_items` е snapshot** — made-to-order статус + срок оцеляват промяна на продукта.
- **UI български, типографски кавички „…"**, дизайн токени (`--sf-*` storefront, `brand-*` платформа),
  reusable компоненти, mobile-first, преди UI промяна → чети `docs/design-final-guide/`.
- **Строг TypeScript, без `as any`.** Тестове за всяка чиста функция + concurrency verify.
- **Гейт:** `pnpm check` (lint + unit + build) преди всеки commit. НЕ push без изрично „да".
- **Смесено количество:** поръчано > наличен готов stock → ЦЯЛОТО количество е „по изработка".

---

## Task 1: Схема — нови колони

**Files:**
- Modify: `src/db/schema.ts` (products таблица + order_items таблица)

**Steps:**

- [ ] **Step 1: Добави колони на `products`** (след `heightMm`/netQuantity блока, до другите продуктови полета):

```ts
/* Ръчна изработка: при изчерпани готови бройки (stock=0) приема поръчки по изработка. */
madeToOrder: boolean("made_to_order").notNull().default(false),
/** Срок за изработка (дни) — диапазон; задължителен когато madeToOrder. */
leadDaysMin: integer("lead_days_min"),
leadDaysMax: integer("lead_days_max"),
/** Таван на едновременните поръчки по изработка; NULL = неограничено. */
madeToOrderCap: integer("made_to_order_cap"),
```

- [ ] **Step 2: Добави snapshot колони на `orderItems`** (до другите snapshot полета):

```ts
/* Made-to-order snapshot: редът е поръчан по изработка + срокът към момента. */
madeToOrder: boolean("made_to_order").notNull().default(false),
leadDaysMin: integer("lead_days_min"),
leadDaysMax: integer("lead_days_max"),
```

- [ ] **Step 3: db:push към DEV база**

Run: `pnpm db:push` (иска `DATABASE_URL_MIGRATIONS` — dev база Париж).
Expected: 7 нови колони добавени, без загуба на данни (всички nullable/с default).

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(made-to-order): схема — made_to_order + lead дни + таван (products, order_items)"
```

---

## Task 2: Zod схема + валидация

**Files:**
- Modify: `src/schemas/product.ts`
- Test: `src/schemas/product.test.ts`

**Interfaces:**
- Produces: `productSchema` разширена с `madeToOrder: boolean`, `leadDaysMin/Max: number|""`,
  `madeToOrderCap: number|""`. Cross-field: при `madeToOrder=true` → lead дни задължителни, `1≤min≤max≤365`.

- [ ] **Step 1: Failing тестове** (`product.test.ts`):

```ts
it("madeToOrder изкл. → lead дни празни са ОК", () =>
  expect(parse({ madeToOrder: false }).success).toBe(true));
it("madeToOrder вкл. без lead дни → грешка", () =>
  expect(parse({ madeToOrder: true, leadDaysMin: "", leadDaysMax: "" }).success).toBe(false));
it("madeToOrder вкл. с валиден диапазон → ОК", () =>
  expect(parse({ madeToOrder: true, leadDaysMin: "10", leadDaysMax: "14" }).success).toBe(true));
it("min > max → грешка", () =>
  expect(parse({ madeToOrder: true, leadDaysMin: "14", leadDaysMax: "10" }).success).toBe(false));
it("таван 0 → грешка; празен → ОК; 5 → ОК", () => {
  expect(parse({ madeToOrder: true, leadDaysMin: "5", leadDaysMax: "7", madeToOrderCap: "0" }).success).toBe(false);
  expect(parse({ madeToOrder: true, leadDaysMin: "5", leadDaysMax: "7", madeToOrderCap: "" }).success).toBe(true);
  expect(parse({ madeToOrder: true, leadDaysMin: "5", leadDaysMax: "7", madeToOrderCap: "5" }).success).toBe(true);
});
```

- [ ] **Step 2: Run — fail** (`pnpm test product.test`). Expected: новите падат.

- [ ] **Step 3: Имплементирай в `product.ts`:**

```ts
const optionalLeadDays = z.union([
  z.coerce.number().int().min(1, "Минимум 1 ден").max(365, "Максимум 365 дни"),
  z.literal(""),
]);
const optionalCap = z.union([z.coerce.number().int().min(1, "Минимум 1"), z.literal("")]);
```

Добави към `productSchema` полетата: `madeToOrder: z.boolean().default(false)`,
`leadDaysMin: optionalLeadDays.default("")`, `leadDaysMax: optionalLeadDays.default("")`,
`madeToOrderCap: optionalCap.default("")`. Добави `.superRefine`:

```ts
.superRefine((data, ctx) => {
  if (data.madeToOrder) {
    const min = data.leadDaysMin, max = data.leadDaysMax;
    if (min === "" || max === "") {
      ctx.addIssue({ code: "custom", path: ["leadDaysMin"], message: "Задай срок за изработка" });
    } else if (Number(min) > Number(max)) {
      ctx.addIssue({ code: "custom", path: ["leadDaysMax"], message: "Максимумът трябва да е ≥ минимума" });
    }
  }
});
```

- [ ] **Step 4: Run — pass** (`pnpm test product.test`). Expected: всички минават.

- [ ] **Step 5: Commit** `feat(made-to-order): Zod валидация — lead дни + таван + cross-field`

---

## Task 3: Made-to-order резолюция в pricing (чиста функция)

**Files:**
- Modify: `src/lib/pricing.ts`
- Test: `src/lib/pricing.test.ts` (или нов `made-to-order.test.ts`)

**Interfaces:**
- Consumes: `PricingProduct` разширен с `madeToOrder: boolean`, `leadDaysMin/Max: number|null`.
- Produces: `PricedLine` разширен с `madeToOrder: boolean`, `leadDaysMin/Max: number|null`.
  Нов helper `resolveLineFulfillment(product, qty): { madeToOrder, leadDaysMin, leadDaysMax }`.

- [ ] **Step 1: Разшири `PricingProduct` и `PricedLine`** с полетата горе (`madeToOrder`,
  `leadDaysMin`, `leadDaysMax`).

- [ ] **Step 2: Failing тест** — логиката „готово vs по изработка":

```ts
// stock покрива количеството → НЕ е по изработка
// stock=0 + madeToOrder → по изработка, носи срока
// stock=2, qty=5, madeToOrder → по изработка (цялото, недостиг)
// stock=0 + НЕ madeToOrder → error OUT_OF_STOCK (както сега)
// stock=null (не следи) → минава, НЕ по изработка
```

- [ ] **Step 3: Имплементирай логиката в `priceCart`** (per ред):
  - Изчисли ефективната наличност (variant или продукт).
  - Ако `stock === null` → минава, `madeToOrder=false`.
  - Ако `effectiveStock >= qty` → готово, `madeToOrder=false`.
  - Ако `effectiveStock < qty`:
    - `product.madeToOrder === true` → `madeToOrder=true`, носи `leadDaysMin/Max`, БЕЗ error.
    - иначе → `error: "out_of_stock"` (както сега).
  - **Забележка:** cap проверката НЕ е тук (тя иска DB заявка) — прави се в orders.ts под лока.
    `priceCart` само маркира „това е по изработка"; финалната cap gate е на checkout.

- [ ] **Step 4: Run — pass.** Commit `feat(made-to-order): pricing резолюция готово/по изработка (чиста функция)`

---

## Task 4: getPricingProducts + query разширение

**Files:**
- Modify: `src/db/queries/cart.ts` (`getPricingProducts`)

- [ ] **Step 1:** Разшири `getPricingProducts` да селектира новите продуктови колони
  (`madeToOrder`, `leadDaysMin`, `leadDaysMax`, `madeToOrderCap`) и да ги мапва в `PricingProduct`.
- [ ] **Step 2:** Run `pnpm check` (типова консистентност). Commit
  `feat(made-to-order): getPricingProducts зарежда made-to-order полетата`

---

## Task 5: Checkout — cap enforcement + snapshot (orders.ts)

**Files:**
- Modify: `src/actions/orders.ts` (`decrementStock`, `insertOrderWithNumber`, `createOrder`, `manualOrder`)
- Modify: `src/db/queries/orders.ts` (нова заявка `countActiveMadeToOrder`)

**Interfaces:**
- Produces: `countActiveMadeToOrder(tx, productId): Promise<number>` — брой редове по изработка в
  незавършени поръчки (`order_items.madeToOrder=true` join `orders.status IN (new,confirmed,shipped)`).

- [ ] **Step 1:** Нова заявка `countActiveMadeToOrder(tx, productId)` в `db/queries/orders.ts`:

```sql
-- count(*) от order_items oi JOIN orders o ON oi.order_id = o.id
-- WHERE oi.product_id = $1 AND oi.made_to_order = true
--   AND o.status IN ('new','confirmed','shipped')
```

- [ ] **Step 2: Промени `decrementStock`** — приеме pricedLines (носят `madeToOrder` от priceCart).
  Per ред:
  - Ако редът НЕ е `madeToOrder` → нормален декремент с guard (както сега); празен резултат → OUT_OF_STOCK.
  - Ако редът Е `madeToOrder`:
    - Ако продуктът има `madeToOrderCap != null`:
      `count = await countActiveMadeToOrder(tx, productId)` (под FOR UPDATE лока, вече взет в createOrder).
      Ако `count >= cap` → throw `MADE_TO_ORDER_FULL`.
    - НЕ декрементирай stock (той е 0 / недостатъчен; това е нова изработка).

- [ ] **Step 3: Промени `insertOrderWithNumber`** — snapshot-ни `madeToOrder`, `leadDaysMin`, `leadDaysMax`
  в `orderItems.values(...)` от pricedLines.

- [ ] **Step 4: Хвани `MADE_TO_ORDER_FULL`** в createOrder/manualOrder → потребителско съобщение
  „Опашката за изработка е пълна в момента. Върни се по-късно." (не generic OUT_OF_STOCK).

- [ ] **Step 5:** Увери се, че `createOrder` подава pricedLines (с madeToOrder маркера) към
  `decrementStock` и `insertOrderWithNumber`, не суровите input.lines.

- [ ] **Step 6:** `pnpm check`. Commit `feat(made-to-order): checkout приема по изработка + cap enforcement + snapshot`

---

## Task 6: Concurrency verify скрипт

**Files:**
- Modify: `scripts/verify-order-concurrency.mjs` (или нов `verify-made-to-order.mjs`)

- [ ] **Step 1:** Добави сценарий: продукт `stock=0`, `madeToOrder=true`, `madeToOrderCap=1`.
  Две паралелни поръчки за него → точно 1 успява, 2-рата получава MADE_TO_ORDER_FULL. Чисти след себе си.
- [ ] **Step 2:** Run срещу dev база. Expected: точно 1 минава. Commit
  `test(made-to-order): concurrency verify — таван на опашката race-safe`

---

## Task 7: Продуктова форма (търговец) — секция

**Files:**
- Modify: `src/components/dashboard/product-form.tsx`

- [ ] **Step 1: Чети `docs/design-final-guide/`** (правило преди UI). Секцията живее в „Детайлно"
  изгледа на съществуващия тогъл.
- [ ] **Step 2:** Нова секция „Ръчна изработка / по поръчка":
  - Тогъл `madeToOrder` (reusable компонент от `ui/`).
  - При вкл. → показва: срок (два `Input` числа: „от" min / „до" max дни) + опционален таван
    („Максимум поръчки в опашка (по избор)").
  - `InfoHint` пояснения: „Приемай поръчки дори когато готовите бройки свършат — с срок за изработка."
  - Field-level Zod грешки (`useActionState` паттерн). Touch targets ≥44px. Mobile-first.
- [ ] **Step 3:** Мапни новите полета в save action-а на продукта (`src/actions/products.ts` или
  където е). `pnpm check`. Commit `feat(made-to-order): продуктова форма — секция ръчна изработка`

---

## Task 8: Storefront показване (гордост, „Пазарен ден")

**Files:**
- Modify: `src/lib/product-badges.ts` (helper за made-to-order badge/статус — чиста функция + тест)
- Modify: продуктова страница `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`
- Modify: `src/components/storefront/product-card.tsx`
- Modify: `src/components/storefront/checkout-form.tsx`
- Modify: order confirmation `src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx`

- [ ] **Step 1: Чети `docs/design-final-guide/`.** Позициониране: горд знак, не извинение.
- [ ] **Step 2:** Helper `madeToOrderLabel(leadMin, leadMax): string` → „Изработва се специално за
  теб · 10–14 дни" (чиста функция + тест).
- [ ] **Step 3: Продуктова страница:**
  - Badge „Ръчна изработка" (ако продуктът е `madeToOrder`, `--sf-*` токени, до „Нов"/промо паттерна).
  - Ако `stock=0` изцяло → акцентна кутийка „Изработва се специално за теб · 10–14 дни" (не дребен ред).
  - Ако `stock>0` → нормална наличност + badge (гордост).
- [ ] **Step 4: Product-card** (каталог): дискретен „Ръчна изработка" badge в ъгъла (както „Нов").
- [ ] **Step 5: Кошница/checkout-form:** ред „⏳ Изработка 10–14 дни" до made-to-order продукт;
  при смес → най-дългият срок като общ ориентир.
- [ ] **Step 6: Order confirmation:** ако редът е `madeToOrder` (от snapshot) → „Изработва се
  специално за теб · очаквай след ~14 дни" вместо „изпращаме днес".
- [ ] **Step 7:** Визуална проверка light + 375px (потребителят одобрява естетиката). `pnpm check`.
  Commit `feat(made-to-order): storefront показване — badge + срок (Пазарен ден)`

---

## Task 9: Dashboard поръчков ред

**Files:**
- Modify: поръчкова страница dashboard (`src/app/(dashboard)/dashboard/orders/[id]/page.tsx` + списък)

- [ ] **Step 1:** Ред по изработка показва бадж „По изработка · 10–14 дни" (от `order_items` snapshot),
  за да не се обърка с готова бройка. `brand-*` токени.
- [ ] **Step 2:** (по избор, ако е лесно) филтър „по изработка" в списъка с поръчки.
- [ ] **Step 3:** `pnpm check`. Commit `feat(made-to-order): dashboard — бадж по изработка на поръчката`

---

## Task 10: Финал — гейт + e2e + документация

- [ ] **Step 1:** Пълен `pnpm check` (lint + unit + build) — зелено.
- [ ] **Step 2:** (по избор) e2e спец: made-to-order продукт → поръчка при stock=0 → потвърждение
  показва срока. Ако store-products spec флейква под пълния suite → изолирано.
- [ ] **Step 3:** verify-made-to-order.mjs минава.
- [ ] **Step 4:** Обнови `docs/WORKLOG.md` (нов ред в Дневник) + `docs/remaining-roadmap.md`
  (нова функция завършена). Commit.
- [ ] **Step 5:** Финален преглед на changed diff (code-review skill).
- [ ] **Step 6:** Тест на живо от потребителя (Preview/dev) → при одобрение: push разрешение.

---

## Self-review бележки

- **Spec coverage:** всяко нещо от спеца → задача (схема T1, валидация T2, pricing T3, query T4,
  checkout+cap T5, concurrency T6, форма T7, storefront T8, dashboard T9, финал T10). ✓
- **Race-safety:** cap заявката в T5 е под `FOR UPDATE` лока (вече в createOrder:268); verify в T6. ✓
- **Два пътя:** createOrder + manualOrder третирани в T5. ✓
- **Snapshot:** order_items колони (T1) + попълване (T5) + четене (T8/T9). ✓
- **Смесено количество:** „поръчано > готов stock → цялото по изработка" в T3 (priceCart). ✓
