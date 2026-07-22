# Монетизационен модел: Free tier + такса на транзакция — дизайн

**Дата:** 2026-07-23
**Статус:** За ревю
**Заменя:** flat абонамент Starter/Pro (План 6 Фаза Б) като *основен* модел
**Свързани:** `docs/superpowers/specs/2026-07-13-online-payments-design.md` (ePay Модел А), `docs/WORKLOG.md:128` (отложената билинг тема), `docs/WORKLOG.md:362-370` (inv.bg Случай A)

---

## 1. Резюме

Frizmo Shops сменя монетизацията от **платен абонамент отпред** (Starter 10€ / Pro 20€) към **безплатен вход + такса на транзакция**. Търговецът се регистрира без плащане, настройва магазина си и започва да продава. Плащаме си таксата само върху **реализирани продажби**, начислена като **процент с минимум и таван**, и **фактурирана месечно** през съществуващия Stripe (търговец → нас).

Парите от продажбите **никога не минават през нас** — купувачът плаща на търговеца директно (наложен платеж в брой на куриера, или ePay директно към мърчанта на търговеца). Ние сме технически посредник и само **броим** таксуемите продажби, после издаваме една месечна фактура за натрупаната комисиона. Това запазва marketplace Модел А (без платежен лиценз, без AML/KYC, не сме страна по сделката) — точно ограниченията, записани в `online-payments-design.md:16-19` и `WORKLOG.md:365-366`.

**Защо сега това е чисто:** платформата няма нито един регистриран търговец. Няма кой да е приел старото публично обещание „без комисиона", така че моделът се въвежда занапред без grandfather логика и без миграция на съществуващи търговци.

---

## 2. Цели и не-цели

### Цели
- Премахване на входната бариера: безплатна регистрация, без карта, без начално плащане.
- Такса само върху това, което търговецът реално продава (align на интереси).
- **Всички** потвърдени продажби са таксуеми — включително наложен платеж (COD), не само онлайн карта (COD е мнозинството от BG оборота).
- Надеждно, **възпроизводимо, одитируемо** броене — миналата такса за месец X трябва да може да се докаже по-късно, дори след връщания.
- Легална чистота: таксата е прозрачна (при избора на план + в правните документи), но не се набива в рекламните страници.
- Anti-gaming: търговец да не може да избягва таксата, като „замразява" поръчки в статус преди `completed`.

### Не-цели (изрично извън обхвата на този спец)
- **Реален payment split** (пари през нас) — отхвърлен: изисква платежен лиценз, противоречи на Модел А. Ако някога се обмисля → нов спец + ADR.
- **Мулти-валута** — остава чист EUR (`money.ts:12`). Дизайнът обаче не блокира бъдещо добавяне на `currency` колона.
- **Таб „Растеж/съвети"** в дашборда (мотивиращи промо съвети) — отделна бъдеща функция.
- **Landing selling-points срещу Facebook** — маркетинг работа, отделно.
- **Планове изобщо** — целият план-концепт (`PlanId`/`PLAN_LIMITS`/Starter/Pro/trial/`maxProducts`) се **премахва** от кода (§8). Един безплатен вход за всички, без нива, без продуктов лимит.
- **inv.bg автоматична интеграция за самите фактури** — таксовите фактури се закачат за същия Случай A механизъм, но неговата пълна автоматизация е отделна външна работа.

---

## 3. Ключови решения (заключени с потребителя)

