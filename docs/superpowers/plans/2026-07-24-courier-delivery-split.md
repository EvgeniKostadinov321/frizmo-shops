# Куриерска доставка — разделяне и live ценообразуване — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Inline изпълнение — БЕЗ паралелни субагенти** (правило на проекта, пази usage лимита).

**Goal:** Разделяме куриерската доставка (Еконт/Спиди с live цена) от собствената доставка (взимане от място, лична доставка) в два ясни таба, с live ценообразуване при checkout и резервна цена при провал.

**Architecture:** Нова таблица `courier_delivery_options` (per shop+provider+target) държи настройката на доставка. `CourierProvider` интерфейсът получава `calculatePrice()`. Checkout вика server action за live цена (или резервна). Таб „Куриери" поема цялата куриерска настройка; таб „Доставка" остава само за `pickup`/`local`.

**Tech Stack:** Next.js 16, Drizzle ORM, Supabase Postgres (dev=Париж), Zod, Vitest, Tailwind 4.

## Global Constraints

- **Валута = EUR директно** — куриерите връщат EUR (сверено на живо: Speedy `currency:"EUR"`). Без BGN конверсия. `Math.round(total * 100)` → eur cents.
- **Пари = integer евроцентове**, никога float; аритметика само върху центове.
- **Multi-tenant:** всяка мутация зад `requireShop()`; публичните endpoint-и rate-limited + Zod + scope по shopId.
- **db:push дропва trgm GIN индексите** — на dev след push пусни `node scripts/setup-storage.mjs` НЕ, а `node scripts/setup-search.mjs`. Локално (dev) db:push е ОК; за прод по-късно = таргетиран SQL.
- **UI текст на български**, типографски кавички „…"; цени през `formatPrice()`.
- **Gate преди commit:** `pnpm check` (lint + unit + build). Node път: prepend `/c/nvm4w/nodejs` към PATH в Git Bash.
- **Строг TypeScript**, без `as any`. Storefront ползва само `--sf-*` токени.
- **Няма push** до изрично разрешение (всичко локално за преглед).

---

### Task 1: Схема — таблица `courier_delivery_options` + Zod

**Files:**
- Modify: `src/db/schema.ts` (след `shopCourierAccounts`, ~ред 350)
- Modify: `src/db/index.ts` (export на новата таблица, ако е нужно)
- Modify: `src/schemas/fulfillment.ts` (нова схема + премахване на `courier` от SHIPPING_TYPES)

**Interfaces:**
- Produces: таблица `courierDeliveryOptions` с колони `id, shopId, provider, deliveryTarget, active, displayName, fallbackPriceCents, freeOverCents, createdAt, updatedAt`; unique `(shopId, provider, deliveryTarget)`.
- Produces: `courierDeliveryOptionSchema` (Zod) с полета `provider, deliveryTarget, active, displayName, fallbackPriceCents, freeOverCents`.

- [ ] **Step 1: Добави таблицата в schema.ts**

```ts
export const courierDeliveryOptions = pgTable(
  "courier_delivery_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    provider: courierProviderEnum("provider").notNull(),
    deliveryTarget: deliveryTargetEnum("delivery_target").notNull(),
    active: boolean("active").notNull().default(true),
    displayName: text("display_name").notNull().default(""),
    fallbackPriceCents: integer("fallback_price_cents").notNull().default(0),
    freeOverCents: integer("free_over_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("courier_delivery_option_idx").on(t.shopId, t.provider, t.deliveryTarget)],
).enableRLS();
```

- [ ] **Step 2: Премахни `courier` от SHIPPING_TYPES + схемата**

В `src/schemas/fulfillment.ts`:
```ts
export const SHIPPING_TYPES = [
  { value: "pickup", label: "Взимане от място" },
  { value: "local", label: "Доставка от производителя" },
] as const;
```
В `shippingMethodSchema` смени `type: z.enum(["courier", "pickup", "local"])` → `type: z.enum(["pickup", "local"])`; премахни полетата `courierProvider` и `deliveryTarget` от схемата.

- [ ] **Step 3: Добави courierDeliveryOptionSchema**

```ts
export const courierDeliveryOptionSchema = z.object({
  provider: z.enum(["econt", "speedy"]),
  deliveryTarget: z.enum(["address", "office"]),
  active: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()).default(false),
  displayName: z.string().trim().min(2, "Въведи име").max(60),
  fallbackPriceCents: z.number().int().min(0).max(100000),
  freeOverCents: z.number().int().min(0).max(1000000).nullable().default(null),
});
export type CourierDeliveryOptionInput = z.infer<typeof courierDeliveryOptionSchema>;
```

