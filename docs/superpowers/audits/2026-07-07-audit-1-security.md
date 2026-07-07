# Одит 1 — Security & Multi-tenant изолация

> Прочети първо `README.md` в тази папка (общите правила). Само откриване, без
> поправки. Стой в scope-а. Не претупвай, но не чети целия проект.

## Мисия

Да докажеш, че **никой търговец не може да достигне/промени чужди данни**, че
**всеки публичен endpoint е защитен**, и че **парите и наличностите не могат да
бъдат манипулирани от клиента или изгубени при състезание (race)**. Това е
правило №1 на проекта (`CLAUDE-backend.md`). Един cross-tenant теч = CRIT.

## Контекст, който ТРЯБВА да прочетеш преди да съдиш

- `CLAUDE-backend.md` — целият (tenant изолация, wrapper-ът, пари, RLS, storage).
- `src/lib/auth.ts` — `requireUser` / `requireShop` / `requireAdmin`. ВАЖНО:
  `requireShop()` НЕ приема `shopId` — връща магазина по `ownerId`. Значи всяко
  действие, което получава `shopId`/`productId`/`orderId`/`couponId` от клиента,
  трябва САМО да ги ползва филтрирано по `shop.id` от wrapper-а. Търси действия,
  които четат/пишат по клиентски id БЕЗ да го обвържат с `shop.id`.
- `src/lib/rate-limit.ts` — `checkRateLimit(key, max, windowSec)`.
- `src/lib/sanitize.ts`, `src/lib/pricing.ts`, `src/lib/money.ts`, `src/lib/phone.ts`.

## Задължителни точки (отвори всяка)

### А. Tenant изолация — мутации (`src/actions/`)
Всичките 16: `auth, admin, shop, site-settings, products, categories, cart,
orders, fulfillment, coupons, contact, newsletter, subscribers, storefront,
push, uploads`. За всяко действие провери:
1. Минава ли през `requireShop()` / `requireAdmin()` (или е съзнателно публично)?
2. Приема ли `id` от клиента (product/order/category/coupon/section/image)? Ако
   да — филтрира ли се ВСЯКА заявка/ъпдейт с `eq(table.shopId, shop.id)` (или
   собственост през owned shop)? Пропуснат tenant филтър в `where` на UPDATE/
   DELETE = **CRIT**.
3. Zod parse на входа преди употреба? Санитизация (`sanitizeText`/`Multiline`)
   на текст преди запис?
4. Storage пътища: качване само под `shops/{shop.id}/...`? Може ли клиент да
   подаде път извън своя shop (`uploads.ts`, `requestImageUpload`)?

### Б. Tenant изолация — заявки (`src/db/queries/`)
`products, categories, cart, orders, coupons, subscribers, admin, catalog,
storefront, site-settings, fulfillment`. Търси query функция, приемаща `id` без
`shopId` в `where`, извикана от action контекст. (Публичните storefront заявки по
`slug` са ОК — те са замислени публични.)

### В. Публични endpoint-и (без auth — най-висок риск)
`actions/cart.ts`, `actions/orders.ts` (createOrder), `actions/contact.ts`,
`actions/newsletter.ts`, `actions/coupons.ts` (validateCoupon). За всяко:
- `checkRateLimit` присъства ли, с разумен лимит/прозорец, и с ключ, който
  включва IP/shop (не глобален ключ, който един бот заключва за всички)?
- Honeypot поле (`website`) — присъства ли там, където има форма (contact,
  newsletter)? Празно→фалшив успех?
- Zod + санитизация на всеки вход?
- Изтича ли информация в грешките (stack trace, „shop not found" vs общо)?

### Г. Пари и наличности (не се доверявай на клиента)
- `src/lib/pricing.ts` — единственият ценови източник. Проверява ли се, че
  количката НЕ носи цени от клиента, а се преизчислява от базата? Отстъпката от
  купон приложена на правилното място (subtotal, не върху доставка)? Отрицателни
  суми възможни ли са (купон > subtotal)?
- `actions/orders.ts` createOrder — транзакция със `SELECT ... FOR UPDATE`:
  проверка наличност → декремент → запис. Race за последна бройка: втори купувач
  получава „изчерпано"? Пореден номер per-shop (max+1, unique + retry)?
- Купон в същата транзакция: `usedCount` инкремент атомарен под lock? Може ли
  един купон да се употреби над `maxUses` при паралелни поръчки?
- Валута: навсякъде integer центове? Някъде float аритметика върху пари? (grep
  `parseFloat`, `* 100`, `/ 100` около пари).

### Д. Админ повърхност
- `actions/admin.ts` + `app/admin/` — всяка мутация през `requireAdmin()`?
- `requireAdmin` издава ли съществуване (трябва `notFound()`, не 403 с текст)?

## Полезни grep-ове (за стесняване, не за заключение)
- `\.update\(` / `\.delete\(` в `src/actions` и `src/db/queries` → провери tenant филтъра на всяко.
- `checkRateLimit` → кои публични действия го НЯМАТ.
- `shopId` подаван като аргумент от клиентски вход.
- `parseFloat|Number\(.*price|Math\.round.*100` → съмнения за float пари.

## Извън обхват (отбележи с 1 ред, не разследвай)
Естетика, a11y контраст, производителност, SEO. RLS policies (съзнателно няма —
Data API заключен, виж backend доклада).

## Изход
Обобщение с брой по тежест → таблица (най-тежкото първо) → чеклист по А–Д кое е
проверено и чисто.