| Решение | Избор | Обосновка |
|---|---|---|
| Механизъм на таксата | Месечна пост-фактум фактура (Модел А) | Надгражда Stripe billing; не пипаме парите; без лиценз |
| Планове | **Няма** — 100% безплатен вход, всичко отключено | Максимално прост модел; 0 регистрирани търговци → чист старт |
| Структура на таксата | 5% + мин 0.30€ + таван 50€ | Символична на дребното, честна на средното, разумна на едрото; монотонна (без скок надолу) |
| База | `subtotalCents − discountCents` (само стоката) | По-честно — не таксуваме доставка/опаковка/раздадена отстъпка |
| Обхват | Всички потвърдени продажби (вкл. COD) | Покрива целия оборот, не само картовия |
| Кога става таксуема | При `completed` + **авто-completed** след 30 дни в `shipped` | Не таксуваме нереализирано; anti-gaming предпазител |
| Връщане на таксувана продажба | **Кредит** в следваща фактура | Не пипа издадена фактура; честно към търговеца |
| Събиране | Авто-теглене от запазена карта | Предотвратява „мами/забравя да плати" |
| Кога се иска карта | След **първата** завършена продажба (card-gate) | Мек вход без карта + гарантирано събиране |
| Прозрачност | При избор на план + правни докове; НЕ в hero | Легално коректно, без dark pattern |
| Неплащане на фактура | Grace 14 дни → **спира продажби** (suspend) | Надгражда съществуващия механизъм; данните остават |

---

## 4. Структура на таксата

Таксата за **една таксуема продажба** се смята като чиста функция върху **базата на таксата** (само стоката, не доставка/опаковка):

```
feeBaseCents(order)  = max(0, order.subtotalCents - order.discountCents)
feeCents(baseCents)  = baseCents <= 0 ? 0
                       : clamp(round(baseCents * FEE_RATE), FEE_MIN_CENTS, FEE_CAP_CENTS)
```

**База 0 → такса 0** (изрично): безплатна поръчка (100% отстъпка / подарък / изцяло купон) не носи такса — минимумът важи само при реална стойност на стоката > 0. Иначе минимумът би таксувал търговеца за раздаден безплатен продукт.

**Заключени стойности (конфиг константи, на едно място в `src/lib/fee.ts`):**
- `FEE_RATE = 0.05` — 5%.
- `FEE_MIN_CENTS = 30` — 0.30€ минимум на продажба. Решава „символична такса на евтините продукти".
- `FEE_CAP_CENTS = 5000` — 50€ таван на продажба. Предпазва от абсурд при много скъпи продукти.

**База на таксата = `subtotalCents − discountCents`** (само стойността на стоката, минус отстъпката, която търговецът вече е дал). **НЕ** включва `shippingPriceCents` (търговецът я плаща на куриера) и **НЕ** включва `giftWrapFeeCents`. По-честно към търговеца — таксваме върху това, което той реално печели от стоката, не върху разходи, които препокрива.

**Свойства (задължителни, тестват се):**
- **Монотонност:** по-голяма база → по-голяма или равна такса. Никога скок надолу. (Затова „процент + минимум + таван", а не „fixed под праг, после процент".)
- **Integer евроценти навсякъде** — `round` (не floor/ceil) при процента; никакъв float. Съгласно `CLAUDE-backend.md` паричното правило.
- **Чиста функция** — `feeCents` + `feeBaseCents` живеят в нов `src/lib/fee.ts`, тествани изолирано, единствен източник на таксовата аритметика (по модела на `pricing.ts`).
- **Snapshot:** `fee_events.baseCents` пази `feeBaseCents(order)` към момента на начисляване — таксата е възпроизводима дори ако поръчката се промени по-късно.

Стойностите остават конфиг константи, така че финална промяна преди пускане е една стойност.

---

## 5. Финансов модел на данни — таксов ledger

Това е сърцевината. Днешните агрегати филтрират по **текущ статус** (`orders.status`), което прави миналото невъзпроизводимо: поръчка завършена през юни и върната през юли изчезва от преизчисления юнски оборот (`getMonthRevenue` в `db/queries/orders.ts:99-111`; `updatedAt` се презаписва). Такса, която не може да се докаже по-късно, е неприемлива за фактуриране.

Затова въвеждаме **immutable, event-dated ledger**: всяко таксово събитие се записва веднъж и не се мутира. Балансът за месец се смята като сума от събития с дата в месеца.

### 5.1 Нова колона на `orders`

