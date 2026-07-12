# Адрес autocomplete + автоматични зони по град (дизайн)

**Дата:** 2026-07-12
**Контекст:** обратна връзка от тест-сесията на Пакет Д. Ръчният zone-picker на checkout
(радио бутони София/Пловдив/…) е объркващ и не мащабира (15 зони = 15 бутона). Адресът и
градът на checkout се въвеждат отделно и не се мачват.

**Цел:** чист checkout UX — клиентът пише адрес (autocomplete → авто-попълва град), а зоната
на доставка се **мачва автоматично по града на сървъра**, без никакъв picker. Плюс адрес
autocomplete навсякъде, където купувач въвежда адрес (checkout + ръчна поръчка).

**Стек/правила:** Next.js 16 · Drizzle/Supabase (`db:push`) · Zod · EUR интегер центове ·
`--sf-*` токени за storefront / `surface-*`/`ink-*` за dashboard · pricing на сървъра е
единственият ценови източник · inline изпълнение.

---

## Решения (фиксирани с потребителя)

1. Storefront **вариант** на autocomplete (не dashboard компонента директно) — `--sf-*` токени.
2. Град **остава редактируем** след авто-попълване.
3. Зона = **списък градове** (текст, comma-separated) + флаг **„Останала страна"** (fallback).
4. Checkout: **без zone picker** — цената идва от града, тихо.
5. Градовете се въвеждат като **текстово поле със запетаи** („София, Пловдив, Варна").
6. Непознат град + няма fallback зона → **базовата цена на метода** (никога не блокира).

---

## Съществуващо (какво преизползваме)

- `AddressAutocomplete` (`src/components/dashboard/address-autocomplete.tsx`) — HERE autosuggest,
  dashboard-стилизиран (`Input` + `surface-*`). Съдържа: HERE fetch (debounce 300ms, BG филтър,
  abort), `resolveCity(suggestion)`, dropdown с предложения. Ползван в shop-form + shop-wizard.
- `shipping_zones` таблица (id, shopId, shippingMethodId, name, priceCents, sortOrder).
- `pricing.ts` — `priceCart(lines, products, shipping?, coupon?, giftWrapFee)`; shipping се подава
  като `{name, priceCents, freeOverCents}`. Зоната се резолвя в `createOrder` ПРЕДИ `priceCart`.
- `checkout-form.tsx` — има zone радио-picker (Д3), `shippingZoneId` в orderSchema, `selectedZone`.
- `manual-order-form.tsx` — търговска ръчна поръчка; адрес/град обикновени `<Input>`.
- `NEXT_PUBLIC_HERE_API_KEY` — зададен.

---

## Архитектура

### Част 1 — Споделена HERE логика (`useAddressSuggest`)

Изнасяме HERE fetch + типовете + `resolveCity` от `AddressAutocomplete` в споделен hook
`src/lib/use-address-suggest.ts` (`"use client"`):

```
useAddressSuggest() → {
  suggestions: AddressSuggestion[],
  loading: boolean,
  query: (text: string) => void,   // debounce + fetch; празни при <3 знака/липсващ ключ
  clear: () => void,
}
```
Плюс изнесени: `AddressSuggestion`, `AddressResult` типове, `resolveCity`. Логиката е UI-агностична
(hook връща данни; компонентът рисува). Dashboard `AddressAutocomplete` се пренаписва да ползва
hook-а — **нула визуална промяна**, само вътрешна.

### Част 2 — Storefront autocomplete (`SfAddressAutocomplete`)

Нов `src/components/storefront/sf-address-autocomplete.tsx` (`"use client"`), използва
`useAddressSuggest`. Стилизиран със `--sf-*` (input + dropdown като темата на магазина).
Props: `value`, `onChange(value)`, `onSelect({fullAddress, city})`, `label?`, `error?`.
Graceful: липсващ HERE ключ / грешка → работи като обикновено текстово поле (hook връща празни
suggestions, dropdown-ът не се показва).

Използван в:
- **checkout-form.tsx** — заменя сегашния address `<input>`; `onSelect` попълва address + city.
- **manual-order-form.tsx** — заменя address `<Input>`; `onSelect` попълва address + city.
  (manual-order е dashboard — там ползва **dashboard** `AddressAutocomplete`, НЕ sf-варианта.
  Sf-вариантът е само за storefront checkout. Manual-order получава dashboard autocomplete.)

### Част 3 — Зони по град (модел + мачване)

**Схема** — 2 нови колони на `shipping_zones`:
```
cities: text notnull default ""       -- comma-separated градове ("София, Пловдив")
isFallback: boolean notnull default false  -- „Останала страна" (мач при непокрит град)
```

**Чиста функция** `matchZone(city, zones) → zone | null` (`src/lib/match-zone.ts`, TDD):
- нормализира входа: trim, lowercase, маха префикси „гр.", „град", „с.", „село".
- за всяка зона: разбива `cities` по запетая, нормализира всеки → ако някой == нормализирания
  град на клиента → мач (първата зона с мач по sortOrder печели).
- ако няма мач → връща зоната с `isFallback = true` (ако има) → иначе `null`.

**Dashboard редактор (`ShippingZonesEditor`):** всяка зона получава:
- текстово поле „Градове (със запетая)" (`cities`)
- чекбокс „Останала страна (fallback)" (`isFallback`)
Съществуващите име + цена остават. `zoneSchema` разширена с `cities`, `isFallback`.

**Сървърно прилагане (`createOrder` + manual):** методът има зони → `matchZone(input.city, zones)`:
- мач → цена = зоната, `shippingName = "{метод} — {зона}"`.
- няма мач → базовата цена на метода (`shippingName = метод`).
`freeOverCents` на метода важи независимо (безплатна над сума побеждава).

**Checkout UI:** премахваме zone радио-picker + `shippingZoneId` от потока. Клиентът праща само
`city` (както винаги). Резюмето показва цената, която сървърът връща (`priceCartAction` вече
преизчислява при промяна). Ценовата разбивка на клиента (`checkout-form` `totals`) също трябва да
мачне зоната локално за instant preview — ползва същия `matchZone` (клиентски, върху подадените
зони) ИЛИ разчита на серверния `priceCartAction`. **Решение:** клиентски `matchZone` за instant
preview (зоните вече се подават като props); сървърът е финалният източник (преизчислява при
submit). Това пази досегашния instant-totals UX без излишни заявки.

---

## Данни поток (checkout)

```
клиент: пише адрес → SfAddressAutocomplete → onSelect попълва address + city
      ↓
клиент: totals useMemo → matchZone(city, methodZones) → instant цена в резюмето
      ↓ (submit)
createOrder(city, shippingMethodId, ...) → matchZone(city, zones) на СЪРВЪРА
      ↓
priceCart(..., {name: zoneName, priceCents: zonePrice, freeOverCents}) → финална цена + snapshot
```

`shippingZoneId` вече НЕ се праща от клиента (сървърът решава по града). Премахва се от orderSchema
(или се игнорира — за чистота: премахва се).

---

## Edge cases

- **Липсващ HERE ключ:** autocomplete → обикновено текстово поле; клиентът пише адрес+град ръчно;
  зоната пак се мачва по ръчно въведения град.
- **Празен/непознат град:** метод със зони → fallback зона → ако няма → базова цена на метода.
- **Множествен мач (град в 2 зони):** първата по sortOrder печели (детерминистично).
- **Метод без зони:** работи както преди (фиксирана цена на метода).
- **Pickup метод (взимане от място):** няма адрес/град → зоните не важат (само courier има зони,
  както е сега).
- **Промяна на града след избор:** клиентът редактира града ръчно → totals преизчисляват зоната.
- **manual-order без autocomplete на dashboard:** ползва dashboard AddressAutocomplete (вече го има
  като компонент); градът се мачва на сървъра при manual поръчка също.

## Тестова стратегия

- **`matchZone` (TDD, чиста функция):** точен мач, case-insensitive, префикси („гр. София"),
  множествен списък, fallback, няма fallback → null, празен град.
- **`useAddressSuggest`:** извлечена логика; тестът покрива `resolveCity` (вече de-facto тестван
  ръчно). Fetch/debounce → ръчна проверка (integration).
- **Pricing със зони по град:** unit срещу `matchZone` + `priceCart` (съществуващите pricing тестове
  не се чупят — shipping обектът остава същата форма).
- `pnpm check` гейт. Ръчна проверка от потребителя (без Playwright).

## Файлове

**Ново:**
- `src/lib/use-address-suggest.ts` — споделен hook + типове + `resolveCity`.
- `src/lib/match-zone.ts` (+ `.test.ts`) — чиста функция за мачване град→зона.
- `src/components/storefront/sf-address-autocomplete.tsx` — storefront вариант.

**Промяна:**
- `src/components/dashboard/address-autocomplete.tsx` — ползва hook-а (без визуална промяна).
- `src/db/schema.ts` — `shipping_zones.cities` + `.isFallback`.
- `src/schemas/fulfillment.ts` — `zoneSchema` + cities/isFallback.
- `src/db/queries/shipping-zones.ts` — (без промяна; findMany вече връща всички колони).
- `src/actions/fulfillment.ts` — `saveShippingZone` приема cities/isFallback.
- `src/components/dashboard/shipping-zones-editor.tsx` — полета за градове + fallback чекбокс.
- `src/actions/orders.ts` — `createOrder` + manual: `matchZone` вместо `shippingZoneId` резолюция.
- `src/schemas/order.ts` — премахва `shippingZoneId` (сървърът решава по града).
- `src/components/storefront/checkout-form.tsx` — sf-autocomplete + премахва zone picker +
  клиентски `matchZone` за instant totals.
- `src/components/dashboard/manual-order-form.tsx` — dashboard AddressAutocomplete + град мач.

## Ред на имплементация (един план)

1. Споделен hook (`useAddressSuggest`) + рефактор на dashboard AddressAutocomplete.
2. `matchZone` чиста функция (TDD).
3. Схема (`cities` + `isFallback`) + `zoneSchema` + action + dashboard редактор.
4. Сървърно мачване в `createOrder` (+ manual) — замяна на zone picker логиката.
5. Storefront `SfAddressAutocomplete` + checkout (autocomplete + премахване на picker + instant totals).
6. manual-order autocomplete.
7. `db:push` + `pnpm check`.
