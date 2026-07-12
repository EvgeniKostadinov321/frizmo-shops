# Адрес autocomplete + автоматични зони по град — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Адрес autocomplete на checkout (+ ръчна поръчка) с авто-попълване на града, и автоматично мачване на зона на доставка по града — без zone picker.

**Architecture:** Изнасяме HERE логиката в споделен hook `useAddressSuggest`; dashboard `AddressAutocomplete` го ползва (без визуална промяна), нов `SfAddressAutocomplete` (`--sf-*`) — за checkout. Зоните получават списък градове + fallback флаг; чиста функция `matchZone(city, zones)` намира зоната; сървърът (`createOrder`) прилага цената по града вместо по избран `shippingZoneId`.

**Tech Stack:** Next.js 16 App Router · Drizzle/Supabase · Zod · EUR интегер центове · HERE Autosuggest API.

## Global Constraints

- Storefront UI ползва `--sf-*` токени; dashboard ползва `surface-*`/`ink-*`. Без inline стойности.
- Pricing на сървъра е единственият ценови източник (`src/lib/pricing.ts`). Пари в интегер центове.
- Всяка мутация на търговец през `requireShop()`; публични през rate-limit (вече има в checkout).
- BG UI с „…“. `count(n, NOUNS.x)` за числа. `pnpm check` е гейтът.
- `db:push` изисква `DATABASE_URL_MIGRATIONS` в shell (стойността не се printва). Един `db:push`.
- `"use server"` файл експортира само async функции → чистите helper-и живеят в неутрални `@/lib/*`.
- HERE ключ: `NEXT_PUBLIC_HERE_API_KEY` (вече зададен; `.trim()` заради trailing newline).

---

### Task 1: Споделен hook `useAddressSuggest` + рефактор на dashboard AddressAutocomplete

**Files:**
- Create: `src/lib/use-address-suggest.ts`
- Modify: `src/components/dashboard/address-autocomplete.tsx`

**Interfaces:**
- Produces: `useAddressSuggest() → { suggestions: AddressSuggestion[]; loading: boolean; query(text: string): void; clear(): void }`; типове `AddressSuggestion`, `AddressResult`; функция `resolveCity(s: AddressSuggestion): string`.

- [ ] **Step 1: Създай hook-а** (изнеси логиката от address-autocomplete.tsx)