```
completedAt  timestamp with time zone  NULL
```

- Попълва се **точно веднъж**, когато поръчка стане `completed` (ръчно или авто) — това е моментът, в който продажбата става таксуема.
- **НЕ разчитаме на `updatedAt`** за нищо таксово — `updatedAt` се презаписва (напр. при генериране на товарителница) и вече се ползва от прозореца за връщане (`requestReturn` в `orders.ts:674` чете `order.updatedAt`). Отделен `completedAt` пази двете независими.
- Индекс: `index("orders_shop_completed_idx").on(shopId, completedAt)` — за месечната агрегация.

### 5.2 Нова таблица `fee_events` (immutable ledger)

```
fee_events
  id           uuid PK default random
  shopId       uuid NOT NULL → shops.id (cascade)
  orderId      uuid NOT NULL → orders.id (cascade)
  type         enum('charge','credit') NOT NULL
  amountCents  integer NOT NULL          -- винаги положително; знакът идва от type
  baseCents    integer NOT NULL          -- feeBaseCents(order) към момента (subtotal−discount, snapshot)
  occurredAt   timestamp NOT NULL        -- бизнес дата на събитието (completedAt / returnedAt)
  createdAt    timestamp NOT NULL default now()

индекси:
  uniqueIndex(orderId, type)             -- идемпотентност: 1 charge + 1 credit максимум на поръчка
  index(shopId, occurredAt)              -- месечна агрегация
```

**Валута:** `fee_events` няма `currency` колона — целият проект е single-currency EUR (`money.ts:12`). Това е **съзнателно** решение за простота, съгласувано с не-целта „без мулти-валута". Ако някога се добави мулти-валута, `currency` колона на `fee_events` + `fee_invoices` е предусловие (маркирано тук, за да не се пропусне).

- **`charge`** — създава се, когато поръчка стане `completed`. `baseCents = feeBaseCents(order)` (= subtotal−discount, §4), `amountCents = feeCents(baseCents)`, `occurredAt = completedAt`.
- **`credit`** — създава се, когато вече-таксувана (има `charge`) поръчка стане `returned`. `amountCents` = точно същата сума като нейния `charge` (сторниране 1:1), `occurredAt = returnedAt` (моментът на връщане).
- **`uniqueIndex(orderId, type)`** гарантира идемпотентност: повторно пускане на който и да е job не създава дублирани charge/credit. Insert с `onConflictDoNothing`.
- Ledger-ът е **append-only** — редовете не се UPDATE-ват и не се DELETE-ват. Балансът е производен.

### 5.3 Защо ledger, а не преброяване при поискване

Кредитът в следващ месец (решение на потребителя) изисква да помним, че конкретна поръчка е била таксувана и с колко — дори след като статусът ѝ се е сменил. Филтър-по-статус не може: върнатата поръчка вече не е `completed`. Ledger-ът пази събитието с неговата дата и сума завинаги, така балансът за всеки минал месец е възпроизводим по всяко време.

---

## 6. Жизнен цикъл на таксата

```
Поръчка създадена (new / pending_payment)
        │
        ▼  търговец: new → confirmed → shipped
   shipped ──────────────────────────────────┐
        │ ръчно: shipped → completed          │ авто след AUTO_COMPLETE_DAYS
        ▼                                      │ (cron): shipped → completed
   completed  ← completedAt се задава ─────────┘
        │
        ├─► fee_events INSERT charge (occurredAt = completedAt)   [идемпотентно]
        │
        │  евентуално: completed → return_requested → returned
        ▼
   returned  ← returnedAt (нова колона, §6.3)
        │
        └─► ако има charge за поръчката → fee_events INSERT credit (occurredAt = returnedAt)
```

### 6.1 Кога се начислява charge
При всеки преход към `completed` (в `updateOrderStatus`, `orders.ts:739` + авто-cron): в същата транзакция, в която статусът става `completed` и `completedAt` се попълва, се прави идемпотентен `INSERT` на `charge` в `fee_events`. Използваме `onConflictDoNothing` на `(orderId, 'charge')`, така двойно изпълнение е безопасно.

