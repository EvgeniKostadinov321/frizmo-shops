# Онлайн картично плащане (ePay.bg) — имплементационен план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline изпълнение). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Купувач плаща поръчка с карта през ePay.bg; парите отиват директно при търговеца (Модел А); поръчката се потвърждава от webhook, не от redirect.

**Architecture:** Pluggable `PaymentProvider` интерфейс + registry (по същия pattern като `CourierProvider`). Per-shop ePay ключове (KIN+secret) в `shop_payment_accounts`. `createOrder` за `online_card` създава поръчка в статус `pending_payment` + резервира наличността + `payment_intent`, после връща ePay redirect пакет (HMAC-SHA1 подпис). ePay нотификация → `/api/payments/epay/notify` проверява подписа със secret-а на магазина, сверява сумата, идемпотентно потвърждава (`pending_payment→new`) или отменя (restock). Cron auto-cancel-ва неплатените след 2ч.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres + Drizzle (`db:push`), Zod, `node:crypto` (HMAC-SHA1), Vitest, Playwright, pnpm.

## Global Constraints

- Спец: `docs/superpowers/specs/2026-07-13-online-payments-design.md` (одобрен 2026-07-13).
- **Модел А:** платформата НИКОГА не докосва парите; всеки търговец си има свой ePay акаунт (KIN+secret). Парите отиват директно при него.
- **Multi-tenant изолация правило №1:** всяка заявка/мутация филтрира по `shopId`; cross-tenant достъп = критичен бъг. Мутации САМО в `src/actions/`, всяка през `requireShop()` (dashboard) — освен публичните endpoint-и (webhook).
- **Пари:** integer евроцентове (EUR) навсякъде; никога float в бизнес логика. ePay `AMOUNT` = `cents/100` с 2 десетични знака.
- **Валута към ePay: EUR** (`CURRENCY=EUR`). Отворен въпрос до живата проверка (ако ePay иска BGN → конверсия по 1.95583; НЕ в този план).
- **Ключове:** per-shop в базата (`credentials` jsonb), никога `NEXT_PUBLIC_`, никога логвани, маскирани в UI. DEV demo ключове само в `.env.local`.
- **Webhook = единственият източник на истина за „платено".** Redirect (URL_OK) не се доверява.
- **Идемпотентност:** ePay нотификацията може да дойде няколко пъти → `payment_intents.providerRef` unique + status guard.
- Нови таблици `.enableRLS()`. Нови колони/enum членове/статуси → безопасен `db:push` (без разрушаване).
- `"use server"` файл експортира САМО async функции (чистите → `src/lib/`).
- Тестове живеят до кода (`src/**/*.test.ts`), НЕ в `tests/`. Единичен тест: `npx vitest run <path>`.
- `db:push`: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push` (drizzle-kit не чете `.env.local` сам).
- UI текстове на български с типографски кавички „…“ (прав `"` чупи lint/JS).
- Гейт преди всеки commit: `pnpm check` (lint + unit + build). Push към `dev` (=prod) само след разрешение — НЕ в плана.
- Числово съгласуване през `src/lib/plural.ts` (`count(n, NOUNS.x)`).

## Файлова структура

**Създаваме:**
- `src/lib/payments/types.ts` — `PaymentProvider` интерфейс + типове (`PaymentId`, `PaymentCreds`, `PaymentPackage`, `PaymentNotification`, `PaymentError`)
- `src/lib/payments/epay-signature.ts` — чисти функции (HMAC-SHA1, ENCODED base64, `toEpayAmount`, build/parse на данни, статус мапинг) — TDD без мрежа
- `src/lib/payments/epay.ts` — ePay провайдър (`buildPackage`, `parseNotification`)
- `src/lib/payments/index.ts` — registry (`getPaymentProvider(id)`) + re-export на types
- `src/schemas/payment-account.ts` — Zod схема (KIN + secret)
- `src/db/queries/payment-accounts.ts` — `getShopPaymentAccount(shopId, provider)`
- `src/actions/payment-account.ts` — dashboard мутации (`savePaymentAccount`, `deletePaymentAccount`)
- `src/app/api/payments/epay/notify/route.ts` — webhook (публичен, CHECKSUM-защитен)
- `src/app/api/cron/expire-payments/route.ts` — reconciliation cron (гард `CRON_SECRET`)
- `src/db/queries/payment-reconcile.ts` — `getExpiredPendingOrders(olderThanMs, limit)`
- `src/components/dashboard/payment-accounts.tsx` — dashboard таб UI

**Модифицираме:**
- `src/db/schema.ts` — enum `online_card`; order статус `pending_payment`; таблици `shop_payment_accounts`, `payment_intents`
- `src/schemas/fulfillment.ts` — `PAYMENT_TYPES` + `online_card`
- `src/actions/orders.ts` — `createOrder` онлайн клон (pending + intent + пакет); `ALLOWED_TRANSITIONS` (`pending_payment`)
- `src/lib/order-status.ts` (ако има) / статус етикети — `pending_payment` етикет
- `src/components/storefront/checkout-form.tsx` — онлайн метод → auto-submit форма към ePay
- `src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx` — статус „Чака плащане"/„Платена"
- `src/app/api/cron/abandoned-carts/route.ts` — (без промяна; отделен cron)
- `vercel.json` — cron `expire-payments`
- `.env.local` — `EPAY_API_BASE`, `EPAY_DEMO_KIN`, `EPAY_DEMO_SECRET` (DEV, коментирани)

---

### Task 1: Чисти функции — ePay подпис/кодиране (`epay-signature.ts`)

**Files:**
- Create: `src/lib/payments/epay-signature.ts`
- Test: `src/lib/payments/epay-signature.test.ts`

**Interfaces:**
- Produces:
  - `toEpayAmount(cents: number): string` — центове → "12.50" (2 десетични, точка)
  - `encodeData(fields: Record<string, string>): string` — редове `KEY=VALUE\n` → base64 (без EOL)
  - `hmacSha1(encoded: string, secret: string): string` — base64 на HMAC-SHA1
  - `verifyChecksum(encoded: string, checksum: string, secret: string): boolean` — timing-safe
  - `decodeData(encoded: string): Record<string, string>` — base64 → парсва `KEY=VALUE` редове
  - `mapEpayStatus(status: string): "paid" | "denied" | "expired" | "unknown"` — `PAID→paid`, `DENIED→denied`, `EXPIRED→expired`, друго→`unknown`

- [ ] **Step 1: Write the failing test**

`src/lib/payments/epay-signature.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  decodeData,
  encodeData,
  hmacSha1,
  mapEpayStatus,
  toEpayAmount,
  verifyChecksum,
} from "@/lib/payments/epay-signature";

describe("epay-signature", () => {
  it("toEpayAmount: центове → 2 десетични с точка", () => {
    expect(toEpayAmount(1250)).toBe("12.50");
    expect(toEpayAmount(2000)).toBe("20.00");
    expect(toEpayAmount(5)).toBe("0.05");
  });

  it("encodeData → base64, decodeData го връща обратно", () => {
    const fields = { MIN: "1234567890", INVOICE: "42", AMOUNT: "12.50" };
    const encoded = encodeData(fields);
    expect(typeof encoded).toBe("string");
    expect(decodeData(encoded)).toMatchObject(fields);
  });

  it("hmacSha1 е стабилен за същия вход", () => {
    const a = hmacSha1("ABC", "secret");
    const b = hmacSha1("ABC", "secret");
    expect(a).toBe(b);
    expect(hmacSha1("ABC", "other")).not.toBe(a);
  });

  it("verifyChecksum приема верен и отхвърля грешен подпис", () => {
    const encoded = encodeData({ INVOICE: "42", STATUS: "PAID" });
    const good = hmacSha1(encoded, "secret");
    expect(verifyChecksum(encoded, good, "secret")).toBe(true);
    expect(verifyChecksum(encoded, good, "wrong")).toBe(false);
    expect(verifyChecksum(encoded, "deadbeef", "secret")).toBe(false);
  });

  it("mapEpayStatus мапва познатите статуси", () => {
    expect(mapEpayStatus("PAID")).toBe("paid");
    expect(mapEpayStatus("DENIED")).toBe("denied");
    expect(mapEpayStatus("EXPIRED")).toBe("expired");
    expect(mapEpayStatus("WHATEVER")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/payments/epay-signature.test.ts`
Expected: FAIL — модулът липсва.

- [ ] **Step 3: Implement**