```ts
// src/lib/use-address-suggest.ts
"use client";

import { useRef, useState } from "react";

/* HERE autosuggest логика — споделена между dashboard и storefront варианта.
   .trim() на ключа: env стойност с trailing newline → %0A → "Illegal API key id". */
const HERE_API_KEY = (process.env.NEXT_PUBLIC_HERE_API_KEY ?? "").trim();

export interface AddressSuggestion {
  id: string;
  title: string;
  resultType: string;
  address?: { label?: string; city?: string; district?: string; county?: string };
}

export interface AddressResult {
  fullAddress: string;
  city: string;
}

export function resolveCity(suggestion: AddressSuggestion): string {
  const addr = suggestion.address;
  const direct = addr?.city || addr?.district || addr?.county;
  if (direct) return direct;
  if (addr?.label) {
    /* HERE label: "ул. Х 25, 4004 Пловдив, България" — градът е предпоследната част. */
    const parts = addr.label.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const cityPart = parts[parts.length - 2]!.replace(/^\d+\s*/, "");
      if (cityPart) return cityPart;
    }
  }
  return "";
}

export function useAddressSuggest() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function clear() {
    setSuggestions([]);
  }

  function query(text: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3 || !HERE_API_KEY) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: text,
          apiKey: HERE_API_KEY,
          at: "42.7339,25.4858",
          in: "countryCode:BGR",
          limit: "5",
          lang: "bg",
        });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(
          `https://autosuggest.search.hereapi.com/v1/autosuggest?${params}`,
          { signal: controller.signal },
        );
        clearTimeout(timer);
        const data = (await res.json()) as { items?: AddressSuggestion[] };
        const items = (data.items ?? []).filter((item) =>
          ["houseNumber", "street", "place"].includes(item.resultType),
        );
        setSuggestions(items);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  return { suggestions, loading, query, clear };
}
```

- [ ] **Step 2: Пренапиши dashboard AddressAutocomplete да ползва hook-а**

В `src/components/dashboard/address-autocomplete.tsx`: махни локалните `HERE_API_KEY`, `AddressSuggestion`, `resolveCity`, fetch логиката и `suggestions`/`loading`/`debounceRef` state; вместо тях `const { suggestions, loading, query, clear } = useAddressSuggest();`. Импортирай типовете + `resolveCity` от hook-а. Запази `open` state + click-outside + рендера (Input + dropdown) — БЕЗ визуална промяна. `handleInput(q)` става:
```ts
function handleInput(q: string) {
  onChange(q);
  query(q);
  setOpen(q.length >= 3);
}
```
`handleSelect` ползва импортирания `resolveCity`; след избор `clear()` + `setOpen(false)`.
Re-export за обратна съвместимост (shop-form/wizard импортират `AddressResult` оттук):
```ts
export type { AddressResult } from "@/lib/use-address-suggest";
```

- [ ] **Step 3: Verify — dashboard autocomplete работи без визуална промяна**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -iE "address-autocomplete|use-address" | grep -v contrast`
Expected: без грешки. (Ръчна визуална проверка на shop-form autocomplete — по-късно от потребителя.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/use-address-suggest.ts src/components/dashboard/address-autocomplete.tsx
git commit -m "refactor(address): споделен useAddressSuggest hook (без визуална промяна)"
```

---

### Task 2: `matchZone` чиста функция (TDD)

**Files:**
- Create: `src/lib/match-zone.ts`
- Test: `src/lib/match-zone.test.ts`

**Interfaces:**
- Produces: `matchZone(city: string, zones: ZoneLike[]): ZoneLike | null` където `ZoneLike = { cities: string; isFallback: boolean; sortOrder: number; ... }`. Връща зоната с мач по града (първата по sortOrder), иначе fallback зоната, иначе null.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/match-zone.test.ts
import { describe, expect, it } from "vitest";
import { matchZone, type ZoneLike } from "./match-zone";

const z = (name: string, cities: string, isFallback = false, sortOrder = 0): ZoneLike =>
  ({ name, cities, isFallback, sortOrder }) as ZoneLike;

describe("matchZone", () => {
  const zones = [
    z("София", "София", false, 1),
    z("Големи градове", "Пловдив, Варна, Бургас", false, 2),
    z("Останала страна", "", true, 3),
  ];

  it("точен мач по град", () => {
    expect(matchZone("София", zones)?.name).toBe("София");
  });
  it("мач в списък със запетаи", () => {
    expect(matchZone("Варна", zones)?.name).toBe("Големи градове");
  });
  it("case-insensitive + trim", () => {
    expect(matchZone("  пловдив ", zones)?.name).toBe("Големи градове");
  });
  it("маха префикс „гр.“", () => {
    expect(matchZone("гр. София", zones)?.name).toBe("София");
  });
  it("непознат град → fallback зоната", () => {
    expect(matchZone("Козлодуй", zones)?.name).toBe("Останала страна");
  });
  it("непознат град без fallback → null", () => {
    const noFallback = [z("София", "София", false, 1)];
    expect(matchZone("Козлодуй", noFallback)).toBeNull();
  });
  it("празен град → fallback (ако има)", () => {
    expect(matchZone("", zones)?.name).toBe("Останала страна");
  });
  it("първата зона по sortOrder печели при дублиран град", () => {
    const dup = [z("Б", "София", false, 2), z("А", "София", false, 1)];
    expect(matchZone("София", dup)?.name).toBe("А");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/match-zone.test.ts`
Expected: FAIL — модулът не съществува.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/match-zone.ts

export interface ZoneLike {
  name: string;
  cities: string;
  isFallback: boolean;
  sortOrder: number;
}

/** Нормализира град: trim, lowercase, маха префикси „гр./град/с./село“ и точки. */
function normalizeCity(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(гр|град|с|село)\.?\s+/u, "")
    .trim();
}

