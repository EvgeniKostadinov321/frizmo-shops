# Дизайн: Еконт/Спиди куриерска интеграция — 2026-07-12

**Статус:** одобрен дизайн, чака ревю на спеца
**Обхват:** офис-доставка + генериране на товарителница (PDF) + tracking, за Еконт и
Спиди едновременно. БЕЗ live тарифиране. Независим от social login спеца.

## Контекст и цел

Днес доставката е ръчна: куриерски методи с фиксирана/зонова цена (`shipping_methods` +
`shipping_zones` + `matchZone`), адресът е свободен текст с HERE autocomplete. Няма никаква
куриерска интеграция (greenfield — разузнаване 2026-07-12 потвърди нула следи от
Еконт/Спиди/товарителница в кода). Предусловието **тегло-на-продукт** е готово
(`products.weightGrams` + габарити, nullable).

Целта: най-силният BG diferenciator — купувачът избира офис/автомат на куриера; търговецът
генерира товарителница с един клик; наложен платеж минава автоматично през куриера; клиентът
получава tracking. Оперативната полза е огромна (край на ръчното въвеждане в куриерската
система за всяка поръчка).

## Решения (заключени с потребителя)

- **Ниво: офиси + товарителница.** НЕ live тарифиране (избягваме агрегиране на габарит,
  структуриран адрес за тарифа, nomenclature цени).
- **Двата куриера едновременно** (Еконт референтен/приоритетен). → абстракцията е
  задължителна от ден 1.
- **Ръчна/фиксирана цена.** Зоните остават ценовият източник; офисът е само дестинация на
  товарителницата. Цената НЕ идва от куриерско API.
- **Авто COD.** Поръчка с наложен платеж → товарителницата носи total-а автоматично.
- **Per-shop ключове.** Всеки търговец въвежда собствения си Еконт/Спиди акаунт (те са
  страна по договора с куриера — юридически правилно, за разлика от общ наш акаунт).
- **Търсене на офис по град** на checkout (офисите кеширани локално от куриерското API).

## Архитектура

### 1. Абстракция на куриера — `src/lib/couriers/`

Общ интерфейс, който всеки куриер имплементира. Шевът, който прави Спиди „добавяне", не
„пренаписване". HTTP към куриера е САМО тук; останалата система вика интерфейса.

```ts
// types.ts
interface Office { officeId: string; name: string; city: string; address: string; type: "office" | "apt" }
interface WaybillResult { waybillId: string; trackingNumber: string; labelPdf: Uint8Array | string /* base64/url */ }
class CourierError extends Error { /* общо BG съобщение навън, детайл в лог */ }

interface CourierProvider {
  id: "econt" | "speedy"
  searchOffices(city: string, creds: CourierCreds): Promise<Office[]>
  createWaybill(input: WaybillInput, creds: CourierCreds): Promise<WaybillResult>
  trackingUrl(trackingNumber: string): string
}
```

- Файлове: `types.ts` (интерфейс + типове + `CourierError`), `econt.ts`, `speedy.ts`,
  `index.ts` (registry: `getCourier(id): CourierProvider`).
- Всеки provider тестваем сам (mock-ната HTTP). Конкретните API полета се уточняват при
  имплементацията (четем реалната куриерска документация тогава — AGENTS.md правилото за
  „прочети преди да пишеш"). Еконт: JSON API (Econt Delivery); Спиди: REST API.
- **Грешки:** provider хвърля `CourierError` → общо BG навън, technical detail само в
  server лог. Куриерско API пада → поръчката/потокът не се чупи.

### 2. Данни модел (4 промени по `src/db/schema.ts`)

**A. Нова таблица `shop_courier_accounts`** (tenant-изолирана):
```
id · shopId (FK cascade) · provider ("econt"|"speedy") · credentials (jsonb) ·
senderName · senderPhone · senderCity · senderAddress · active (bool) · createdAt · updatedAt
uniqueIndex (shopId, provider)   // един акаунт на куриер на магазин
```
`.enableRLS()` без policies. Ключовете само сървърно (Drizzle direct), никога `NEXT_PUBLIC_`.

**B. Нова таблица `courier_offices`** (кеш на nomenclature — офисите са хиляди, менят се рядко):
```
id · provider · officeId (куриерски) · name · city · address · type ("office"|"apt") · updatedAt
index (provider, city)   // търсене по град
```
Опресняване: lazy при първо търсене на град с изтекъл кеш, ИЛИ периодичен refresh. Пести
API заявки на всеки checkout.

**C. Разширение на `shipping_methods`:**
```
+ courierProvider ("econt"|"speedy"|null)   // null = стар ръчен куриер (обратна съвместимост)
+ deliveryTarget ("address"|"office")        // до адрес или до офис
```
Съществуващите куриерски методи → `null` provider → работят точно както сега (нула регресия).

**D. Разширение на `orders`** (снапшоти на товарителницата, всичко nullable):
```
+ courierProvider (text) · courierOfficeId (text) · courierOfficeName (text) ·
  waybillId (text) · trackingNumber (text)
```

Всичко ново е nullable → `db:push` без backfill, нула регресия за съществуващи
поръчки/магазини/методи.

### 3. Търговски setup (dashboard)

**A. Нов таб „Куриери" в `/dashboard/fulfillment`** (до Доставка/Плащане/Поръчки-връщания):
- Карта Еконт + карта Спиди. Всяка: акаунт ключове (username/password или token, според
  куриера) + данни на подателя (име/телефон/град/адрес за товарителницата) + toggle „активен".
- **Валидация при запис:** тестова заявка към куриера (`searchOffices` за тестов град) →
  зелена „свързан" / „невалидни ключове".
- Ключовете се маскират след запис (`••••`, като Stripe панела).

**B. При създаване/редакция на куриерски метод** (`FulfillmentManager`):
- Ако търговецът има свързан куриер → нови полета „Куриер" (Еконт/Спиди/без) + „Доставка до"
  (адрес/офис). Метод без куриер → работи както сега.
- Цената остава от метода/зоните (ръчна).

**Actions** (нов `src/actions/couriers.ts`): `saveCourierAccount`, `deleteCourierAccount`,
`testCourierConnection` — всичките през `requireShop()`, Zod, санитизация. Ключовете никога
не се логват.

### 4. Checkout (купувачът избира офис)

- Купувачът избира куриерски метод с `deliveryTarget = "office"` → появява се
  **офис-търсачка**: пише град → офисите/автоматите на този куриер в града (dropdown с
  търсене) от `courier_offices` кеша (не удря API на всеки клавиш) → избира → снапшот
  (`officeId` + име) във формата.
- Метод „до адрес" → текущият address autocomplete както сега (нула промяна).
- **`orderSchema`:** `courierOfficeId` + `courierOfficeName` (опционални; **задължителни
  само ако методът е office-based** — Zod refine).
- **Сървърна валидация (`createOrder`, авторитетна):** office-based метод без избран офис →
  блокира „Избери офис" (както зоните сега блокират „Избери зона"); цената resolve-ва както
  сега (метод/зони) — офисът НЕ мени цената; снапшот на офиса в поръчката.
