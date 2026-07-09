# Тегло, размери и количество на продукт — дизайн

**Дата:** 2026-07-10
**Статус:** одобрен за планиране
**Обхват:** чисто в кода (без външна настройка от потребителя)
**Свързани задачи (по-късни):** product feed (№2), автоматична Еконт/Спиди тарифа (M3) — тази задача добавя **данните**, които те ще ползват. НЕ е предусловие за нищо съществуващо (виж по-долу).

---

## 1. Цел

Всеки продукт да може да носи (всичко **по избор**):
- **тегло** (грамове) — за product feed и за бъдеща автоматична Еконт/Спиди тарифа;
- **размери** дължина × ширина × височина (см) — за обемно тегло при Еконт/Спиди по-късно;
- **количество** (мг/г/кг/мл/л) — чисто за показване на страницата (напр. „500 мл").

### Защо всичко е по избор (важно решение)

Доставката **вече работи с фиксирана цена**. Всеки метод за доставка (`shipping_methods`) има `priceCents` — търговецът сам задава колко струва („Доставка до адрес — 5 €", безплатна над X €). Значи теглото **никога не е било задължително за нищо** — то е добавка за *бъдещата* автоматична тарифа по тегло (M3), която още не съществува.

Затова:
- Полетата са **по избор**. Празен продукт работи точно както днес.
- Ако търговецът НЕ попълни тегло/размери, при бъдещата Еконт/Спиди интеграция ще му се покаже, че **автоматичната тарифа може да не е точна** — и той пак ще може да ползва фиксирана цена. Няма насила.
- **Няма backfill, няма `NOT NULL`, няма чупене** на 53-те съществуващи продукта. Огромно опростяване спрямо „задължително".

**Извън обхвата (нарочно, YAGNI):**
- Тегло/размери на ниво **вариант** — само на продукта (решение при брейнсторминга). Вариантите споделят стойностите на продукта.
- Самият product feed и Еконт/Спиди код — отделни задачи. Тук само гарантираме, че данните ги има.

---

## 2. Модел на данните

Шест нови колони на таблицата `products` (`src/db/schema.ts`), **всички nullable** (NULL = не е зададено):

| Колона | Тип | Смисъл |
|---|---|---|
| `weightGrams` (`weight_grams`) | `integer` NULL | Тегло, **грамове** (integer, като центовете). |
| `lengthMm` (`length_mm`) | `integer` NULL | Дължина, **милиметри** (виж защо мм по-долу). |
| `widthMm` (`width_mm`) | `integer` NULL | Ширина, милиметри. |
| `heightMm` (`height_mm`) | `integer` NULL | Височина, милиметри. |
| `netQuantityValue` (`net_quantity_value`) | `integer` NULL | Количество, съхранено като **число × 1000** (0.5 → 500). |
| `netQuantityUnit` (`net_quantity_unit`) | `text` NULL | Единица: `'mg' \| 'g' \| 'kg' \| 'ml' \| 'l'`. |

**Правила за консистентност (гарантирани от Zod, не от DB):**
- `netQuantityValue` и `netQuantityUnit` са винаги **заедно** — или и двете NULL, или и двете попълнени.
- Трите размера са независими един от друг (може да имаш само някои), но на практика формата ги третира като група — виж UI.
- Единицата е `text` + `z.enum` валидация — без нов Postgres enum (по-просто, достатъчно).

**Защо integer (никога float):** правилото на проекта — „мерки като integer, никога float" (`CLAUDE-backend.md`). Тегло: перфоратор `4500`, чаша `250`. Аритметиката (сбор в кошница) остава точна.

**Защо размерите в милиметри, а UI-ът в сантиметри:** търговецът въвежда см (по-естествено за колет — „30 см"), но пазим мм в базата, за да допуснем десетичен см вход („30,5 см" → `305` мм) без float. `formatPrice`-стилът: съхранение × 10, показване / 10.

**Защо количеството × 1000:** за да приеме десетични („0,5 л") без float. `500` + `'l'` = 0.5 л.

**Никакъв backfill, никаква миграционна церемония** — колоните се добавят nullable с един `db:push` и това е. Съществуващите 53 продукта остават с NULL навсякъде и работят непроменени.

---

## 3. Помощни функции (`src/lib/money.ts`)

Симетрични на съществуващите `toCents` / `formatPrice` / `centsToInput`. Понеже размерите (× 10) и количеството (× 1000) са различни фактори, правим **един общ параметризиран helper** вместо да копираме логиката:

### `parseScaled(input: string, factor: number): number | null`
Приема десетичен стринг с точка **или** запетая, връща `Math.round(число × factor)` или `null` при невалиден/отрицателен вход. Ядрото (нормализация запетая→точка, проверка за число ≥ 0) е същото като `toCents`, но факторът е параметър.

| Вход | factor | Изход |
|---|---|---|
| `"0,5"` | 1000 | `500` |
| `"1.5"` | 1000 | `1500` |
| `"30"` | 10 | `300` |
| `"30,5"` | 10 | `305` |
| `"0"` | 10 | `0` |
| `""` | * | `null` |
| `"abc"` | * | `null` |
| `"-1"` | * | `null` |

Тънки обвивки за четимост на извикванията:
- `toMilliQuantity(s) = parseScaled(s, 1000)` — за количеството (0.5 → 500).
- `cmToMm(s) = parseScaled(s, 10)` — за размери: см вход → мм (30 см → 300 мм; десетичен „30,5" → 305 мм). *(Тегло НЕ ползва parseScaled — то е цели грамове, парсва се от `z.coerce.number` в схемата.)*

### `formatNetQuantity(value: number, unit: string): string`
Съхранена стойност (× 1000) + единица → човешки стринг за показване (BG стил, **запетая**). Винаги дели на 1000 (моделът е консистентен: въведеното × 1000 се пази, показването / 1000).

| Вход (съхранено) | Изход |
|---|---|
| `(500000, "ml")` | `"500 мл"` |
| `(1500, "l")` | `"1,5 л"` |
| `(250000, "g")` | `"250 г"` |
| `(1000, "kg")` | `"1 кг"` |
| `(500, "ml")` | `"0,5 мл"` |

Съкращения (BG): `mg→мг`, `g→г`, `kg→кг`, `ml→мл`, `l→л`. Цели числа без десетична част („1 кг", не „1,0 кг").

### `scaledToInput(value: number, factor: number): string`
Обратното на `parseScaled` — от съхранена стойност прави стринг за `<input>` (точка за десетичните, защото влиза в поле за въвеждане). Целите числа без „.0".

| Вход | factor | Изход |
|---|---|---|
| `500` | 1000 | `"0.5"` |
| `1500` | 1000 | `"1.5"` |
| `305` | 10 | `"30.5"` |
| `300` | 10 | `"30"` |

Ползва се при зареждане на съществуващ продукт във формата (секция 6). Тегло не му трябва (цели грамове → `String(weightGrams)`).

---

## 4. Zod схема + валидация (`src/schemas/product.ts`)

Всички нови полета **по избор**. Таван на всяко — за да хване печатни грешки.

### Тегло (по избор)
```ts
// Празно = "" (не е зададено). Иначе цяло число грамове 1..200000 (над това е палет, не колет).
const optionalWeight = z.union([
  z.coerce.number().int().min(1, "Минимум 1 грам").max(200_000, "Максимум 200000 г"),
  z.literal(""),
]);
```

### Размери (по избор, поотделно)
```ts
// Всеки размер: празно "" или десетичен см 0.1..500 см (5 метра таван). Пази се като мм.
const optionalDimension = z.union([
  z.string().trim().refine((s) => {
    const mm = cmToMm(s);
    return mm !== null && mm >= 1 && mm <= 5000;   // 1мм .. 5000мм (500см)
  }, "Невалиден размер в см (пример: 30 или 30,5)"),
  z.literal(""),
]);
```

### Количество (по избор)
```ts
const NET_UNITS = ["mg", "g", "kg", "ml", "l"] as const;

const netQuantity = z
  .union([
    z.object({
      value: z.string().trim().refine(
        (s) => { const m = toMilliQuantity(s); return m !== null && m > 0; },
        "Невалидно количество (пример: 0,5)",
      ),
      unit: z.enum(NET_UNITS),
    }),
    z.null(),
  ])
  .default(null);
```

### В `productSchema`
```ts
weight: optionalWeight.default(""),
length: optionalDimension.default(""),
width: optionalDimension.default(""),
height: optionalDimension.default(""),
netQuantity,
```

`ProductInput` (`z.infer`) се разширява автоматично. **crossValidate** не се пипа — всичко е самодостатъчно в схемата.

---

## 5. Мапинг към базата (`src/actions/products.ts`)

### `productValues(input, shopId)` — добавят се:
```ts
weightGrams: input.weight === "" ? null : input.weight,
lengthMm: input.length === "" ? null : cmToMm(input.length),
widthMm: input.width === "" ? null : cmToMm(input.width),
heightMm: input.height === "" ? null : cmToMm(input.height),
netQuantityValue: input.netQuantity ? toMilliQuantity(input.netQuantity.value)! : null,
netQuantityUnit: input.netQuantity ? input.netQuantity.unit : null,
```
`input.weight` е `number | ""` (от `z.coerce.number` union). Размерите идват като стринг → `cmToMm`. Всички празни → NULL. `insertRelations` не се пипа.

---

## 6. Форма за продукт (`src/components/dashboard/product-form.tsx`)

### Нова секция „Тегло и размер"
Нова `<Card>` **веднага след** „Цена и наличност" (между ред 233 и 235). Стил като другите секции: `<Card className="flex flex-col gap-4">` + `<h2 className="text-lg font-bold text-ink-900">Тегло и размер</h2>`.

Съдържание (всичко по избор — без звездички):
```
Тегло
[ 4500 ] грамове              = 4,5 кг

Размери (по избор)
Дължина [ 30 ] × Ширина [ 20 ] × Височина [ 10 ]  см

Количество (по избор)
[ 500 ] [ мл ▾ ]
Показва се на страницата на продукта, напр. „500 мл“.
```

Кратък пояснителен текст под заглавието (по езиковия guide, тон „на ти", типографски кавички):
> „По избор. Попълни тегло и размери, за да смятаме автоматично цена за доставка с Еконт и Спиди по-късно. Иначе ползвай фиксирана цена на доставка."

**Полета (само компоненти от `@/components/ui`, без голи `<input>`):**
- **Тегло** — `<Input type="number" min={1}>`, `label="Тегло"`, суфикс „грамове". Живо „= X,X кг" вдясно при стойност ≥ 1000. `error={fieldErrors.weight}`.
- **Размери** — три тесни `<Input type="number" min={0}>` в един ред с „×" между тях (или `grid grid-cols-3 gap-2`), обща единица „см" вдясно/отдолу. `label`-и „Дължина / Ширина / Височина". Грешки: `fieldErrors.length/width/height`.
- **Количество** — `<Input type="number" min={0}>` + `<Select>` за единицата с опции: `милиграм (мг)` `грам (г)` `килограм (кг)` `милилитър (мл)` `литър (л)`; стойности `mg/g/kg/ml/l`. Hint отдолу.
- **Мобилно (375px):** размерите минават 3-в-колона или 2+1; количеството — поле над дропдаун. Секцията е с hairline стил като останалите.

### Състояние (useState, ~ред 87)
```ts
const [weight, setWeight] = useState(initial.weight);
const [length, setLength] = useState(initial.length);
const [width, setWidth] = useState(initial.width);
const [height, setHeight] = useState(initial.height);
const [netQuantityValue, setNetQuantityValue] = useState(initial.netQuantityValue);
const [netQuantityUnit, setNetQuantityUnit] = useState(initial.netQuantityUnit);
```

### `ProductFormInitial` + `emptyInitial`
Нови стрингови полета (всички празни по подразбиране):
```ts
weight: string;            // "" или "4500"
length: string;            // "" или "30"  (см, за показване)
width: string;
height: string;
netQuantityValue: string;  // "" или "0.5"
netQuantityUnit: string;   // "g" дефолт в дропдауна (но празна стойност → не се записва)
```
`emptyInitial`: всички `""`, `netQuantityUnit: "g"`.

### Payload в `handleSubmit` — добавя се:
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

### Зареждане на съществуващ продукт (форма за редакция)
Мястото, което строи `initial` от продукта в базата, добавя:
```ts
weight: product.weightGrams !== null ? String(product.weightGrams) : "",
length: product.lengthMm !== null ? scaledToInput(product.lengthMm, 10) : "",
width:  product.widthMm  !== null ? scaledToInput(product.widthMm, 10)  : "",
height: product.heightMm !== null ? scaledToInput(product.heightMm, 10) : "",
netQuantityValue: product.netQuantityValue !== null ? scaledToInput(product.netQuantityValue, 1000) : "",
netQuantityUnit: product.netQuantityUnit ?? "g",
```

> **Open item за плана:** точното място където се строи `ProductFormInitial` за редакция трябва да се намери (grep `ProductFormInitial` / `initial={`) и да се допълни. Аналогично onboarding „simple" режимът, ако подава initial.

---

## 7. Публична страница на продукта (`src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx`)

### Количество (по избор) → като характеристика
Ако `netQuantityValue !== null`, показва се като **първи ред** в блока „Характеристики" (`<dl>`, ~ред 162). Ако продуктът няма други характеристики, но има количество, блокът пак се показва.

```tsx
<div className="flex justify-between gap-4 px-4 py-3 text-sm">
  <dt className="text-(--sf-muted)">Количество</dt>
  <dd className="text-right font-medium text-(--sf-text)">
    {formatNetQuantity(product.netQuantityValue, product.netQuantityUnit)}
  </dd>
</div>
```
Условията се разширяват с `|| product.netQuantityValue !== null`.

### Тегло и размери — НЕ се показват
Служебни са (доставка/feed). Купувачът не ги вижда. (Ако по-късно решим да показваме размери — отделна задача.)

### JSON-LD (`Product`, ~ред 72)
Ако има тегло → добавя се `weight` (Schema.org, грамове):
```ts
...(product.weightGrams !== null && {
  weight: { "@type": "QuantitativeValue", value: product.weightGrams, unitCode: "GRM" },
}),
```
Условно (spread) — само когато е зададено. Размерите/количеството НЕ влизат в JSON-LD засега (за product feed-а са, отделна задача).

### Query
`getActiveProduct` селектира целия `products` ред → новите колони идват автоматично. **Няма промяна в заявката.**

---

## 8. CSV импорт/експорт (`src/actions/products.ts` + `product-import-export.tsx`)

Новите полета минават през CSV, за да не се губят при експорт→импорт. Всички **по избор** — празно е валидно, нищо не се чупи назад.

### Експорт
`CSV_HEADER` += `weight_grams`, `length_cm`, `width_cm`, `height_cm`, `net_quantity`, `net_quantity_unit`.
- `weight_grams` = число грамове или празно.
- `length_cm`/`width_cm`/`height_cm` = см с **точка** (машинен формат), напр. „30" / „30.5", или празно.
- `net_quantity` = стойност с точка („0.5") или празно; `net_quantity_unit` = `mg|g|kg|ml|l` или празно.

### Импорт
Колоните се четат по име (редът без значение). Всяко поле:
- **Празно** → NULL (валидно).
- **Невалидна стойност** (не-число, извън граници, невалидна единица) → редът се **пропуска** с ясно съобщение „ред N: невалидно тегло/размер/количество „…"".

```ts
// Тегло
const weightRaw = cell(row, "weight_grams");
let weightGrams: number | null = null;
if (weightRaw !== "") {
  const w = Number(weightRaw);
  if (!Number.isInteger(w) || w < 1 || w > 200_000) {
    result.skipped.push(`ред ${lineNo}: невалидно тегло „${weightRaw}“`); continue;
  }
  weightGrams = w;
}
// Размер (× за всеки от length/width/height)
function parseDim(raw: string, label: string): number | null | "skip" {
  if (raw === "") return null;
  const mm = cmToMm(raw.replace(",", "."));
  if (mm === null || mm < 1 || mm > 5000) {
    result.skipped.push(`ред ${lineNo}: невалиден размер (${label}) „${raw}“`); return "skip";
  }
  return mm;
}
// Количество
const netRaw = cell(row, "net_quantity");
const netUnitRaw = cell(row, "net_quantity_unit").toLowerCase();
let netQuantityValue: number | null = null, netQuantityUnit: string | null = null;
if (netRaw !== "") {
  const m = toMilliQuantity(netRaw.replace(",", "."));
  if (m === null || m <= 0 || !["mg","g","kg","ml","l"].includes(netUnitRaw)) {
    result.skipped.push(`ред ${lineNo}: невалидно количество „${netRaw} ${netUnitRaw}“`); continue;
  }
  netQuantityValue = m; netQuantityUnit = netUnitRaw;
}
```
Всички стойности се добавят в `values` обекта (create и update) в импортната транзакция. (Точната форма на `parseDim`/„skip" контрола се доизкусурява в плана — идеята: невалиден размер пропуска реда, празен = NULL.) Снимки/варианти не участват (както досега).

---

## 9. Тестове (Vitest)

Логиката се покрива; UI естетиката се проверява ръчно (правило — без Playwright визуални тестове).

### `src/lib/money.test.ts`
- `parseScaled`: („0,5",1000)→500 · („1.5",1000)→1500 · („30",10)→300 · („30,5",10)→305 · („0",10)→0 · („",10)→null · („abc",10)→null · („-1",10)→null
- `formatNetQuantity` (съхранено ×1000): (500000,"ml")→„500 мл" · (1500,"l")→„1,5 л" · (250000,"g")→„250 г" · (1000,"kg")→„1 кг" · (500,"ml")→„0,5 мл"
- `scaledToInput`: (500,1000)→„0.5" · (1500,1000)→„1.5" · (305,10)→„30.5" · (300,10)→„30"

### `src/schemas/product.test.ts`
- тегло „4500"→минава · „"→минава (по избор) · „0"→грешка · „300000"→грешка · „abc"→грешка
- размер „30"→минава · „30,5"→минава · „"→минава · „0"→грешка (< 1мм) · „600"→грешка (> 500см) · „abc"→грешка
- `netQuantity {value:"0,5",unit:"l"}`→минава · `{value:"0",unit:"l"}`→грешка · `{value:"1",unit:"xx"}`→грешка · `null`→минава

### `productValues` мапинг
- тегло „750" + размери „30/20/10" + `netQuantity {value:"0,5",unit:"l"}` → `weightGrams:750, lengthMm:300, widthMm:200, heightMm:100, netQuantityValue:500, netQuantityUnit:"l"`
- всичко празно (`weight:"", length:"", ..., netQuantity:null`) → всичките шест колони `null`

### CSV импорт (integration, ако има CSV тест)
- ред без нови колони → всички нови полета NULL (продуктът се създава нормално)
- ред с `weight_grams:"750"`, `length_cm:"30"` → `weightGrams:750, lengthMm:300`
- ред с `weight_grams:"abc"` → пропуснат, съобщение съдържа „невалидно тегло"

### Гейт
`pnpm check` (lint + unit + build) минава преди commit.

---

## 10. Обобщение на засегнатите файлове

| Файл | Промяна |
|---|---|
| `src/db/schema.ts` | 6 нови nullable колони на `products` (weight, length, width, height ×мм, netQuantity value/unit) |
| `src/lib/money.ts` | `parseScaled` + обвивки `toMilliQuantity`/`cmToMm`, `formatNetQuantity`, `scaledToInput` |
| `src/schemas/product.ts` | `weight`, `length`, `width`, `height`, `netQuantity` (всички по избор) |
| `src/actions/products.ts` | `productValues` + CSV import/export (6 колони, празно=NULL) |
| `src/components/dashboard/product-form.tsx` | нова секция „Тегло и размер", състояние, initial, payload |
| форма за редакция на продукт | `ProductFormInitial` се строи с новите полета (grep за точното място) |
| `src/app/(storefront)/s/[slug]/p/[productSlug]/page.tsx` | количество като характеристика + условен `weight` в JSON-LD |
| `src/components/dashboard/product-import-export.tsx` | нови колони в експорта (ако редовете се строят тук) |
| тестове | `money`, `product` схема, `productValues`, CSV |

**Няма:** backfill скрипт, `NOT NULL`, миграционна церемония. Един `db:push` добавя nullable колоните; съществуващите продукти остават непроменени.

**Ред на изпълнение (за плана):** схема (nullable, един push) → helpers + тестове → Zod схема + тестове → мапинг + форма → публична страница + JSON-LD → CSV → финална `pnpm check`.