/**
 * Намира зоната за даден град: първо точен мач в списъка `cities` (първата по
 * sortOrder печели), иначе зоната с `isFallback`, иначе null.
 */
export function matchZone<T extends ZoneLike>(city: string, zones: T[]): T | null {
  const target = normalizeCity(city);
  const sorted = [...zones].sort((a, b) => a.sortOrder - b.sortOrder);

  if (target) {
    for (const zone of sorted) {
      const cityList = zone.cities
        .split(",")
        .map((c) => normalizeCity(c))
        .filter(Boolean);
      if (cityList.includes(target)) return zone;
    }
  }
  return sorted.find((z) => z.isFallback) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/match-zone.test.ts`
Expected: PASS (8 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/match-zone.ts src/lib/match-zone.test.ts
git commit -m "feat(shipping): matchZone — град→зона мачване + TDD"
```

---

### Task 3: Схема (cities + isFallback) + zoneSchema + action + dashboard редактор

**Files:**
- Modify: `src/db/schema.ts` (2 колони на `shipping_zones`)
- Modify: `src/schemas/fulfillment.ts` (`zoneSchema`)
- Modify: `src/actions/fulfillment.ts` (`saveShippingZone`)
- Modify: `src/components/dashboard/shipping-zones-editor.tsx`

**Interfaces:**
- Consumes: `ZoneLike` полета (cities/isFallback/sortOrder) от Task 2.
- Produces: `shipping_zones.cities` (text), `shipping_zones.isFallback` (boolean); `zoneSchema` с `cities`/`isFallback`.

- [ ] **Step 1: Добави колоните** в `src/db/schema.ts` (в `shippingZones`, след `priceCents`)

```ts
    priceCents: integer("price_cents").notNull(),
    /** Д3.1: градове в тази зона (comma-separated, за авто-мач по града на клиента). */
    cities: text("cities").notNull().default(""),
    /** Д3.1: „Останала страна“ — мач при непокрит град (най-много една смислена per метод). */
    isFallback: boolean("is_fallback").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
```

- [ ] **Step 2: Разшири zoneSchema** в `src/schemas/fulfillment.ts`

```ts
export const zoneSchema = z.object({
  shippingMethodId: z.uuid(),
  name: z.string().trim().min(2, "Въведи име на зона").max(60),
  price: priceString,
  /** Градове (comma-separated). Празно е ОК, ако зоната е fallback. */
  cities: z.string().trim().max(500).default(""),
  isFallback: z.boolean().default(false),
});
```

- [ ] **Step 3: Обнови `saveShippingZone`** в `src/actions/fulfillment.ts`

В `db.insert(shippingZones).values({...})` добави `cities` + `isFallback` от `parsed.data`:
```ts
  await db.insert(shippingZones).values({
    shopId: shop.id,
    shippingMethodId: method.id,
    name: sanitizeText(parsed.data.name, 60),
    priceCents: toCents(parsed.data.price)!,
    cities: sanitizeText(parsed.data.cities, 500),
    isFallback: parsed.data.isFallback,
    sortOrder: (orderRow?.maxOrder ?? 0) + 1,
  });
```
(`sanitizeText` вече е импортиран в файла.)

- [ ] **Step 4: Обнови dashboard редактора** `src/components/dashboard/shipping-zones-editor.tsx`

Разшири формата за нова зона с поле „Градове" + чекбокс „Останала страна". Добави локален state:
```tsx
const [cities, setCities] = useState("");
const [isFallback, setIsFallback] = useState(false);
```
В `add()` подай `cities`/`isFallback` към `saveShippingZone`; ресетни ги след успех. UI (под име+цена реда, преди бутона „Добави"):
```tsx
<Input
  label="Градове (със запетая)"
  hideLabel
  placeholder="напр. София, Перник"
  value={cities}
  onChange={(e) => setCities(e.target.value)}
/>
<Checkbox
  label="Останала страна (при непокрит град)"
  checked={isFallback}
  onChange={(e) => setIsFallback(e.target.checked)}
/>
```
Импортирай `Checkbox` от `@/components/ui`. Показвай `z.cities` (или „Останала страна“ при fallback) под всяка съществуваща зона в списъка. Обнови подсказката: „Клиентът пише адрес → градът избира зоната автоматично.“

- [ ] **Step 5: Verify build**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -iE "shipping-zones|fulfillment|schema" | grep -v contrast`
Expected: без грешки.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/schemas/fulfillment.ts src/actions/fulfillment.ts src/components/dashboard/shipping-zones-editor.tsx
git commit -m "feat(shipping): зони с градове + fallback флаг (dashboard редактор)"
```

---

### Task 4: Сървърно мачване по града в `createOrder`

**Files:**
- Modify: `src/actions/orders.ts` (замяна на shippingZoneId резолюцията с matchZone)
- Modify: `src/schemas/order.ts` (премахни `shippingZoneId`)

**Interfaces:**
- Consumes: `matchZone` (Task 2), `shipping_zones.cities`/`isFallback` (Task 3).

- [ ] **Step 1: Импортирай matchZone** в `src/actions/orders.ts` (при другите @/lib импорти)

```ts
import { matchZone } from "@/lib/match-zone";
```

- [ ] **Step 2: Замени зона блока** (сегашните редове ~193-211)

Стар код (търси и замени):
```ts
  /* Д3: зони на доставка. Ако методът има ≥1 зона → цената идва от избраната зона
     (изисква се); без зони → базовата цена на метода. Всичко се решава на сървъра. */
  const methodZones =
    shipping.type === "courier"
      ? await db.query.shippingZones.findMany({
          where: and(
            eq(shippingZones.shippingMethodId, shipping.id),
            eq(shippingZones.shopId, shop.id),
          ),
        })
      : [];
  let shippingDisplayName = shipping.name;
  let shippingBasePriceCents = shipping.priceCents;
  if (methodZones.length > 0) {
    const zone = methodZones.find((z) => z.id === input.shippingZoneId);
    if (!zone) return fail("Избери зона на доставка.");
    shippingDisplayName = `${shipping.name} — ${zone.name}`;
    shippingBasePriceCents = zone.priceCents;
  }
```
Нов код:
```ts
  /* Д3.1: зони по град. Ако методът има зони → мачваме по града на клиента (matchZone);
     мач → цена от зоната; непознат град → fallback зона или базовата цена на метода. */
  const methodZones =
    shipping.type === "courier"
      ? await db.query.shippingZones.findMany({
          where: and(
            eq(shippingZones.shippingMethodId, shipping.id),
            eq(shippingZones.shopId, shop.id),
          ),
        })
      : [];
  let shippingDisplayName = shipping.name;
  let shippingBasePriceCents = shipping.priceCents;
  if (methodZones.length > 0) {
    const zone = matchZone(input.city, methodZones);
    if (zone) {
      shippingDisplayName = `${shipping.name} — ${zone.name}`;
      shippingBasePriceCents = zone.priceCents;
    }
    /* Няма мач и няма fallback → базовата цена на метода (никога не блокира). */
  }
```

- [ ] **Step 3: Премахни `shippingZoneId`** от `src/schemas/order.ts`

Изтрий реда:
```ts
  /** Д3: избрана зона на доставка (при courier метод със зони). null = метод без зони. */
  shippingZoneId: z.union([z.uuid(), z.null()]).default(null),
```
(Сървърът вече решава по града; клиентът не праща зона.)

- [ ] **Step 4: Verify build**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -iE "orders.ts|order.ts" | grep -v contrast`
Expected: без грешки (проверителите на orderSchema вече не виждат shippingZoneId — Task 5 маха и клиентския му подавач).

- [ ] **Step 5: Commit**

```bash
git add src/actions/orders.ts src/schemas/order.ts
git commit -m "feat(shipping): зоната се мачва по града на сървъра (без shippingZoneId)"
```

---

### Task 5: `SfAddressAutocomplete` + checkout (autocomplete, махане на picker, instant totals)

**Files:**
- Create: `src/components/storefront/sf-address-autocomplete.tsx`
- Modify: `src/components/storefront/checkout-form.tsx`

**Interfaces:**
- Consumes: `useAddressSuggest`, `resolveCity`, `AddressResult` (Task 1); `matchZone` (Task 2).

- [ ] **Step 1: Създай storefront autocomplete**

```tsx
// src/components/storefront/sf-address-autocomplete.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveCity,
  useAddressSuggest,
  type AddressResult,
} from "@/lib/use-address-suggest";

/** Storefront адрес autocomplete (--sf-* токени). Graceful: без HERE ключ → обикновено поле. */
export function SfAddressAutocomplete({
  value,
  onChange,
  onSelect,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  className?: string;
}) {
  const { suggestions, loading, query, clear } = useAddressSuggest();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          query(e.target.value);
          setOpen(e.target.value.length >= 3);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Започни да пишеш адрес…"
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-3 text-xs text-(--sf-muted)">…</span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) py-1 shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect({
                    fullAddress: s.address?.label || s.title,
                    city: resolveCity(s),
                  });
                  clear();
                  setOpen(false);
                }}
                className="w-full px-3.5 py-2.5 text-left text-sm text-(--sf-text) transition-colors hover:bg-(--sf-bg)"
              >
                <span className="font-medium">{s.title}</span>
                {s.address?.label && s.address.label !== s.title && (
                  <span className="mt-0.5 block text-xs text-(--sf-muted)">{s.address.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Замени адрес полето в checkout-form** с autocomplete

В `src/components/storefront/checkout-form.tsx`, намери адрес `<input>` (в `{!isPickup && (...)}` блока, `name="street-address"`) и замени с:
```tsx
<SfAddressAutocomplete
  value={form.address}
  onChange={(v) => set("address", v)}
  onSelect={(r) => {
    setForm((f) => ({ ...f, address: r.fullAddress, city: r.city || f.city }));
  }}
  className={inputClass}
/>
```
Импортирай `SfAddressAutocomplete` + `matchZone`.

- [ ] **Step 3: Премахни zone picker + `shippingZoneId`**

Изтрий целия `{methodZones.length > 0 && (<Field label="Зона на доставка">…</Field>)}` блок (Д3 UI). Премахни `shippingZoneId` от form state (init), от reset при смяна на метод, и от `createOrder` payload-а (`shippingZoneId: form.shippingZoneId || null` реда). Премахни `selectedZone`. Смени radio onChange за метод обратно на `set("shippingMethodId", m.id)` (вече няма зона за ресет).

- [ ] **Step 4: Instant totals по града** (замени `selectedZone` логиката)

В `totals` useMemo, замени зоната-цена логиката с `matchZone` по града:
```ts
    /* Д3.1: instant preview на зоната по града (сървърът е финалният източник). */
    const zone = methodZones.length > 0 ? matchZone(form.city, methodZones) : null;
    const basePrice = zone ? zone.priceCents : shipping.priceCents;
    const shippingCents = free ? 0 : basePrice;
```
Обнови useMemo deps: махни `selectedZone`, добави `form.city` (и `methodZones` остава). `methodZones` остава дефиниран (`shipping?.type === "courier" ? zones.filter(...) : []`).

- [ ] **Step 5: Verify build**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -iE "checkout-form|sf-address" | grep -v contrast`
Expected: без грешки.

- [ ] **Step 6: Commit**

```bash
git add src/components/storefront/sf-address-autocomplete.tsx src/components/storefront/checkout-form.tsx
git commit -m "feat(checkout): адрес autocomplete + зона по града (без picker)"
```

---

### Task 6: manual-order dashboard autocomplete

**Files:**
- Modify: `src/components/dashboard/manual-order-form.tsx`

**Interfaces:**
- Consumes: dashboard `AddressAutocomplete` (Task 1 — вече рефакторнат).

- [ ] **Step 1: Замени адрес Input с AddressAutocomplete**

В `src/components/dashboard/manual-order-form.tsx`, намери адрес `<Input>` (~ред 239) и замени с:
```tsx
<AddressAutocomplete
  value={address}
  onChange={setAddress}
  onSelect={(r) => {
    setAddress(r.fullAddress);
    if (r.city) setCity(r.city);
  }}
/>
```
Импортирай `AddressAutocomplete` от `@/components/dashboard/address-autocomplete`. Град Input-ът остава (редактируем). Manual-order НЕ ползва зони (има ръчен shipping override) — само autocomplete за адрес/град.

- [ ] **Step 2: Verify build**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -iE "manual-order" | grep -v contrast`
Expected: без грешки.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/manual-order-form.tsx
git commit -m "feat(manual-order): адрес autocomplete за клиентския адрес"
```

---

### Task 7: db:push + пълен гейт

- [ ] **Step 1: Приложи схемата**

Зареди `DATABASE_URL_MIGRATIONS` (без printване), после:
Run: `pnpm db:push`
Expected: нови колони `cities` + `is_fallback` на `shipping_zones`, без загуба на данни.

- [ ] **Step 2: Пълен гейт**

Run: `pnpm check`
Expected: lint + unit + build зелени.

- [ ] **Step 3: Спри за проверка + push разрешение**

Докладвай: готово, `pnpm check` зелен, `db:push` приложен, чака ръчна проверка на живо + push разрешение. НЕ push-вай без изрично „да“.

---

## Self-Review (свери преди старт)

- **Спец покритие:** Част 1 hook (Task 1) · matchZone (Task 2) · схема+редактор (Task 3) · сървърно мачване (Task 4) · sf-autocomplete+checkout (Task 5) · manual-order (Task 6). ✓
- **Град остава редактируем:** checkout (`city: r.city || f.city`) + manual (`if (r.city) setCity`); отделно Град поле остава. ✓
- **Без picker (спец):** Task 5 Step 3 премахва Field-а + shippingZoneId. ✓
- **Fallback → базова цена (спец):** Task 4 — `if (zone) {...}`, иначе базовата; Task 2 — matchZone връща null без fallback. ✓
- **Pricing = сървър:** Task 4 сървърно; Task 5 instant preview е само UX (сървърът преизчислява). ✓
- **manual-order без зони (спец):** Task 6 само autocomplete; зона логиката е само в createOrder. ✓
- **use server капан:** matchZone/useAddressSuggest/resolveCity са в неутрални @/lib (не в action). ✓
- **Placeholder scan:** Task 5 Step 2/3 „намери …" са локализиращи стъпки за реалния фрагмент (name="street-address", методния radio) — не placeholder-и. `inputClass` вече съществува в checkout-form. Провери `--sf-bg` токена (fallback `--sf-surface` ако липсва).
- **Type consistency:** `matchZone(city, zones)` сигнатура еднаква в Task 2/4/5; `AddressResult {fullAddress, city}` еднакъв в Task 1/5/6; `ZoneLike` полета (cities/isFallback/sortOrder) съвпадат със schema колоните (Task 3). ✓