- **Компонент:** нов `CourierOfficePicker` (storefront, `--sf-*` токени, темово-съгласуван,
  огледало на `SfAddressAutocomplete`). Graceful degrade: куриер недостъпен → текстово поле
  (поръчката не се блокира от външен срив).

### 5. Генериране на товарителница (търговецът)

- **Къде:** order detail (`/dashboard/orders/[id]`) — бутон „Генерирай товарителница" до
  `OrderActions`, закачен за прехода `confirmed → shipped`.
- **Server action `generateWaybill(orderId)`** (`requireShop()`):
  - Взима куриерския акаунт + подателя на магазина.
  - Взима поръчката: получател (име/телефон), дестинация (офис ID или адрес), **тегло**
    (агрегирано `order_items` → `products.weightGrams`; липсва → разумен fallback +
    предупреждение), **COD сума** (ако `paymentType = cod` → total-а, авто).
  - Вика `courier.createWaybill(...)` → `waybillId` + `trackingNumber` + PDF етикет.
  - Записва снапшотите в поръчката; по избор авто-преход към `shipped`.
- **Идемпотентност:** поръчка с `waybillId != null` → показва съществуващата, не прави дубъл.
- **PDF етикет:** отваря се в нов таб / сваля за печат (огледало на съществуващия print route).
- **Tracking:** `trackingNumber` → линк „Проследи" (`courier.trackingUrl()`) в поръчката +
  опционално в статус имейла до купувача.
- **Грешки:** API пада / невалидни данни → общо BG „Товарителницата не може да се създаде
  сега, опитай пак" + детайл в server лог. Поръчката непокътната.

## Тестване

- **Чисти функции (TDD, unit без API):** `aggregateOrderWeight(items, products)` (сумиране
  с fallback); `resolveCodAmount(order)` (COD само при `paymentType=cod` → total); mapper-ите
  вход→куриерски payload за всеки provider.
- **Provider тестове (mock HTTP):** `searchOffices` парсва отговора; `createWaybill` праща
  правилен payload; API грешка → `CourierError`.
- **Zod refine:** office-based метод изисква `courierOfficeId`.
- **Без нов e2e** (иска реални куриерски ключове) — ръчна проверка на живо след credentials.
- `pnpm check` гейт зелен на всяка стъпка.

## Multi-tenant изолация (правило №1)

Всяка courier мутация през `requireShop()`; `shop_courier_accounts` филтрирани по `shopId`;
ключове само сървърно (Drizzle direct), никога `NEXT_PUBLIC_`. Товарителницата на магазин А
не може да ползва акаунта на магазин Б.

## Обратна съвместимост (нула регресия)

Всичко ново е nullable; куриерски метод без `courierProvider` работи точно както днес;
поръчка без товарителница — непроменена. Съществуващите ръчни зони остават непокътнати.

## Какво чака потребителя (външно, преди имплементация)

Регистрация в Еконт + Спиди → API ключове (username/password или token) → въвеждат се от
търговеца в dashboard-а (НЕ в env — per-shop). За теста ти трябва поне един реален акаунт
(Еконт е приоритетен).

## Извън обхвата (изрично)

- **Live тарифиране** по тегло/габарит (отделно, по-тежко ниво).
- **Международни пратки.**
- **Анулиране/връщане на товарителница** (v2).
- **Автоматично известяване на куриера за взимане** (v2).
- **Живо API ценообразуване** — цената остава ръчна/зонова.
