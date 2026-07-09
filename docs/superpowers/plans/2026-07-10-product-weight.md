# Тегло, размери и количество на продукт — план за имплементация

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (INLINE изпълнение — проектното правило забранява паралелни субагенти/subagent-driven). Стъпките ползват checkbox (`- [ ]`) синтаксис за проследяване.

**Goal:** Всеки продукт да може да носи (всичко по избор) тегло (грамове), размери Д×Ш×В (см, пазени в мм) и количество за показване (мг/г/кг/мл/л) — данни за product feed и бъдеща Еконт/Спиди тарифа, без да чупим нищо съществуващо.

**Architecture:** Шест нови nullable колони на `products` (един `db:push`, без backfill/NOT NULL). Един параметризиран helper `parseScaled(input, factor)` в `money.ts` за десетичен вход → мащабиран integer (симетрично на `toCents`), плюс обвивки и форматиране. Zod схемата разширява `productSchema` с 5 нови по-избор полета. Мапингът в `productValues` + формата + публичната страница + CSV импорт/експорт консумират тези полета. Всичко integer, никога float.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Drizzle ORM + Supabase Postgres, Zod, Tailwind 4, Vitest, pnpm.

**Източник (спец):** `docs/superpowers/specs/2026-07-10-product-weight-design.md`

## Global Constraints

- **Пари/мерки = integer, никога float.** Тегло = цели грамове; размери = мм (см×10); количество = стойност×1000. Аритметика само върху integer.
- **Всички нови полета са ПО ИЗБОР** — nullable в базата, `""`/`null` в схемата. Празен продукт работи както днес. Няма backfill, няма `NOT NULL`, няма миграционна церемония.
- **`shopId` е тенант ключът** — не се пипа изолацията; мутациите остават през `requireShop()` wrapper-а.
- **UI текстове на български, типографски кавички „…“** — прав `"` в BG стринг чупи lint/JS. Тон „на ти". Валута EUR (не се докосва тук).
- **Само компоненти от `@/components/ui`** — без голи `<input>`/`<select>`; без емоджита; touch targets ≥ 44px (`h-11`); типизирани props без `any`.
- **Строг TypeScript** — без `as any`; edge cases, performance, security при всяко писане.
- **Гейт преди всеки commit:** `pnpm check` (lint + unit + build). E2e не се пипа тук.
- **Преди commit:** сканирай за невидими контролни символи `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`.
- **Git:** работим на `dev` (= Vercel production). Push САМО след изрично разрешение от потребителя — питай преди качване. Всеки commit завършва с `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Без Playwright визуални тестове** — UI естетиката се проверява ръчно от потребителя; тестваме само логиката (Vitest).
- **`pnpm db:push`** прилага `src/db/schema.ts` към базата (иска `DATABASE_URL_MIGRATIONS` в `.env.local`, session pooler :5432). Без versioned migration файлове.

---

### Task 1: Схема — 6 нови nullable колони на `products`

**Files:**
- Modify: `src/db/schema.ts` (таблица `products`)

**Interfaces:**
- Produces: колони `products.weightGrams`, `products.lengthMm`, `products.widthMm`, `products.heightMm`, `products.netQuantityValue` (всички `integer` NULL), `products.netQuantityUnit` (`text` NULL). Типът `Product` (`typeof products.$inferSelect`) автоматично получава `weightGrams: number | null` и т.н.

- [ ] **Стъпка 1: Намери таблицата `products` в схемата**

Run: `grep -n "export const products = pgTable" src/db/schema.ts`
Expected: намира дефиницията на таблицата. Прочети колоните `priceCents`, `promoPriceCents`, `stock`, `images` за да видиш точния стил (`integer("...")`, `text("...")`).

- [ ] **Стъпка 2: Добави шестте колони**

В обекта с колоните на `products`, непосредствено след съществуващите продуктови полета (напр. след `stock` / `images`, преди `createdAt`/`updatedAt`), добави:

```ts
    /** Тегло в грамове (за product feed + бъдеща Еконт/Спиди тарифа). null = не е зададено. */
    weightGrams: integer("weight_grams"),
    /** Размери в милиметри (UI приема см, пази мм за десетичен вход без float). null = не е зададено. */
    lengthMm: integer("length_mm"),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    /** Количество за показване, съхранено като стойност × 1000 (0.5 → 500). null = не е зададено. */
    netQuantityValue: integer("net_quantity_value"),
    /** Единица на количеството: 'mg' | 'g' | 'kg' | 'ml' | 'l'. Винаги заедно с netQuantityValue. */
    netQuantityUnit: text("net_quantity_unit"),
```

Провери, че `integer` и `text` вече са импортирани най-горе в `schema.ts` (те се ползват за други колони — би трябвало да са налични). Ако липсват, добави ги към import-а от `drizzle-orm/pg-core`.

- [ ] **Стъпка 3: Провери, че typecheck минава (колоните са валиден Drizzle DSL)**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки от `schema.ts`. (Може да има несвързани грешки другаде, ако е стар `.next` — фокусирай се, че `schema.ts` е чист.)

- [ ] **Стъпка 4: Приложи към базата**

Run: `pnpm db:push`
Expected: drizzle-kit докладва добавяне на 6 nullable колони на `products`, без загуба на данни. Ако поиска потвърждение за нови колони — те са nullable, безопасно е.

Ако `DATABASE_URL_MIGRATIONS` липсва, спри и питай потребителя (не продължавай с гадаене).

- [ ] **Стъпка 5: Commit**

```bash
git add src/db/schema.ts
git commit -F <temp-msg-file>
```
Съобщение (BG, типографски кавички; чрез временен файл заради Windows multiline):
```
feat(products): 6 nullable колони — тегло/размери/количество

weight_grams, length_mm, width_mm, height_mm, net_quantity_value,
net_quantity_unit. Всички по избор (NULL), приложени с db:push;
съществуващите продукти остават непроменени.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 2: Helper функции в `money.ts` (TDD)

