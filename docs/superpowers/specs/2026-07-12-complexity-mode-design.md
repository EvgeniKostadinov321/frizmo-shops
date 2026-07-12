# Дизайн: Режим на сложност (Фаза 2)

**Дата:** 2026-07-12
**Статус:** одобрен дизайн, чака ревю на спеца
**Обхват:** прогресивно разкриване на dashboard функциите чрез 3 режима на сложност. Чисто презентационно — никога не трие/спира данни.

## Контекст и цел

Платформата натрупа ~14 nav секции и продуктова форма с 10 карти. Начинаещ „хоби"
търговец (продава по нещо от време на време) се плаши от 90% от функциите (реферали,
product feed, SEO, GTIN, зони, analytics разрези…).

Решение: **режим на сложност** — глобален превключвател на магазина, който скрива
напредналите nav секции и продуктови полета. Три нива:
- **Хоби (0)** — само ядрото
- **Малък бизнес (1)** — ядро + базов растеж
- **Пълна настройка (2)** — всичко

Табовете от Фаза 1 (`docs/superpowers/specs/2026-07-12-dashboard-tabs-design.md`) са
готовите граници: режимът контролира кои табове/секции съществуват.

## Ключови решения (взети с потребителя)

1. **Напълно разделен от плана.** Режимът = колко UI виждаш (безплатен за всеки). Планът =
   бизнес лимити (отделно). Хоби потребител на евтин план и опитен потребител на същия
   план виждат различен UI по свой избор.
2. **Механика: минимално ниво на секция.** Всяка nav секция/поле носи `minMode` (число).
   Показва се ако `MODE_LEVEL[currentMode] >= itemMinMode`. Един числов праг на елемент.
3. **Скрива И nav секции И продуктови полета.**
4. **Продуктовият Бързо/Детайлно тогъл се ЗАМЕНЯ** от режима. `src/lib/product-form-mode.ts`
   (localStorage) се маха; формата чете `complexityMode` (prop от server страницата).
5. **Default:** нови магазини избират в onboarding (fallback `business`); съществуващи
   магазини → `full` (колоната default е `full` → `db:push` не променя нищо за тях).
6. **Скрита секция с данни → само UI се скрива, данните работят.** Режимът никога не
   трие/спира данни (както downgrade на план — CLAUDE-backend.md). Welcome купон в скрит
   таб продължава да работи на storefront.
7. **Директен URL към скрита страница работи** — режимът е UI помощ, НЕ security gate. Без
   изненадващи 404-та; данните са достъпни, ако потребителят знае URL-а.
