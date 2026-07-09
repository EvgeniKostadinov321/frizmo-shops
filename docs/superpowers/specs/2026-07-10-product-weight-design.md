# Тегло и количество на продукт — дизайн

**Дата:** 2026-07-10
**Статус:** одобрен за планиране
**Обхват:** чисто в кода (без външна настройка от потребителя)
**Зависими задачи (по-късни):** product feed (№2), Еконт/Спиди интеграция (M3) — тази задача е тяхното **предусловие за данни**.

---

## 1. Цел

Всеки продукт да носи **тегло** (задължително, за доставка и product feed) и по избор **количество** (мл/л/г/кг — за показване на страницата). Теглото е предусловието, без което Еконт/Спиди не могат да смятат цена на доставка и product feed-ът няма `shipping_weight`.

**Извън обхвата (нарочно, YAGNI):**
- Размери (дължина × ширина × височина) — отделна по-късна задача заедно с Еконт/Спиди (те искат размери за обемно тегло). Заглавието на UI секцията вече е готово за тях („Тегло и размер").
- Тегло на ниво **вариант** — само на продукта (решение при брейнсторминга). Различните варианти споделят едно тегло.
- Самият product feed и Еконт/Спиди код — това са отделни задачи.

---

## 2. Модел на данните

Три нови колони на таблицата `products` (`src/db/schema.ts`):

| Колона | Тип | Null | Смисъл |
|---|---|---|---|
| `weightGrams` (`weight_grams`) | `integer` | **NOT NULL** | Тегло за доставка/feed, **винаги грамове** (integer, като центовете). |
| `netQuantityValue` (`net_quantity_value`) | `integer` | NULL | Опционално количество, съхранено като **число × 1000** (0.5 → 500). NULL = не е зададено. |
| `netQuantityUnit` (`net_quantity_unit`) | `text` | NULL | Единица: `'mg' \| 'g' \| 'kg' \| 'ml' \| 'l'`. NULL когато и стойността е NULL. |

**Правила за консистентност:**
- `netQuantityValue` и `netQuantityUnit` са винаги **заедно** — или и двете NULL, или и двете попълнени. Гарантира се от Zod схемата (обект или `null`), не от DB constraint.
- Няма нужда от нов Postgres enum за единицата — пази се като `text`, валидира се от Zod (`z.enum`). (Проектът ползва enum-и за статуси, но тук единицата е чисто входна валидация; `text` е по-просто и достатъчно.)

**Защо integer грамове, а не float килограми:** правилото на проекта е „мерки като integer, никога float" (`CLAUDE-backend.md`, „Пари"). Перфоратор = `4500`, керамична чаша = `250`. Аритметиката (сбор на теглата в кошница за Еконт) остава точна.

