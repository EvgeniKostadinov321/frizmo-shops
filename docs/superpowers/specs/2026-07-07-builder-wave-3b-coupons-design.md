# Website Builder — Вълна 3Б: Промо кодове (дизайн)

Дата: 2026-07-07 · Пътна карта: `docs/superpowers/plans/2026-07-06-builder-roadmap.md`

Промо кодове/купони за отстъпка на количката — най-тежкото във Вълна 3
(нова таблица + промяна в ценовия източник + checkout интеграция). Част Б,
след 3А (контактна форма + newsletter — готови).

**Одобрени решения (2026-07-07):** тип percent + fixed; код само на checkout;
ограничения срок + лимит употреби + мин. сума; броене атомарно в транзакцията;
отстъпка върху subtotal-а (стеква се с промо/deal цени).

---

## Данни

**Нова таблица `coupons`** (`src/db/schema.ts`):
```
id: uuid pk
shopId: uuid → shops (тенант ключ, cascade)
code: text (uppercase, unique per shop)
discountType: enum ('percent' | 'fixed')
discountValue: int (процент 1–100 ИЛИ центове за fixed)
minSubtotalCents: int default 0 (0 = без минимум)
maxUses: int | null (null = без лимит)
usedCount: int default 0
expiresAt: timestamp | null (null = безсрочен)
active: bool default true
createdAt, updatedAt
```
Индекси: `unique(shopId, code)`, `index(shopId)`. `.enableRLS()`.
Нов enum `couponTypeEnum`.

**Orders разширение** — нови колони:
- `couponCode: text default ''` (snapshot на кода към поръчката)
- `discountCents: int default 0` (колко е спестено)

---

## Ценова логика (`pricing.ts` — сърцето)

`priceCart(lines, products, shipping?, coupon?)` — нов опционален параметър:
```
interface AppliedCoupon {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minSubtotalCents: number;
}
```
Отстъпката се смята **върху subtotal-а** (след deals/промо), между subtotal и
shipping:
- Ако `subtotalCents < coupon.minSubtotalCents` → не се прилага (discount = 0,
  `couponError: 'min_not_met'`).
- percent: `discountCents = round(subtotal * value / 100)`.
- fixed: `discountCents = min(value, subtotal)` (не под 0).
- `total = subtotal - discount + shipping`.

`PricedCart` нови полета: `discountCents`, `appliedCouponCode` (празно ако няма),
`couponError?` ('min_not_met' — за UI съобщение). `priceCart` остава **чиста
функция** — приема вече валидиран купон; срок/лимит/активност се проверяват
отделно на сървъра.

---

## Валидация (сървър)

**Query** (`src/db/queries/coupons.ts`): `findValidCoupon(shopId, code)` — намира
активен, неизтекъл, под лимита купон по код (uppercase). Връща `AppliedCoupon`
или причина за отказ (`not_found | expired | inactive | limit_reached`).

**Публичен action** (`src/actions/cart.ts` или нов `coupons.ts`):
`validateCoupon(shopSlug, code, lines)` — за checkout live проверка:
- rate limit (`coupon:{ip}:{shopId}`, напр. 20/час — брутфорс защита).
- намира купона → ако валиден, връща `priceCart` резултата с приложен купон
  (клиентът вижда новата сума); иначе грешка с BG причина.

---

## Checkout интеграция

**checkout-form.tsx:** ново поле „Промо код" + бутон „Приложи":
- Клиентът въвежда код → `validateCoupon` → показва отстъпка в резюмето
  (нов ред „Отстъпка (КОД): −X") или грешка.
- Приложеният код се пази в state и се праща на `createOrder`.
- Ред в резюмето: Междинна сума → **Отстъпка** → Доставка → Общо.

**createOrder (orders.ts):** транзакцията:
1. Препотвърждава купона на сървъра (`findValidCoupon` + лимит) — клиентът може
   да е манипулирал; сумата се преизчислява със `priceCart(..., coupon)`.
2. `SELECT ... FOR UPDATE` на купона в транзакцията → проверка `usedCount < maxUses`
   → декремент/инкремент атомарно (както наличностите). Race → вторият получава
   „лимитът е достигнат", поръчката пада с ясна грешка.
3. Записва `couponCode` + `discountCents` в поръчката (snapshot).
- Ако купонът е станал невалиден между checkout и submit → поръчката се създава
  БЕЗ отстъпка + предупреждение (или пада — виж по-долу). Решение: **пада с
  грешка** „Промо кодът вече не е валиден", клиентът пробва пак (по-безопасно от
  тиха промяна на сумата).

---

## Dashboard управление

**Нов таб „Промо кодове"** (`/dashboard/coupons`, `src/actions/coupons.ts`
admin мутации през `requireShop`):
- Списък на купоните: код, тип/стойност, употреби (used/max), срок, статус.
- Създаване/редакция (drawer форма): код, тип (percent/fixed), стойност, мин.
  сума, макс употреби, срок, активен.
- Триене (confirm) / включване-изключване.
- Валидация: код uppercase, unique per shop (грешка при дубликат); процент 1–100;
  fixed > 0.
- Нов линк в dashboard nav.

---

## Грешки

- Публичните: общи BG съобщения. Невалиден купон → конкретна причина („изтекъл",
  „не е достигнат минимумът от X", „лимитът е достигнат").
- Race при лимит → атомарен `FOR UPDATE`, вторият пада чисто.
- Мулти-тенант: всички coupon заявки филтрирани по `shopId`; клиент не може да
  ползва чужд купон (код е per-shop).
- Купон невалиден между checkout и submit → поръчката пада с ясна грешка (не тиха
  промяна на сумата).
- Fixed отстъпка > subtotal → сваля само до 0 (без отрицателна сума).

## Тестване

- **Unit:** `priceCart` с купон (percent, fixed, min не достигнат, fixed > subtotal),
  `findValidCoupon` причини (expired/inactive/limit).
- **E2e (по желание):** създай купон в dashboard → приложи на checkout → виж
  отстъпка → завърши поръчка → провери usedCount++.
- **Ръчно:** създаване на купон, прилагане, изтекъл/лимит случаи, поръчка с код.

## Ред на имплементация

1. Таблица `coupons` + orders колони + enum → `db:push`.
2. `pricing.ts` разширение (чиста функция + unit тестове).
3. Query + валидация action.
4. Dashboard таб (CRUD) — за да има какво да се тества.
5. Checkout интеграция (поле + resume + createOrder транзакция).
6. `pnpm check` + инструкции.

БЕЗ commit до одобрение (тества се заедно с 3А).