- [ ] **Step 4: Приложи схемата на dev базата**

```bash
export PATH="/c/nvm4w/nodejs:$PATH"
pnpm db:push
node scripts/setup-search.mjs   # възстанови trgm индексите (db:push ги дропва)
```
Expected: таблицата `courier_delivery_options` създадена; trgm 3/3 възстановени.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/schemas/fulfillment.ts
git commit -m "feat(couriers): схема courier_delivery_options + премахване на courier тип"
```

---

### Task 2: DB заявки за delivery options

**Files:**
- Modify: `src/db/queries/couriers.ts` (или където са courier заявките)
- Test: `src/db/queries/couriers.test.ts` (ако има; иначе покриваме през action теста)

**Interfaces:**
- Consumes: `courierDeliveryOptions` таблица (Task 1).
- Produces: `getCourierDeliveryOptions(shopId): Promise<CourierDeliveryOption[]>`, `getActiveCourierDeliveryOptions(shopId): Promise<CourierDeliveryOption[]>`.

- [ ] **Step 1: Намери файла на courier заявките**

Run: `grep -rn "getCourierAccounts\|courier" src/db/queries/ | head`
Expected: намираме `src/db/queries/couriers.ts` (или подобен).

- [ ] **Step 2: Добави заявките**

```ts
export async function getCourierDeliveryOptions(shopId: string) {
  return db.query.courierDeliveryOptions.findMany({
    where: eq(courierDeliveryOptions.shopId, shopId),
  });
}
export async function getActiveCourierDeliveryOptions(shopId: string) {
  return db.query.courierDeliveryOptions.findMany({
    where: and(
      eq(courierDeliveryOptions.shopId, shopId),
      eq(courierDeliveryOptions.active, true),
    ),
  });
}
```

- [ ] **Step 3: Провери типовете компилират**

Run: `export PATH="/c/nvm4w/nodejs:$PATH" && npx tsc --noEmit 2>&1 | grep couriers || echo clean`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/db/queries/couriers.ts
git commit -m "feat(couriers): заявки за delivery options"
```

---

### Task 3: `calculatePrice` в CourierProvider интерфейса (типове + Speedy)

**Files:**
- Modify: `src/lib/couriers/types.ts` (нов метод + PriceInput/PriceResult)
- Modify: `src/lib/couriers/speedy.ts` (имплементация)
- Test: `src/lib/couriers/speedy.test.ts`

**Interfaces:**
- Produces: `PriceInput` = `{ officeId: string | null; city: string; weightGrams: number; codCents: number | null }`.
- Produces: `CourierProvider.calculatePrice(input: PriceInput, creds): Promise<{ amountCents: number } | null>`.

- [ ] **Step 1: Разшири types.ts**

```ts
export interface PriceInput {
  officeId: string | null;
  city: string;
  weightGrams: number;
  codCents: number | null;
}
```
В `CourierProvider` интерфейса добави:
```ts
  calculatePrice(input: PriceInput, creds: CourierCreds): Promise<{ amountCents: number } | null>;
```

- [ ] **Step 2: Напиши failing тест за Speedy calculatePrice**

В `speedy.test.ts`:
```ts
describe("speedy.calculatePrice", () => {
  it("парсва calculations[0].price.total (EUR) към центове", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ calculations: [{ serviceId: 505, price: { total: 3.44, currency: "EUR" } }] }), { status: 200 }),
    );
    const res = await speedy.calculatePrice(
      { officeId: "2", city: "София", weightGrams: 800, codCents: null },
      { username: "u", password: "p" },
    );
    expect(res).toEqual({ amountCents: 344 });
  });
  it("грешен/липсващ отговор → null (fallback към резервна)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "x" } }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = await speedy.calculatePrice({ officeId: "2", city: "София", weightGrams: 800, codCents: null }, { username: "u", password: "p" });
    expect(res).toBeNull();
  });
});
```

- [ ] **Step 3: Пусни теста — трябва да падне**

Run: `/c/nvm4w/nodejs/node node_modules/vitest/vitest.mjs run src/lib/couriers/speedy.test.ts`
Expected: FAIL (calculatePrice not a function).

- [ ] **Step 4: Имплементирай speedy.calculatePrice**