`src/lib/payments/epay-signature.ts`:
```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/** Центове (EUR) → ePay AMOUNT ("12.50" — 2 десетични, точка). */
export function toEpayAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** { KEY: VALUE } → base64 на редове „KEY=VALUE" (\n разделител, без крайен EOL). */
export function encodeData(fields: Record<string, string>): string {
  const data = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  return Buffer.from(data, "utf8").toString("base64");
}

/** base64 → { KEY: VALUE } (парсва „KEY=VALUE" редовете; стойности може да съдържат „="). */
export function decodeData(encoded: string): Record<string, string> {
  const data = Buffer.from(encoded, "base64").toString("utf8");
  const out: Record<string, string> = {};
  for (const line of data.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

/** base64 на HMAC-SHA1(encoded, secret) — форматът, който ePay очаква за CHECKSUM. */
export function hmacSha1(encoded: string, secret: string): string {
  return createHmac("sha1", secret).update(encoded).digest("base64");
}

/** Timing-safe сравнение на очаквания CHECKSUM с получения. */
export function verifyChecksum(encoded: string, checksum: string, secret: string): boolean {
  const expected = hmacSha1(encoded, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(checksum);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** ePay STATUS → вътрешен статус на payment_intent. */
export function mapEpayStatus(status: string): "paid" | "denied" | "expired" | "unknown" {
  switch (status.trim().toUpperCase()) {
    case "PAID":
      return "paid";
    case "DENIED":
      return "denied";
    case "EXPIRED":
      return "expired";
    default:
      return "unknown";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/payments/epay-signature.test.ts`