**Files:**
- Modify: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

**Interfaces:**
- Consumes: нищо ново (mirror-ва съществуващия `toCents`).
- Produces:
  - `parseScaled(input: string, factor: number): number | null` — десетичен стринг (точка или запетая) → `Math.round(num × factor)`, или `null` при празно/невалидно/отрицателно.
  - `toMilliQuantity(s: string): number | null` = `parseScaled(s, 1000)`.
  - `cmToMm(s: string): number | null` = `parseScaled(s, 10)`.
  - `formatNetQuantity(value: number, unit: string): string` — (стойност×1000, единица) → BG стринг със запетая („1,5 л“).
  - `scaledToInput(value: number, factor: number): string` — обратно на `parseScaled`, точка за десетичните, без „.0“ за цели.

- [ ] **Стъпка 1: Напиши failing тестове за `parseScaled`**

Добави в края на `src/lib/money.test.ts`. Първо разшири import-а най-горе:
```ts
import { cmToMm, formatNetQuantity, formatPrice, parseScaled, scaledToInput, toCents, toMilliQuantity } from "./money";
```

После добави блоковете:
```ts
describe("parseScaled", () => {
  it("парсва десетична запетая с фактор 1000", () => expect(parseScaled("0,5", 1000)).toBe(500));
  it("парсва десетична точка с фактор 1000", () => expect(parseScaled("1.5", 1000)).toBe(1500));
  it("парсва цяло с фактор 10", () => expect(parseScaled("30", 10)).toBe(300));
  it("парсва десетичен см с фактор 10", () => expect(parseScaled("30,5", 10)).toBe(305));
  it("нула е валидна", () => expect(parseScaled("0", 10)).toBe(0));
  it("отхвърля празен низ", () => expect(parseScaled("", 10)).toBeNull());
  it("отхвърля текст", () => expect(parseScaled("abc", 10)).toBeNull());
  it("отхвърля отрицателни", () => expect(parseScaled("-1", 10)).toBeNull());
  it("закръгля коректно", () => expect(parseScaled("0,333", 1000)).toBe(333));
});

describe("toMilliQuantity / cmToMm", () => {
  it("toMilliQuantity умножава по 1000", () => expect(toMilliQuantity("0,5")).toBe(500));
  it("cmToMm умножава по 10", () => expect(cmToMm("30")).toBe(300));
  it("cmToMm приема десетичен см", () => expect(cmToMm("30,5")).toBe(305));
});

describe("formatNetQuantity", () => {
  it("цяло число мл без десетична", () => expect(formatNetQuantity(500, "ml")).toBe("500 мл"));
  it("десетичен литър със запетая", () => expect(formatNetQuantity(1500, "l")).toBe("1,5 л"));
  it("грам", () => expect(formatNetQuantity(250, "g")).toBe("250 г"));
  it("цял килограм без „,0“", () => expect(formatNetQuantity(1000, "kg")).toBe("1 кг"));
  it("милиграм", () => expect(formatNetQuantity(5000, "mg")).toBe("5000 мг"));
});

describe("scaledToInput", () => {
  it("количество 500 × factor 1000 → „0.5“", () => expect(scaledToInput(500, 1000)).toBe("0.5"));
  it("количество 1500 → „1.5“", () => expect(scaledToInput(1500, 1000)).toBe("1.5"));
  it("размер 305 × factor 10 → „30.5“", () => expect(scaledToInput(305, 10)).toBe("30.5"));
  it("размер 300 → цяло „30“", () => expect(scaledToInput(300, 10)).toBe("30"));
});
```

- [ ] **Стъпка 2: Пусни тестовете — трябва да СЕ ПРОВАЛЯТ**

Run: `pnpm exec vitest run src/lib/money.test.ts`
Expected: FAIL — `parseScaled is not a function` (и останалите нови имена).

- [ ] **Стъпка 3: Имплементирай helper-ите в `money.ts`**

Добави след съществуващия `centsToInput` в `src/lib/money.ts`:

```ts
/**
 * Десетичен стринг (точка или запетая) → мащабиран integer (× factor), закръглен.
 * Симетрично на toCents, но факторът е параметър. null при празно/невалидно/отрицателно.
 * Позволява до 3 десетични знака (достатъчно за × 1000).
 */
export function parseScaled(input: string, factor: number): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * factor);
}

/** Количество: десетичен вход → стойност × 1000 (0.5 → 500). */
export function toMilliQuantity(s: string): number | null {
  return parseScaled(s, 1000);
}

/** Размер: см вход → милиметри (30 → 300; 30,5 → 305). */
export function cmToMm(s: string): number | null {
  return parseScaled(s, 10);
}

const NET_UNIT_LABELS: Record<string, string> = {
  mg: "мг",
  g: "г",
  kg: "кг",
  ml: "мл",
  l: "л",
};

/** Съхранена стойност (× 1000) + единица → BG стринг за показване („1,5 л“). */
export function formatNetQuantity(value: number, unit: string): string {
  const num = value / 1000;
  const text = Number.isInteger(num) ? String(num) : String(num).replace(".", ",");
  return `${text} ${NET_UNIT_LABELS[unit] ?? unit}`;
}

/** Обратно на parseScaled — съхранена стойност → стринг за <input> (точка, без „.0“). */
export function scaledToInput(value: number, factor: number): string {
  const num = value / factor;
  return Number.isInteger(num) ? String(num) : String(num);
}
```

Забележка: `String(305 / 10)` → `"30.5"` и `String(300 / 10)` → `"30"` в JS, така `scaledToInput` дава точка автоматично; за цели числа `Number.isInteger` пази без „.0“. (Двата клона връщат едно и също, но явната проверка документира намерението и е защита при бъдеща промяна на форматирането.)