```ts
  async calculatePrice(input, creds) {
    try {
      const data = await speedyPost<{ calculations?: { price?: { total?: number } }[] }>(
        "/calculate", creds,
        {
          recipient: {
            privatePerson: true,
            pickupOfficeId: input.officeId ? Number(input.officeId) : undefined,
            address: input.officeId ? undefined : { siteName: input.city },
          },
          service: {
            autoAdjustPickupDate: true,
            serviceIds: [SPEEDY_STANDARD_SERVICE],
            additionalServices: input.codCents != null ? { cod: { amount: input.codCents / 100, processingType: "CASH" } } : undefined,
          },
          content: { parcelsCount: 1, totalWeight: input.weightGrams / 1000 },
          payment: { courierServicePayer: input.codCents != null ? "RECIPIENT" : "SENDER" },
        },
      );
      const total = data.calculations?.[0]?.price?.total;
      if (typeof total !== "number") return null;
      return { amountCents: Math.round(total * 100) };
    } catch {
      return null;
    }
  },
```

- [ ] **Step 5: Пусни теста — трябва да мине**

Run: `/c/nvm4w/nodejs/node node_modules/vitest/vitest.mjs run src/lib/couriers/speedy.test.ts`
Expected: PASS (всички).

- [ ] **Step 6: Commit**

```bash
git add src/lib/couriers/types.ts src/lib/couriers/speedy.ts src/lib/couriers/speedy.test.ts
git commit -m "feat(couriers): Speedy calculatePrice (live EUR цена)"
```

---

### Task 4: `calculatePrice` за Econt (mode: calculate)

**Files:**
- Modify: `src/lib/couriers/econt.ts`
- Test: `src/lib/couriers/econt.test.ts`

**Interfaces:**
- Consumes: `PriceInput`, `CourierProvider.calculatePrice` (Task 3).

- [ ] **Step 1: Напиши failing тест**

В `econt.test.ts`:
```ts
describe("econt.calculatePrice", () => {
  it("парсва label.totalPrice (EUR) към центове", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ label: { totalPrice: 4.2 } }), { status: 200 }),
    );
    const res = await econt.calculatePrice(
      { officeId: "1234", city: "София", weightGrams: 800, codCents: null },
      { username: "u", password: "p" },
    );
    expect(res).toEqual({ amountCents: 420 });
  });
  it("грешка → null", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("fail", { status: 500 }));
    const res = await econt.calculatePrice({ officeId: "1", city: "София", weightGrams: 500, codCents: null }, { username: "u", password: "p" });
    expect(res).toBeNull();
  });
});
```
(⚠️ точното поле — `label.totalPrice` — се СВЕРЯВА на живо в Task 9; ако е различно, коригирай теста + кода тогава.)

- [ ] **Step 2: Пусни — трябва да падне**

Run: `/c/nvm4w/nodejs/node node_modules/vitest/vitest.mjs run src/lib/couriers/econt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Имплементирай econt.calculatePrice**

```ts
  async calculatePrice(input, creds) {
    try {
      const data = await econtPost<{ label?: { totalPrice?: number } }>(
        "/Shipments/LabelService.createLabel.json", creds,
        {
          mode: "calculate",
          label: {
            senderClient: { name: "-", phones: ["0000000000"] },
            senderAddress: { city: { name: "София" }, street: "-" },
            receiverClient: { name: "-", phones: ["0000000000"] },
            receiverOfficeCode: input.officeId ?? undefined,
            receiverAddress: input.officeId ? undefined : { city: { name: input.city }, street: "-" },
            packCount: 1,
            weight: input.weightGrams / 1000,
            services: input.codCents != null ? { cdAmount: input.codCents / 100, cdType: "get" } : undefined,
          },
        },
      );
      const total = data.label?.totalPrice;
      if (typeof total !== "number") return null;
      return { amountCents: Math.round(total * 100) };
    } catch {
      return null;
    }
  },
