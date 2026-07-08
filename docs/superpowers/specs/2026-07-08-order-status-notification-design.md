# M1 — Известие до купувача при смяна на статус (спец)

> Първи фийчър от post-audit roadmap-а (`docs/superpowers/plans/2026-07-07-post-audit-roadmap.md`).
> Одобрен дизайн 2026-07-08. Имплементира се сам, тества се от потребителя, чак
> тогава следващ фийчър.

## Проблем
Днес когато търговецът смени статуса на поръчка (`updateOrderStatus` в
`src/actions/orders.ts`), купувачът **не научава нищо** — статусът се сменя само в
dashboard-а. Купувачът получава имейл единствено при *приемане* на поръчката (`new`,
през `sendOrderEmails` в `createOrder`). Дупка в доверието.

## Решение (обхват)
При смяна на статус на **confirmed / shipped / cancelled** → автоматичен имейл до
купувача (ако е дал имейл). Прост статус + бутон към страницата на поръчката.

**Решения (одобрени):**
- Обхват: confirmed + shipped + cancelled. `completed` НЕ праща имейл (купувачът
  вече е получил стоката). `new` вече се покрива от `createOrder`.
- Контрол: **винаги автоматично** — без toggle/настройка (YAGNI; може по-късно).
- Съдържание: прост статус + линк към поръчката (НЕ таблица с артикули — тя вече е
  на страницата на поръчката и в първия имейл). Без tracking номер (това е M3).

## Архитектура
Стъпва изцяло на съществуващата имейл инфраструктура (`shell`/`esc` helper-и,
graceful без ключ, `Promise.allSettled`). Нула DB промяна.

### 1. `sendOrderStatusEmail` — нова функция в `src/lib/email.ts`
```
sendOrderStatusEmail(input: {
  shop: Pick<Shop, "name" | "slug" | "phone" | "email">;
  order: { orderNumber; id; publicToken; customerName; customerEmail };
  status: "confirmed" | "shipped" | "cancelled";
}): Promise<void>
```
- Ако `!order.customerEmail` → тихо `return` (много поръчки са само с телефон).
- Ако `!RESEND_API_KEY` → `console.warn` + `return` (както другите функции).
- Иначе → `resend.emails.send` с `shell(title, body)`, обвито в try/catch →
  `console.error` (имейлът е странична дейност, не бива да чупи смяната на статус).
- Линк към поръчката: `${BASE_URL}/s/${shop.slug}/order/${order.id}?t=${order.publicToken}`
  (същият token патърн от одит 1 — иначе страницата не отваря).

**Текстове по статус** (subject + body):
| Статус | Subject | Body (кратък) |
|--------|---------|---------------|
| confirmed | `Поръчка #NNNN е потвърдена — {shop}` | „{shop} прие поръчката ти и я подготвя." |
| shipped | `Поръчка #NNNN е изпратена — {shop}` | „Поръчката ти е изпратена и пътува към теб." |
| cancelled | `Поръчка #NNNN е отказана — {shop}` | „Поръчката беше отказана. При въпроси: {shop.phone или shop.email}." |

Всеки имейл има бутон „Виж поръчката" → линка. Номерът е `#${String(orderNumber).padStart(4,"0")}`.

### 2. Кука в `updateOrderStatus` (`src/actions/orders.ts`)
След успешната транзакция (статусът е сменен, при cancelled наличностите върнати),
ако `parsed.data.status` ∈ {confirmed, shipped, cancelled}:
```
void Promise.allSettled([
  sendOrderStatusEmail({ shop, order, status: parsed.data.status }),
]);
```
**Неблокиращо** (`void` + `allSettled`) — точно както `createOrder` праща
известията, за да не бави отговора към търговеца. `shop` идва от `requireShop()`
(има `slug`, `name`, `phone`, `email`); `order` е вече заредената поръчка от
`db.query.orders.findFirst` — то връща всички колони, вкл. `id`, `orderNumber`,
`publicToken`, `customerName`, `customerEmail` (потвърдено в текущия код).

## Edge cases
- Купувач без имейл → тихо пропуска.
- Липсващ RESEND ключ → warning, не чупи.
- Провал на имейла → `allSettled` + `console.error`; статусът вече е сменен.
- cancelled праща имейл + връща наличности — независими, и двете стават.
- Забранен преход на статус → връща се преди куката (имейл не се праща).

## Извън обхват (YAGNI)
Toggle/настройка · tracking номер (M3) · completed имейл · промяна на схемата ·
имейл до търговеца при смяна (той сам я прави).

## Тестване (потребителят)
1. Направи поръчка с имейл на купувача (може твоя).
2. В dashboard смени статуса → confirmed → провери имейл (+ бутон отваря поръчката).
3. → shipped → имейл. → cancelled (на друга поръчка) → имейл + наличности върнати.
4. Поръчка без имейл на купувача → смяна на статус → без грешка, без имейл.