- [ ] **Стъпка 4: Пусни тестовете — трябва да минат**

Run: `pnpm exec vitest run src/lib/money.test.ts`
Expected: PASS — всички нови + старите `toCents`/`centsToInput`/`formatPrice`.

- [ ] **Стъпка 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(money): parseScaled + cmToMm/toMilliQuantity/formatNetQuantity/scaledToInput

Общ параметризиран helper за десетичен вход → мащабиран integer
(симетрично на toCents). Обвивки за количество (×1000) и размери (×10),
BG форматиране за показване, обратна функция за <input>. Пълни тестове.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 3: Zod схема — 5 нови по-избор полета (TDD)

**Files:**
- Modify: `src/schemas/product.ts`
- Test: `src/schemas/product.test.ts` (Create)

**Interfaces:**
- Consumes: `cmToMm`, `toMilliQuantity` от `@/lib/money`.
- Produces: `productSchema` разширена с `weight` (`number | ""`), `length`/`width`/`height` (`string`), `netQuantity` (`{value:string,unit:'mg'|'g'|'kg'|'ml'|'l'} | null`). `ProductInput` = `z.infer<typeof productSchema>` — авто-разширен.

- [ ] **Стъпка 1: Напиши failing тестове**

Create `src/schemas/product.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { productSchema } from "./product";

/** База с всички задължителни полета — надграждаме я per-тест. */
const base = { name: "Продукт", price: "12,50" };

function parse(extra: Record<string, unknown>) {
  return productSchema.safeParse({ ...base, ...extra });
}

describe("productSchema — тегло", () => {
  it("валидно тегло минава", () => expect(parse({ weight: "4500" }).success).toBe(true));
  it("празно тегло минава (по избор)", () => expect(parse({ weight: "" }).success).toBe(true));
  it("липсващо тегло минава (default)", () => expect(parse({}).success).toBe(true));
  it("нула отпада", () => expect(parse({ weight: "0" }).success).toBe(false));
  it("над тавана отпада", () => expect(parse({ weight: "300000" }).success).toBe(false));
  it("текст отпада", () => expect(parse({ weight: "abc" }).success).toBe(false));
});

describe("productSchema — размери", () => {
  it("цял см минава", () => expect(parse({ length: "30" }).success).toBe(true));
  it("десетичен см минава", () => expect(parse({ length: "30,5" }).success).toBe(true));
  it("празно минава", () => expect(parse({ length: "" }).success).toBe(true));
  it("нула отпада (< 1мм)", () => expect(parse({ length: "0" }).success).toBe(false));
  it("над 500см отпада", () => expect(parse({ length: "600" }).success).toBe(false));
  it("текст отпада", () => expect(parse({ width: "abc" }).success).toBe(false));
});

describe("productSchema — количество", () => {
  it("валидно количество минава", () =>
    expect(parse({ netQuantity: { value: "0,5", unit: "l" } }).success).toBe(true));
  it("нулева стойност отпада", () =>
    expect(parse({ netQuantity: { value: "0", unit: "l" } }).success).toBe(false));
  it("невалидна единица отпада", () =>
    expect(parse({ netQuantity: { value: "1", unit: "xx" } }).success).toBe(false));
  it("null минава", () => expect(parse({ netQuantity: null }).success).toBe(true));
  it("липсващо минава (default null)", () => {
    const r = parse({});
    expect(r.success && r.data.netQuantity).toBeNull();
  });
});
```

- [ ] **Стъпка 2: Пусни — трябва да СЕ ПРОВАЛЯТ**

Run: `pnpm exec vitest run src/schemas/product.test.ts`
Expected: FAIL — сега схемата приема неизвестни ключове по подразбиране, така че някои „отпада“ тестове ще паднат (валидацията още я няма).

- [ ] **Стъпка 3: Добави полетата в схемата**

В `src/schemas/product.ts` — разшири import-а:
```ts
import { cmToMm, toCents, toMilliQuantity } from "@/lib/money";
```

Преди `export const productSchema`, добави дефинициите:
```ts
const optionalWeight = z.union([
  z.coerce.number().int().min(1, "Минимум 1 грам").max(200_000, "Максимум 200000 г"),
  z.literal(""),
]);

const optionalDimension = z.union([
  z.string().trim().refine((s) => {
    const mm = cmToMm(s);
    return mm !== null && mm >= 1 && mm <= 5000;
  }, "Невалиден размер в см (пример: 30 или 30,5)"),
  z.literal(""),
]);

const NET_UNITS = ["mg", "g", "kg", "ml", "l"] as const;

const netQuantity = z
  .union([
    z.object({
      value: z
        .string()
        .trim()
        .refine((s) => {
          const m = toMilliQuantity(s);
          return m !== null && m > 0;
        }, "Невалидно количество (пример: 0,5)"),
      unit: z.enum(NET_UNITS),
    }),
    z.null(),
  ])
  .default(null);
```

В обекта `productSchema`, след `deal: ...` (или на подходящо място вътре в `z.object({...})`), добави:
```ts
  weight: optionalWeight.default(""),
  length: optionalDimension.default(""),
  width: optionalDimension.default(""),
  height: optionalDimension.default(""),
  netQuantity,
```

- [ ] **Стъпка 4: Пусни тестовете — трябва да минат**

Run: `pnpm exec vitest run src/schemas/product.test.ts`
Expected: PASS — всичките.

- [ ] **Стъпка 5: Commit**