### 6.2 Anti-gaming: авто-completed на заседнали `shipped`
Търговец би могъл да държи поръчки в `shipped` завинаги, за да не се начисли такса. Предпазител:

- **Cron job** (нов Vercel cron, гарден с `CRON_SECRET` — както `expire-payments`): намира поръчки в `shipped` с `updatedAt < now() - AUTO_COMPLETE_DAYS`, прехвърля ги `shipped → completed` (легитимен преход по `ALLOWED_TRANSITIONS`), задава `completedAt` и начислява charge.
  - `AUTO_COMPLETE_DAYS = 30` — конфиг. Реалистично: куриерът вече е доставил, разписката съществува.

Комбинира се с **card-gate**-а (§8.2): дори без auto-complete, търговецът не може да натрупа повече от една завършена продажба без запазена карта, така прозорецът за злоупотреба е минимален.

### 6.3 Връщане → credit
`requestReturn` (`orders.ts:641`) вече изисква `status === "completed"` и пази `returnRequestedAt`. Когато търговецът приеме връщане (`return_requested → returned` в `updateOrderStatus`):
- Записваме **момента на връщане**. `returnRequestedAt` съществува, но е моментът на *заявката*, не на *приемането*. Въвеждаме `returnedAt timestamp NULL` на `orders`, попълван при прехода към `returned` — това е `occurredAt` на кредита.
- Ако поръчката има `charge` в `fee_events` → идемпотентен `INSERT` на `credit` със същата сума. Ако няма charge (върната преди изобщо да е таксувана — напр. `completed` за кратко без job да е минал, после веднага върната) → няма charge → няма credit. `uniqueIndex(orderId,type)` пази от дубликати.

### 6.4 `cancelled` не носи такса
Отказана поръчка (по всеки път) никога не достига `completed` → няма charge. Ако по някаква причина `completed → cancelled` е възможно (днес не е — `completed` е терминален в `ALLOWED_TRANSITIONS`), това би било gap; текущата машина го изключва.

---

## 7. Месечно фактуриране

### 7.1 Агрегация
Нова заявка `getBillableBalanceForPeriod(shopId, from, to)` в `db/queries/fees.ts`:
```sql
SELECT
  COALESCE(SUM(CASE WHEN type='charge' THEN amount_cents ELSE 0 END), 0) AS charges,
  COALESCE(SUM(CASE WHEN type='credit' THEN amount_cents ELSE 0 END), 0) AS credits
FROM fee_events
WHERE shop_id = $1 AND occurred_at >= $from AND occurred_at < $to
```
Дължимо за периода = `charges - credits`. Понеже кредитите носят `occurredAt` от датата на връщане, кредит за юнска продажба, върната през юли, попада в **юлската** фактура — точно „кредит следващ месец".

### 7.2 Фактурен запис (идемпотентност на billing job-а)
Нова таблица `fee_invoices`:
```
fee_invoices
  id                uuid PK
  shopId            uuid NOT NULL → shops.id
  periodStart       date NOT NULL      -- начало на фактурирания месец (UTC)
  periodEnd         date NOT NULL
  chargesCents      integer NOT NULL   -- snapshot на сумата charge за периода
  creditsCents      integer NOT NULL   -- snapshot на сумата credit за периода
  amountDueCents    integer NOT NULL   -- charges - credits (може да е 0 или отрицателно → пренася се)
  stripeInvoiceId   text               -- връзка към Stripe фактурата (NULL докато не се създаде)
  status            enum('draft','issued','paid','uncollectible') NOT NULL default 'draft'
  createdAt, updatedAt

uniqueIndex(shopId, periodStart)        -- един фактурен ред на магазин на месец
```
- Месечен **billing cron** (нов, `CRON_SECRET`) за всеки активен магазин смята баланса за изминалия месец, прави идемпотентен `INSERT` в `fee_invoices` (`onConflictDoNothing` на `(shopId, periodStart)`), после създава Stripe фактура за `amountDueCents`, ако е > 0.
- `amountDueCents <= 0` (кредитите надвишават таксите за месеца) → **не** се издава Stripe фактура. Отрицателният остатък **не** се пренася напред и **не** създава дълг на платформата към търговеца — просто този месец не се таксува. (Всеки кредит вече е с `occurredAt` в своя месец и не се брои повторно, така двойно приспадане е невъзможно.) Записът в `fee_invoices` пак се създава (`amountDueCents` може да е ≤ 0) за одит, но със `status='draft'` и без Stripe фактура.

