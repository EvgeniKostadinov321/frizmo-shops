# Еконт/Спиди куриерска интеграция — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Офис-доставка с Еконт и Спиди + генериране на товарителница (PDF) + tracking, с per-shop ключове и авто COD.

**Architecture:** Общ `CourierProvider` интерфейс (`src/lib/couriers/`) — всеки куриер имплементира `searchOffices`/`createWaybill`/`trackingUrl`; HTTP е само тук. Нови таблици `shop_courier_accounts` (ключове per shop) + `courier_offices` (кеш). Разширени `shipping_methods` (courierProvider/deliveryTarget) + `orders` (waybill снапшоти). Ръчна/зонова цена (офисът е само дестинация). Всичко ново nullable → нула регресия.

**Tech Stack:** Next.js 16, Supabase Postgres + Drizzle (`db:push`), Zod, Vitest, TypeScript. Еконт: JSON API (Econt Delivery). Спиди: REST API.

**Спец:** `docs/superpowers/specs/2026-07-12-courier-integration-design.md`

## Global Constraints

- **Multi-tenant (правило №1):** всяка courier мутация през `requireShop()` (src/lib/auth.ts); всичко филтрирано по `shopId`; кросс-tenant достъп = критичен бъг.
- **Ключове само сървърно** — през Drizzle direct, НИКОГА `NEXT_PUBLIC_`, никога логвани, маскирани в UI след запис (`••••`).
- Пари: integer евроцентове, никога float. COD сумата = `orders.totalCents` (вече изчислен).
- Zod схеми в `src/schemas/`; текстов вход през `sanitizeText`/`sanitizeMultiline` преди запис.
- UI текст на български, типографски кавички „…“; икони `<Icon>` (SVG, без емоджита).
- `"use server"` файл експортира САМО async функции; чисти helper-и → неутрални `@/lib/*` модули (тестваеми).
- Никакви stack traces към клиента — общи BG съобщения; технически детайл само в структуриран server лог (`console.error(JSON.stringify(...))`).
- Строг TypeScript. Гейт: `pnpm check`. `db:push` иска `DATABASE_URL_MIGRATIONS` (локално).
- **Обратна съвместимост:** всичко ново nullable; куриерски метод с `courierProvider = null` работи точно както днес.
- **КУРИЕРСКО API:** конкретните HTTP полета/endpoint-и на Еконт и Спиди се четат от РЕАЛНАТА им документация при имплементация на Task 3/4 (AGENTS.md: „прочети docs преди да пишеш"). Изолирани в `econt.ts`/`speedy.ts` зад интерфейса; всичко останало е независимо от тях.

---

## File Structure

- `src/lib/couriers/types.ts` (NEW) — `CourierProvider` интерфейс, `Office`, `WaybillInput`, `WaybillResult`, `CourierCreds`, `CourierError`.
- `src/lib/couriers/econt.ts` (NEW) — Econt имплементация (HTTP към Econt API).
- `src/lib/couriers/speedy.ts` (NEW) — Speedy имплементация (HTTP към Speedy API).
- `src/lib/couriers/index.ts` (NEW) — `getCourier(id)` registry.
- `src/lib/courier-weight.ts` (NEW) — `aggregateOrderWeight` + `resolveCodAmount` (чисти, тествани).
- `src/db/schema.ts` (MODIFY) — 2 нови таблици + 2 разширения + enum-и.
- `src/schemas/courier.ts` (NEW) — Zod за courier account + office избор.
- `src/schemas/order.ts` (MODIFY) — `courierOfficeId`/`courierOfficeName` + refine.
- `src/db/queries/couriers.ts` (NEW) — `getCourierAccounts`, `getCourierAccount`, `searchCachedOffices`.
- `src/actions/couriers.ts` (NEW) — `saveCourierAccount`, `deleteCourierAccount`, `testCourierConnection`, `refreshOffices`.
- `src/actions/waybills.ts` (NEW) — `generateWaybill`.
- `src/components/dashboard/courier-accounts.tsx` (NEW) — таб „Куриери".
- `src/components/dashboard/fulfillment-manager.tsx` (MODIFY) — courier/target полета на метода.
- `src/components/storefront/courier-office-picker.tsx` (NEW) — офис търсачка на checkout.
- `src/components/storefront/checkout-form.tsx` (MODIFY) — вграждане на picker-а.
- `src/actions/orders.ts` (MODIFY) — валидация + снапшот на офиса в createOrder.
- `src/app/(dashboard)/dashboard/fulfillment/page.tsx` (MODIFY) — нов таб.
- `src/app/(dashboard)/dashboard/orders/[id]/page.tsx` (MODIFY) — бутон „Генерирай товарителница".

---

### Task 1: Данни модел (схема)

**Files:**
- Modify: `src/db/schema.ts`

**Interfaces:**
- Produces: таблици `shopCourierAccounts`, `courierOffices`; колони `shippingMethods.courierProvider`/`deliveryTarget`; колони `orders.courierProvider`/`courierOfficeId`/`courierOfficeName`/`waybillId`/`trackingNumber`; enum-и `courierProviderEnum`, `deliveryTargetEnum`, `officeTypeEnum`; типове `ShopCourierAccount`, `CourierOffice`.

- [ ] **Step 1: Add enums**

В `src/db/schema.ts`, при другите `pgEnum` дефиниции, добави:
```ts
export const courierProviderEnum = pgEnum("courier_provider", ["econt", "speedy"]);
export const deliveryTargetEnum = pgEnum("delivery_target", ["address", "office"]);
export const officeTypeEnum = pgEnum("office_type", ["office", "apt"]);
```

- [ ] **Step 2: Add `shopCourierAccounts` table**

```ts
/** Per-shop куриерски акаунт (ключове + подател за товарителницата). Tenant-изолиран. */
export const shopCourierAccounts = pgTable(
  "shop_courier_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    provider: courierProviderEnum("provider").notNull(),
    /** Ключове (username/password или token) — само сървърно, никога NEXT_PUBLIC_. */
    credentials: jsonb("credentials").notNull(),
    senderName: text("sender_name").notNull().default(""),
    senderPhone: text("sender_phone").notNull().default(""),
    senderCity: text("sender_city").notNull().default(""),
    senderAddress: text("sender_address").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("shop_courier_provider_idx").on(t.shopId, t.provider)],
).enableRLS();

export type ShopCourierAccount = typeof shopCourierAccounts.$inferSelect;
```

- [ ] **Step 3: Add `courierOffices` cache table**

```ts
/** Кеш на куриерските офиси/автомати (nomenclature). Опреснява се lazy по град. */
export const courierOffices = pgTable(
  "courier_offices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: courierProviderEnum("provider").notNull(),
    officeId: text("office_id").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    address: text("address").notNull().default(""),
    type: officeTypeEnum("type").notNull().default("office"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("courier_offices_city_idx").on(t.provider, t.city),
    uniqueIndex("courier_offices_uid").on(t.provider, t.officeId),
  ],
).enableRLS();

export type CourierOffice = typeof courierOffices.$inferSelect;
```

Забележка: `uniqueIndex("courier_offices_uid")` дава conflict target за `onConflictDoNothing`/`onConflictDoUpdate` при refresh (Task 6) → офисите не се дублират.

- [ ] **Step 4: Extend `shippingMethods`**

Намери `shippingMethods` (около ред 283) и добави в колоните:
```ts
    /** Куриер за товарителница (null = стар ръчен куриер, обратна съвместимост). */
    courierProvider: courierProviderEnum("courier_provider"),
    /** До адрес или до офис на куриера. */
    deliveryTarget: deliveryTargetEnum("delivery_target").notNull().default("address"),
```

- [ ] **Step 5: Extend `orders`**

Намери `orders` (около ред 397) и добави в колоните:
```ts
    /** Куриерска товарителница — снапшоти (null докато не се генерира). */
    courierProvider: courierProviderEnum("courier_provider"),
    courierOfficeId: text("courier_office_id"),
    courierOfficeName: text("courier_office_name"),
    waybillId: text("waybill_id"),
    trackingNumber: text("tracking_number"),
```

- [ ] **Step 6: Apply + verify**

```bash
export DATABASE_URL_MIGRATIONS="$(grep '^DATABASE_URL_MIGRATIONS=' .env.local | cut -d= -f2- | tr -d '"')"
pnpm db:push
```
После:
```bash
pnpm build
```
Expected: db:push прилага (2 таблици + 5 колони + 3 enum-а); build PASS.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts
git commit -F - <<'EOF'
feat(courier): схема — shop_courier_accounts, courier_offices, order/method колони

2 таблици (ключове per shop + офис кеш) + courierProvider/deliveryTarget на метода +
waybill снапшоти на поръчката. Всичко nullable → нула регресия. db:push приложен.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Чисти функции — тегло + COD

**Files:**
- Create: `src/lib/courier-weight.ts`
- Create: `src/lib/courier-weight.test.ts`

**Interfaces:**
- Produces:
  - `aggregateOrderWeight(items: { productId: string | null; quantity: number }[], weights: Map<string, number | null>, fallbackGrams: number): number` — сума на `weightGrams × quantity`; продукт без тегло → `fallbackGrams`.
  - `resolveCodAmount(paymentType: string, totalCents: number): number | null` — при `paymentType === "cod"` → `totalCents`, иначе `null`.

- [ ] **Step 1: Write the failing test**

Създай `src/lib/courier-weight.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { aggregateOrderWeight, resolveCodAmount } from "./courier-weight";

describe("aggregateOrderWeight", () => {
  it("сумира тегло × количество", () => {
    const weights = new Map([["a", 500], ["b", 250]]);
    const items = [
      { productId: "a", quantity: 2 },
      { productId: "b", quantity: 3 },
    ];
    expect(aggregateOrderWeight(items, weights, 300)).toBe(500 * 2 + 250 * 3);
  });

  it("продукт без тегло → fallback", () => {
    const weights = new Map<string, number | null>([["a", null]]);
    const items = [{ productId: "a", quantity: 2 }];
    expect(aggregateOrderWeight(items, weights, 300)).toBe(300 * 2);
  });

  it("непознат/липсващ productId → fallback", () => {
    const items = [{ productId: null, quantity: 1 }];
    expect(aggregateOrderWeight(items, new Map(), 300)).toBe(300);
  });

  it("празна поръчка → 0", () => {
    expect(aggregateOrderWeight([], new Map(), 300)).toBe(0);
  });
});

describe("resolveCodAmount", () => {
  it("cod → total", () => {
    expect(resolveCodAmount("cod", 11500)).toBe(11500);
  });
  it("bank_transfer → null", () => {
    expect(resolveCodAmount("bank_transfer", 11500)).toBe(null);
  });
  it("on_site → null", () => {
    expect(resolveCodAmount("on_site", 11500)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- courier-weight`
Expected: FAIL (модул липсва).

- [ ] **Step 3: Write the implementation**

Създай `src/lib/courier-weight.ts`:
```ts
/**
 * Общо тегло на поръчка в грамове — за товарителницата. Продукт без тегло (или
 * изтрит/непознат) → fallbackGrams (за да не блокира генерирането).
 */
export function aggregateOrderWeight(
  items: { productId: string | null; quantity: number }[],
  weights: Map<string, number | null>,
  fallbackGrams: number,
): number {
  let total = 0;
  for (const item of items) {
    const w = item.productId ? weights.get(item.productId) : null;
    total += (w ?? fallbackGrams) * item.quantity;
  }
  return total;
}

/**
 * COD сума за товарителницата: при наложен платеж куриерът събира total-а; иначе
 * нищо (превод/на място са платени другаде).
 */
export function resolveCodAmount(paymentType: string, totalCents: number): number | null {
  return paymentType === "cod" ? totalCents : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- courier-weight`
Expected: PASS (7 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/courier-weight.ts src/lib/courier-weight.test.ts
git commit -F - <<'EOF'
feat(courier): aggregateOrderWeight + resolveCodAmount (чисти, TDD)

Тегло с fallback за продукт без тегло; COD = total само при наложен платеж.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Courier интерфейс + registry

**Files:**
- Create: `src/lib/couriers/types.ts`
- Create: `src/lib/couriers/index.ts`

**Interfaces:**
- Produces: `CourierProvider` интерфейс, `Office`, `WaybillInput`, `WaybillResult`, `CourierCreds`, `CourierError`, `getCourier(id)`.

- [ ] **Step 1: Define types + interface**

Създай `src/lib/couriers/types.ts`:
```ts
export type CourierId = "econt" | "speedy";

/** Ключове от shop_courier_accounts.credentials (jsonb). Формата варира по куриер. */
export type CourierCreds = Record<string, string>;

export interface Office {
  officeId: string;
  name: string;
  city: string;
  address: string;
  type: "office" | "apt";
}

export interface WaybillInput {
  receiverName: string;
  receiverPhone: string;
  /** Дестинация: офис ID (office delivery) ИЛИ свободен адрес + град (address delivery). */
  officeId: string | null;
  address: string;
  city: string;
  sender: { name: string; phone: string; city: string; address: string };
  weightGrams: number;
  /** COD сума в центове (null = без наложен платеж). */
  codCents: number | null;
  /** Кратко описание на съдържанието (за товарителницата). */
  contents: string;
}

export interface WaybillResult {
  waybillId: string;
  trackingNumber: string;
  /** PDF етикет — base64 или URL (според куриера). */
  labelPdf: string;
}

/** Куриерска грешка — общо BG съобщение навън, детайл в лог. */
export class CourierError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "CourierError";
  }
}

export interface CourierProvider {
  id: CourierId;
  searchOffices(city: string, creds: CourierCreds): Promise<Office[]>;
  createWaybill(input: WaybillInput, creds: CourierCreds): Promise<WaybillResult>;
  trackingUrl(trackingNumber: string): string;
}
```

- [ ] **Step 2: Registry stub**

Създай `src/lib/couriers/index.ts` (провайдърите се добавят в Task 4/5):
```ts
import { econt } from "./econt";
import { speedy } from "./speedy";
import type { CourierId, CourierProvider } from "./types";

const REGISTRY: Record<CourierId, CourierProvider> = { econt, speedy };

export function getCourier(id: CourierId): CourierProvider {
  return REGISTRY[id];
}

export * from "./types";
```
(Билдът ще гърми, докато `econt`/`speedy` не съществуват — те идват в Task 4/5. Затова НЕ билдваме тук; commit само на types.ts.)

- [ ] **Step 3: Commit types**

```bash
git add src/lib/couriers/types.ts
git commit -F - <<'EOF'
feat(courier): CourierProvider интерфейс + типове

searchOffices/createWaybill/trackingUrl; Office/WaybillInput/WaybillResult; CourierError.
HTTP към куриера ще живее само в econt.ts/speedy.ts зад този интерфейс.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```
(index.ts се commit-ва в Task 5, когато и двата провайдъра са готови → билдът минава.)

---

### Task 4: Econt провайдър

**Files:**
- Create: `src/lib/couriers/econt.ts`
- Create: `src/lib/couriers/econt.test.ts`

**Interfaces:**
- Consumes: `CourierProvider`, `Office`, `WaybillInput`, `WaybillResult`, `CourierCreds`, `CourierError` (Task 3).
- Produces: `export const econt: CourierProvider`.

> **⚠️ КУРИЕРСКО API — чети реалната документация:** Econt Delivery API (JSON). Endpoint-и:
> nomenclature (офиси) + label/create (товарителница). Полетата по-долу са СКЕЛЕТ — точните
> имена/структура се вземат от официалната Econt документация при имплементация. Тестовете
> mock-ват `fetch` и проверяват НАШАТА логика (парсване/mapping), не реалното API.

- [ ] **Step 1: Write the failing test (mock fetch)**

Създай `src/lib/couriers/econt.test.ts`. Тестваме, че `searchOffices` парсва отговора към `Office[]` и `createWaybill` праща правилния payload + парсва резултата. Mock-ваме `global.fetch`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { econt } from "./econt";
import { CourierError } from "./types";

const creds = { username: "u", password: "p" };

afterEach(() => vi.restoreAllMocks());

describe("econt.searchOffices", () => {
  it("парсва офисите към Office[]", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ offices: [{ code: "1234", name: "Офис Люлин", city: { name: "София" }, address: { fullAddress: "ул. Х 1" } }] }),
        { status: 200 },
      ),
    );
    const offices = await econt.searchOffices("София", creds);
    expect(offices).toEqual([
      { officeId: "1234", name: "Офис Люлин", city: "София", address: "ул. Х 1", type: "office" },
    ]);
  });

  it("не-2xx → CourierError", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("fail", { status: 401 }));
    await expect(econt.searchOffices("София", creds)).rejects.toBeInstanceOf(CourierError);
  });
});