```bash
git add src/schemas/product.ts src/schemas/product.test.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(schema): продукт — тегло/размери/количество (по избор) + тестове

optionalWeight (цели грамове 1..200000), optionalDimension (см→мм,
1..5000мм), netQuantity ({value,unit} | null). Всички по избор с
default. Нов src/schemas/product.test.ts покрива границите.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 4: Мапинг `productValues` → базата (TDD)

**Files:**
- Modify: `src/actions/products.ts` (функция `productValues`, ред 80-93; import ред 19)
- Test: `src/actions/product-values.test.ts` (Create)

**Interfaces:**
- Consumes: `cmToMm`, `toMilliQuantity` от `@/lib/money`; `ProductInput` от схемата.
- Produces: `productValues(input, shopId)` връща обект с новите шест колони, мапнати към DB стойности (integer или null).

**Забележка за теста:** `productValues` е `function` (не `export`) в `products.ts`, а файлът е `"use server"` с тежки импорти (db, supabase). За да е тестваема чисто, изнеси `productValues` в самостоятелен модул без странични ефекти.

- [ ] **Стъпка 1: Изнеси `productValues` в чист модул**

Create `src/actions/product-values.ts`:
```ts
import { toCents } from "@/lib/money";
import { cmToMm, toMilliQuantity } from "@/lib/money";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import type { ProductInput } from "@/schemas/product";

/** Мапва валидиран ProductInput към колоните на таблицата products. Чиста функция. */
export function productValues(input: ProductInput, shopId: string) {
  return {
    shopId,
    categoryId: input.categoryId || null,
    name: sanitizeText(input.name, 120),
    description: sanitizeMultiline(input.description, 10_000),
    priceCents: toCents(input.price)!,
    promoPriceCents: input.promoPrice ? toCents(input.promoPrice) : null,
    stock: input.stock === "" ? null : input.stock,
    status: input.status,
    images: input.images,
    weightGrams: input.weight === "" ? null : input.weight,
    lengthMm: input.length === "" ? null : cmToMm(input.length),
    widthMm: input.width === "" ? null : cmToMm(input.width),
    heightMm: input.height === "" ? null : cmToMm(input.height),
    netQuantityValue: input.netQuantity ? toMilliQuantity(input.netQuantity.value)! : null,
    netQuantityUnit: input.netQuantity ? input.netQuantity.unit : null,
    updatedAt: new Date(),
  };
}
```
(Обедини двата `@/lib/money` импорта в един ред: `import { cmToMm, toCents, toMilliQuantity } from "@/lib/money";`.)

- [ ] **Стъпка 2: Замени дефиницията в `products.ts` с импорт**

В `src/actions/products.ts`:
- Изтрий локалната `function productValues(...) {...}` (ред 80-93).
- Добави към импортите: `import { productValues } from "./product-values";`
- Махни вече неизползвани импорти САМО ако станат неизползвани (`sanitizeText`/`sanitizeMultiline` още се ползват в `insertRelations` и CSV — НЕ ги махай; провери с lint).

- [ ] **Стъпка 3: Напиши тестове**

Create `src/actions/product-values.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { productValues } from "./product-values";
import { productSchema } from "@/schemas/product";

function values(extra: Record<string, unknown>) {
  const parsed = productSchema.parse({ name: "Продукт", price: "12,50", ...extra });
  return productValues(parsed, "shop-1");
}

describe("productValues — нови полета", () => {
  it("мапва тегло/размери/количество", () => {
    const v = values({
      weight: "750",
      length: "30",
      width: "20",
      height: "10",
      netQuantity: { value: "0,5", unit: "l" },
    });
    expect(v.weightGrams).toBe(750);
    expect(v.lengthMm).toBe(300);
    expect(v.widthMm).toBe(200);
    expect(v.heightMm).toBe(100);
    expect(v.netQuantityValue).toBe(500);
    expect(v.netQuantityUnit).toBe("l");
  });

  it("празни полета → всичките шест null", () => {
    const v = values({});
    expect(v.weightGrams).toBeNull();
    expect(v.lengthMm).toBeNull();
    expect(v.widthMm).toBeNull();
    expect(v.heightMm).toBeNull();
    expect(v.netQuantityValue).toBeNull();
    expect(v.netQuantityUnit).toBeNull();
  });
});
```

- [ ] **Стъпка 4: Пусни тестовете**

Run: `pnpm exec vitest run src/actions/product-values.test.ts`
Expected: PASS.

- [ ] **Стъпка 5: Провери typecheck (импортът в products.ts е валиден)**

Run: `pnpm exec tsc --noEmit`
Expected: без нови грешки; `products.ts` компилира с външния `productValues`.

- [ ] **Стъпка 6: Commit**

```bash
git add src/actions/product-values.ts src/actions/product-values.test.ts src/actions/products.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(products): productValues мапва новите 6 колони (+ изнесен в чист модул)

productValues изнесен от products.ts в src/actions/product-values.ts
(чиста функция, тестваема без server side-effects). Мапва
тегло/размери(см→мм)/количество(×1000); празно → NULL. Тестове за
двата случая.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 5: Форма — секция „Тегло и размер“ + състояние + payload

**Files:**
- Modify: `src/components/dashboard/product-form.tsx`

**Interfaces:**
- Consumes: `ProductFormInitial` (разширен), `saveProduct` payload формата.
- Produces: `ProductFormInitial` разширен с `weight`/`length`/`width`/`height`/`netQuantityValue`/`netQuantityUnit` (всички `string`); `emptyInitial` с тези по подразбиране; нова UI секция; payload с `weight`/`length`/`width`/`height`/`netQuantity`.

- [ ] **Стъпка 1: Прочети формата, за да намериш точните места**

Run: `grep -n "ProductFormInitial\|emptyInitial\|const \[.*useState\|handleSubmit\|Цена и наличност\|saveProduct(" src/components/dashboard/product-form.tsx`
Expected: намираш (а) интерфейса `ProductFormInitial`, (б) `emptyInitial`, (в) useState блока, (г) `handleSubmit` payload обекта, (д) секцията „Цена и наличност“ (Card), (е) импортите от `@/components/ui`.

- [ ] **Стъпка 2: Разшири `ProductFormInitial` и `emptyInitial`**