### 7.3 Stripe механизъм — авто-теглене със запазена карта
Плащаме таксата през **съществуващата** Stripe инфраструктура (`stripe.ts`, `billing.ts`, webhook `stripe/route.ts`), но с различен режим: вместо `mode: "subscription"` (flat), таксовите фактури са **еднократни Stripe Invoices** (invoice items за периода).

**Събиране = авто-теглене (решено).** Търговецът запазва карта (Stripe `PaymentMethod`, прикачен към `Customer` като `default_payment_method`) — виж card-gate §8.2. Месечната фактура се създава с `collection_method: "charge_automatically"`, така Stripe тегли автоматично от запазената карта. Това предотвратява „забравил да плати / мами".

- Провалено теглене → Stripe праща `invoice.payment_failed` → `fee_invoices.status='issued'` остава неплатена → влиза в grace → след grace магазинът спира продажби (§8.1). Stripe прави собствени retry-и (Smart Retries) в grace прозореца.
- Webhook-ът остава single source of truth за платено/неплатено (`invoice.paid` / `invoice.payment_failed`), обновявайки `fee_invoices.status`. Идемпотентността през `stripe_events` (`schema.ts:129-133`) остава.
- Setup на картата: Stripe `SetupIntent` (SCA-съвместимо, без реално теглене при запазването) чрез съществуващия Stripe клиент. `subscriptions.stripeCustomerId` (`schema.ts:106-126`) се преизползва за таксовия Customer. (`shop_payment_accounts` е нещо различно — ePay мърчант credentials на търговеца, не се пипа тук.)

---

## 8. Премахване на плановете + gate логика

**Планове изобщо няма — решено.** Регистрацията е 100% безплатна, търговецът получава всичко (без продуктов лимит, без заключени функции). Монетизацията е **изцяло** през таксата. Значи целият план-концепт се маха:

- `src/lib/plan.ts` се **изтрива изцяло** — `PlanId`, `PLAN_LIMITS`, `resolvePlan`, `getShopPlan`, `inSignupTrial`, `billingAllowsSelling`, `isShopActive`, trial логиката. Няма Starter/Pro, няма `maxProducts` лимит.
- `products.ts` enforce-ите на `maxProducts` (`:161-164,423-424,532`) → премахват се (няма лимит).
- **Новият публичен gate живее в `src/lib/selling-gate.ts`** (тънък модул) и вика заявките от `db/queries/fees.ts`. Единствената му функция е `canAcceptOrders(shopId)`.

Днешният `billingAllowsSelling` (`plan.ts:30-33`) **блокира** продажби без активен абонамент — за нов безплатен модел е точно наопаки. Затова целият модул се заменя. Новата логика има **два независими gate-а** (заявки в `db/queries/fees.ts`), и двата трябва да са изпълнени, за да приема магазинът поръчки:

### 8.1 Gate 1 — просрочена такса (`hasOverdueFees`)
- Нова функция `hasOverdueFees(shopId)` — има ли `fee_invoices` със `status='issued'`, чиято карта е отказана и grace периодът е изтекъл.
- Магазин с просрочена фактура → checkout блокиран („временно затворено"), данните остават (suspend модел от `CLAUDE-backend.md`).
- `FEE_GRACE_DAYS = 14` — конфиг, от издаване на фактурата.

### 8.2 Gate 2 — card-gate (карта след първата завършена продажба)
Балансът между „безплатен вход" и „гарантирано събиране":

- **Вход, настройка, публикуване, продажби — без карта.** Никаква карта не се иска, докато няма реална таксуема продажба.
- **Първата поръчка, стигнала `completed`,** се таксува нормално (charge в ledger-а — реализирана продажба, честно). В същия момент магазинът минава в състояние **„изисква карта".**
- Докато няма запазена карта, магазинът **блокира приемане на НОВИ поръчки** („Запази карта, за да приемаш нови поръчки"). Съществуващите поръчки се обслужват; каталогът се вижда; само нов checkout е спрян.
- Запазена карта (SetupIntent, §7.3) → gate падне → авто-теглене занапред → всичко тече гладко.

**Механизъм (без нова тежка машинария):** card-gate е производен, не отделен флаг за поддръжка:
```
requiresCard(shopId) =
  има поне един fee_events charge за магазина      -- имало е ≥1 таксуема продажба (DB)
  И няма запазен default_payment_method            -- но няма карта (Stripe Customer)
```
`requiresCard(shopId)` комбинира DB проверка (`fee_events` charge наличен) + Stripe проверка (Customer има ли `default_payment_method`); прочита `subscriptions.stripeCustomerId` (§7.3) за да достигне Stripe. Прозорецът за злоупотреба е точно **една** завършена продажба (и тя се таксува) — минимален, затваря „мами/забравя".

`canAcceptOrders(shopId)` = `!hasOverdueFees(shopId) && !requiresCard(shopId)`. Това е **единственият** checkout gate в `createOrder`, заменя стария `isShopActive`/`billingAllowsSelling` изцяло.

---

## 9. Легални и текстови промени

`"Без комисиона"` е публикувано на 4 места, едно от които **правно обвързващо**:
- `src/lib/platform-legal.ts:27` — „Платформата не удържа комисиони от продажбите на търговеца" → **пренаписва се** да описва таксата коректно (процент, минимум, таван, месечно фактуриране, кога е таксуема, кредит при връщане).
- `src/app/(marketing)/page.tsx:62` (FAQ „Има ли комисиона? Не.") + hero „Без комисиони" (`:27,162,187`) → пренаписват се. Hero-то **не** набива таксата; FAQ отговаря честно.
- `src/lib/plans-content.ts:46` (trust strip) + `src/lib/plans-content.ts` плановите карти → безплатен план с ясно „+ X% при продажба".
- MVP спец `2026-07-02-...:31` → бележка, че решението е сменено (ADR).

**Прозрачност (задължителна, не dark pattern):**
- Таксата се вижда **при избора/представянето на плана** — не скрита до края на настройката.
- Пълна и коректна в правния документ, който търговецът приема при регистрация.
- Не е в рекламния hero — това е позициониране, не скриване.

**ADR:** `docs/decisions/2026-07-23-transaction-fee-monetization.md` — отклонение от MVP „без комисиона" решението, с обосновката.

---

## 10. Компоненти и файлова карта

**Нови файлове:**
- `src/lib/fee.ts` — `feeCents(baseCents)` + `feeBaseCents(order)` чисти функции + конфиг константи (`FEE_RATE=0.05`, `FEE_MIN_CENTS=30`, `FEE_CAP_CENTS=5000`, `AUTO_COMPLETE_DAYS=30`, `FEE_GRACE_DAYS=14`). Тествани изолирано.
- `src/db/queries/fees.ts` — `getBillableBalanceForPeriod`, `recordFeeCharge`, `recordFeeCredit`, `hasOverdueFees`, `requiresCard`, `canAcceptOrders`, `getFeeInvoices`.
- `src/lib/selling-gate.ts` — нов тънък публичен gate: `canAcceptOrders(shopId)` (вика заявките от `fees.ts`). Заменя изтрития `plan.ts`.
- `src/app/api/cron/auto-complete-orders/route.ts` — авто-completed cron (`CRON_SECRET`).
- `src/app/api/cron/bill-fees/route.ts` — месечен billing cron (`CRON_SECRET`).
- Card setup UI + action (SetupIntent) в dashboard billing секцията.
- `docs/decisions/2026-07-23-transaction-fee-monetization.md` — ADR.

**Изтрити файлове:**
- `src/lib/plan.ts` — **целият план-концепт** (`PlanId`/`PLAN_LIMITS`/`resolvePlan`/`getShopPlan`/`inSignupTrial`/`billingAllowsSelling`/`isShopActive`). Заменен от `selling-gate.ts` + `fees.ts` заявките.

**Променени файлове:**
- `src/db/schema.ts` — `orders.completedAt`, `orders.returnedAt`, `fee_events` таблица + enum, `fee_invoices` таблица + enum, индекси.
- `src/actions/orders.ts` — `updateOrderStatus`: при `→completed` задава `completedAt` + charge; при `→returned` задава `returnedAt` + credit (в транзакция, идемпотентно). `createOrder` checkout gate → `canAcceptOrders`.
- `src/actions/products.ts` — премахване на `maxProducts` enforce (`:161-164,423-424,532`) + импортите от изтрития `plan.ts`.
- Всички други вносители на `plan.ts` (`getShopPlan`/`isShopActive`/`inSignupTrial`) → мигрират към `selling-gate.ts` или премахват употребата (grep `from "@/lib/plan"` при имплементация).
- `src/lib/order-status.ts` — без промяна на преходите (авто-completed ползва съществуващия `shipped→completed`).
- `src/lib/stripe.ts` / `src/actions/billing.ts` — таксов invoice режим (`charge_automatically` еднократни фактури вместо subscription); SetupIntent action.
- `src/app/api/webhooks/stripe/route.ts` — обработка на `invoice.paid` / `invoice.payment_failed` → `fee_invoices.status`.
- `src/lib/platform-legal.ts`, `src/app/(marketing)/page.tsx`, `src/lib/plans-content.ts` — текстове.
- `vercel.ts` / cron конфиг — двата нови cron-а.

**Деактивирани (решено):** subscription checkout flow (`createCheckoutSession` mode `subscription`) се **премахва** (не се пренасочва). `subscriptions` таблицата **остава** в схемата — преизползва се за `stripeCustomerId` на таксовия Customer (§7.3); колоните за план/статус, които вече не важат, се игнорират (не се трият, за да не се чупи миграция).

---

## 11. Обработка на грешки и ръбови случаи

| Случай | Поведение |
|---|---|
| Двойно изпълнение на auto-complete cron | `onConflictDoNothing` на `(orderId,'charge')` → без дубъл |
| Двойно изпълнение на billing cron | `onConflictDoNothing` на `(shopId,periodStart)` → без дубъл фактура |
| Връщане преди charge (кратко completed) | Няма charge → няма credit; чисто |
| Връщане на нетаксувана поръчка | Няма charge → credit не се създава |
| Кредит надвишава такси за месец | `amountDue <= 0` → фактура не се издава; търговецът не дължи |
| Поръчка заседнала в `shipped` | Авто-completed след `AUTO_COMPLETE_DAYS` → таксува се |
| Stripe webhook закъснява/повтаря | Идемпотентност през `stripe_events`; `fee_invoices.status` е производно |
| Магазин с просрочена фактура прави продажба | Checkout блокиран преди създаване на поръчка (`canAcceptOrders`) |
| Първа завършена продажба без карта | Таксува се; магазинът минава „изисква карта" → нов checkout блокиран до запазване |
| Карта отказана при месечно теглене | `invoice.payment_failed` → grace → след grace спира продажби |
| База много малка | `feeCents` вдига до `FEE_MIN_CENTS` |
| База много голяма | `feeCents` реже до `FEE_CAP_CENTS` |
| База ≤ 0 (безплатна/100% купон) | `feeCents` връща 0 (§4) — не таксуваме раздаден безплатен продукт |
| Часова зона на месеца | Периодите се смятат в UTC последователно; `occurredAt` е timestamptz |

---

## 12. Тестова стратегия

- **`fee.ts` unit** — граници на clamp (под мин, над таван, точно на праговете), монотонност (property: `a<b ⇒ feeCents(a)<=feeCents(b)`), **база ≤ 0 → 0**, база = subtotal − discount, integer-only, кръгли и некръгли суми.
- **Ledger unit** — charge при completed; credit при returned; идемпотентност (двоен insert → един ред); credit само ако има charge.
- **Агрегация unit** — баланс за период; кредит от следващ месец попада в правилния месец; празен период = 0.
- **Concurrency/integration** — `verify-order-concurrency.mjs` разширение: паралелно completing на същата поръчка → точно един charge (unique guard под транзакция).
- **Gate unit** — `canAcceptOrders`: true за нов магазин без charge; **след първи charge без карта → false** (card-gate); true пак след запазена карта; false при просрочена фактура; grace граница.
- **E2e** — не е задължителен за billing (external Stripe); ръчна проверка на живо след push (по модела на другите функции).

---

## 13. Фазиране (за плана)

1. **Данни + аритметика** — `fee.ts` (`feeCents`/`feeBaseCents` + константи), схема (`completedAt`, `returnedAt`, `fee_events`, `fee_invoices`), `db:push`. Тестове.
2. **Начисляване** — charge при `completed` (+ `completedAt`), credit при `returned` (+ `returnedAt`), идемпотентно, в `updateOrderStatus`. Тестове + concurrency.
3. **Anti-gaming** — auto-complete cron. Тест.
4. **Gate логика** — премахване на целия план-концепт (`PlanId`/`PLAN_LIMITS`/trial/`maxProducts`); нов `canAcceptOrders` = `!hasOverdueFees && !requiresCard`; checkout gate в `createOrder`. Тестове.
5. **Card setup** — SetupIntent flow, запазване на карта, `requiresCard` производно, dashboard UI „Запази карта, за да приемаш нови поръчки".
6. **Фактуриране** — агрегация, `fee_invoices`, billing cron, Stripe `charge_automatically` invoice режим, webhook обработка (`invoice.paid`/`payment_failed`).
7. **Легални/текстови** — `platform-legal.ts`, landing, планови карти → безплатен + 5%, ADR.

**Извън обхвата (по-късни надстройки):** таб „Растеж"; landing selling-points срещу Facebook. (Няма отделен „твърд блок на 90 дни" — card-gate §8.2 го замести.)

---

## 14. Заключени решения (всички отворени въпроси адресирани)

| # | Решение | Стойност |
|---|---|---|
| 1 | Процент | `FEE_RATE = 5%` |
| 2 | Минимум на такса | `FEE_MIN_CENTS = 30` (0.30€) |
| 3 | Таван на такса | `FEE_CAP_CENTS = 5000` (50€) |
| 4 | База на таксата | `subtotalCents − discountCents` (само стоката; база ≤ 0 → такса 0) |
| 5 | Авто-completed | `AUTO_COMPLETE_DAYS = 30` |
| 6 | Grace при неплащане | `FEE_GRACE_DAYS = 14` |
| 7 | Планове | Няма — 100% безплатен вход, всичко отключено, без продуктов лимит |
| 8 | Кога таксуема | При `completed` (ръчно или авто) |
| 9 | Връщане | Кредит със същата сума, `occurredAt` = дата на връщане (следващ месец) |
| 10 | Събиране | Авто-теглене от запазена карта (Stripe `charge_automatically`) |
| 11 | Кога карта | След първата завършена продажба (card-gate §8.2); вход без карта |
| 12 | Прозрачност | При избор на план + правни докове; не в hero |

Всички стойности са конфиг константи в `src/lib/fee.ts` — финална промяна преди пускане = една стойност.