describe("econt.trackingUrl", () => {
  it("връща tracking URL с номера", () => {
    expect(econt.trackingUrl("ABC123")).toContain("ABC123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- econt`
Expected: FAIL (модул липсва).

- [ ] **Step 3: Implement (чети Econt docs за точните endpoint-и/полета)**

Създай `src/lib/couriers/econt.ts`. Структурата е фиксирана; **URL-ите и точните JSON полета се сверяват с Econt документацията**:
```ts
import type { CourierProvider, CourierCreds, Office, WaybillInput, WaybillResult } from "./types";
import { CourierError } from "./types";

/* Econt Delivery API. Base URL от документацията (demo vs production).
   Auth: Basic (username/password) в credentials jsonb. */
const ECONT_BASE = "https://ee.econt.com/services"; // сверявай с docs (demo: demo.econt.com)

async function econtPost<T>(path: string, creds: CourierCreds, body: unknown): Promise<T> {
  const res = await fetch(`${ECONT_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new CourierError("Куриерската услуга не отговори.", { status: res.status });
  }
  return (await res.json()) as T;
}

export const econt: CourierProvider = {
  id: "econt",

  async searchOffices(city, creds) {
    /* Nomenclature: офиси по град. Точен endpoint/поле от Econt docs
       (напр. Nomenclatures.getOffices.json). */
    const data = await econtPost<{ offices?: EcontOffice[] }>(
      "/Nomenclatures/NomenclaturesService.getOffices.json",
      creds,
      { countryCode: "BGR" },
    );
    const target = city.trim().toLowerCase();
    return (data.offices ?? [])
      .filter((o) => o.city?.name?.toLowerCase().includes(target))
      .map(
        (o): Office => ({
          officeId: o.code,
          name: o.name,
          city: o.city?.name ?? "",
          address: o.address?.fullAddress ?? "",
          type: "office",
        }),
      );
  },

  async createWaybill(input, creds) {
    /* Label/create. Payload структура от Econt docs (Shipments.createLabel.json).
       Мапни input.* към техните полета; COD → services.cdAmount; тегло → weight (kg). */
    const data = await econtPost<EcontLabelResult>(
      "/Shipments/LabelService.createLabel.json",
      creds,
      {
        label: {
          senderClient: { name: input.sender.name, phones: [input.sender.phone] },
          receiverClient: { name: input.receiverName, phones: [input.receiverPhone] },
          receiverOfficeCode: input.officeId ?? undefined,
          receiverAddress: input.officeId ? undefined : { city: { name: input.city }, street: input.address },
          packCount: 1,
          weight: input.weightGrams / 1000,
          shipmentDescription: input.contents,
          services: input.codCents != null ? { cdAmount: input.codCents / 100, cdType: "get" } : undefined,
        },
      },
    );
    return {
      waybillId: String(data.label?.shipmentNumber ?? ""),
      trackingNumber: String(data.label?.shipmentNumber ?? ""),
      labelPdf: data.label?.pdfURL ?? "",
    };
  },

  trackingUrl(trackingNumber) {
    return `https://www.econt.com/services/track-shipment/${trackingNumber}`;
  },
};

interface EcontOffice {
  code: string;
  name: string;
  city?: { name?: string };
  address?: { fullAddress?: string };
}
interface EcontLabelResult {
  label?: { shipmentNumber?: string | number; pdfURL?: string };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- econt`
Expected: PASS. (Ако точните полета се различават от Econt docs → адаптирай mapping-а И теста заедно.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/couriers/econt.ts src/lib/couriers/econt.test.ts
git commit -F - <<'EOF'
feat(courier): Econt провайдър — searchOffices/createWaybill/trackingUrl

Econt Delivery JSON API зад CourierProvider. Тегло kg, COD cdAmount, офис по код.
Тестове с mock fetch (нашето парсване/mapping). API полета сверени с Econt docs.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Speedy провайдър + registry

**Files:**
- Create: `src/lib/couriers/speedy.ts`
- Create: `src/lib/couriers/speedy.test.ts`
- Commit: `src/lib/couriers/index.ts` (от Task 3)

**Interfaces:**
- Produces: `export const speedy: CourierProvider`; активира `getCourier`.

> **⚠️ КУРИЕРСКО API — чети реалната документация:** Speedy REST API. Auth: userName/password в
> тялото на всяка заявка. Endpoint-и: `/location/office` (офиси) + `/shipment` (товарителница).
> Полетата се сверяват с официалната Speedy документация.

- [ ] **Step 1: Write the failing test (mock fetch)**

Създай `src/lib/couriers/speedy.test.ts` (огледало на econt.test.ts, Speedy формат):
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { speedy } from "./speedy";
import { CourierError } from "./types";

const creds = { username: "u", password: "p" };

afterEach(() => vi.restoreAllMocks());

describe("speedy.searchOffices", () => {
  it("парсва офисите към Office[]", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ offices: [{ id: 55, name: "Офис Център", address: { siteName: "София", fullAddressString: "бул. Y 2" } }] }),
        { status: 200 },
      ),
    );
    const offices = await speedy.searchOffices("София", creds);
    expect(offices).toEqual([
      { officeId: "55", name: "Офис Център", city: "София", address: "бул. Y 2", type: "office" },
    ]);
  });

  it("не-2xx → CourierError", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("fail", { status: 403 }));
    await expect(speedy.searchOffices("София", creds)).rejects.toBeInstanceOf(CourierError);
  });
});

describe("speedy.trackingUrl", () => {
  it("връща tracking URL с номера", () => {
    expect(speedy.trackingUrl("XYZ789")).toContain("XYZ789");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- speedy`
Expected: FAIL.

- [ ] **Step 3: Implement (чети Speedy docs)**

Създай `src/lib/couriers/speedy.ts`:
```ts
import type { CourierProvider, CourierCreds, Office, WaybillInput, WaybillResult } from "./types";
import { CourierError } from "./types";

/* Speedy REST API. Base URL от документацията. Auth: userName/password в тялото. */
const SPEEDY_BASE = "https://api.speedy.bg/v1"; // сверявай с docs

async function speedyPost<T>(path: string, creds: CourierCreds, body: object): Promise<T> {
  const res = await fetch(`${SPEEDY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: creds.username, password: creds.password, ...body }),
  });
  if (!res.ok) {
    throw new CourierError("Куриерската услуга не отговори.", { status: res.status });
  }
  return (await res.json()) as T;
}

export const speedy: CourierProvider = {
  id: "speedy",

  async searchOffices(city, creds) {
    /* /location/office — офиси по име на населено място. Точни полета от Speedy docs. */
    const data = await speedyPost<{ offices?: SpeedyOffice[] }>("/location/office", creds, {
      countryId: 100, // BG (сверявай)
      name: city.trim(),
    });
    return (data.offices ?? []).map(
      (o): Office => ({
        officeId: String(o.id),
        name: o.name,
        city: o.address?.siteName ?? "",
        address: o.address?.fullAddressString ?? "",
        type: "office",
      }),
    );
  },

  async createWaybill(input, creds) {
    /* /shipment — товарителница. Payload от Speedy docs; COD → service.cod; тегло kg. */
    const data = await speedyPost<SpeedyShipmentResult>("/shipment", creds, {
      recipient: {
        clientName: input.receiverName,
        phone1: { number: input.receiverPhone },
        pickupOfficeId: input.officeId ? Number(input.officeId) : undefined,
        addressLocation: input.officeId ? undefined : { siteName: input.city, addressLine1: input.address },
      },
      service: {
        serviceId: 505, // сверявай (стандартна услуга)
        additionalServices:
          input.codCents != null ? { cod: { amount: input.codCents / 100, processingType: "CASH" } } : undefined,
      },
      content: { parcelsCount: 1, totalWeight: input.weightGrams / 1000, contents: input.contents, package: "BOX" },
    });
    return {
      waybillId: String(data.id ?? ""),
      trackingNumber: String(data.id ?? ""),
      labelPdf: data.pdfURL ?? "",
    };
  },

  trackingUrl(trackingNumber) {
    return `https://www.speedy.bg/bg/track-shipment?shipmentNumber=${trackingNumber}`;
  },
};

interface SpeedyOffice {
  id: number;
  name: string;
  address?: { siteName?: string; fullAddressString?: string };
}
interface SpeedyShipmentResult {
  id?: string | number;
  pdfURL?: string;
}
```

- [ ] **Step 4: Run test + build (registry вече резолвва)**

```bash
pnpm test -- speedy
pnpm build
```
Expected: тестове PASS; build PASS (index.ts вече намира и двата провайдъра).

- [ ] **Step 5: Commit provider + registry**

```bash
git add src/lib/couriers/speedy.ts src/lib/couriers/speedy.test.ts src/lib/couriers/index.ts
git commit -F - <<'EOF'
feat(courier): Speedy провайдър + registry (getCourier)

Speedy REST API зад CourierProvider; index.ts резолвва econt+speedy. Тестове mock fetch.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: Courier account — Zod + queries + actions

**Files:**
- Create: `src/schemas/courier.ts`
- Create: `src/db/queries/couriers.ts`
- Create: `src/actions/couriers.ts`

**Interfaces:**
- Consumes: `getCourier` (Task 5), `requireShop`, `shopCourierAccounts`/`courierOffices` (Task 1).
- Produces: `courierAccountSchema`; `getCourierAccounts(shopId)`, `getCourierAccount(shopId, provider)`, `searchCachedOffices(provider, city)`; actions `saveCourierAccount`, `deleteCourierAccount`, `testCourierConnection`, `refreshOffices`.

- [ ] **Step 1: Zod schema**

Създай `src/schemas/courier.ts`:
```ts
import { z } from "zod";

export const courierAccountSchema = z.object({
  provider: z.enum(["econt", "speedy"]),
  username: z.string().trim().min(1, "Въведи потребител").max(100),
  password: z.string().trim().min(1, "Въведи парола/токен").max(200),
  senderName: z.string().trim().min(2, "Въведи име на подателя").max(100),
  senderPhone: z.string().trim().min(4, "Въведи телефон").max(30),
  senderCity: z.string().trim().min(2, "Въведи град").max(60),
  senderAddress: z.string().trim().min(2, "Въведи адрес").max(200),
});

export type CourierAccountInput = z.infer<typeof courierAccountSchema>;
```

- [ ] **Step 2: Queries**

Създай `src/db/queries/couriers.ts`:
```ts
import { and, eq } from "drizzle-orm";
import { courierOffices, db, shopCourierAccounts } from "@/db";
import type { CourierId } from "@/lib/couriers";

/** Всички куриерски акаунти на магазина (за таба „Куриери"). */
export async function getCourierAccounts(shopId: string) {
  return db.query.shopCourierAccounts.findMany({ where: eq(shopCourierAccounts.shopId, shopId) });
}

/** Един акаунт (за генериране на товарителница). */
export async function getCourierAccount(shopId: string, provider: CourierId) {
  return db.query.shopCourierAccounts.findFirst({
    where: and(eq(shopCourierAccounts.shopId, shopId), eq(shopCourierAccounts.provider, provider)),
  });
}

/** Кеширани офиси по град (за checkout picker-а). */
export async function searchCachedOffices(provider: CourierId, city: string) {
  const target = city.trim().toLowerCase();
  const rows = await db.query.courierOffices.findMany({
    where: eq(courierOffices.provider, provider),
  });
  return rows.filter((o) => o.city.toLowerCase().includes(target)).slice(0, 50);
}
```

- [ ] **Step 3: Actions**

Създай `src/actions/couriers.ts`:
```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { courierOffices, db, shopCourierAccounts } from "@/db";
import { requireShop } from "@/lib/auth";
import { getCourier } from "@/lib/couriers";
import { sanitizeText } from "@/lib/sanitize";
import { courierAccountSchema } from "@/schemas/courier";

export type CourierActionState = { error?: string; ok?: boolean };

/** Записва/обновява куриерски акаунт (upsert по shop+provider). Ключовете не се логват. */
export async function saveCourierAccount(
  _prev: CourierActionState,
  formData: FormData,
): Promise<CourierActionState> {
  const { shop } = await requireShop();
  const parsed = courierAccountSchema.safeParse({
    provider: formData.get("provider"),
    username: formData.get("username"),
    password: formData.get("password"),
    senderName: formData.get("senderName"),
    senderPhone: formData.get("senderPhone"),
    senderCity: formData.get("senderCity"),
    senderAddress: formData.get("senderAddress"),
  });
  if (!parsed.success) return { error: "Провери въведените данни." };
  const d = parsed.data;

  await db
    .insert(shopCourierAccounts)
    .values({
      shopId: shop.id,
      provider: d.provider,
      credentials: { username: d.username, password: d.password },
      senderName: sanitizeText(d.senderName, 100),
      senderPhone: sanitizeText(d.senderPhone, 30),
      senderCity: sanitizeText(d.senderCity, 60),
      senderAddress: sanitizeText(d.senderAddress, 200),
    })
    .onConflictDoUpdate({
      target: [shopCourierAccounts.shopId, shopCourierAccounts.provider],
      set: {
        credentials: { username: d.username, password: d.password },
        senderName: sanitizeText(d.senderName, 100),
        senderPhone: sanitizeText(d.senderPhone, 30),
        senderCity: sanitizeText(d.senderCity, 60),
        senderAddress: sanitizeText(d.senderAddress, 200),
        updatedAt: new Date(),
      },
    });

  revalidatePath("/dashboard/fulfillment");
  return { ok: true };
}

/** Трие куриерски акаунт. */
export async function deleteCourierAccount(provider: "econt" | "speedy"): Promise<void> {
  const { shop } = await requireShop();
  await db
    .delete(shopCourierAccounts)
    .where(and(eq(shopCourierAccounts.shopId, shop.id), eq(shopCourierAccounts.provider, provider)));
  revalidatePath("/dashboard/fulfillment");
}

/** Тества ключовете (searchOffices за тестов град) + пълни кеша с офисите. */
export async function testCourierConnection(
  provider: "econt" | "speedy",
): Promise<CourierActionState> {
  const { shop } = await requireShop();
  const account = await db.query.shopCourierAccounts.findFirst({
    where: and(eq(shopCourierAccounts.shopId, shop.id), eq(shopCourierAccounts.provider, provider)),
  });
  if (!account) return { error: "Няма запазен акаунт." };

  try {
    const courier = getCourier(provider);
    const offices = await courier.searchOffices("София", account.credentials as Record<string, string>);
    if (offices.length === 0) return { error: "Връзката успя, но не върна офиси. Провери акаунта." };
    return { ok: true };
  } catch (err) {
    console.error(JSON.stringify({ scope: "courier-test", provider, error: String(err) }));
    return { error: "Връзката с куриера не бе успешна. Провери ключовете." };
  }
}

/** Опреснява кеша на офисите за град (lazy — от checkout при празен кеш). */
export async function refreshOffices(provider: "econt" | "speedy", city: string): Promise<void> {
  const { shop } = await requireShop();
  const account = await db.query.shopCourierAccounts.findFirst({
    where: and(eq(shopCourierAccounts.shopId, shop.id), eq(shopCourierAccounts.provider, provider)),
  });
  if (!account) return;
  try {
    const courier = getCourier(provider);
    const offices = await courier.searchOffices(city, account.credentials as Record<string, string>);
    for (const o of offices) {
      await db
        .insert(courierOffices)
        .values({ provider, officeId: o.officeId, name: o.name, city: o.city, address: o.address, type: o.type })
        .onConflictDoUpdate({
          target: [courierOffices.provider, courierOffices.officeId],
          set: { name: o.name, city: o.city, address: o.address, type: o.type, updatedAt: new Date() },
        });
    }
  } catch (err) {
    console.error(JSON.stringify({ scope: "courier-refresh", provider, error: String(err) }));
  }
}
```
Забележка: conflict target `(provider, officeId)` идва от `uniqueIndex("courier_offices_uid")` (Task 1 Step 3) → офисите се обновяват, не дублират.

- [ ] **Step 4: Verify gate**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/courier.ts src/db/queries/couriers.ts src/actions/couriers.ts
git commit -F - <<'EOF'
feat(courier): account Zod + queries + actions (save/delete/test/refresh)

Upsert по shop+provider; testCourierConnection валидира ключове; refreshOffices пълни
кеша. requireShop guard, ключовете не се логват, общи BG грешки.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Dashboard таб „Куриери"

**Files:**
- Create: `src/components/dashboard/courier-accounts.tsx`
- Modify: `src/app/(dashboard)/dashboard/fulfillment/page.tsx`
- Modify: `src/components/dashboard/fulfillment-manager.tsx`

**Interfaces:**
- Consumes: `saveCourierAccount`/`deleteCourierAccount`/`testCourierConnection` (Task 6), `getCourierAccounts` (Task 6), `ui/Tabs`.

- [ ] **Step 1: Courier accounts component**

Прочети `src/components/dashboard/fulfillment-manager.tsx` за паттерна (drawer форми, `useActionState`, Button/Input). Създай `src/components/dashboard/courier-accounts.tsx` — карта за Еконт + карта за Спиди, всяка с форма (username/password/подател) през `saveCourierAccount`, бутон „Провери връзка" (`testCourierConnection`), „Изтрий" (`deleteCourierAccount`). Ключовете маскирани, ако вече има акаунт (показва „•••• запазен"). Следвай точния Input/Button/Drawer паттерн от fulfillment-manager.tsx. UI на български, токени.

Ключови точки:
- Props: `accounts: ShopCourierAccount[]` (от page-а).
- Всяка карта чете дали има акаунт за този provider → показва „свързан" бадж или форма.
- „Провери връзка" → `testCourierConnection(provider)` → toast success/error (sonner, установен стандарт).

- [ ] **Step 2: Add tab to fulfillment page**

Прочети `src/app/(dashboard)/dashboard/fulfillment/page.tsx` (табове Доставка/Плащане/Поръчки-връщания). Добави 4-ти таб „Куриери":
- Зареди `getCourierAccounts(shop.id)`.
- Нов `TabPanel` с `<CourierAccounts accounts={accounts} />`.
- Добави таба в `Tabs` листа (следвай съществуващия `ui/Tabs` паттерн + `?tab=` URL).

- [ ] **Step 3: Courier/target полета на метода**

В `src/components/dashboard/fulfillment-manager.tsx`, при формата за куриерски метод (`type === "courier"`), добави 2 полета (само ако магазинът има поне един свързан куриер — подай `hasCourier` prop):
- `Select` „Куриер" (Еконт/Спиди/„Ръчно (без куриер)") → `courierProvider`.
- `Select` „Доставка до" (адрес/офис) → `deliveryTarget`.
Разшири `shippingMethodSchema` (`src/schemas/fulfillment.ts`) с `courierProvider` (nullable enum) + `deliveryTarget` (enum, default "address"). Разшири `saveShippingMethod` action да ги записва.

- [ ] **Step 4: Verify gate**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/components/dashboard/courier-accounts.tsx" "src/app/(dashboard)/dashboard/fulfillment/page.tsx" "src/components/dashboard/fulfillment-manager.tsx" src/schemas/fulfillment.ts src/actions/fulfillment.ts
git commit -F - <<'EOF'
feat(courier): dashboard таб „Куриери" + courier/target на метода

Карти Еконт/Спиди (ключове + подател + провери връзка + изтрий); куриерски метод
получава Куриер + Доставка до (адрес/офис). Ключовете маскирани.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: Checkout — офис picker + Zod refine + сървърна валидация

**Files:**
- Modify: `src/schemas/order.ts:4-36`
- Create: `src/components/storefront/courier-office-picker.tsx`
- Modify: `src/components/storefront/checkout-form.tsx`
- Modify: `src/actions/orders.ts` (createOrder — валидация + снапшот)

**Interfaces:**
- Consumes: `searchCachedOffices`/`refreshOffices` (Task 6), `Office` (Task 3).
- Produces: `orderSchema` с `courierOfficeId`/`courierOfficeName` + refine.

- [ ] **Step 1: Extend orderSchema (Zod refine)**

В `src/schemas/order.ts`, добави в `orderSchema` полетата (след `city`):
```ts
  /** Куриерски офис (само при office-based метод — refine-ва се на сървъра по метода). */
  courierOfficeId: z.string().trim().max(50).default(""),
  courierOfficeName: z.string().trim().max(200).default(""),
```
Забележка: „задължителен само ако методът е office" не може да се refine-не тук (нямаме метода в схемата) → валидира се в `createOrder` (Step 4), както зоните сега. Тестът за refine е на ниво action.

- [ ] **Step 2: Office picker component**

Прочети `src/components/storefront/sf-address-autocomplete.tsx` за паттерна. Създай `src/components/storefront/courier-office-picker.tsx`:
- Props: `provider`, `onSelect(office: { officeId; officeName })`, `--sf-*` токени.
- Input за град → при въвеждане вика server action-обвивка около `searchCachedOffices` (или директно fetch към route) → dropdown с офисите → избор сетва стойността.
- Празен кеш → показва „Зареждам офиси…" + тригерва `refreshOffices` веднъж, после reload.
- Graceful degrade: грешка → текстово поле (свободен офис).

- [ ] **Step 3: Wire into checkout-form**

В `src/components/storefront/checkout-form.tsx`, при избран метод с `deliveryTarget === "office"`, покажи `<CourierOfficePicker provider={method.courierProvider} onSelect={...} />` вместо/до address autocomplete. Сетни `courierOfficeId`/`courierOfficeName` в form state. Подай `courierProvider`/`deliveryTarget` на метода към клиента (разшири `getShippingMethods` селекта, ако липсват).

- [ ] **Step 4: Server validation + snapshot (createOrder)**

Прочети `src/actions/orders.ts` около редове 175-214 (метод + зона resolve). Добави: ако избраният метод е `deliveryTarget === "office"` и `courierOfficeId` е празен → върни грешка „Избери офис на куриера" (както зоните блокират „Избери зона"). При валиден офис → снапшот в поръчката:
```ts
courierProvider: method.courierProvider ?? null,
courierOfficeId: input.courierOfficeId || null,
courierOfficeName: input.courierOfficeName || null,
```
(в insert-а на поръчката, при другите shipping снапшоти `shippingName`/`shippingPriceCents`).