```

- [ ] **Step 4: Пусни — трябва да мине**

Run: `/c/nvm4w/nodejs/node node_modules/vitest/vitest.mjs run src/lib/couriers/econt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/couriers/econt.ts src/lib/couriers/econt.test.ts
git commit -m "feat(couriers): Econt calculatePrice (mode calculate)"
```

---

### Task 5: Чиста функция за приоритетна ценова логика

**Files:**
- Create: `src/lib/courier-pricing.ts`
- Test: `src/lib/courier-pricing.test.ts`

**Interfaces:**
- Produces: `resolveCourierShippingCents(opts): Promise<{ cents: number; free: boolean; source: "free"|"live"|"fallback" }>`.
  Сигнатура: `{ subtotalCents, freeOverCents, fallbackPriceCents, live: () => Promise<{amountCents:number}|null> }`.

- [ ] **Step 1: Напиши failing тестове (приоритет)**

```ts
import { resolveCourierShippingCents } from "./courier-pricing";
describe("resolveCourierShippingCents", () => {
  it("над прага → безплатна (не пита live)", async () => {
    const live = vi.fn();
    const r = await resolveCourierShippingCents({ subtotalCents: 6000, freeOverCents: 5000, fallbackPriceCents: 500, live });
    expect(r).toEqual({ cents: 0, free: true, source: "free" });
    expect(live).not.toHaveBeenCalled();
  });
  it("под прага + live успех → live цена", async () => {
    const r = await resolveCourierShippingCents({ subtotalCents: 3000, freeOverCents: 5000, fallbackPriceCents: 500, live: async () => ({ amountCents: 344 }) });
    expect(r).toEqual({ cents: 344, free: false, source: "live" });
  });
  it("под прага + live null → резервна цена", async () => {
    const r = await resolveCourierShippingCents({ subtotalCents: 3000, freeOverCents: null, fallbackPriceCents: 500, live: async () => null });
    expect(r).toEqual({ cents: 500, free: false, source: "fallback" });
  });
});
```

- [ ] **Step 2: Пусни — падат**

Run: `/c/nvm4w/nodejs/node node_modules/vitest/vitest.mjs run src/lib/courier-pricing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Имплементирай**

```ts
interface ResolveOpts {
  subtotalCents: number;
  freeOverCents: number | null;
  fallbackPriceCents: number;
  live: () => Promise<{ amountCents: number } | null>;
}
export async function resolveCourierShippingCents(o: ResolveOpts) {
  if (o.freeOverCents != null && o.subtotalCents >= o.freeOverCents) {
    return { cents: 0, free: true, source: "free" as const };
  }
  const live = await o.live();
  if (live) return { cents: live.amountCents, free: false, source: "live" as const };
  return { cents: o.fallbackPriceCents, free: false, source: "fallback" as const };
}
```

- [ ] **Step 4: Пусни — минават**

Run: `/c/nvm4w/nodejs/node node_modules/vitest/vitest.mjs run src/lib/courier-pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/courier-pricing.ts src/lib/courier-pricing.test.ts
git commit -m "feat(couriers): приоритетна ценова логика (безплатна>live>резервна)"
```

---

### Task 6: Server actions — save delivery option + getCourierPrice

**Files:**
- Modify: `src/actions/couriers.ts`
- Test: `src/actions/couriers.test.ts` (ако има; иначе минимален нов)

**Interfaces:**
- Consumes: `courierDeliveryOptionSchema` (T1), `getActiveCourierDeliveryOptions` (T2), `getCourier` + `calculatePrice` (T3/4), `resolveCourierShippingCents` (T5), `aggregateOrderWeight` (`src/lib/courier-weight.ts`), `checkRateLimit`.
- Produces: `saveCourierDeliveryOption(_prev, formData): Promise<CourierActionState>`; `getCourierPrice(input): Promise<{ cents: number; free: boolean }>` (публичен).

- [ ] **Step 1: saveCourierDeliveryOption (upsert по shop+provider+target)**

```ts
export async function saveCourierDeliveryOption(_prev: CourierActionState, formData: FormData): Promise<CourierActionState> {
  const { shop } = await requireShop();
  const parsed = courierDeliveryOptionSchema.safeParse({
    provider: formData.get("provider"),
    deliveryTarget: formData.get("deliveryTarget"),
    active: formData.get("active"),
    displayName: formData.get("displayName"),
    fallbackPriceCents: Number(formData.get("fallbackPriceCents") ?? 0),
    freeOverCents: formData.get("freeOverCents") ? Number(formData.get("freeOverCents")) : null,
  });
  if (!parsed.success) return { error: "Провери въведените данни." };
  const d = parsed.data;
  await db.insert(courierDeliveryOptions)
    .values({ shopId: shop.id, ...d, displayName: sanitizeText(d.displayName, 60) })
    .onConflictDoUpdate({
      target: [courierDeliveryOptions.shopId, courierDeliveryOptions.provider, courierDeliveryOptions.deliveryTarget],
      set: { active: d.active, displayName: sanitizeText(d.displayName, 60), fallbackPriceCents: d.fallbackPriceCents, freeOverCents: d.freeOverCents, updatedAt: new Date() },
    });
  revalidatePath("/dashboard/fulfillment");
  return { ok: true };
}
```