В интерфейса `ProductFormInitial` добави:
```ts
  weight: string;
  length: string;
  width: string;
  height: string;
  netQuantityValue: string;
  netQuantityUnit: string;
```

В `emptyInitial` добави:
```ts
  weight: "",
  length: "",
  width: "",
  height: "",
  netQuantityValue: "",
  netQuantityUnit: "g",
```

- [ ] **Стъпка 3: Добави състоянието**

До другите `useState` в компонента:
```ts
  const [weight, setWeight] = useState(initial.weight);
  const [length, setLength] = useState(initial.length);
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);
  const [netQuantityValue, setNetQuantityValue] = useState(initial.netQuantityValue);
  const [netQuantityUnit, setNetQuantityUnit] = useState(initial.netQuantityUnit);
```

- [ ] **Стъпка 4: Увери се, че `Select` е импортиран**

Провери import реда от `@/components/ui`. Ако `Select` липсва — добави го. (`Input`, `Card` вече се ползват.)

- [ ] **Стъпка 5: Добави UI секцията след „Цена и наличност“**

Веднага след затварящия `</Card>` на „Цена и наличност“ добави нова `<Card>`. Ползвай само `@/components/ui` компоненти, типографски кавички, тон „на ти“, `h-11` touch targets (компонентите вече го дават):

```tsx
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-ink-900">Тегло и размер</h2>
            <p className="text-sm text-ink-500">
              По избор. Попълни тегло и размери, за да смятаме автоматично цена за
              доставка с Еконт и Спиди по-късно. Иначе ползвай фиксирана цена на доставка.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Input
              type="number"
              min={1}
              label="Тегло (грамове)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              error={fieldErrors.weight}
              inputMode="numeric"
            />
            {Number(weight) >= 1000 && (
              <p className="text-sm text-ink-500">
                = {formatPrice ? "" : ""}
                {(Number(weight) / 1000).toFixed(1).replace(".", ",")} кг
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-700">Размери (см, по избор)</span>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                min={0}
                label="Дължина"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                error={fieldErrors.length}
                inputMode="decimal"
              />
              <Input
                type="number"
                min={0}
                label="Ширина"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                error={fieldErrors.width}
                inputMode="decimal"
              />
              <Input
                type="number"
                min={0}
                label="Височина"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                error={fieldErrors.height}
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-700">Количество (по избор)</span>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                label="Стойност"
                value={netQuantityValue}
                onChange={(e) => setNetQuantityValue(e.target.value)}
                inputMode="decimal"
              />
              <Select
                label="Единица"
                value={netQuantityUnit}
                onChange={(e) => setNetQuantityUnit(e.target.value)}
              >
                <option value="mg">милиграм (мг)</option>
                <option value="g">грам (г)</option>
                <option value="kg">килограм (кг)</option>
                <option value="ml">милилитър (мл)</option>
                <option value="l">литър (л)</option>
              </Select>
            </div>
            <p className="text-sm text-ink-500">
              Показва се на страницата на продукта, напр. „500 мл“.
            </p>
          </div>
        </Card>
```

**Забележка:** махни неизползвания `formatPrice` фрагмент — просто покажи живото „= X,X кг“:
```tsx
            {Number(weight) >= 1000 && (
              <p className="text-sm text-ink-500">
                = {(Number(weight) / 1000).toFixed(1).replace(".", ",")} кг
              </p>
            )}
```
Провери точните имена на props на `<Input>`/`<Select>` (`label`, `error`, `value`, `onChange`) спрямо съществуващата употреба във формата и `src/components/ui/index.ts` — ползвай каквото вече ползват другите полета (напр. ако грешките идват като `fieldErrors.price`, следвай същия шаблон).

- [ ] **Стъпка 6: Добави полетата в payload на `handleSubmit`**

В обекта, който се подава на `saveProduct`, добави:
```ts
      weight,
      length,
      width,
      height,
      netQuantity:
        netQuantityValue.trim() === ""
          ? null
          : { value: netQuantityValue, unit: netQuantityUnit || "g" },
```

- [ ] **Стъпка 7: Провери typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/components/dashboard/product-form.tsx`
Expected: без грешки. (Ако `fieldErrors` няма ключове `weight/length/...` типово — те идват от Zod и са `Record<string,string>`; следвай съществуващия тип.)

- [ ] **Стъпка 8: Commit**

```bash
git add src/components/dashboard/product-form.tsx
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(product-form): секция „Тегло и размер“ (по избор)

Тегло (грамове, живо „= X,X кг“), размери Д×Ш×В в см, количество
(стойност + единица дропдаун). ProductFormInitial/emptyInitial/състояние/
payload разширени. Пояснение за фиксирана vs автоматична доставка.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 6: Форма за редакция + „нов продукт“ + onboarding — попълване на `initial`

**Files:**
- Modify: `src/app/(dashboard)/dashboard/products/[id]/page.tsx` (edit — явен `initial`)
- Verify: `src/app/(dashboard)/dashboard/products/new/page.tsx` и `src/app/(dashboard)/dashboard/onboarding/page.tsx` (дали ползват `emptyInitial` — ако да, автоматично покрити от Task 5)

**Interfaces:**
- Consumes: `scaledToInput` от `@/lib/money`; `Product` типа (с новите колони от Task 1).
- Produces: edit страницата подава новите шест `initial` полета от продукта в базата.

- [ ] **Стъпка 1: Разшири import-а в edit страницата**

В `src/app/(dashboard)/dashboard/products/[id]/page.tsx`, ред 6:
```ts
import { centsToInput, scaledToInput } from "@/lib/money";
```

- [ ] **Стъпка 2: Добави новите полета в `initial={{...}}`**