- [ ] **Step 5: Verify gate**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/order.ts "src/components/storefront/courier-office-picker.tsx" "src/components/storefront/checkout-form.tsx" src/actions/orders.ts
git commit -F - <<'EOF'
feat(courier): checkout офис picker + сървърна валидация + снапшот

Office-based метод → търсене на офис по град (кеширан); празен офис блокира поръчката
(както зоните). Снапшот на офиса в поръчката. Graceful degrade към текст.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: Генериране на товарителница

**Files:**
- Create: `src/actions/waybills.ts`
- Modify: `src/app/(dashboard)/dashboard/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `getCourierAccount` (Task 6), `getCourier` (Task 5), `aggregateOrderWeight`/`resolveCodAmount` (Task 2), `getOrderWithItems`.
- Produces: `generateWaybill(orderId): Promise<{ ok?: boolean; error?: string; trackingUrl?: string }>`.

- [ ] **Step 1: generateWaybill action**

Създай `src/actions/waybills.ts`:
```ts
"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, orders, products } from "@/db";
import { getOrderWithItems } from "@/db/queries/orders";
import { getCourierAccount } from "@/db/queries/couriers";
import { requireShop } from "@/lib/auth";
import { getCourier } from "@/lib/couriers";
import { aggregateOrderWeight, resolveCodAmount } from "@/lib/courier-weight";