**Защо количеството е × 1000:** за да приеме десетични („0,5 л") без float в базата. `500` + `'l'` означава 0.5 л. Показва се като „0,5 л".

### Backfill на съществуващите продукти

53-те съществуващи продукта нямат тегло. Понеже `weightGrams` е `NOT NULL`, редът на прилагане има значение:

1. `db:push` добавя колоната **първо като nullable** (междинно състояние — виж плана, стъпка за схемата).
2. Скрипт `scripts/backfill-product-weight.mjs` дава `weight_grams = 500` на **всички** редове където е NULL.
3. Втори `db:push` я прави `NOT NULL`.

Дефолтът **500 г** е решение при брейнсторминга — прост, разумен за дребни стоки; търговецът го коригира при следваща редакция. Количеството остава празно (NULL) при backfill.

Скриптът:
- Чете `DATABASE_URL` (transaction pooler, `prepare:false` — както другите скриптове).
- `UPDATE products SET weight_grams = 500 WHERE weight_grams IS NULL`.
- Печата броя засегнати редове.
- Идемпотентен (повторно пускане не променя нищо — `WHERE ... IS NULL`).

---

## 3. Помощни функции (`src/lib/money.ts`)

Два нови експорта, симетрични на съществуващите `toCents` / `formatPrice`:

### `toMilli(input: string): number | null`
Приема десетичен стринг с точка **или** запетая, връща integer × 1000 или `null` при невалиден вход.

| Вход | Изход |
|---|---|
| `"0,5"` | `500` |
| `"1.5"` | `1500` |
| `"500"` | `500000` |
| `"2,25"` | `2250` |
| `"0"` | `0` |
| `""` | `null` |
| `"abc"` | `null` |
| `"-1"` | `null` |

Логиката за нормализация на запетая→точка е същата като `toCents`; фактор 1000 вместо 100. Отрицателни и нечислови → `null`.

### `formatNetQuantity(value: number, unit: string): string`
Приема съхранената стойност (× 1000) + единицата, връща човешки стринг за показване (BG стил — **запетая** за десетичните).

| Вход | Изход |
|---|---|
| `(500, "ml")` | `"500 мл"` |
| `(1500, "l")` | `"1,5 л"` |
| `(250, "g")` | `"250 г"` |
| `(1000, "kg")` | `"1 кг"` |
| `(2250, "l")` | `"2,25 л"` |

Съкращения на единиците (BG): `mg → мг`, `g → г`, `kg → кг`, `ml → мл`, `l → л`. Целите числа се показват без десетична част („1 кг", не „1,0 кг").

### `netQuantityToInput(value: number): string`
Обратното на `toMilli` — от съхранена стойност (× 1000) прави стринг за `<input>`. **Точка** за десетичните (влиза в поле за въвеждане, не се показва на купувач), БЕЗ единица. Симетричен на `centsToInput`, но фактор 1000. Ползва се при зареждане на съществуващ продукт във формата за редакция (секция 6).

| Вход | Изход |
|---|---|
| `500` | `"0.5"` |
| `1500` | `"1.5"` |
| `500000` | `"500"` |
| `1000` | `"1"` |

---

## 4. Zod схема + валидация (`src/schemas/product.ts`)

### Тегло (задължително)
```ts
const weightGrams = z.coerce
  .number({ error: "Въведи тегло в грамове" })
  .int("Теглото трябва да е цяло число грамове")
  .min(1, "Теглото трябва да е поне 1 грам")
  .max(200_000, "Максимум 200000 г (200 кг)");
```
Таван 200 кг — над това е палетна пратка, не колет; предпазва от печатни грешки (напр. грамове, въведени като килограми × 1000 × 1000).

### Количество (по избор)
```ts
const NET_UNITS = ["mg", "g", "kg", "ml", "l"] as const;

const netQuantity = z
  .union([
    z.object({
      value: z
        .string()
        .trim()
        .refine((s) => toMilli(s) !== null && toMilli(s)! > 0, "Невалидно количество (пример: 0,5)"),
      unit: z.enum(NET_UNITS),
    }),
    z.null(),
  ])
  .default(null);
```
Стойност `0` е невалидна (безсмислено количество) — затова `> 0` в `refine`.

### В `productSchema`
Добавят се два ключа:
```ts
weight: weightGrams,
netQuantity,
```

### `ProductInput` типът
Разширява се автоматично (`z.infer`). Няма ръчна промяна.

**crossValidate:** теглото се валидира изцяло от Zod — **не** се добавя нищо в `crossValidate`. (Количеството също е самодостатъчно в схемата.)

---

## 5. Мапинг към базата (`src/actions/products.ts`)

### `productValues(input, shopId)`
Добавят се три полета:
```ts
weightGrams: input.weight,
netQuantityValue: input.netQuantity ? toMilli(input.netQuantity.value)! : null,
netQuantityUnit: input.netQuantity ? input.netQuantity.unit : null,
```
`input.weight` вече е number (от `z.coerce.number`). Двете `netQuantity*` са винаги заедно NULL или заедно попълнени.

Няма промяна в `insertRelations` (теглото е на самия продукт, не в свързана таблица).

---

## 6. Форма за продукт (`src/components/dashboard/product-form.tsx`)

### Нова секция „Тегло и размер"
Слага се като нова `<Card>` **веднага след** секцията „Цена и наличност" (между ред 233 и 235). Стил идентичен на другите секции: `<Card className="flex flex-col gap-4">` + `<h2 className="text-lg font-bold text-ink-900">Тегло и размер</h2>`.

Съдържание:
```
Тегло *
[ 4500 ] грамове              = 4,5 кг
Теглото е нужно за доставка с Еконт и Спиди.
Ако не сте сигурни, въведете приблизително.

Количество (по избор)
[ 500 ] [ мл ▾ ]
Показва се на страницата на продукта, напр. „500 мл“.
```

**Полета (само компоненти от `@/components/ui`, без голи `<input>`):**
- **Тегло** — `<Input type="number" min={1}>`, задължително (`required`), `label="Тегло"`, `hint` = двуредовото копие по-горе. Живо изчисление „= X,X кг" вдясно, показва се само при стойност ≥ 1000 (число / 1000, запетая). `error={fieldErrors.weight}`.
- **Количество** — два контрола един до друг в `grid gap-4 sm:grid-cols-2` (или `flex`): `<Input type="number" min={0}>` за стойността + `<Select>` за единицата с опции: `милиграм (мг)`, `грам (г)`, `килограм (кг)`, `милилитър (мл)`, `литър (л)`. Стойностите на опциите: `mg`, `g`, `kg`, `ml`, `l`. `hint` под тях. Полето е по избор — празна стойност е ок.
- **Мобилно (375px):** двата контрола на количеството минават един под друг (grid → 1 колона под `sm`).

### Състояние (useState)
Нови състояния до останалите (ред ~87):
```ts
const [weight, setWeight] = useState(initial.weight);
const [netQuantityValue, setNetQuantityValue] = useState(initial.netQuantityValue);
const [netQuantityUnit, setNetQuantityUnit] = useState(initial.netQuantityUnit);
```

### `ProductFormInitial` + `emptyInitial`
Добавят се:
```ts
weight: string;              // "" за нов, "4500" за съществуващ
netQuantityValue: string;    // "" когато няма
netQuantityUnit: string;     // "" когато няма, иначе 'mg'|'g'|'kg'|'ml'|'l'
```
`emptyInitial`: `weight: ""`, `netQuantityValue: ""`, `netQuantityUnit: "g"` (дефолтна единица в дропдауна, но полето остава по избор — ако стойността е празна, не се записва количество).

### Payload в `handleSubmit`
Добавя се към обекта подаван на `saveProduct`:
```ts
weight,
netQuantity:
  netQuantityValue.trim() === ""
    ? null
    : { value: netQuantityValue, unit: netQuantityUnit || "g" },
```

### Зареждане на съществуващ продукт (страницата за редакция)
Мястото, което строи `initial` от продукта в базата (страницата `dashboard/products/[id]/edit` или подобна), добавя:
```ts
weight: String(product.weightGrams),
netQuantityValue: product.netQuantityValue !== null ? netQuantityToInput(product.netQuantityValue) : "",
netQuantityUnit: product.netQuantityUnit ?? "g",
```
където показваната стойност на количеството се получава от съхранената (× 1000) обратно към входа чрез нов helper `netQuantityToInput(value: number): string` в `money.ts` (връща „0.5" от `500`, „1.5" от `1500` — с **точка**, защото стойността влиза в `<input>`, не се показва на купувач; БЕЗ единица). Симетричен на `centsToInput`, но фактор 1000.

> **Забележка за плана:** точното място където се строи `ProductFormInitial` за редакция трябва да се намери (grep `ProductFormInitial` / `initial={`) и да се допълни с трите полета. Аналогично — onboarding „simple" режимът, ако подава initial.

---

## 7. Публична страница на продукта (`src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`)

### Показване на количеството (по избор)
Ако продуктът има количество (`netQuantityValue !== null`), показва се като **първи ред** в блока „Характеристики" (`<dl>`, ред ~162). Ако продуктът няма други характеристики, но има количество, блокът пак се показва (условието се разширява).

Ред за количеството (същият стил като другите `<div>` редове в `<dl>`):
```tsx
<div className="flex justify-between gap-4 px-4 py-3 text-sm">
  <dt className="text-(--sf-muted)">Количество</dt>
  <dd className="text-right font-medium text-(--sf-text)">
    {formatNetQuantity(product.netQuantityValue, product.netQuantityUnit)}
  </dd>
</div>
```
Условието за показване на целия блок става:
```tsx
{(product.description || product.attributes.length > 0 || product.netQuantityValue !== null) && ( ... )}
{(product.attributes.length > 0 || product.netQuantityValue !== null) && ( <dl> ... </dl> )}
```

### Теглото НЕ се показва
Теглото е служебно (доставка/feed). Купувачът не го вижда никъде на страницата.

### JSON-LD (`Product`, ред ~72)
Добавя се `weight` към структурираните данни (Schema.org `Product.weight` с `QuantitativeValue` в грамове):
```ts
weight: {
  "@type": "QuantitativeValue",
  value: product.weightGrams,
  unitCode: "GRM",  // UN/CEFACT код за грам
},
```
Чист SEO плюс — данните вече ги има. (Количеството НЕ влиза в JSON-LD засега — `unitPricingMeasure` е за product feed-а, отделна задача.)

### Query (`getActiveProduct`)
`getActiveProduct` селектира целия `products` ред (`db.select({ product: products, ... })`) → `weightGrams` и `netQuantity*` идват автоматично. **Няма промяна в заявката.**

---

## 8. CSV импорт/експорт (`src/actions/products.ts` + `product-import-export.tsx`)

### Експорт
`CSV_HEADER` се разширява с три колони: `weight_grams`, `net_quantity`, `net_quantity_unit`.
- `weight_grams` = `product.weightGrams` (число грамове, напр. „4500").
- `net_quantity` = показваната стойност (напр. „0.5") или празно; **точка** за десетичните (CSV е машинен формат, не BG UI).
- `net_quantity_unit` = `mg|g|kg|ml|l` или празно.

Мястото, което строи редовете за експорт (grep за `CSV_HEADER` в експортната функция/компонент), се допълва с трите стойности.

### Импорт
Новите колони се четат по име (както другите — редът е без значение).

**Тегло — съвместимост назад:**
- Стар CSV файл (без колона `weight_grams`) → колоната липсва → всеки ред получава **тегло 500 г по подразбиране** (същата логика като backfill-а). Файлът не се чупи.
- Ред **с** валидно тегло → използва се.
- Ред с **невалидно** тегло (не-число, < 1, > 200000) → редът се **пропуска** с съобщение „ред N: невалидно тегло „…"".

```ts
const weightRaw = cell(row, "weight_grams");
let weightGrams = 500; // дефолт при липса
if (weightRaw !== "") {
  const w = Number(weightRaw);
  if (!Number.isInteger(w) || w < 1 || w > 200_000) {
    result.skipped.push(`ред ${lineNo}: невалидно тегло „${weightRaw}“`);
    continue;
  }
  weightGrams = w;
}
```

**Количество — по избор:**
```ts
const netRaw = cell(row, "net_quantity");
const netUnitRaw = cell(row, "net_quantity_unit").toLowerCase();
let netQuantityValue: number | null = null;
let netQuantityUnit: string | null = null;
if (netRaw !== "") {
  const milli = toMilli(netRaw.replace(",", "."));
  if (milli === null || milli <= 0 || !["mg","g","kg","ml","l"].includes(netUnitRaw)) {
    result.skipped.push(`ред ${lineNo}: невалидно количество „${netRaw} ${netUnitRaw}“`);
    continue;
  }
  netQuantityValue = milli;
  netQuantityUnit = netUnitRaw;
}
```

Двете стойности се добавят в `values` обекта (за create и update) в импортната транзакция.

**Обхват на импорта:** снимки/варианти не участват (както досега). Теглото участва.

---

## 9. Тестове (Vitest)

Покриваме логиката; UI естетиката се проверява ръчно (правило на проекта — без Playwright визуални тестове).

### `src/lib/money.test.ts` (или съществуващия money тест файл)
- `toMilli`: „0,5"→500 · „1.5"→1500 · „500"→500000 · „2,25"→2250 · „0"→0 · „"→null · „abc"→null · „-1"→null
- `formatNetQuantity`: (500,"ml")→„500 мл" · (1500,"l")→„1,5 л" · (250,"g")→„250 г" · (1000,"kg")→„1 кг" · (2250,"l")→„2,25 л"
- `netQuantityToInput`: 500→„0.5" · 1500→„1.5" · 500000→„500" · 1000→„1" (точка, без единица)

### `src/schemas/product.test.ts` (или съществуващия схемен тест)
- тегло „4500" → минава (`weight === 4500`)
- тегло „" → грешка „Въведи тегло"
- тегло „0" → грешка (min 1)
- тегло „300000" → грешка (max 200000)
- тегло „abc" → грешка
- `netQuantity: {value:"0,5", unit:"l"}` → минава
- `netQuantity: {value:"0", unit:"l"}` → грешка (> 0)
- `netQuantity: {value:"1", unit:"xx"}` → грешка (невалидна единица)
- `netQuantity: null` → минава (по избор)

### `productValues` мапинг (в products test или нов)
- вход тегло „750" + `netQuantity {value:"0,5", unit:"l"}` → `weightGrams:750, netQuantityValue:500, netQuantityUnit:"l"`
- вход тегло „750" + `netQuantity: null` → `weightGrams:750, netQuantityValue:null, netQuantityUnit:null`

### CSV импорт (integration, в съществуващия CSV тест ако има)
- ред без колона `weight_grams` → продукт с `weightGrams: 500`
- ред с `weight_grams: "750"` → `weightGrams: 750`
- ред с `weight_grams: "abc"` → пропуснат, съобщение съдържа „невалидно тегло"

### Гейт
`pnpm check` (lint + всички unit тестове + build) минава преди commit.

---

## 10. Обобщение на засегнатите файлове

| Файл | Промяна |
|---|---|
| `src/db/schema.ts` | 3 нови колони на `products` (`weightGrams` NOT NULL, `netQuantityValue`, `netQuantityUnit`) |
| `scripts/backfill-product-weight.mjs` | **нов** — 500 г на съществуващите |
| `src/lib/money.ts` | `toMilli`, `formatNetQuantity`, `netQuantityToInput` |
| `src/schemas/product.ts` | `weightGrams`, `netQuantity` в `productSchema` |
| `src/actions/products.ts` | `productValues` + CSV import/export (3 колони, дефолт 500) |
| `src/components/dashboard/product-form.tsx` | нова секция „Тегло и размер", състояние, initial, payload |
| страницата за редакция на продукт | `ProductFormInitial` се строи с трите нови полета |
| `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx` | количество като характеристика + `weight` в JSON-LD |
| `src/components/dashboard/product-import-export.tsx` | нови колони в експорта (ако редовете се строят тук) |
| тестове | `money`, `product` схема, `productValues`, CSV |

**Ред на изпълнение (за плана):** схема (nullable) → backfill скрипт → схема (NOT NULL) → helpers + тестове → Zod схема + тестове → мапинг + форма → публична страница + JSON-LD → CSV → финална проверка `pnpm check`.