В обекта `initial` (ред 33-57), след `deal: ...` (вътре в обекта), добави:
```ts
          weight: product.weightGrams !== null ? String(product.weightGrams) : "",
          length: product.lengthMm !== null ? scaledToInput(product.lengthMm, 10) : "",
          width: product.widthMm !== null ? scaledToInput(product.widthMm, 10) : "",
          height: product.heightMm !== null ? scaledToInput(product.heightMm, 10) : "",
          netQuantityValue:
            product.netQuantityValue !== null ? scaledToInput(product.netQuantityValue, 1000) : "",
          netQuantityUnit: product.netQuantityUnit ?? "g",
```
(`getProductWithRelations` селектира целия ред → новите колони са в `product`.)

- [ ] **Стъпка 3: Провери `new` и `onboarding` страниците**

Run: `grep -n "emptyInitial\|initial=\|<ProductForm" src/app/\(dashboard\)/dashboard/products/new/page.tsx src/app/\(dashboard\)/dashboard/onboarding/page.tsx`
Expected: ако подават `emptyInitial` (или изобщо не подават `initial`, а формата ползва `emptyInitial` по подразбиране) → нищо за правене (Task 5 покри `emptyInitial`). Ако строят собствен обект `initial` inline → добави същите шест полета с празни стойности (`weight: "", ..., netQuantityUnit: "g"`).

- [ ] **Стъпка 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки — `initial` вече съответства на разширения `ProductFormInitial`. (Ако tsc гърми, че на друга страница липсват полета в `initial` → добави ги там.)

- [ ] **Стъпка 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/products/[id]/page.tsx"
# + new/onboarding ако са пипани
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(products): edit форма зарежда тегло/размери/количество от базата

initial построен от новите колони (мм→см и ×1000→десетичен през
scaledToInput). new/onboarding покрити от emptyInitial.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 7: Публична страница — количество като характеристика + JSON-LD `weight`

**Files:**
- Modify: `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`

**Interfaces:**
- Consumes: `formatNetQuantity` от `@/lib/money`; `product.netQuantityValue`/`netQuantityUnit`/`weightGrams` (вече в заявката).
- Produces: количеството видимо в „Характеристики“; условен `weight` в Product JSON-LD.

- [ ] **Стъпка 1: Прочети релевантните секции**

Run: `grep -n "formatNetQuantity\|jsonLd\|@type.*Product\|attributes.map\|<dl\|import.*money" src/app/\(storefront\)/s/\[slug\]/p/\[productSlug\]/page.tsx`
Expected: намираш (а) import реда от `@/lib/money`, (б) JSON-LD обекта (~ред 72), (в) блока „Характеристики“ `<dl>` (~ред 162).

- [ ] **Стъпка 2: Добави `formatNetQuantity` към import-а**

```ts
import { formatPrice, formatNetQuantity } from "@/lib/money";
```
(Следвай точния съществуващ import — добави само `formatNetQuantity` към списъка.)

- [ ] **Стъпка 3: Покажи количеството като първи ред в „Характеристики“**

Намери условието, което решава дали блокът „Характеристики“ се рендерира (напр. `product.attributes.length > 0`) и го разшири:
```tsx
{(product.attributes.length > 0 || product.netQuantityValue !== null) && (
```
Вътре в `<dl>`, преди `product.attributes.map(...)`, добави реда за количество:
```tsx
              {product.netQuantityValue !== null && (
                <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-(--sf-muted)">Количество</dt>
                  <dd className="text-right font-medium text-(--sf-text)">
                    {formatNetQuantity(product.netQuantityValue, product.netQuantityUnit ?? "g")}
                  </dd>
                </div>
              )}
```
(Съгласувай точните класове/структура с това как вече изглежда всеки `attributes.map` ред — копирай неговия обвиващ `<div>`/`<dt>`/`<dd>` шаблон, за да е визуално идентично.)

- [ ] **Стъпка 4: Добави условен `weight` в JSON-LD**

В обекта, подаван на JSON-LD (`Product`), добави условен spread:
```ts
    ...(product.weightGrams !== null && {
      weight: { "@type": "QuantitativeValue", value: product.weightGrams, unitCode: "GRM" },
    }),
```
(Постави го редом с другите условни полета като `aggregateRating`/`offers` в същия обект.)

- [ ] **Стъпка 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Стъпка 6: Commit**

```bash
git add "src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx"
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(storefront): количество в „Характеристики“ + weight в JSON-LD

Количеството (formatNetQuantity) се показва като първи ред при налично;
блокът се рендерира дори само с количество. Product JSON-LD получава
условен weight (QuantitativeValue, GRM) когато тегло е зададено.
Тегло/размери остават скрити за купувача.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 8: CSV експорт — 6 нови колони

**Files:**
- Modify: `src/actions/products.ts` (`CSV_HEADER` ред 355) + мястото, което строи редовете за експорт (`toCsv` caller)

**Interfaces:**
- Consumes: `scaledToInput` от `@/lib/money`; `Product` колоните.
- Produces: `CSV_HEADER` += 6 имена; редовете за експорт съдържат стойностите (машинен формат с точка) или празно.

- [ ] **Стъпка 1: Намери CSV експорт builder-а**

Run: `grep -rn "toCsv\|CSV_HEADER" src/`
Expected: намираш кой файл извиква `toCsv(...)` с продуктови редове (route handler или action; клиентският `product-import-export.tsx` само тегли). Прочети го, за да видиш точния ред-по-ред builder и как се четат колоните на продукта.

- [ ] **Стъпка 2: Разшири `CSV_HEADER`**

В `src/actions/products.ts`, ред 355:
```ts
const CSV_HEADER = [
  "name", "slug", "description", "price", "promo_price", "stock", "category", "status",
  "weight_grams", "length_cm", "width_cm", "height_cm", "net_quantity", "net_quantity_unit",
] as const;
```

- [ ] **Стъпка 3: Добави стойностите в export builder-а**

В builder-а (открит в Стъпка 1), за всеки продукт добави клетките в реда, спазвайки реда на `CSV_HEADER`. Импортирай `scaledToInput` там, където се строят редовете:
```ts
import { scaledToInput } from "@/lib/money";
```
Клетки (машинен формат — точка, не запетая; празно при null):
```ts
  p.weightGrams !== null ? String(p.weightGrams) : "",
  p.lengthMm !== null ? scaledToInput(p.lengthMm, 10) : "",
  p.widthMm !== null ? scaledToInput(p.widthMm, 10) : "",
  p.heightMm !== null ? scaledToInput(p.heightMm, 10) : "",
  p.netQuantityValue !== null ? scaledToInput(p.netQuantityValue, 1000) : "",
  p.netQuantityUnit ?? "",