8. **Контрол:** компактен дропдаун в хедъра („Режим: Хоби ▾") + стъпка в onboarding wizard.

## Feature матрица — nav секции

Режими: Хоби (0) · Малък бизнес (1) · Пълна (2). Показва се ако текущ ≥ minMode.

| Nav секция | minMode |
|---|---|
| Табло | 0 |
| Продукти | 0 |
| Поръчки | 0 |
| Магазин | 0 |
| Уебсайт | 0 |
| Плащане и доставка | 0 |
| Абонамент | 0 |
| Категории | 1 |
| Промо кодове | 1 |
| Ревюта | 1 |
| Аналитика | 1 |
| Въпроси (Q&A) | 2 |
| Таблици размери | 2 |
| Абонати | 2 |

Хоби: 7 секции · Малък бизнес: 11 · Пълна: 14.

## Feature матрица — продуктова форма

| Продуктова секция | minMode | Таб (Фаза 1) |
|---|---|---|
| Основни (име/категория/описание/активен) | 0 | винаги |
| Цена и наличност | 0 | винаги |
| Снимки | 0 | винаги |
| Характеристики | 1 | Основно |
| Тегло и размер + количество | 1 | Логистика |
| Таблица с размери | 2 | Логистика |
| Продуктови кодове (SKU/GTIN/марка/cost) | 2 | Кодове и SEO |
| SEO | 2 | Кодове и SEO |
| Промоция „купи повече" | 2 | Варианти |
| Опции и варианти | 2 | Варианти |

Превод в табове:
- **Хоби:** без табове — 3-те базови карти в колона.
- **Малък бизнес:** табове **Основно** (+ Характеристики) и **Логистика**. Без Кодове/SEO/Варианти.
- **Пълна:** всичките 4 таба.

Marker логиката показва точка само за табове, съществуващи в текущия режим.

## Архитектура

### Данни

- Нов Postgres enum `complexity_mode` (`hobby | business | full`) — `pgEnum` над `shops`
  (до `couponTypeEnum`, `src/db/schema.ts:24`).
- Нова колона `shops.complexityMode` — `complexityModeEnum("complexity_mode").notNull().default("full")`.
- `db:push` прилага колоната; съществуващите редове получават `full`.

### Централен модул `src/lib/complexity.ts` (чист, тестван, неутрален)

```ts
export type ComplexityMode = "hobby" | "business" | "full";

export const MODE_LEVEL: Record<ComplexityMode, number> = {
  hobby: 0,
  business: 1,
  full: 2,
};

export interface ModeMeta {
  value: ComplexityMode;
  label: string;
  description: string;
}
export const MODE_META: ModeMeta[]; // 3 записа с BG етикет + кратко описание

/** Видим ли е елемент с даден minMode при текущия режим. */
export function isVisible(itemMinMode: number, currentMode: ComplexityMode): boolean {
  return MODE_LEVEL[currentMode] >= itemMinMode;
}
```

Unit тестове: `isVisible` граници (hobby не вижда minMode 1/2; full вижда всичко), наредба
на `MODE_LEVEL`, `MODE_META` покрива и трите режима.

### Nav филтриране

- `NavItem` (в `src/components/dashboard/nav-items.ts`) получава `minMode: number`; всеки
  запис в `NAV_ITEMS` получава стойност по матрицата.
- `DashboardLayout` вече зарежда `shop` (`getOwnShop()`) → подава `shop.complexityMode` на
  `DashboardNav` + `MobileMenuButton`; те филтрират `NAV_ITEMS` през `isVisible`.

### Хедър дропдаун — `ComplexityModeSwitcher` (нов client компонент)

- В хедъра до `ThemeToggle` (`src/app/(dashboard)/dashboard/layout.tsx`). Prop: текущ режим.
- Показва „Режим: {label} ▾"; отваря меню с 3-те `MODE_META` (етикет + описание); избор →
  `setComplexityMode(mode)` action → `router.refresh()`.
- На мобилно: в burger менюто (`MobileMenuButton`/мобилното меню).

### Action

- `setComplexityMode(mode: ComplexityMode)` в `src/actions/shop.ts` през `requireShop()`
  (auth + собственост + Zod parse на mode). Update `shops.complexityMode`.
  `revalidatePath("/dashboard", "layout")` за пре-рендер на nav.

### Onboarding

- Нова стъпка „Сложност" в `ShopWizard` (`src/components/dashboard/shop-wizard.tsx`): 4-та
  стъпка след „Работно време". Radio избор от `MODE_META` (default `business`), контролиран
  state → `<input type="hidden" name="complexityMode">`. `createShop` (`src/actions/shop.ts:81`)
  чете полето (Zod, default `business`) и го записва.
- `STEPS` масивът получава 4-ти запис; `StepIndex` става `0|1|2|3`; `isLast` = `step === 3`.

### Продуктова форма

- Маха `src/lib/product-form-mode.ts` + `useSyncExternalStore` + Бързо/Детайлно бутоните.
- `ProductForm` получава `complexityMode: ComplexityMode` prop. Продуктовите страници
  (`products/new`, `products/[id]`) са server components със `shop` → подават режима.
  Onboarding продуктовата форма (`simple`) остава закована на минималния изглед.
- Табовете/картите се филтрират по `minMode` през `isVisible`.

## Крайни случаи

- Скрита секция с данни → само UI скрит, данните работят (нулев риск).
- Директен URL към скрита страница → работи (не блокираме; режимът не е security gate).
- Продуктова форма marker → само за табове в текущия режим (скрито поле няма стойност →
  няма валидация върху него).
- Onboarding пропуснат / стар магазин → fallback съответно `business` / `full`.
- Дропдаун смяна → `router.refresh()` пре-рендерира server layout-а → nav се обновява.
- Reviews/Questions badge count-ове в layout се зареждат винаги (евтини) — крием само линка.

## Извън обхвата

- Планове 2.1 (3 плана 5/15/30€) — отделно, за Stripe live.
- Storefront непроменен (режимът е само dashboard).
- Без блокиране на достъп по URL.

## Тестване

- `complexity.ts`: unit тестове (Vitest) — виж по-горе.
- `nav-items`: тест че всеки item има валиден `minMode` (число 0–2).
- Без нови e2e. Потребителят прави визуалната проверка: 3-те режима × light/dark/375px.
- `db:push` за новата колона. `pnpm check` гейт зелен преди край.