const FALLBACK_WEIGHT_GRAMS = 500;

export async function generateWaybill(
  orderId: string,
): Promise<{ ok?: boolean; error?: string; trackingUrl?: string }> {
  const { shop } = await requireShop();
  const order = await getOrderWithItems(orderId, shop.id);
  if (!order) return { error: "Поръчката не е намерена." };
  if (order.waybillId) {
    /* Идемпотентност: вече има товарителница → не дублирай. */
    const courier = order.courierProvider ? getCourier(order.courierProvider) : null;
    return { ok: true, trackingUrl: courier && order.trackingNumber ? courier.trackingUrl(order.trackingNumber) : undefined };
  }
  if (!order.courierProvider) return { error: "Методът на доставка не е куриерски." };

  const account = await getCourierAccount(shop.id, order.courierProvider);
  if (!account) return { error: "Няма свързан куриерски акаунт." };

  /* Тегло: сумирай от продуктите (fallback за липсващо). */
  const productIds = order.items.map((i) => i.productId).filter((id): id is string => id != null);
  const rows = productIds.length
    ? await db.select({ id: products.id, weightGrams: products.weightGrams }).from(products).where(inArray(products.id, productIds))
    : [];
  const weights = new Map(rows.map((r) => [r.id, r.weightGrams]));
  const weightGrams = aggregateOrderWeight(
    order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    weights,
    FALLBACK_WEIGHT_GRAMS,
  );

  const codCents = resolveCodAmount(order.paymentType, order.totalCents);

  try {
    const courier = getCourier(order.courierProvider);
    const result = await courier.createWaybill(
      {
        receiverName: order.customerName,
        receiverPhone: order.customerPhone,
        officeId: order.courierOfficeId,
        address: order.address,
        city: order.city,
        sender: {
          name: account.senderName,
          phone: account.senderPhone,
          city: account.senderCity,
          address: account.senderAddress,
        },
        weightGrams,
        codCents,
        contents: `Поръчка ${order.orderNumber}`,
      },
      account.credentials as Record<string, string>,
    );

    await db
      .update(orders)
      .set({ waybillId: result.waybillId, trackingNumber: result.trackingNumber, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    revalidatePath(`/dashboard/orders/${orderId}`);
    return { ok: true, trackingUrl: courier.trackingUrl(result.trackingNumber) };
  } catch (err) {
    console.error(JSON.stringify({ scope: "generate-waybill", orderId, error: String(err) }));
    return { error: "Товарителницата не може да се създаде сега. Опитай пак." };
  }
}
```
Забележка: сверявай сигнатурата на `getOrderWithItems(orderId, shopId)` с реалната в `src/db/queries/orders.ts` (tenant guard по shopId е задължителен). Ако връща различна структура (`items`/`orderItems`), адаптирай.

- [ ] **Step 2: Button on order detail**

Прочети `src/app/(dashboard)/dashboard/orders/[id]/page.tsx` (има „Печат" линк + `OrderActions`). Добави клиентски бутон „Генерирай товарителница" (нов малък client компонент, който вика `generateWaybill(orderId)` + toast + показва tracking линк при успех). Показвай го само при `order.courierProvider != null` и статус, който позволява (`confirmed`). Ако `order.waybillId` вече е зададен → покажи „Товарителница №… · Проследи" вместо бутона.

- [ ] **Step 3: Verify gate**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/actions/waybills.ts" "src/app/(dashboard)/dashboard/orders/[id]/page.tsx"
git commit -F - <<'EOF'
feat(courier): generateWaybill action + бутон на поръчката

Агрегира тегло (fallback), авто COD при наложен платеж, вика courier.createWaybill,
записва waybillId/trackingNumber. Идемпотентен (не дублира). Tracking линк при успех.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 10: Финален гейт + валидация

- [ ] **Step 1: Full gate**

Run: `pnpm check`
Expected: PASS (lint + всички unit тестове вкл. courier-weight/econt/speedy + build).

- [ ] **Step 2: Съобщи на потребителя (чака външно)**

Кодът е готов, но чака:
1. Регистрация в Еконт + Спиди → API ключове (username/password или token).
2. Въвеждане на ключовете от търговеца в /dashboard/fulfillment → таб „Куриери" → „Провери връзка".
3. **Свери реалните API полета** на Econt/Speedy (Task 4/5 mapping-ите) при първото живо тестване — mock тестовете проверяват нашата логика, но реалните payload-и трябва да минат срещу истинското API.

Ръчна проверка на живо (със свързан акаунт):
- Таб „Куриери" → въведи Еконт ключове → „Провери връзка" → зелено.
- Създай куриерски метод „до офис" с Еконт.
- Checkout → избери метода → търси офис по град → избери → поръчай.
- Поръчка → „Генерирай товарителница" → PDF + tracking; втори клик → не дублира.
- COD поръчка → товарителницата носи total-а; превод → без COD.

Push към `dev` (=prod) само след разрешение.

---

## Notes for the implementer

- **Куриерските API полета (Task 4/5)** са скелет по публично известната структура на Econt/Speedy; сверявай с официалната документация при имплементация. Mock тестовете гарантират НАШАТА логика (парсване/mapping/грешки), не реалния API контракт — това е нарочно (нямаме ключове при писане).
- Всичко ново е nullable → съществуващите методи/поръчки/магазини работят непроменени.
- Ключовете НИКОГА не се логват, не отиват към клиента, маскирани в UI.
- COD сумата = `orders.totalCents` (вече включва доставка/отстъпки) — не преизчислявай.
- `getCourier(provider)` е единствената точка, която знае за конкретен куриер; UI/actions работят с интерфейса.
- `courier_offices` има `uniqueIndex(provider, officeId)` (Task 1) → refresh-ът upsert-ва (`onConflictDoUpdate`), не дублира.