```
(Ако експортната заявка селектира само определени колони — разшири `columns` да включва новите шест.)

- [ ] **Стъпка 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: без грешки.

- [ ] **Стъпка 5: Commit**

```bash
git add src/actions/products.ts  # + експорт builder файла ако е друг
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(csv): експорт на тегло/размери/количество (6 нови колони)

CSV_HEADER += weight_grams/length_cm/width_cm/height_cm/net_quantity/
net_quantity_unit. Стойности в машинен формат (точка), празно при NULL.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 9: CSV импорт — четене на 6-те колони (TDD за parse логиката)

**Files:**
- Modify: `src/actions/products.ts` (`CSV_HEADER` вече разширен; `importProductsCsv`, ред 371-507)
- Create: `src/actions/csv-measures.ts` (чиста parse логика, тестваема)
- Test: `src/actions/csv-measures.test.ts`

**Interfaces:**
- Consumes: `cmToMm`, `toMilliQuantity` от `@/lib/money`.
- Produces: `parseCsvMeasures(cells)` → `{ ok: true, values } | { ok: false, error }` за тегло/размери/количество на един ред.

- [ ] **Стъпка 1: Напиши чистата parse функция (TDD — тест първо)**

Create `src/actions/csv-measures.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseCsvMeasures } from "./csv-measures";

describe("parseCsvMeasures", () => {
  it("празни клетки → всички null", () => {
    const r = parseCsvMeasures({ weight_grams: "", length_cm: "", width_cm: "", height_cm: "", net_quantity: "", net_quantity_unit: "" });
    expect(r).toEqual({
      ok: true,
      values: { weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, netQuantityValue: null, netQuantityUnit: null },
    });
  });

  it("валидни стойности", () => {
    const r = parseCsvMeasures({ weight_grams: "750", length_cm: "30", width_cm: "20", height_cm: "10", net_quantity: "0.5", net_quantity_unit: "l" });
    expect(r).toEqual({
      ok: true,
      values: { weightGrams: 750, lengthMm: 300, widthMm: 200, heightMm: 100, netQuantityValue: 500, netQuantityUnit: "l" },
    });
  });

  it("невалидно тегло → грешка", () => {
    const r = parseCsvMeasures({ weight_grams: "abc", length_cm: "", width_cm: "", height_cm: "", net_quantity: "", net_quantity_unit: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("тегло");
  });

  it("невалиден размер → грешка", () => {
    const r = parseCsvMeasures({ weight_grams: "", length_cm: "9999", width_cm: "", height_cm: "", net_quantity: "", net_quantity_unit: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("размер");
  });

  it("количество без валидна единица → грешка", () => {
    const r = parseCsvMeasures({ weight_grams: "", length_cm: "", width_cm: "", height_cm: "", net_quantity: "0.5", net_quantity_unit: "xx" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("количество");
  });
});
```

Create `src/actions/csv-measures.ts`:
```ts
import { cmToMm, toMilliQuantity } from "@/lib/money";

interface Cells {
  weight_grams: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  net_quantity: string;
  net_quantity_unit: string;
}

interface Measures {
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  netQuantityValue: number | null;
  netQuantityUnit: string | null;
}

const NET_UNITS = ["mg", "g", "kg", "ml", "l"];

/** Парсва измервателните CSV клетки на един ред. Празно → null; невалидно → грешка. */
export function parseCsvMeasures(
  c: Cells,
): { ok: true; values: Measures } | { ok: false; error: string } {
  let weightGrams: number | null = null;
  if (c.weight_grams.trim() !== "") {
    const w = Number(c.weight_grams.trim());
    if (!Number.isInteger(w) || w < 1 || w > 200_000) {
      return { ok: false, error: `невалидно тегло „${c.weight_grams}“` };
    }
    weightGrams = w;
  }

  function dim(raw: string, label: string): number | null | { error: string } {
    if (raw.trim() === "") return null;
    const mm = cmToMm(raw);
    if (mm === null || mm < 1 || mm > 5000) return { error: `невалиден размер (${label}) „${raw}“` };
    return mm;
  }
  const l = dim(c.length_cm, "дължина");
  if (l !== null && typeof l === "object") return { ok: false, error: l.error };
  const w = dim(c.width_cm, "ширина");
  if (w !== null && typeof w === "object") return { ok: false, error: w.error };
  const h = dim(c.height_cm, "височина");
  if (h !== null && typeof h === "object") return { ok: false, error: h.error };

  let netQuantityValue: number | null = null;
  let netQuantityUnit: string | null = null;
  if (c.net_quantity.trim() !== "") {
    const m = toMilliQuantity(c.net_quantity);
    const unit = c.net_quantity_unit.trim().toLowerCase();
    if (m === null || m <= 0 || !NET_UNITS.includes(unit)) {
      return { ok: false, error: `невалидно количество „${c.net_quantity} ${c.net_quantity_unit}“` };
    }
    netQuantityValue = m;
    netQuantityUnit = unit;
  }

  return {
    ok: true,
    values: { weightGrams, lengthMm: l as number | null, widthMm: w as number | null, heightMm: h as number | null, netQuantityValue, netQuantityUnit },
  };
}
```

- [ ] **Стъпка 2: Пусни тестовете**

