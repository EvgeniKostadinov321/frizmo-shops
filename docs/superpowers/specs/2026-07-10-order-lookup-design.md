# „Провери поръчка" от купувача — дизайн

**Дата:** 2026-07-10
**Статус:** одобрен за планиране
**Обхват:** чисто в кода (без външна настройка от потребителя)
**Различно от:** merchant order-search (`2026-07-08-order-search-design.md`, търсене в dashboard-а). Тази функция е за **купувача** на storefront-а.

---

## 1. Цел

Купувач (гост, без акаунт) да провери статуса на поръчката си, като въведе **номер на поръчка + телефон** — дори ако е загубил имейла/линка с потвърждението. BG пазар: COD купувачът дава телефон, не имейл.

### Защо е нужно

Днес confirmation страницата (`/s/{slug}/order/{id}?t={token}`) е достъпна само с `publicToken` (линк от checkout/имейла). Загуби ли линка, купувачът няма как да намери поръчката. Тази функция е втори вход — доказваш собственост чрез телефона (тайната), не токена.

**Ключово решение (сигурност):** номерът на поръчка е **пореден и познаваем** (#0001, #0002…). Тайната е **телефонът**. Затова: строг rate-limit + обща грешка (не разкрива дали номер съществува).

**Извън обхвата (YAGNI):**
- Купувачески акаунт (одитът реши, че е overkill).
- Проверка по имейл (BG COD купувачът дава телефон).
- Отделен status изглед — преизползваме confirmation страницата.

---

## 2. Поток (Server Action + навигация)

Купувачът отваря `/s/{slug}/order-status` (линк от footer-а), попълва форма → нов action `lookupOrder`:

```
lookupOrder(slug, { orderNumber, phone }) →
  Zod parse (orderNumber: string, phone: string)
  clientIp() → checkRateLimit(`order-lookup:${ip}`, 5, 900)   // 5 опита / 15 мин
    → лимит достигнат: fail("Твърде много опити. Опитай по-късно.")
  n = parseOrderNumber(orderNumber)   // "#0042"/"42" → 42; невалиден → null
  parseBgPhone(phone) → e164          // невалиден → обща грешка
  ако n === null ИЛИ телефон невалиден → fail(ОБЩА_ГРЕШКА)
  магазин по slug (published) → иначе fail(ОБЩА_ГРЕШКА)
  db: orders WHERE shopId + orderNumber = n + customerPhone = e164  (limit 1)
    → съвпадение: ok({ path: `/s/${slug}/order/${order.id}?t=${order.publicToken}` })
    → няма: fail(ОБЩА_ГРЕШКА)
```

`ОБЩА_ГРЕШКА` = „Няма поръчка с този номер и телефон. Провери ги и опитай пак." — **еднаква** и при несъществуващ номер, и при грешен телефон (не помага на brute-force).

**Клиентът** (както checkout с `createOrder`): при `ok` → `router.push(result.path)` към готовата confirmation страница; при `fail` → показва грешката под формата. Телефонът НЕ влиза в URL (POST body на action-а).

**Защо не redirect() от сървъра:** storefront формите (checkout) връщат резултат и клиентът навигира — следваме същия pattern за консистентност (`createOrder` връща `{orderId, token}`, клиентът push-ва).

---

## 3. Парсване на номера (`src/lib/order-number.ts`, нов чист модул)

```ts
/** "#0042" / "42" / " 42 " → 42. Невалиден (текст, ≤0, празно) → null. */
export function parseOrderNumber(input: string): number | null {
  const cleaned = input.trim().replace(/^#/, "").replace(/\s/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = parseInt(cleaned, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
```
Изнесен в отделен модул (не в `"use server"` файла) за тестваемост — както `csv-measures`/`product-values`.

---

## 4. Страница + форма

### Route `src/app/(storefront)/s/[slug]/order-status/page.tsx` (нов)
- SSR, `robots: { index: false }` (както confirmation страницата — не се индексира).
- Немо́жем/не-published магазин → `notFound()`.
- Заглавие „Провери поръчка" + пояснение („Въведи номера на поръчката и телефона, с който направи поръчката.").
- Рендерира клиентската форма (по-долу).