- [ ] **Step 2: getCourierPrice (публичен, rate-limited)**

```ts
const priceSchema = z.object({
  shopId: z.string().uuid(),
  provider: z.enum(["econt", "speedy"]),
  deliveryTarget: z.enum(["address", "office"]),
  officeId: z.string().nullable(),
  city: z.string().max(120),
  subtotalCents: z.number().int().min(0),
  weightGrams: z.number().int().min(1),
  codCents: z.number().int().nullable(),
});
export async function getCourierPrice(raw: unknown): Promise<{ cents: number; free: boolean }> {
  const p = priceSchema.parse(raw);
  if (!(await checkRateLimit(`courier-price:${p.shopId}`, 60, 60))) return { cents: 0, free: false };
  const option = await db.query.courierDeliveryOptions.findFirst({
    where: and(eq(courierDeliveryOptions.shopId, p.shopId), eq(courierDeliveryOptions.provider, p.provider), eq(courierDeliveryOptions.deliveryTarget, p.deliveryTarget), eq(courierDeliveryOptions.active, true)),
  });
  if (!option) return { cents: 0, free: false };
  const account = await db.query.shopCourierAccounts.findFirst({
    where: and(eq(shopCourierAccounts.shopId, p.shopId), eq(shopCourierAccounts.provider, p.provider)),
  });
  const res = await resolveCourierShippingCents({
    subtotalCents: p.subtotalCents,
    freeOverCents: option.freeOverCents,
    fallbackPriceCents: option.fallbackPriceCents,
    live: async () => {
      if (!account) return null;
      return getCourier(p.provider).calculatePrice(
        { officeId: p.officeId, city: p.city, weightGrams: p.weightGrams, codCents: p.codCents },
        account.credentials as Record<string, string>,
      );
    },
  });
  return { cents: res.cents, free: res.free };
}
```

- [ ] **Step 3: Провери типове + build**

Run: `export PATH="/c/nvm4w/nodejs:$PATH" && npx tsc --noEmit 2>&1 | grep couriers.ts || echo clean`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/actions/couriers.ts
git commit -m "feat(couriers): save delivery option + getCourierPrice (live/резервна)"
```

---

### Task 7: Таб „Куриери" — секция „Настройка на доставка"

**Files:**
- Modify: `src/components/dashboard/courier-accounts.tsx`
- Modify: `src/app/(dashboard)/dashboard/fulfillment/page.tsx` (подай `deliveryOptions`)

**Interfaces:**
- Consumes: `saveCourierDeliveryOption` (T6), `getCourierDeliveryOptions` (T2).

- [ ] **Step 1: page.tsx зарежда и подава delivery options**

В `fulfillment/page.tsx` добави към `Promise.all`: `getCourierDeliveryOptions(shop.id)`; подай `deliveryOptions={deliveryOptions}` на `<CourierAccounts>`.

- [ ] **Step 2: В CourierAccounts — под всяка свързана карта, форма „Доставка"**

За всеки свързан куриер, за всеки target (`office`, `address`) покажи ред: превключвател „Предлагай"; поле „Име в checkout" (displayName); „Резервна цена" (PriceInput); „Безплатна над" (PriceInput, опц.). Submit → `saveCourierDeliveryOption`. Показвай само ако `account` съществува (свързан). Ползвай `Field`/`PriceInput`/`SfCheckbox` еквивалент от `@/components/ui`.

```tsx
// Псевдо-структура вътре в картата, под TestButton:
{account && (["office","address"] as const).map((target) => (
  <DeliveryOptionForm key={target} provider={p.id} target={target}
    option={optionFor(p.id, target)} />
))}
```
`DeliveryOptionForm` = form action={saveDeliveryOption bound}, hidden provider+deliveryTarget, checkbox active, Input displayName, PriceInput fallback + freeOver, бутон Запази + toast.

- [ ] **Step 3: Визуална проверка (dev)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard/fulfillment` (влизане нужно) — или ръчна проверка в браузъра: таб Куриери → под Спиди има „Доставка до офис / до адрес" с резервна цена.
Expected: формите се показват за свързан куриер.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/courier-accounts.tsx "src/app/(dashboard)/dashboard/fulfillment/page.tsx"
git commit -m "feat(couriers): настройка на доставка в таб Куриери"
```

---

### Task 8: Таб „Доставка" почистване + checkout live цена

**Files:**
- Modify: `src/components/dashboard/fulfillment-manager.tsx` (премахни courier полетата)
- Modify: `src/app/(storefront)/s/[slug]/checkout/page.tsx` (подай активните courier delivery options като методи)
- Modify: `src/components/storefront/checkout-form.tsx` (courier метод → office picker + live цена)
- Modify: `src/lib/pricing.ts` ако е нужно (доставката се инжектира; вероятно без промяна)

**Interfaces:**
- Consumes: `getCourierPrice` (T6), `getActiveCourierDeliveryOptions` (T2), `CourierOfficePicker` (има).

- [ ] **Step 1: fulfillment-manager премахни courier UI**

Премахни блока с „Куриер" + „Доставка до" dropdown-ите (редове ~344-363) и всичко зависещо от `type==="courier"` в редактора. `SHIPPING_TYPES` вече няма courier (T1), така че dropdown-ът за тип автоматично се стеснява. Премахни `hasCourier` prop-а ако вече не се ползва.

- [ ] **Step 2: checkout page събира методите**

Активните `courier_delivery_options` се превръщат в „shipping методи" за checkout: всеки става запис `{ id: "courier:{provider}:{target}", name: displayName, type: "courier", provider, deliveryTarget, priceCents: fallback (placeholder), courier: true }`. Сливат се със `pickup`/`local` методите.

- [ ] **Step 3: checkout-form — при courier метод**

При избор на courier метод: покажи office picker (при target=office) или адрес (target=address); при избор на офис/град → извикай `getCourierPrice(...)` → покажи цената в резюмето. Преизчислявай при смяна на офис/град. Цената в поръчката = върнатата (сървърът я валидира отново при създаване).

- [ ] **Step 4: Сървърна валидация при създаване на поръчка**

Намери order creation action-а; при courier метод преизчисли цената сървърно (не вярвай на клиента) чрез `getCourierPrice` и я запиши. (Grep: `createOrder` в `src/actions/`.)

- [ ] **Step 5: pnpm check**

Run: `export PATH="/c/nvm4w/nodejs:$PATH" && pnpm check 2>&1 | grep -iE "Tests |error|Compiled"`
Expected: всички тестове минават, build OK.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(couriers): почистен таб Доставка + live цена в checkout"
```

