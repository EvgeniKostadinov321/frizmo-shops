# Одит 3 — Payments correctness & concurrency · 2026-07-13

**Обхват:** паричните потоци end-to-end под конкурентност — `pending_payment` →
webhook → confirm/cancel, cron auto-cancel, резервация на наличности при онлайн
плащане, център-аритметика, EUR↔ePay конверсия. Метод: inline проследяване на
целия онлайн път + сверяване с офлайн пътя за симетрия + анализ на race
прозорците между webhook, cron и ръчните действия на търговеца.

**Резюме:** Аритметиката и идемпотентността са наред. Основният риск е в
**разминаването между `orders.status` и `payment_intents.status`** при два пътя,
които отменят поръчка, без да пипат intent-а → закъсняла PAID нотификация може да
„възкреси" отменена поръчка (клиентът е платил, но е бил отменен — или обратно).
Две находки от този клас (една важна, една критична-по-ефект), плюс липса на
concurrency покритие за новия payment поток.

Severity: 🔴 критична · 🟠 важна · 🟡 дребна

---

## 🔴 S3-01 — Ръчен cancel на `pending_payment` не отменя intent-а → late PAID webhook възкресява поръчката

**Къде:**
- `src/lib/order-status.ts:9` — `pending_payment: ["new", "cancelled"]` (cancel е позволен преход)
- `src/actions/orders.ts:714` — `updateOrderStatus` enum позволява `"cancelled"`
- `src/actions/orders.ts:727-737` — транзакцията сетва само `orders.status` + `restoreStock`, **НЕ пипа `paymentIntents`**
- `src/actions/payment-confirm.ts:40` — idempotency guard е върху `intent.status`, не върху `order.status`

**Сценарий (реален race):**
1. Купувач създава онлайн поръчка → `order=pending_payment`, `intent=pending`,
   наличност резервирана.
2. Търговецът (или нетърпелив клиент) я отменя ръчно преди плащане →
   `updateOrderStatus(cancelled)` → `order=cancelled` + restock. **`intent` остава
   `pending`.**
3. Купувачът все пак плаща (беше отворил ePay) → webhook `confirmEpayPayment`
   вижда `intent.status === "pending"` (guard-ът минава!) → PAID клонът сетва
   `order` обратно на `new` + `intent=paid`.

**Ефект:** Отменена поръчка се „възкресява" от закъсняло плащане. Наличността е
била върната в стъпка 2, но поръчката пак е активна в стъпка 3 → **оверселинг +
объркан търговец** (мислеше, че е отказал). Обратно: клиентът е платил за нещо,
което е било отменено — ако търговецът не забележи възкресяването, парите са взети
без изпълнение.

**Първопричина:** двата източника на истина (`order.status` и `intent.status`) се
обновяват от различни места; ръчният cancel познава само поръчката.

**Препоръка (избери едно):**
- (a) В `updateOrderStatus`, когато отменяш поръчка с `paymentType === "online_card"`
  и статус `pending_payment`, отмени и intent-а в същата транзакция
  (`intent.status = "expired"`), за да не мине guard-ът после. **Препоръчано** —
  минимална промяна, затваря race-а at source.
- (b) Направи ръчния cancel на `pending_payment` изобщо непозволен (махни
  `"cancelled"` от `ALLOWED_TRANSITIONS.pending_payment` за ръчния път) — само
  webhook/cron управляват pending поръчки. По-строго, но лишава търговеца от
  контрол над „заседнала" pending поръчка.
- Във всички случаи: в PAID клона добави проверка/лог, ако `order.status` вече не е
  `pending_payment` при потвърждаване (defense-in-depth — виж S3-02).

---

## 🟠 S3-02 — Cron auto-cancel vs закъсняла PAID: клиентът плаща, поръчката е вече отменена — без alert

**Къде:**
- `src/app/api/cron/expire-payments/route.ts:8` — `EXP_MS = 2ч`
- `src/lib/payments/build-order-package.ts:3` — `EPAY_EXP_SECONDS = 7200` (2ч)
- `src/actions/payment-confirm.ts:40` — guard `intent.status !== "pending"` → `ignored`

**Проблем:** Границите на ePay `EXP_TIME` (2ч от генериране) и cron `EXP_MS` (2ч от
`intent.createdAt`) съвпадат, а cron се пуска на `*/15`. Има race прозорец около
2-часовата граница: cron отменя поръчката (`order=cancelled`, `intent=expired`,
restock) точно преди закъсняла PAID нотификация. Тогава webhook вижда
`intent=expired` → връща `ignored` **без никакъв сигнал**, че е пристигнало
плащане за отменена поръчка.

**Ефект:** В нормалния случай ePay няма да приеме плащане след `EXP_TIME`, така че
прозорецът е тесен. Но ако се случи (часовникови разминавания, забавена
нотификация), **клиентът е таксуван, а поръчката е отменена и наличността върната**
— и никой не научава. Парите остават при търговеца (Модел А) без насрещна поръчка.

**Препоръка:**
- В `confirmEpayPayment`, когато нотификацията е PAID, но `intent.status !== "pending"`
  (вече expired/cancelled), **логвай warning с висока видимост** (напр.
  `scope: "epay-paid-after-expire"` + orderId + amount) вместо тихо `ignored` — за
  да може търговецът да върне парите или да реактивира поръчката ръчно.
- Обмисли cron граница > ePay граница (напр. cron на 2ч30мин, ePay 2ч) — така ePay
  вече е отказал плащането, преди cron да пипне поръчката, и прозорецът се затваря
  почти напълно.
- (Пълно решение — извън MVP: reconciliation, който сверява ePay статуса на
  expired intents преди окончателен cancel.)