Expected: PASS (5 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments/epay-signature.ts src/lib/payments/epay-signature.test.ts
git commit -m "feat(payments): чисти функции за ePay подпис/кодиране (HMAC-SHA1, base64)"
```

---

### Task 2: `PaymentProvider` интерфейс + ePay провайдър + registry

**Files:**
- Create: `src/lib/payments/types.ts`
- Create: `src/lib/payments/epay.ts`
- Create: `src/lib/payments/index.ts`
- Test: `src/lib/payments/epay.test.ts`

**Interfaces:**
- Consumes: `epay-signature.ts` (Task 1).
- Produces:
  - `PaymentId = "epay"`
  - `PaymentCreds = { kin: string; secret: string }`
  - `PaymentPackage = { actionUrl: string; fields: Record<string, string> }` — `fields` е готовото form body (PAGE/ENCODED/CHECKSUM/URL_OK/URL_CANCEL)
  - `BuildPackageInput = { invoice: string; amountCents: number; description: string; expSeconds: number; urlOk: string; urlCancel: string }`
  - `PaymentNotification = { invoice: string; status: "paid"|"denied"|"expired"|"unknown"; amountCents: number | null; raw: Record<string, string> }`
  - `PaymentProvider` интерфейс: `id`; `buildPackage(input, creds, apiBase): PaymentPackage`; `parseNotification(body, creds): PaymentNotification | null` (null = невалиден подпис)
  - `getPaymentProvider(id: PaymentId): PaymentProvider`
  - `class PaymentError extends Error`

- [ ] **Step 1: Write the failing test**

`src/lib/payments/epay.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { hmacSha1, encodeData } from "@/lib/payments/epay-signature";
import { getPaymentProvider } from "@/lib/payments";

const CREDS = { kin: "1234567890", secret: "topsecret" };

describe("epay провайдър", () => {
  const epay = getPaymentProvider("epay");

  it("buildPackage връща actionUrl + подписан пакет", () => {
    const pkg = epay.buildPackage(
      {
        invoice: "42",
        amountCents: 1250,
        description: "Поръчка №42",
        expSeconds: 7200,
        urlOk: "https://x/ok",
        urlCancel: "https://x/cancel",
      },
      CREDS,
      "https://demo.epay.bg",
    );
    expect(pkg.actionUrl).toContain("demo.epay.bg");
    expect(pkg.fields.PAGE).toBe("paylogin");
    expect(pkg.fields.ENCODED).toBeTruthy();
    expect(pkg.fields.CHECKSUM).toBe(hmacSha1(pkg.fields.ENCODED, CREDS.secret));
    expect(pkg.fields.URL_OK).toBe("https://x/ok");
  });

  it("parseNotification валидира подписа и връща статуса", () => {
    const encoded = encodeData({ INVOICE: "42", STATUS: "PAID", AMOUNT: "12.50" });
    const checksum = hmacSha1(encoded, CREDS.secret);
    const note = epay.parseNotification({ encoded, checksum }, CREDS);
    expect(note).not.toBeNull();
    expect(note!.invoice).toBe("42");
    expect(note!.status).toBe("paid");
    expect(note!.amountCents).toBe(1250);
  });

  it("parseNotification връща null при грешен подпис", () => {
    const encoded = encodeData({ INVOICE: "42", STATUS: "PAID" });
    const note = epay.parseNotification({ encoded, checksum: "bad" }, CREDS);
    expect(note).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/payments/epay.test.ts`
Expected: FAIL — модулите липсват.

- [ ] **Step 3: Implement types**

`src/lib/payments/types.ts`:
```ts
export type PaymentId = "epay";

/** Ключове от shop_payment_accounts.credentials (jsonb). */
export type PaymentCreds = { kin: string; secret: string };

/** Готов ePay пакет за auto-submit форма от клиента. */
export interface PaymentPackage {
  actionUrl: string;
  fields: Record<string, string>;
}

export interface BuildPackageInput {
  /** ePay INVOICE — поредният номер на поръчката (per-shop уникален). */
  invoice: string;
  amountCents: number;
  description: string;
  /** Валидност на плащането в секунди (EXP_TIME). */
  expSeconds: number;
  urlOk: string;
  urlCancel: string;
}

export interface PaymentNotification {
  invoice: string;
  status: "paid" | "denied" | "expired" | "unknown";
  amountCents: number | null;
  raw: Record<string, string>;
}

export interface PaymentProvider {
  id: PaymentId;
  /** Строи подписан redirect пакет със secret-а на магазина. */
  buildPackage(input: BuildPackageInput, creds: PaymentCreds, apiBase: string): PaymentPackage;
  /** Валидира подписа на нотификацията; null = невалиден (не се доверяваме). */
  parseNotification(
    body: { encoded: string; checksum: string },
    creds: PaymentCreds,
  ): PaymentNotification | null;
}

/** Платежна грешка — общо BG съобщение навън, детайл в лог. */
export class PaymentError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
```

- [ ] **Step 4: Implement ePay провайдър**

`src/lib/payments/epay.ts`:
```ts
import {
  decodeData,
  encodeData,
  hmacSha1,
  mapEpayStatus,
  toEpayAmount,
  verifyChecksum,
} from "./epay-signature";
import type { BuildPackageInput, PaymentCreds, PaymentPackage, PaymentProvider } from "./types";

/** Строи ePay paylogin пакета: ENCODED(данни) + CHECKSUM(secret). */
function buildPackage(
  input: BuildPackageInput,
  creds: PaymentCreds,
  apiBase: string,
): PaymentPackage {
  /* EXP_TIME е абсолютен unix timestamp в секунди (сега + expSeconds). Смята се
     при извикването (не в тест — тук е ОК, извиква се от createOrder на сървъра). */
  const expTime = Math.floor(Date.now() / 1000) + input.expSeconds;
  const encoded = encodeData({
    MIN: creds.kin,
    INVOICE: input.invoice,
    AMOUNT: toEpayAmount(input.amountCents),
    CURRENCY: "EUR",
    EXP_TIME: String(expTime),
    DESCR: input.description,
  });
  return {
    actionUrl: `${apiBase.replace(/\/$/, "")}/`,
    fields: {
      PAGE: "paylogin",
      ENCODED: encoded,
      CHECKSUM: hmacSha1(encoded, creds.secret),
      URL_OK: input.urlOk,
      URL_CANCEL: input.urlCancel,
    },
  };
}

/** Валидира подписа на нотификацията и вади INVOICE/STATUS/AMOUNT. */
function parseNotification(
  body: { encoded: string; checksum: string },
  creds: PaymentCreds,
) {
  if (!body.encoded || !body.checksum) return null;
  if (!verifyChecksum(body.encoded, body.checksum, creds.secret)) return null;
  const raw = decodeData(body.encoded);
  const amount = raw.AMOUNT ? Math.round(Number(raw.AMOUNT) * 100) : null;
  return {
    invoice: raw.INVOICE ?? "",
    status: mapEpayStatus(raw.STATUS ?? ""),
    amountCents: Number.isFinite(amount) ? amount : null,
    raw,
  };
}

export const epay: PaymentProvider = { id: "epay", buildPackage, parseNotification };
```

- [ ] **Step 5: Implement registry**

`src/lib/payments/index.ts`:
```ts
import { epay } from "./epay";
import type { PaymentId, PaymentProvider } from "./types";

const REGISTRY: Record<PaymentId, PaymentProvider> = { epay };

export function getPaymentProvider(id: PaymentId): PaymentProvider {
  return REGISTRY[id];
}

export * from "./types";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/payments/epay.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 7: Commit**

```bash
git add src/lib/payments/types.ts src/lib/payments/epay.ts src/lib/payments/index.ts src/lib/payments/epay.test.ts
git commit -m "feat(payments): PaymentProvider интерфейс + ePay провайдър + registry"
```

---

### Task 3: Схема — `online_card` тип, `pending_payment` статус, таблици

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/schemas/fulfillment.ts` (PAYMENT_TYPES)
- Test: `src/db/payment-schema.test.ts`

**Interfaces:**
- Produces: `paymentTypeEnum` + `online_card`; `orderStatusEnum` + `pending_payment`; таблици `shopPaymentAccounts`, `paymentIntents`; типове `ShopPaymentAccount`, `PaymentIntent`.

- [ ] **Step 1: Write the failing test**

`src/db/payment-schema.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { paymentIntents, shopPaymentAccounts } from "@/db";
import { paymentTypeEnum } from "@/db/schema";

describe("payment схема", () => {
  it("shopPaymentAccounts има shopId + provider + credentials", () => {
    expect(shopPaymentAccounts.shopId).toBeDefined();
    expect(shopPaymentAccounts.provider).toBeDefined();
    expect(shopPaymentAccounts.credentials).toBeDefined();
  });
  it("paymentIntents има orderId + providerRef + amountCents + status", () => {
    expect(paymentIntents.orderId).toBeDefined();
    expect(paymentIntents.providerRef).toBeDefined();
    expect(paymentIntents.amountCents).toBeDefined();
    expect(paymentIntents.status).toBeDefined();
  });
  it("online_card е валиден платежен тип", () => {
    expect(paymentTypeEnum.enumValues).toContain("online_card");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/payment-schema.test.ts`
Expected: FAIL — таблиците/типът липсват.

- [ ] **Step 3: Разшири enum-ите**

В `src/db/schema.ts` смени `paymentTypeEnum` (ред ~276):
```ts
export const paymentTypeEnum = pgEnum("payment_type", [
  "cod",
  "bank_transfer",
  "on_site",
  "online_card",
]);
```
И `orderStatusEnum` (ред ~277) — добави `pending_payment` ПЪРВО:
```ts
export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "new",
  "confirmed",
  "shipped",
  "completed",
  "cancelled",
  "return_requested",
  "returned",
]);
```

- [ ] **Step 4: Добави платежен провайдър enum + таблиците**

В `src/db/schema.ts`, веднага СЛЕД `export type CourierOffice = ...` (ред ~336) добави:
```ts
/* Онлайн картично плащане (ePay) — per-shop акаунт + плащане-намерение (Модел А). */
export const paymentProviderEnum = pgEnum("payment_provider", ["epay"]);

/** Per-shop платежен акаунт (KIN + secret). Tenant-изолиран; ключове само сървърно. */
export const shopPaymentAccounts = pgTable(
  "shop_payment_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    /** { kin, secret } — само сървърно, никога NEXT_PUBLIC_, маскирани в UI. */
    credentials: jsonb("credentials").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("shop_payment_provider_idx").on(t.shopId, t.provider)],
).enableRLS();

export type ShopPaymentAccount = typeof shopPaymentAccounts.$inferSelect;

export const paymentIntentStatusEnum = pgEnum("payment_intent_status", [
  "pending",
  "paid",
  "denied",
  "expired",
]);

/** Плащане-намерение: одит + идемпотентност (providerRef unique) + reconciliation. */
export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    /** ePay INVOICE (= поредният номер на поръчката). Unique per provider. */
    providerRef: text("provider_ref").notNull(),
    /** Очаквана сума в центове — сверяваме срещу нотификацията. */
    amountCents: integer("amount_cents").notNull(),
    status: paymentIntentStatusEnum("status").notNull().default("pending"),
    /** Суровата нотификация (одит/дебъг). */
    rawNotification: jsonb("raw_notification"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_intents_ref_idx").on(t.provider, t.providerRef),
    index("payment_intents_order_idx").on(t.orderId),
    index("payment_intents_shop_idx").on(t.shopId),
  ],
).enableRLS();

export type PaymentIntent = typeof paymentIntents.$inferSelect;
```
(Забележка: `orders` е дефинирана по-надолу в файла, но Drizzle позволява forward reference през `() => orders.id` callback — точно както `orderItems` реферира `orders`.)

- [ ] **Step 5: PAYMENT_TYPES + paymentMethodSchema в fulfillment схемата**

В `src/schemas/fulfillment.ts` добави `online_card` НА ДВЕ места:

(а) `PAYMENT_TYPES` масива (е `as const` — добави реда преди `] as const;`):
```ts
export const PAYMENT_TYPES = [
  { value: "cod", label: "Наложен платеж" },
  { value: "bank_transfer", label: "Банков превод" },
  { value: "on_site", label: "Плащане на място" },
  { value: "online_card", label: "Карта (ePay)" },
] as const;
```

(б) `paymentMethodSchema.type` enum-а (иначе dashboard-ът не може да създаде online_card метод):
```ts
    type: z.enum(["cod", "bank_transfer", "on_site", "online_card"]),
```
(останалото на `paymentMethodSchema` — `superRefine` за IBAN — остава непроменено; `online_card` не иска details.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/db/payment-schema.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 7: Приложи схемата**

Run: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push`
Expected: „Changes applied" (2 нови таблици + 2 нови enum-а + разширени 2 enum-а).

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/schemas/fulfillment.ts src/db/payment-schema.test.ts
git commit -m "feat(payments): схема — online_card, pending_payment, shop_payment_accounts, payment_intents"
```

---

### Task 4: Zod схема + query за платежен акаунт

**Files:**
- Create: `src/schemas/payment-account.ts`
- Create: `src/db/queries/payment-accounts.ts`
- Test: `src/schemas/payment-account.test.ts`

**Interfaces:**
- Consumes: `shopPaymentAccounts` (Task 3).
- Produces:
  - `paymentAccountSchema` (Zod): `{ kin: string; secret: string }`
  - `PaymentAccountInput = z.infer<...>`
  - `getShopPaymentAccount(shopId: string, provider: PaymentId): Promise<ShopPaymentAccount | undefined>`

- [ ] **Step 1: Write the failing test**

`src/schemas/payment-account.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { paymentAccountSchema } from "@/schemas/payment-account";

describe("paymentAccountSchema", () => {
  it("приема валиден KIN + secret", () => {
    const r = paymentAccountSchema.safeParse({ kin: "1234567890", secret: "s3cr3t" });
    expect(r.success).toBe(true);
  });
  it("отхвърля празен KIN", () => {
    expect(paymentAccountSchema.safeParse({ kin: "", secret: "s" }).success).toBe(false);
  });
  it("отхвърля празен secret", () => {
    expect(paymentAccountSchema.safeParse({ kin: "123", secret: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/schemas/payment-account.test.ts`
Expected: FAIL — схемата липсва.

- [ ] **Step 3: Implement схемата**

`src/schemas/payment-account.ts`:
```ts
import { z } from "zod";

export const paymentAccountSchema = z.object({
  /** ePay клиентски идентификационен номер (KIN/MIN). */
  kin: z.string().trim().min(1, "Въведи КИН").max(64),
  /** ePay secret word (тайната дума за подписване). */
  secret: z.string().trim().min(1, "Въведи тайната дума").max(200),
});

export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;
```

- [ ] **Step 4: Implement query**

`src/db/queries/payment-accounts.ts`:
```ts
import { and, eq } from "drizzle-orm";
import { db, shopPaymentAccounts, type ShopPaymentAccount } from "@/db";
import type { PaymentId } from "@/lib/payments";

/** Платежният акаунт на магазина за даден провайдър (undefined = няма). */
export async function getShopPaymentAccount(
  shopId: string,
  provider: PaymentId,
): Promise<ShopPaymentAccount | undefined> {
  return db.query.shopPaymentAccounts.findFirst({
    where: and(
      eq(shopPaymentAccounts.shopId, shopId),
      eq(shopPaymentAccounts.provider, provider),
    ),
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/schemas/payment-account.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 6: Commit**

```bash
git add src/schemas/payment-account.ts src/db/queries/payment-accounts.ts src/schemas/payment-account.test.ts
git commit -m "feat(payments): Zod схема + query за платежен акаунт"
```

---

### Task 5: Dashboard мутации — save/delete платежен акаунт

**Files:**
- Create: `src/actions/payment-account.ts`
- Test: `src/actions/payment-account.test.ts`

**Interfaces:**
- Consumes: `requireShop()`, `paymentAccountSchema` (Task 4), `shopPaymentAccounts` (Task 3).
- Produces:
  - `type PaymentAccountState = { error?: string; ok?: boolean }`
  - `savePaymentAccount(_prev: PaymentAccountState, formData: FormData): Promise<PaymentAccountState>` — upsert по shop+provider("epay")
  - `deletePaymentAccount(): Promise<void>`

- [ ] **Step 1: Write the failing test**

`src/actions/payment-account.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireShop, insertValues, onConflict, deleteWhere } = vi.hoisted(() => ({
  requireShop: vi.fn(),
  onConflict: vi.fn().mockResolvedValue(undefined),
  insertValues: vi.fn(),
  deleteWhere: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({ requireShop }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    delete: () => ({ where: deleteWhere }),
  },
  shopPaymentAccounts: { shopId: "shopId", provider: "provider" },
}));

import { requireShop as rs } from "@/lib/auth";
import { savePaymentAccount, deletePaymentAccount } from "@/actions/payment-account";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

describe("savePaymentAccount", () => {
  beforeEach(() => {
    (rs as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      shop: { id: "shop1" },
    });
    insertValues.mockReturnValue({ onConflictDoUpdate: onConflict });
    onConflict.mockClear();
  });

  it("записва валиден акаунт (upsert)", async () => {
    const res = await savePaymentAccount({}, fd({ kin: "1234567890", secret: "s3cr3t" }));
    expect(res.ok).toBe(true);
    expect(insertValues).toHaveBeenCalled();
  });

  it("отхвърля празен KIN", async () => {
    const res = await savePaymentAccount({}, fd({ kin: "", secret: "s" }));
    expect(res.error).toBeTruthy();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("deletePaymentAccount трие по shop+provider", async () => {
    await deletePaymentAccount();
    expect(deleteWhere).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/actions/payment-account.test.ts`
Expected: FAIL — действията липсват.

- [ ] **Step 3: Implement**

`src/actions/payment-account.ts`:
```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, shopPaymentAccounts } from "@/db";
import { requireShop } from "@/lib/auth";
import { paymentAccountSchema } from "@/schemas/payment-account";

export type PaymentAccountState = { error?: string; ok?: boolean };

/** Записва/обновява ePay акаунт (upsert по shop+provider). Ключовете не се логват. */
export async function savePaymentAccount(
  _prev: PaymentAccountState,
  formData: FormData,
): Promise<PaymentAccountState> {
  const { shop } = await requireShop();
  const parsed = paymentAccountSchema.safeParse({
    kin: formData.get("kin"),
    secret: formData.get("secret"),
  });
  if (!parsed.success) return { error: "Провери въведените данни." };

  const credentials = { kin: parsed.data.kin, secret: parsed.data.secret };
  await db
    .insert(shopPaymentAccounts)
    .values({ shopId: shop.id, provider: "epay", credentials })
    .onConflictDoUpdate({
      target: [shopPaymentAccounts.shopId, shopPaymentAccounts.provider],
      set: { credentials, updatedAt: new Date() },
    });

  revalidatePath("/dashboard/fulfillment");
  return { ok: true };
}

/** Трие ePay акаунта на магазина. */
export async function deletePaymentAccount(): Promise<void> {
  const { shop } = await requireShop();
  await db
    .delete(shopPaymentAccounts)
    .where(
      and(
        eq(shopPaymentAccounts.shopId, shop.id),
        eq(shopPaymentAccounts.provider, "epay"),
      ),
    );
  revalidatePath("/dashboard/fulfillment");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/actions/payment-account.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/actions/payment-account.ts src/actions/payment-account.test.ts
git commit -m "feat(payments): dashboard мутации save/delete ePay акаунт"
```

---

### Task 6: `createOrder` — онлайн клон (pending + intent + пакет)

**Files:**
- Create: `src/lib/payments/build-order-package.ts` (чистият helper — `"use server"` файл НЕ може да експортира sync функция)
- Modify: `src/actions/orders.ts`
- Test: `src/lib/payments/build-order-package.test.ts`

**Interfaces:**
- Consumes: `getPaymentProvider` (Task 2), `getShopPaymentAccount` (Task 4), `paymentIntents` (Task 3), `insertOrderWithNumber` (съществуващ), `restoreStock` (съществуващ).
- Produces: `createOrder` връща разширен резултат за `online_card`:
  `ActionResult<{ orderId: string; token: string; epay?: PaymentPackage }>`.
  При `online_card`: поръчка `status: "pending_payment"`, `payment_intent` (pending), ePay пакет в резултата. При офлайн методи — без промяна.

**Контекст (важно за имплементатора):**
- Транзакцията вече вика `insertOrderWithNumber(tx, shopId, values, lines)` — `values` е `Omit<orders.$inferInsert, "shopId"|"orderNumber">`, така че добавяме `status` в него.
- `EXP_TIME` за плащането = 2 часа (`EPAY_EXP_SECONDS = 7200`).
- `apiBase` от `process.env.EPAY_API_BASE ?? "https://www.epay.bg"`.
- URL-ите: `NEXT_PUBLIC_SITE_URL` (fallback `https://frizmo-shops.vercel.app`) + `/s/{slug}/order/{id}?paid=1` и `/s/{slug}/checkout?cancelled=1`.
- `payment.type === "online_card"` е сигналът за клона.

- [ ] **Step 1: Write the failing test**

`src/lib/payments/build-order-package.test.ts`:
```ts
import { describe, expect, it } from "vitest";

/* Чистата логика на онлайн клона — helper в src/lib/ (НЕ в orders.ts, защото
   "use server" файл експортира само async функции). */
import { buildEpayForOrder } from "@/lib/payments/build-order-package";

describe("buildEpayForOrder", () => {
  it("строи пакет с INVOICE = orderNumber и сумата на поръчката", () => {
    const pkg = buildEpayForOrder({
      slug: "shop",
      orderId: "11111111-1111-4111-8111-111111111111",
      orderNumber: 42,
      totalCents: 1250,
      shopName: "Тест",
      creds: { kin: "1234567890", secret: "s3cr3t" },
      siteUrl: "https://x",
      apiBase: "https://demo.epay.bg",
    });
    expect(pkg.fields.PAGE).toBe("paylogin");
    expect(pkg.fields.URL_OK).toContain("/s/shop/order/11111111-1111-4111-8111-111111111111?paid=1");
    expect(pkg.fields.ENCODED).toBeTruthy();
    expect(pkg.fields.CHECKSUM).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/payments/build-order-package.test.ts`
Expected: FAIL — `buildEpayForOrder` липсва.

- [ ] **Step 3: Създай чистия helper**

`src/lib/payments/build-order-package.ts`:
```ts
import { getPaymentProvider, type PaymentCreds, type PaymentPackage } from "@/lib/payments";

export const EPAY_EXP_SECONDS = 7200; // 2 часа за плащане, после cron auto-cancel

/** Строи ePay пакета за поръчка (чиста — само подпис върху creds на магазина). */
export function buildEpayForOrder(args: {
  slug: string;
  orderId: string;
  orderNumber: number;
  totalCents: number;
  shopName: string;
  creds: PaymentCreds;
  siteUrl: string;
  apiBase: string;
}): PaymentPackage {
  const base = args.siteUrl.replace(/\/$/, "");
  return getPaymentProvider("epay").buildPackage(
    {
      invoice: String(args.orderNumber),
      amountCents: args.totalCents,
      description: `Поръчка №${args.orderNumber} от ${args.shopName}`,
      expSeconds: EPAY_EXP_SECONDS,
      urlOk: `${base}/s/${args.slug}/order/${args.orderId}?paid=1`,
      urlCancel: `${base}/s/${args.slug}/checkout?cancelled=1`,
    },
    args.creds,
    args.apiBase,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/payments/build-order-package.test.ts`
Expected: PASS.

- [ ] **Step 4б: Импорти в `orders.ts`**

Към импортите на `src/actions/orders.ts` добави:
```ts
import { paymentIntents, shopPaymentAccounts } from "@/db";
import { type PaymentCreds, type PaymentPackage } from "@/lib/payments";
import { buildEpayForOrder } from "@/lib/payments/build-order-package";
```
(добави `paymentIntents, shopPaymentAccounts` към съществуващия `@/db` импорт списък.)

- [ ] **Step 5: Свържи клона в createOrder транзакцията**

В `createOrder`, ПРЕДИ транзакцията (след като `payment` е резолюиран, ~ред 194), добави проверка за акаунт:
```ts
  /* Онлайн плащане: магазинът трябва да има свързан ePay акаунт. */
  let epayCreds: PaymentCreds | null = null;
  if (payment.type === "online_card") {
    const acct = await db.query.shopPaymentAccounts.findFirst({
      where: and(
        eq(shopPaymentAccounts.shopId, shop.id),
        eq(shopPaymentAccounts.provider, "epay"),
      ),
    });
    if (!acct || !acct.active) {
      return fail("Плащането с карта не е налично за този магазин в момента.");
    }
    epayCreds = acct.credentials as PaymentCreds;
  }
```
В `insertOrderWithNumber` извикването добави `status` в `values` обекта:
```ts
          status: payment.type === "online_card" ? "pending_payment" : "new",
```
СЛЕД `insertOrderWithNumber` (още в транзакцията), създай intent-а за онлайн:
```ts
      if (payment.type === "online_card") {
        await tx.insert(paymentIntents).values({
          orderId: inserted.orderId,
          shopId: shop.id,
          provider: "epay",
          providerRef: String(inserted.orderNumber),
          amountCents: cart.totalCents,
        });
      }
```

- [ ] **Step 6: Генерирай пакета СЛЕД commit + върни го**

Транзакцията връща `created`. СЛЕД успешния commit (там, където се смятат известията, ~ред 384), за онлайн НЕ пращаме „нова поръчка" известия още (поръчката не е платена) и генерираме пакета. Промени финала:
```ts
  /* Онлайн (pending) → генерирай ePay пакета и върни го; известията изчакват
     потвърждението от webhook-а (иначе търговецът получава „нова поръчка" за нещо
     неплатено). Офлайн → досегашното поведение (известия + revalidate). */
  if (epayCreds) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://frizmo-shops.vercel.app";
    const apiBase = process.env.EPAY_API_BASE ?? "https://www.epay.bg";
    let epay: PaymentPackage;
    try {
      epay = buildEpayForOrder({
        slug: shop.slug,
        orderId: created.orderId,
        orderNumber: created.orderNumber,
        totalCents: created.cart.totalCents,
        shopName: shop.name,
        creds: epayCreds,
        siteUrl,
        apiBase,
      });
    } catch (e) {
      console.error(JSON.stringify({ scope: "epay-build", orderId: created.orderId, error: String(e) }));
      /* Поръчката остава pending_payment; cron ще я auto-cancel-не + върне наличността. */
      return fail("Плащането не можа да се стартира. Опитай пак.");
    }
    revalidatePath("/dashboard/orders");
    return ok({ orderId: created.orderId, token: created.publicToken, epay });
  }
```
(Съществуващият блок за известия/revalidate остава за офлайн — увий го в `else` или сложи `return` в онлайн клона преди него; онлайн клонът връща по-рано.)

Обнови типа на `createOrder`:
```ts
): Promise<ActionResult<{ orderId: string; token: string; epay?: PaymentPackage }>> {
```

- [ ] **Step 7: Verify + commit**

Run: `pnpm check`
Expected: lint + unit + build зелени.
```bash
git add src/actions/orders.ts src/lib/payments/build-order-package.ts src/lib/payments/build-order-package.test.ts
git commit -m "feat(payments): createOrder онлайн клон — pending поръчка + intent + ePay пакет"
```

---

### Task 7: `ALLOWED_TRANSITIONS` + статус етикети за `pending_payment`

**Files:**
- Modify: `src/actions/orders.ts` (ALLOWED_TRANSITIONS)
- Modify: статус етикетите (виж Step 2 — намери файла)
- Test: `src/actions/order-transitions.test.ts`

**Interfaces:**
- Produces: `ALLOWED_TRANSITIONS` включва `pending_payment: ["new", "cancelled"]`; `pending_payment` НЕ е в опциите за ръчна смяна от търговеца (той не бута плащане).

- [ ] **Step 1: Write the failing test**

`src/actions/order-transitions.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS } from "@/actions/orders";

describe("ALLOWED_TRANSITIONS — pending_payment", () => {
  it("pending_payment → new и cancelled", () => {
    expect(ALLOWED_TRANSITIONS.pending_payment).toEqual(["new", "cancelled"]);
  });
  it("new остава непроменен (не се връща към pending)", () => {
    expect(ALLOWED_TRANSITIONS.new).toEqual(["confirmed", "cancelled"]);
  });
});
```

- [ ] **Step 2: Експортирай + разшири ALLOWED_TRANSITIONS**

В `src/actions/orders.ts` направи `ALLOWED_TRANSITIONS` експортна и добави реда:
```ts
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ["new", "cancelled"],
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  return_requested: ["returned", "completed"],
  returned: [],
};
```
(Ръчната смяна на статус от търговеца ползва `z.enum(["confirmed","shipped","completed","cancelled","returned"])` — `pending_payment` и `new` не са там, така че търговецът не може да „плати" ръчно. Остави го както е.)

- [ ] **Step 3: Статус етикет за `pending_payment`**

Намери къде се мапват order статусите към BG етикети (в storefront order страницата и/или dashboard). Търси:
```bash
grep -rn "\"new\":\|new:.*Приета\|Приета\|STATUS_LABELS\|statusLabel" src/app src/components src/lib | grep -i "приета\|confirmed\|status" | head
```
Във всеки такъв мапинг добави `pending_payment: "Чака плащане"` (или подобен BG етикет). Ако мапингът е в `src/app/(catalog)/account/orders/page.tsx` (`STATUS_LABELS`), добави там; ако е в storefront order страницата — там също.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/actions/order-transitions.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add src/actions/orders.ts src/actions/order-transitions.test.ts src/app src/components
git commit -m "feat(payments): pending_payment преходи + статус етикет „Чака плащане“"
```

---

### Task 8: Webhook — `/api/payments/epay/notify`

**Files:**
- Create: `src/app/api/payments/epay/notify/route.ts`
- Create: `src/actions/payment-confirm.ts` (сървърна логика за потвърждение, реюзваема + тестваема)
- Test: `src/actions/payment-confirm.test.ts`

**Interfaces:**
- Consumes: `getShopPaymentAccount` (Task 4), `getPaymentProvider` (Task 2), `paymentIntents`/`orders` (Task 3), `restoreStock` (съществуващ — трябва да се експортира).
- Produces:
  - `confirmEpayPayment(body: { encoded: string; checksum: string }): Promise<{ invoice: string; result: "ok" | "ignored" | "invalid" }>` — намира поръчката по INVOICE, валидира подписа, идемпотентно потвърждава/отменя.
  - route: POST → вика `confirmEpayPayment` → връща текст `INVOICE=<N>:STATUS=OK`.

**Контекст:** INVOICE = `orders.orderNumber`, но не е глобално уникален (per-shop). ePay нотификацията НЕ носи shopId. Затова: `payment_intents.providerRef` = orderNumber, но за да намерим правилния магазин, ще ползваме връзката intent→order→shop. Понеже providerRef не е глобално уникален между магазини, намираме intent-а по `providerRef` + после проверяваме подписа със secret-а на неговия магазин. **Ръб:** ако два магазина имат поръчка №42, `verifyChecksum` ще мине само за правилния (различни secret-и) → сигурно. Ползваме `findMany` по providerRef и вземаме този, чийто подпис верифицира.

- [ ] **Step 1: Write the failing test**

`src/actions/payment-confirm.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeData, hmacSha1 } from "@/lib/payments/epay-signature";

const { intentFindMany, orderUpdate, intentUpdate, restoreStock, txMock } = vi.hoisted(() => ({
  intentFindMany: vi.fn(),
  orderUpdate: vi.fn().mockResolvedValue(undefined),
  intentUpdate: vi.fn().mockResolvedValue(undefined),
  restoreStock: vi.fn().mockResolvedValue(undefined),
  txMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: { paymentIntents: { findMany: intentFindMany } },
    transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        update: () => ({ set: () => ({ where: orderUpdate }) }),
      }),
  },
  paymentIntents: { providerRef: "providerRef", id: "id", status: "status" },
  orders: { id: "id", status: "status" },
  shopPaymentAccounts: {},
}));
vi.mock("@/actions/orders", () => ({ restoreStock }));
vi.mock("@/lib/email", () => ({ sendOrderStatusEmail: vi.fn(), sendOrderEmails: vi.fn() }));
vi.mock("@/lib/push", () => ({ sendNewOrderPush: vi.fn(), sendPushToUser: vi.fn() }));

/* getShopPaymentAccount мокнат да върне creds със secret "s3cr3t" за магазина. */
vi.mock("@/db/queries/payment-accounts", () => ({
  getShopPaymentAccount: vi.fn().mockResolvedValue({ credentials: { kin: "1", secret: "s3cr3t" } }),
}));

import { confirmEpayPayment } from "@/actions/payment-confirm";

const SECRET = "s3cr3t";

function notif(fields: Record<string, string>) {
  const encoded = encodeData(fields);
  return { encoded, checksum: hmacSha1(encoded, SECRET) };
}

describe("confirmEpayPayment", () => {
  beforeEach(() => {
    intentFindMany.mockReset();
    orderUpdate.mockClear();
    restoreStock.mockClear();
  });

  it("невалиден подпис → invalid, нищо не се обновява", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "pending" },
    ]);
    const res = await confirmEpayPayment({ encoded: notif({ INVOICE: "42", STATUS: "PAID" }).encoded, checksum: "bad" });
    expect(res.result).toBe("invalid");
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it("PAID → потвърждава (ok)", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "pending" },
    ]);
    const res = await confirmEpayPayment(notif({ INVOICE: "42", STATUS: "PAID", AMOUNT: "12.50" }));
    expect(res.result).toBe("ok");
  });

  it("вече paid → ignored (идемпотентност)", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "paid" },
    ]);
    const res = await confirmEpayPayment(notif({ INVOICE: "42", STATUS: "PAID", AMOUNT: "12.50" }));
    expect(res.result).toBe("ignored");
  });

  it("подправена сума → invalid", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "pending" },
    ]);
    const res = await confirmEpayPayment(notif({ INVOICE: "42", STATUS: "PAID", AMOUNT: "99.00" }));
    expect(res.result).toBe("invalid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/actions/payment-confirm.test.ts`
Expected: FAIL — `confirmEpayPayment` липсва.

- [ ] **Step 3: Експортирай `restoreStock` от orders.ts**

В `src/actions/orders.ts` направи `restoreStock` експортна (`export async function restoreStock(...)`).

- [ ] **Step 4: Implement `confirmEpayPayment`**

`src/actions/payment-confirm.ts`:
```ts
"use server";

import { eq } from "drizzle-orm";
import { db, orders, paymentIntents } from "@/db";
import { restoreStock } from "@/actions/orders";
import { getShopPaymentAccount } from "@/db/queries/payment-accounts";
import { getPaymentProvider, type PaymentCreds } from "@/lib/payments";

type ConfirmResult = { invoice: string; result: "ok" | "ignored" | "invalid" };

/**
 * Обработва ePay нотификация (сървър-към-сървър). Намира intent-а по INVOICE,
 * валидира подписа със secret-а на неговия магазин, сверява сумата, идемпотентно
 * потвърждава (pending_payment→new) или отменя (→cancelled + restock). Никакво
 * доверие на клиентски данни; повторна нотификация → ignored.
 */
export async function confirmEpayPayment(body: {
  encoded: string;
  checksum: string;
}): Promise<ConfirmResult> {
  const provider = getPaymentProvider("epay");

  /* INVOICE = orderNumber (per-shop, не глобално уникален) → може да има >1 intent.
     Правилният е този, чийто shop secret верифицира подписа. */
  const decoded = tryDecodeInvoice(body.encoded);
  if (!decoded) return { invoice: "", result: "invalid" };

  const candidates = await db.query.paymentIntents.findMany({
    where: eq(paymentIntents.providerRef, decoded),
  });

  for (const intent of candidates) {
    const acct = await getShopPaymentAccount(intent.shopId, "epay");
    if (!acct) continue;
    const creds = acct.credentials as PaymentCreds;
    const note = provider.parseNotification(body, creds);
    if (!note) continue; // подписът не пасва на този магазин

    /* Идемпотентност: вече обработен. */
    if (intent.status !== "pending") return { invoice: decoded, result: "ignored" };

    /* Сверка на сумата (защита срещу подправяне). */
    if (note.amountCents !== null && note.amountCents !== intent.amountCents) {
      console.error(
        JSON.stringify({ scope: "epay-amount-mismatch", invoice: decoded, expected: intent.amountCents, got: note.amountCents }),
      );
      return { invoice: decoded, result: "invalid" };
    }

    if (note.status === "paid") {
      await db.transaction(async (tx) => {
        await tx
          .update(paymentIntents)
          .set({ status: "paid", paidAt: new Date(), rawNotification: note.raw, updatedAt: new Date() })
          .where(eq(paymentIntents.id, intent.id));
        /* Guard: потвърждаваме само ако още е pending_payment (късна нотификация след
           cron auto-cancel не възкресява отменена поръчка). */
        await tx
          .update(orders)
          .set({ status: "new", updatedAt: new Date() })
          .where(eq(orders.id, intent.orderId));
      });
      return { invoice: decoded, result: "ok" };
    }

    if (note.status === "denied" || note.status === "expired") {
      await db.transaction(async (tx) => {
        await tx
          .update(paymentIntents)
          .set({ status: note.status, rawNotification: note.raw, updatedAt: new Date() })
          .where(eq(paymentIntents.id, intent.id));
        await tx
          .update(orders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(orders.id, intent.orderId));
        await restoreStock(tx, intent.orderId);
      });
      return { invoice: decoded, result: "ok" };
    }

    return { invoice: decoded, result: "invalid" };
  }

  return { invoice: decoded, result: "invalid" };
}

/** Вади INVOICE от ENCODED без да валидира подпис (за да намерим кандидатите). */
function tryDecodeInvoice(encoded: string): string | null {
  try {
    const data = Buffer.from(encoded, "base64").toString("utf8");
    for (const line of data.split("\n")) {
      const [k, ...rest] = line.trim().split("=");
      if (k === "INVOICE") return rest.join("=");
    }
  } catch {
    /* игнорирай */
  }
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/actions/payment-confirm.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 6: Implement route**

`src/app/api/payments/epay/notify/route.ts`:
```ts
import { confirmEpayPayment } from "@/actions/payment-confirm";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/actions/cart";

export const dynamic = "force-dynamic";

/**
 * ePay нотификация (сървър-към-сървър). Публичен endpoint, защитен от CHECKSUM
 * проверката (само валиден подпис със secret-а на магазина минава). Rate-limit
 * срещу флууд. Отговаряме точния ePay формат „INVOICE=<N>:STATUS=OK".
 */
export async function POST(req: Request) {
  const ip = await clientIp();
  if (!(await checkRateLimit(`epay-notify:${ip}`, 60, 60_000))) {
    return new Response("Too Many Requests", { status: 429 });
  }

  const form = await req.formData();
  const encoded = String(form.get("encoded") ?? "");
  const checksum = String(form.get("checksum") ?? "");
  if (!encoded || !checksum) {
    return new Response("ERR", { status: 400 });
  }

  try {
    const { invoice, result } = await confirmEpayPayment({ encoded, checksum });
    /* ePay иска „INVOICE=N:STATUS=OK" за да не ретрайва. При invalid връщаме ERR
       (ePay ще опита пак — но валиден подпис никога няма да мине с грешен secret). */
    if (result === "ok" || result === "ignored") {
      return new Response(`INVOICE=${invoice}:STATUS=OK`, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response(`INVOICE=${invoice}:STATUS=ERR`, { status: 200 });
  } catch (err) {
    console.error(JSON.stringify({ scope: "epay-notify", error: String(err) }));
    return new Response("ERR", { status: 500 });
  }
}
```

- [ ] **Step 7: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add src/actions/payment-confirm.ts src/actions/payment-confirm.test.ts src/actions/orders.ts src/app/api/payments/epay/notify/route.ts
git commit -m "feat(payments): ePay webhook — подпис + идемпотентно потвърждение/отмяна"
```

---

### Task 9: Checkout — онлайн метод → auto-submit към ePay

**Files:**
- Modify: `src/components/storefront/checkout-form.tsx`
- Test: (визуална/e2e — покрива се в Task 12; тук е UI промяна)

**Interfaces:**
- Consumes: `createOrder` резултат с опционален `epay` (Task 6).
- Produces: при `result.data.epay` — рендерира скрита форма (POST) към `epay.actionUrl` с всичките `fields` и я submit-ва (redirect към ePay). Иначе досегашния `router.push`.

- [ ] **Step 1: Добави ePay redirect в submit**

В `src/components/storefront/checkout-form.tsx`, в `submit`, замени финалния успех:
```ts
      clearCart(shopId);
      /* Онлайн плащане: сървърът върна ePay пакет → auto-submit към ePay (redirect).
         Иначе (офлайн) → потвърждение на поръчката. */
      if (result.data.epay) {
        submitEpayForm(result.data.epay);
        return;
      }
      router.push(`${base}/order/${result.data.orderId}?t=${result.data.token}`);
```
Добави helper (извън компонента или в него — чист DOM):
```ts
function submitEpayForm(epay: { actionUrl: string; fields: Record<string, string> }) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = epay.actionUrl;
  for (const [name, value] of Object.entries(epay.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
```
Типа на `epay` идва от `PaymentPackage`; ако TS се оплаче, импортвай типа: `import type { PaymentPackage } from "@/lib/payments";` и типизирай helper-а с него.

- [ ] **Step 2: (по избор) показване „Отказано плащане" при връщане**

Ако `URL_CANCEL` върне купувача на `?cancelled=1`, checkout-ът може да покаже бележка. Минимално: чети `useSearchParams` и ако `cancelled=1` покажи `setError("Плащането е отказано. Можеш да опиташ пак.")` в `useEffect`. (Ако усложнява — пропусни; купувачът просто вижда празен checkout и опитва пак.)

- [ ] **Step 3: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add src/components/storefront/checkout-form.tsx
git commit -m "feat(payments): checkout auto-submit към ePay при онлайн плащане"
```

---

### Task 10: Order confirmation — статуси „Чака плащане" / „Платена"

**Files:**
- Modify: `src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx`
- Test: (визуална — ръчна проверка)

**Interfaces:**
- Consumes: `order.status` (`pending_payment` | `new` | ...), `order.paymentType`.
- Produces: за `pending_payment` → банер „Чакаме потвърждение на плащането"; за платена онлайн поръчка (`paymentType === "online_card"` && `status !== "pending_payment"`) → „Плащането е получено".

- [ ] **Step 1: Добави статус банери**

В `src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx`, до другите статус блокове (търси `order.status === "completed"`), добави:
```tsx
      {order.status === "pending_payment" && (
        <div className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4 text-sm text-(--sf-text)">
          Чакаме потвърждение на плащането от ePay. Ако вече плати, статусът ще се
          обнови до минута — презареди страницата.
        </div>
      )}
      {order.status !== "pending_payment" && order.paymentType === "online_card" && (
        <div className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4 text-sm text-(--sf-text)">
          Плащането е получено. Благодарим!
        </div>
      )}
```
(Провери, че `order` носи `status` и `paymentType` — ако query-то не ги връща, добави ги към селекта на order query-то за тази страница.)

- [ ] **Step 2: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add "src/app/(storefront)/s/[slug]/order/[orderId]/page.tsx"
git commit -m "feat(payments): статуси „Чака плащане“/„Платена“ на потвърждението"
```

---

### Task 11: Dashboard таб „Онлайн плащане" + reconciliation cron

**Files:**
- Create: `src/components/dashboard/payment-accounts.tsx`
- Create: `src/db/queries/payment-reconcile.ts`
- Create: `src/app/api/cron/expire-payments/route.ts`
- Modify: `vercel.json`
- Modify: dashboard страница/nav, където живее fulfillment (виж Step 4)
- Test: `src/db/queries/payment-reconcile.test.ts` (query guard)

**Interfaces:**
- Consumes: `getShopPaymentAccount` (Task 4), `savePaymentAccount`/`deletePaymentAccount` (Task 5), `restoreStock` (Task 8), `paymentIntents`/`orders`.
- Produces:
  - `getExpiredPendingOrders(olderThanMs: number, limit: number): Promise<{ orderId: string; intentId: string }[]>`
  - cron route: намира изтеклите pending → cancel + restock + intent expired.
  - dashboard UI за свързване/триене на ePay акаунт (InfoHint за КИН/secret, като куриерите).

- [ ] **Step 1: Reconcile query + тест**

`src/db/queries/payment-reconcile.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));
vi.mock("@/db", () => ({
  db: { select: selectMock },
  paymentIntents: { id: "id", orderId: "orderId", status: "status", createdAt: "createdAt" },
  orders: { id: "id", status: "status" },
}));

import { getExpiredPendingOrders } from "@/db/queries/payment-reconcile";

describe("getExpiredPendingOrders", () => {
  it("връща orderId+intentId за изтеклите", async () => {
    selectMock.mockReturnValue({
      from: () => ({ innerJoin: () => ({ where: () => ({ limit: () => [{ orderId: "o1", intentId: "i1" }] }) }) }),
    });
    const rows = await getExpiredPendingOrders(7_200_000, 100);
    expect(rows).toEqual([{ orderId: "o1", intentId: "i1" }]);
  });
});
```

`src/db/queries/payment-reconcile.ts`:
```ts
import { and, eq, lt, sql } from "drizzle-orm";
import { db, orders, paymentIntents } from "@/db";

/** pending_payment поръчки, чийто intent е по-стар от olderThanMs (за auto-cancel). */
export async function getExpiredPendingOrders(
  olderThanMs: number,
  limit: number,
): Promise<{ orderId: string; intentId: string }[]> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const rows = await db
    .select({ orderId: orders.id, intentId: paymentIntents.id })
    .from(paymentIntents)
    .innerJoin(orders, eq(paymentIntents.orderId, orders.id))
    .where(
      and(
        eq(paymentIntents.status, "pending"),
        eq(orders.status, "pending_payment"),
        lt(paymentIntents.createdAt, cutoff),
      ),
    )
    .limit(limit);
  return rows;
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/db/queries/payment-reconcile.test.ts`
Expected: PASS.

- [ ] **Step 3: Cron route**

`src/app/api/cron/expire-payments/route.ts`:
```ts
import { eq } from "drizzle-orm";
import { db, orders, paymentIntents } from "@/db";
import { restoreStock } from "@/actions/orders";
import { getExpiredPendingOrders } from "@/db/queries/payment-reconcile";

export const dynamic = "force-dynamic";

const EXP_MS = 2 * 60 * 60 * 1000; // 2 часа

/**
 * Vercel Cron: auto-cancel на неплатени онлайн поръчки (pending_payment >2ч) —
 * връща наличността + маркира intent-а expired. Гард с CRON_SECRET. Guard по
 * статус: ако междувременно webhook е потвърдил, поръчката вече не е pending.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const due = await getExpiredPendingOrders(EXP_MS, 100);
  let cancelled = 0;
  for (const { orderId, intentId } of due) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(orders.id, orderId));
        await tx
          .update(paymentIntents)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(paymentIntents.id, intentId));
        await restoreStock(tx, orderId);
      });
      cancelled++;
    } catch (err) {
      console.error(JSON.stringify({ event: "expire_payment_failed", orderId, err: String(err) }));
    }
  }
  return Response.json({ cancelled });
}
```

- [ ] **Step 4: Dashboard UI**

`src/components/dashboard/payment-accounts.tsx` — компонент по образец на `courier-accounts.tsx` (`Card` + `Drawer` + `Input` + `InfoHint`), но за ePay: полета КИН + тайна дума, `savePaymentAccount`/`deletePaymentAccount`. Пълен код:
```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { deletePaymentAccount, savePaymentAccount } from "@/actions/payment-account";
import { Badge, Button, Card, ConfirmDialog, Drawer, InfoHint, Input } from "@/components/ui";
import type { ShopPaymentAccount } from "@/db";

/** Свързване на ePay акаунт (Модел А: парите отиват при търговеца). */
export function PaymentAccounts({ account }: { account: ShopPaymentAccount | null }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, action] = useActionState(savePaymentAccount, {} as { error?: string; ok?: boolean });

  /* Успешен запис → затвори drawer + toast (react-canary паттерн на проекта). */
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success("Акаунтът е запазен.");
    }
  }, [state.ok]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink-900">ePay.bg</p>
            {account ? <Badge tone="success">Свързан</Badge> : <Badge>Не е свързан</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Карта онлайн — парите отиват директно при теб (не при платформата).
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={account ? "secondary" : "primary"} onClick={() => setOpen(true)}>
            {account ? "Промени" : "Свържи"}
          </Button>
          {account && (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              Изтрий
            </Button>
          )}
        </div>
      </div>

      {open && (
        <Drawer open title="ePay — акаунт" onClose={() => setOpen(false)}>
          <form action={action} className="flex flex-col gap-4">
            <Input
              label="КИН (клиентски номер)"
              name="kin"
              required
              placeholder={account ? "•••• (запазен — въведи наново за промяна)" : ""}
              labelSuffix={
                <InfoHint
                  label="Клиентският идентификационен номер (КИН/MIN) от ePay акаунта на магазина. Намира се в профила ти в ePay.bg."
                  ariaLabel="Какво е КИН?"
                />
              }
            />
            <Input
              label="Тайна дума (secret)"
              name="secret"
              type="password"
              required
              placeholder={account ? "•••• (запазена)" : ""}
              labelSuffix={
                <InfoHint
                  label="Тайната дума за подписване на плащанията (SECRET word), задава се в ePay настройките за търговци. С нея ePay проверява, че заявката идва от теб."
                  ariaLabel="Каква тайна дума?"
                />
              }
            />
            {state.error && <p className="text-sm text-danger-600">{state.error}</p>}
            <div className="flex gap-2">
              <Button type="submit">Запази</Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Отказ
              </Button>
            </div>
          </form>
        </Drawer>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deletePaymentAccount();
          toast.success("Акаунтът е премахнат.");
        }}
        title="Премахване на ePay"
        message="Купувачите вече няма да могат да плащат с карта. Сигурен ли си?"
        confirmLabel="Премахни"
      />
    </Card>
  );
}
```
(Забележка: използва `useActionState` (React 19, паттернът на проекта — виж `shop-form.tsx`); `useEffect` върху `state.ok` затваря drawer-а + toast. `Badge` приема `tone` (`neutral|success|warning|danger|brand`); `Button` приема `variant` (`primary|secondary|ghost|danger`) — вече верни в кода горе.)

- [ ] **Step 5: Монтирай UI + добави cron**

Намери dashboard страницата за плащания/доставка (`src/app/(dashboard)/dashboard/fulfillment/page.tsx` или подобна) и рендерирай `<PaymentAccounts account={...} />`, като заредиш акаунта:
```tsx
import { getShopPaymentAccount } from "@/db/queries/payment-accounts";
// в компонента (server), до другите заявки:
const paymentAccount = (await getShopPaymentAccount(shop.id, "epay")) ?? null;
// в JSX:
<PaymentAccounts account={paymentAccount} />
```
В `vercel.json` добави cron-а:
```json
{
  "crons": [
    { "path": "/api/cron/abandoned-carts", "schedule": "0 * * * *" },
    { "path": "/api/cron/expire-payments", "schedule": "*/15 * * * *" }
  ]
}
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm check`
Expected: зелено.
```bash
git add src/components/dashboard/payment-accounts.tsx src/db/queries/payment-reconcile.ts src/db/queries/payment-reconcile.test.ts "src/app/api/cron/expire-payments/route.ts" vercel.json "src/app/(dashboard)"
git commit -m "feat(payments): dashboard таб ePay + reconciliation cron (auto-cancel неплатени)"
```

---

### Task 12: E2e — онлайн checkout до pending поръчка + DEV env

**Files:**
- Create: `e2e/online-payment.spec.ts`
- Modify: `.env.local` (DEV ePay ключове — коментирани/примерни)
- Modify: `scripts/seed-demo-shops.mjs` (по избор: ePay акаунт + online_card метод на демо магазин) ИЛИ тестът ги създава

**Interfaces:**
- Consumes: e2e паттерна (демо магазин, cookie банер).

**Контекст:** без реален ePay акаунт НЕ можем да минем целия flow (redirect към epay.bg). Тестът спира ПРЕДИ реалния redirect — проверява, че при онлайн метод се създава `pending_payment` поръчка и checkout се опитва да submit-не към ePay (interceptваме мрежата/формата). Демо магазинът трябва да има ePay акаунт + активен `online_card` метод.

- [ ] **Step 1: DEV env бележка**

В `.env.local` добави (коментирани, DEV fallback — както Спиди):
```
# ePay DEV (demo среда — за локална разработка; per-shop ключове живеят в dashboard/DB)
# EPAY_API_BASE=https://demo.epay.bg
# EPAY_DEMO_KIN=...
# EPAY_DEMO_SECRET=...
```

- [ ] **Step 2: Seed ePay за демо магазин (за да има онлайн метод)**

В `scripts/seed-demo-shops.mjs` (или в теста преди flow-а) осигури за `atelie-glina`:
- ред в `shop_payment_accounts` (provider `epay`, credentials `{ kin: "1234567890", secret: "demosecret" }`, active true)
- активен payment method с `type: "online_card"`, name „Карта (ePay)"
Ако seed-ът е сложен — тестът може да ги вмъкне през直 SQL/action преди checkout. Избери по-простото; **логни решението** в теста (коментар).

- [ ] **Step 3: E2e тест**

`e2e/online-payment.spec.ts`:
```ts
import { expect, test, type Page } from "@playwright/test";

/* Онлайн плащане: избор на „Карта (ePay)" в checkout → pending_payment поръчка +
   опит за redirect към ePay. Спираме ПРЕДИ реалния epay.bg (нямаме реален акаунт):
   interceptваме POST-а към ePay и проверяваме, че формата се submit-ва. */

async function markCookieSeen(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
}

test("онлайн метод → checkout submit-ва към ePay", async ({ page }) => {
  test.setTimeout(120_000);
  await markCookieSeen(page);

  /* Блокираме реалния ePay redirect (нямаме акаунт) и хващаме опита. */
  let epayHit = false;
  await page.route(/epay\.bg/, (route) => {
    epayHit = true;
    return route.fulfill({ status: 200, body: "OK (mock ePay)" });
  });

  /* Добави продукт в количката на демо магазина. */
  await page.goto("/s/atelie-glina/p/chasha-utro");
  await page.getByRole("button", { name: "Добави в количката" }).click();
  await page.goto("/s/atelie-glina/checkout");

  /* Попълни минимума. */
  await page.getByLabel("Име и фамилия").fill("Е2Е Плащане");
  await page.getByLabel("Телефон").fill("0888123456");
  /* Избери онлайн метод (ако демо магазинът го има активен). */
  const onlineRadio = page.getByText("Карта (ePay)");
  if (await onlineRadio.count()) {
    await onlineRadio.click();
  } else {
    test.skip(true, "Демо магазинът няма активен ePay метод — seed нужен.");
  }

  await page.getByRole("button", { name: /Поръчай|Плати/ }).click();
  /* Checkout се опита да submit-не към ePay. */
  await expect.poll(() => epayHit, { timeout: 15_000 }).toBe(true);
});
```
(Ако локаторите за метода/бутона се различават — сверявай с реалния checkout DOM. Ако демо seed-ът не е направен, тестът се skip-ва graceful.)

- [ ] **Step 4: Run e2e**

Run: `npx playwright test online-payment --reporter=line`
Expected: PASS (или skip, ако метода липсва — тогава направи seed-а в Step 2).

- [ ] **Step 5: Финален гейт + commit**

Run: `pnpm check`
Expected: lint + всички unit + build зелени.
```bash
git add e2e/online-payment.spec.ts scripts/seed-demo-shops.mjs
git commit -m "feat(payments): e2e онлайн checkout → pending поръчка + ePay submit"
```

---

## Финал (след всички задачи)

- [ ] Пълен `pnpm check` (lint + unit + build зелени).
- [ ] `npx playwright test online-payment --reporter=line` (+ регресия: `store-products`, `checkout`-свързани ако има).
- [ ] Обнови `docs/WORKLOG.md` (нов Дневник ред + текущ commit) + паметта (нова `online-payments-feature.md` + ред в MEMORY.md; линк към [[courier-integration-feature]], [[stripe-billing-status]]).
- [ ] Обнови `docs/remaining-roadmap.md` — онлайн плащане: код готов, чака реален ePay акаунт + жива проверка + Vercel env (`EPAY_API_BASE` за prod, `CRON_SECRET` вече го има).
- [ ] Ръчна проверка на живо (dev сървър): dashboard → свържи (demo) ePay → checkout с „Карта" → pending поръчка се създава → (със реален акаунт) плащане → webhook потвърждава.
- [ ] **Отворени въпроси за живата проверка (от спеца):** валута EUR vs BGN; точен формат на нотификацията; POST vs GET на redirect формата — сверяват се на `demo.epay.bg`.
- [ ] Докладвай: готово локално, чака push разрешение + реален ePay акаунт. **НЕ push-вай без изрично „да".**

## Отбелязани отклонения / за преглед при изпълнение

- **INVOICE уникалност:** `orderNumber` е per-shop, не глобален. Webhook-ът намира правилния магазин чрез верификация на подписа (различни secret-и). Ако при живата проверка се окаже, че ePay изисква глобално уникален INVOICE, алтернатива: `INVOICE = hash(shopId, orderNumber)` или отделен глобален брояч — отбележи и питай преди смяна.
- **Валута EUR:** заложена в `epay.ts` (`CURRENCY: "EUR"`). Ако демо ePay отхвърли EUR → добави BGN конверсия (× 1.95583) като отделна малка промяна, питай преди.