### Форма `src/components/storefront/order-lookup-form.tsx` (нов, `"use client"`)
Pattern като checkout-form (ръчен `useState` за грешка/loading + директно извикване на action):
- Поле „Номер на поръчка" (`inputMode="numeric"`, приема с/без `#`).
- Поле „Телефон" (`type="tel"`, `autoComplete="tel"`).
- Бутон „Провери" (loading състояние при заявка).
- Обща грешка под формата при `fail`.
- При `ok` → `router.push(result.path)`.
- Storefront стил (`--sf-*` променливи), touch targets ≥44px, mobile-first.

### Footer линк (`src/components/storefront/footer.tsx`)
Footer има **2 варианта** (`footerVariant`), всеки със свой nav масив. Добавя се елемент **и в двата**:
```ts
{ href: `${base}/order-status`, label: "Провери поръчка" }
```
(до „Контакти"/„Условия").

---

## 5. Грешки

Всички водят до **обща грешка** (не разкриват детайли):
- Невалиден номер (текст/≤0) → ОБЩА_ГРЕШКА
- Невалиден телефон → ОБЩА_ГРЕШКА
- Няма съвпадение → ОБЩА_ГРЕШКА
- Rate-limit достигнат → „Твърде много опити. Опитай по-късно."
- Немо́жем/не-published магазин → `notFound()` (страницата)
- Никакви stack traces/вътрешни детайли към клиента.

---

## 6. Сигурност

- **Rate-limit преди всякаква работа:** `checkRateLimit(order-lookup:${ip}, 5, 900)` (Postgres `rate_limits`, вече наличен). 5 опита / 15 мин на IP — brute-force на телефон невъзможен; легитимен купувач знае телефона си.
- **Обща грешка** — не разкрива дали номер съществува.
- **Телефон като e164** — `parseBgPhone` нормализира вход („0888…"/„+359888…"/„359888…") към записания формат преди сравнение.
- **Tenant изолация** — заявката винаги филтрира по `shopId` (+ orderNumber + phone). Confirmation страницата пак валидира `publicToken` отделно.
- **POST body** — телефонът никога в URL/query (не се логва, не се споделя).

---

## 7. Тестове (Vitest — само логиката)

`src/lib/order-number.test.ts`:
- `parseOrderNumber`: „#0042"→42 · „42"→42 · „ 42 "→42 · „#42"→42 · „abc"→null · „0"→null · „-5"→null · „"→null · „4a"→null

`lookupOrder` (integration, ако е практично с тестова база — иначе ръчно): грешен телефон → fail без path · грешен номер → fail · валидни → ok с правилен token path · rate-limit → fail. UI (формата) — ръчна проверка от потребителя (правило: без Playwright визуални тестове).

**Гейт:** `pnpm check` минава преди commit.

---

## 8. Обобщение на засегнатите файлове

| Файл | Промяна |
|---|---|
| `src/lib/order-number.ts` | `parseOrderNumber` (нов, чист) |
| `src/lib/order-number.test.ts` | тестове (нов) |
| `src/actions/orders.ts` | `lookupOrder` action (rate-limit + parseBgPhone + заявка → path/грешка) |
| `src/app/(storefront)/s/[slug]/order-status/page.tsx` | нова страница (SSR, noindex) |
| `src/components/storefront/order-lookup-form.tsx` | нова форма (client) |
| `src/components/storefront/footer.tsx` | линк „Провери поръчка" в 2-та варианта |

**Няма:** нови колони, нова таблица, cron, външна настройка. Функцията стъпва изцяло на съществуващи данни (`orderNumber`, `customerPhone` e164, `publicToken`) и инфраструктура (`checkRateLimit`, `parseBgPhone`, confirmation страницата).

**Ред на изпълнение (за плана):** `parseOrderNumber` + тестове → `lookupOrder` action → страница + форма → footer линк → финална `pnpm check`.