---

## 🟠 S3-03 — ePay `URL_OK` без `?t=<token>` → 404 след плащане (дублира S1-02)

**Къде:** `src/lib/payments/build-order-package.ts:23`; `checkout-form.tsx:361-365`

Вече описано в Одит #1 (S1-02). Тук е **correctness** ъгълът: онлайн пътят е
единственият, който не носи токена в URL-а, така че успешно платена поръчка връща
купувача на 404. Поправката (добави `&t=${token}` в `urlOk`, прекарай
`publicToken` до `buildEpayForOrder`) затваря и двете. **Оправи заедно с онлайн
потока.**

---

## 🟡 S3-04 — Резервацията на наличност при онлайн плащане държи склад до 2ч при изоставяне

**Къде:** `src/actions/orders.ts:346` + `:373` (decrementStock се вика за online_card преди плащане)

**Наблюдение (дизайнерски избор, не бъг):** При `online_card` наличността се
декрементира при създаване на `pending_payment` поръчката — преди клиентът да е
платил. Ако купувачът отвори ePay и просто затвори, стокът стои резервиран до
cron-а (≤2ч). Симетрично е (cancel/expire → restock), така че няма загуба на
наличност, но при малки наличности „изоставени" pending поръчки временно блокират
реални купувачи.

**Препоръка:** Приемливо за старта. Ако се окаже проблем на живо: скъси cron
границата за pending (напр. 30 мин вместо 2ч — повечето плащания стават до
минути), или добави индикация „резервирано" отделно от „продадено". Не блокер.

---

## 🟡 S3-05 — Новият payment поток няма concurrency покритие в `verify-order-concurrency.mjs`

**Къде:** `scripts/verify-order-concurrency.mjs` (покрива overselling / пореден номер / idempotency, но НЕ payment race-ове)

**Проблем:** Съществуващият скрипт доказва трите поръчкови гаранции директно срещу
базата, но не покрива новите payment сценарии: двоен webhook (идемпотентност),
webhook vs cron, late-paid след cancel (S3-01/02), multi-tenant `providerRef`
(Одит #1 S1-01).

**Препоръка:** Разшири скрипта (или нов `verify-payment-concurrency.mjs`) с:
- двойна PAID нотификация за същия intent → точно едно потвърждение, един restock 0.
- cancel на pending + следваща PAID → провери желаното поведение след поправката на S3-01.
- два магазина, еднакъв orderNumber, PAID за единия → само неговият intent става paid
  (регресия за S1-01).
Направи го **след** поправките на S1-01 и S3-01, за да кодифицира новото поведение.

---

## ✅ Проверено и чисто

- **Център-аритметика:** integer навсякъде; `priceCart` е единственият ценови
  източник (количка + checkout викат с еднакви данни → клиент/сървър не се
  разминават). Купон/deal/безплатна доставка: `Math.round`, без float
  (`pricing.ts:100,103,162`).
- **EUR↔ePay конверсия:** `toEpayAmount(cents) = (cents/100).toFixed(2)` →
  „33.00"; обратно `Math.round(Number(AMOUNT)*100)` — симетрично и integer-safe
  (`epay-signature.ts:4`, `epay.ts:45`). Валута фиксирана `CURRENCY: "EUR"`
  (`epay.ts:24`). ⚠️ EUR vs BGN приемането от ePay остава за жива проверка (както
  е отбелязано в спеца) — кодът е EUR-консистентен.
- **Резервация симетрия:** `decrementStock` (създаване) ↔ `restoreStock`
  (cancel/expire/denied) са симетрични; `restoreStock` уважава `stock IS NULL`
  (не следи наличност) — `orders.ts:701`.
- **Overselling под лок:** `SELECT ... FOR UPDATE` + conditional `stock >= qty
  returning` (доказано от `verify-order-concurrency.mjs` фикс #1) важи и за онлайн
  пътя (същият `decrementStock`).
- **Идемпотентност webhook:** двоен PAID → вторият вижда `intent.status !== "pending"`
  → `ignored`, без double-confirm/double-restock (`payment-confirm.ts:40`).
- **Idempotency на поръчката:** `idempotencyKey` + partial unique индекс + 23505
  recovery (`orders.ts:169,405`) — важи и за онлайн (двоен submit → една поръчка).
- **COD при онлайн:** `resolveCodAmount` връща null за `online_card` (не „cod") →
  куриерът не събира пари за вече платена поръчка (`courier-weight.ts:22`).
- **Cron guard по статус:** `getExpiredPendingOrders` филтрира по
  `intent=pending AND order=pending_payment` → вече потвърдена поръчка не попада в
  списъка за отмяна (`payment-reconcile.ts:15`).
- **Транзакционност:** confirm (paid/denied) и cron cancel са в `db.transaction`
  (intent + order + restock атомарно).

---

## Статус на находките

- [ ] S3-01 🔴 — ръчен cancel на pending не отменя intent → late-paid възкресяване (оправи at source)
- [ ] S3-02 🟠 — cron vs late-paid: логвай „paid-after-expire" + cron граница > ePay граница
- [ ] S3-03 🟠 — ePay `URL_OK` + `?t=` (= S1-02; оправи заедно)
- [ ] S3-04 🟡 — резервация до 2ч при изоставяне (по избор: скъси cron за pending)
- [ ] S3-05 🟡 — payment concurrency verify скрипт (след S3-01 / S1-01)

Свързано: [[online-payments-feature]], `2026-07-13-audit-1-security.md` (S1-01,
S1-02), `scripts/verify-order-concurrency.mjs`, [[production-audit-2026-07-09]]
(поръчковите concurrency фикси).