Run: `pnpm exec vitest run src/actions/csv-measures.test.ts`
Expected: PASS.

- [ ] **Стъпка 3: Интегрирай в `importProductsCsv`**

В `src/actions/products.ts`:
- Импортирай: `import { parseCsvMeasures } from "./csv-measures";`
- В цикъла на импорта (след като `status` е валидиран, преди построяването на `values`), добави:
```ts
      const measures = parseCsvMeasures({
        weight_grams: cell(row, "weight_grams"),
        length_cm: cell(row, "length_cm"),
        width_cm: cell(row, "width_cm"),
        height_cm: cell(row, "height_cm"),
        net_quantity: cell(row, "net_quantity"),
        net_quantity_unit: cell(row, "net_quantity_unit"),
      });
      if (!measures.ok) {
        result.skipped.push(`ред ${lineNo}: ${measures.error}`);
        continue;
      }
```
- В обекта `values` (ред 465-474) добави: `...measures.values,` (разгъва шестте колони).
- **Забележка:** `cell()` е типизиран с `(typeof CSV_HEADER)[number]` — понеже разширихме `CSV_HEADER` в Task 8 с новите имена, `cell(row, "weight_grams")` вече е типово валидно. Ако Task 8 не е слят, увери се, че `CSV_HEADER` съдържа новите имена (те са предусловие и за импорта — колоните се откриват по header).

- [ ] **Стъпка 4: Typecheck + пусни всички unit тестове**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run`
Expected: без грешки; всички тестове минават.

- [ ] **Стъпка 5: Commit**

```bash
git add src/actions/csv-measures.ts src/actions/csv-measures.test.ts src/actions/products.ts
git commit -F <temp-msg-file>
```
Съобщение:
```
feat(csv): импорт на тегло/размери/количество (parseCsvMeasures)

Чиста parseCsvMeasures (тестваема): празно→NULL, невалидно→пропуска реда
с ясно съобщение. Интегрирана в importProductsCsv (values += measures).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 10: Финален гейт + ръчна проверка

**Files:** няма промени по код (само проверка).

- [ ] **Стъпка 1: Сканирай за невидими контролни символи в пипнатите файлове**

Използвай Grep tool с pattern `[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]` върху всички пипнати файлове (money.ts, product.ts, products.ts, product-values.ts, csv-measures.ts, product-form.tsx, двете page.tsx, schema.ts).
Expected: 0 съвпадения.

- [ ] **Стъпка 2: Пълен гейт**

Run: `pnpm check`
Expected: lint + unit + build минават без грешки.

- [ ] **Стъпка 3: Ръчна проверка (потребителят, не Playwright)**

Съобщи на потребителя да провери ръчно (dev сървър):
- Нов продукт: секцията „Тегло и размер“ се вижда след „Цена и наличност“; попълване + запис; редакция зарежда стойностите обратно (мм→см, ×1000→десетичен).
- Публична страница: количеството се показва в „Характеристики“; тегло/размери НЕ се виждат; JSON-LD съдържа `weight` при зададено тегло (view-source).
- CSV: експорт съдържа 6-те нови колони; импорт на същия файл не губи данни; ред с невалидно тегло се пропуска със съобщение.
- Мобилно 375px: секцията не прелива; размерите 3-в-ред четими.
- Празен продукт (без нови полета) работи както преди.

- [ ] **Стъпка 4: Питай за push**

Съобщи, че всичко е готово и `pnpm check` минава. **Питай потребителя за разрешение** преди push към `dev` (= Vercel production). Push САМО при изрично „да“.

- [ ] **Стъпка 5: Обнови WORKLOG**

След одобрение (или при завършване на сесията) добави ред в „Дневник“ на `docs/WORKLOG.md` + текущ commit, съгласно CLAUDE.md.

---

## Self-Review (проверено спрямо спеца)

- **Секция 2 (схема)** → Task 1 ✅ (6 nullable колони, db:push, без backfill).
- **Секция 3 (helpers)** → Task 2 ✅ (`parseScaled`/`toMilliQuantity`/`cmToMm`/`formatNetQuantity`/`scaledToInput` + тестове; `parseScaled` regex позволява 3 десетични знака за × 1000).
- **Секция 4 (Zod)** → Task 3 ✅ (`optionalWeight`/`optionalDimension`/`netQuantity` + `product.test.ts`).
- **Секция 5 (мапинг)** → Task 4 ✅ (`productValues` изнесен + тестван; шестте колони).
- **Секция 6 (форма)** → Task 5 + Task 6 ✅ (секция, състояние, initial, payload; edit/new/onboarding).
- **Секция 7 (публична)** → Task 7 ✅ (количество в „Характеристики“; условен JSON-LD `weight`; тегло/размери скрити).
- **Секция 8 (CSV)** → Task 8 (експорт) + Task 9 (импорт) ✅.
- **Секция 9 (тестове)** → покрити в Task 2/3/4/9; UI ръчно (без Playwright) в Task 10.

**Type consistency:** `cmToMm`/`toMilliQuantity`/`scaledToInput`/`parseScaled`/`formatNetQuantity` — едни и същи имена навсякъде (money.ts, product.ts, product-values.ts, csv-measures.ts, страниците). `productValues` върнатите ключове (`weightGrams`, `lengthMm`, ...) съвпадат с колоните от Task 1. `netQuantityUnit` fallback `"g"` е консистентен (форма + storefront).

**Отклонения от спеца (обосновани, не изискват промяна на спеца):**
- `productValues` е изнесен в отделен модул `src/actions/product-values.ts` — спецът го оставя в `products.ts`, но `"use server"` файл не е чисто тестваем; изнасянето е чист рефактор, поведението не се променя.
- CSV import логиката е изнесена в `csv-measures.ts` за тестваемост (спецът я скицира inline с „доизкусурява се в плана“ — ето финалната форма).