---

### Task 9: Миграция на стари courier методи + жив тест

**Files:**
- Create: `scripts/migrate-courier-methods.mjs` (еднократен)
- Проверка на живо (Speedy calculate вече сверен; Econt calculate — сверяваме тук)

- [ ] **Step 1: Скрипт за миграция**

За всеки `shipping_methods` с `courierProvider != null`: create `courier_delivery_options` (provider, target от `deliveryTarget`, `fallbackPriceCents` = `priceCents`, `freeOverCents` пренесен, `displayName` = name, active = active); после `active=false` на стария метод. Идемпотентен (ON CONFLICT DO NOTHING).

- [ ] **Step 2: Пусни миграцията на dev**

Run: `/c/nvm4w/nodejs/node --env-file=.env.local scripts/migrate-courier-methods.mjs`
Expected: старите courier методи мигрирани.

- [ ] **Step 3: Жив тест Econt calculate (сверка на реалното поле)**

Пусни временен probe срещу Econt demo с `mode: "calculate"` → виж реалното име на полето за total цена. Ако е различно от `label.totalPrice` → коригирай econt.ts + теста (Task 4).

- [ ] **Step 4: Жив тест Speedy calculate (вече сверен)** — потвърди `calculations[0].price.total`.

- [ ] **Step 5: Финален pnpm check + ръчен end-to-end (dev)**

Run: `export PATH="/c/nvm4w/nodejs:$PATH" && pnpm check`
Ръчно: dashboard → Куриери → активирай „До офис на Спиди" резервна 5€ → checkout → избери метода → избери офис → виж live цена.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-courier-methods.mjs
git commit -m "chore(couriers): миграция на стари courier методи + жив тест на calculate"
```

---

## Self-Review бележки
- **Spec coverage:** T1 таблица+схема ✓; T2 заявки ✓; T3/4 live цена (Speedy+Econt) ✓; T5 приоритет ✓; T6 actions ✓; T7 таб Куриери ✓; T8 таб Доставка+checkout ✓; T9 миграция+жив тест ✓.
- **Валута:** EUR директно навсякъде (без BGN) — Global Constraints.
- **Econt поле за total:** маркирано „сверява се на живо в T9" (единствената недоверена точка; Speedy е сверен).
- **Няма push** — цялата работа локална за преглед (правило на потребителя за тази сесия).
