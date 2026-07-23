# WORKLOG — Frizmo Shops

> **Живият контекст файл.** Един източник на истината за „докъде сме стигнали", независимо от коя машина работим (личен PC, Mac мини, друга).
>
> **ПРАВИЛО ЗА CLAUDE:** Обновявай този файл в края на всяка работна сесия, в която има смислена промяна (нова функционалност, редизайн на секция, решение, промяна в deploy-а). Слагай нов ред най-отгоре в „Дневник" с дата и кратко резюме + текущия commit. Той се commit-ва заедно с кода → синхронизира се през git между всички машини.

---

## Как да продължа работа на нова машина (напр. Mac мини)

Избран подход: **git clone + пренос само на `.env.local`** (вариант А).

1. **Clone на repo-тата от GitHub** (кодът е там, синхронизиран):
   - Frizmo Shops: `EvgeniKostadinov321/frizmo-shops`
   - Saas (Frizmo booking): второто repo на потребителя
2. **Пренеси `.env.local`** — той НЕ е в git (и не трябва да е). Копирай го сигурно (password manager / rar с парола), не по чист имейл. Сложи го в корена на `frizmo-shop/`.
   **Пълният шаблон с всички ключове е `.env.example`** (в git) — 17 ключа. Реалните стойности са само в твоя `.env.local`:
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`
   - Postgres: `DATABASE_URL` (:6543 transaction pooler) / `DATABASE_URL_MIGRATIONS` (:5432 session, само за db:push/seed)
   - `NEXT_PUBLIC_HERE_API_KEY`, `RESEND_API_KEY`
   - VAPID: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT`
   - `PLATFORM_ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL` (по избор — има fallback)
   - Stripe (billing, test mode локално): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET`
   - `CRON_SECRET` (abandoned cart cron гард; произволен низ, `openssl rand -hex 32`; текущата стойност е и във Vercel prod)
3. **Инсталирай и стартирай:**
   ```bash
   pnpm install
   pnpm dev        # http://localhost:3000
   ```
   **По желание — само ако ще пипаш маскот видеата:** `brew install ffmpeg` (не идва с
   `pnpm install`; нужен за обработка на пчела видеата — виж `docs/design/mascot-progress.md`).
   Готовите видео асети (`public/bee-wave.webm/.mp4`) са в git — ffmpeg трябва само за нови.
4. **НЕ пускай** `pnpm db:push` / seed скриптовете — Supabase базата е **облачна и обща**; от новата машина се свързваш към същата база. Setup-скриптовете (`setup-storage.mjs`, `setup-search.mjs`, `seed-demo-shops.mjs`) са еднократни и вече са изпълнени.
5. **Gate преди всеки commit:** `pnpm check` (lint + unit + build).

**Какво НЕ се пренася в rar/архив:** `node_modules/` (платформено-специфични; идват от `pnpm install`), `.next/` (билд кеш), `.git/` (идва от clone). Единственото ръчно нещо е `.env.local`.

---

## Текущо състояние (2026-07-13)

> **ВСИЧКИ pure-code функции завършени, тествани на живо и push-нати на прод** (Пакети А–Д +
> 7-те по-ранни). **UX инициатива Фаза 1 (табове) + Фаза 2 (режим на сложност) завършени и
> push-нати.** **Social login (Google) ✅ имплементиран, тестван на живо и push-нат
> (2026-07-13).** **Куриерска интеграция (Еконт+Спиди) ✅ имплементирана (10 задачи,
> commit-ната на `dev` локално, НЕ push-ната); чака push разрешение + ръчна проверка + външни
> ключове (Спиди, реален Еконт prod, жива проверка на createWaybill).**
> **Купувачески профил ✅ имплементиран (12 задачи, среден обхват) + разширен до ГЛОБАЛЕН
> `/account` (13 задачи: всички поръчки/любими продукти+магазини от всички магазини на едно
> място, профил икона в каталог/landing, сърце „любим магазин", изтриване с „ИЗТРИЙ";
> старите `/s/{slug}/account/*` пренасочват) + любимите станаха акаунт-базирани при логнат
> + десктоп sidebar layout + HERE autocomplete в адресната книга; ✅ ТЕСТВАН НА ЖИВО,
> commit-нат на `dev` локално, НЕ push-нат; e2e 5/5; чака САМО push. Мулти-user екипи ПРЕМАХНАТИ от обхвата.** Оставаща пътна карта →
> `docs/remaining-roadmap.md`. **СЛЕДВА: push на куриерите + купувачския профил (при разрешение)
> + останалата външна работа** (домейн `frizmoshops.bg` поръчан, чака setup; Stripe live; inv.bg;
> Sentry). Пълните детайли — в „Дневник" по-долу.

- **Клонове (ОБНОВЕНО 2026-07-22):** **`main` = Vercel PRODUCTION**, **`dev` = Preview/staging**. (Старата схема „dev=prod" е сменена при миграцията на нов Vercel акаунт.) Работим на `dev` → тест на Preview → merge/ff в `main` → Production. Push към `main` (=prod): агентът ПИТА преди качване. Vercel проект: **`frizmo-shops-final`** в акаунт **`frizmotech-2481`** (не стария `supportfrizmo-2377`).
- **Планове 1–5 ✅** · **План 6 Фаза А (админ) ✅** · **Фаза Б (Stripe billing) ✅** (test mode тестван, push-нат на dev; чака live Stripe ресурси + Vercel env vars за прод активиране). Резюме: `docs/superpowers/plans/executed-plans-summary.md`.
- **`getShopPlan()` е stub** (src/lib/plan.ts) → всички магазини са "pro" до прод активиране на билинга.
- **Website builder Вълни 1–3Б ✅** (dev+prod, тествани). Остава Вълна 4 (undo/версии, домейн, i18n).
- **Одит цикли ✅**: 4 одита 2026-07-07 (security/a11y/perf/UX) + production readiness одит 2026-07-09 (12/19 оправени, 2 критични concurrency бъга фикснати) + Next.js плюсове одит 2026-07-12 (SEO enrichment + cache safe wins) + **5 предстартови одита 2026-07-13 на новия код (ePay/куриери/профил) — 0 критични в стария код; ВСИЧКИ находки обработени (3+4+7) в 3 локални commit-а; S1-01 индексът приложен и НА ПРОД**. `docs/superpowers/audits/`.
- **Всички pure-code пакети (А–Д) ✅ ТЕСТВАНИ + PUSH-НАТИ** (2026-07-12). Категория 1 от `remaining-roadmap.md` е приключена. Остава „голямото самостоятелно" (мулти-user екипи, купувачески акаунт) + категория 2 (иска външна намеса).
- **UX инициатива ✅**: Фаза 1 (табове на 5 претрупани страници, `ui/Tabs` примитив) + Фаза 2 (режим на сложност Хоби/Малък бизнес/Пълна) — тествани на живо + push-нати 2026-07-12.

**Открити нишки (не спешни):**
- Кеш архитектура — частично адресирана 2026-07-12 (cookie-guard + terms кеш, Пакет B); пълното решение = Next `cacheComponents` (отделна сесия). Анализ: `docs/superpowers/audits/2026-07-07-cache-architecture-deep-dive.md`.
- Sentry — чака DSN (същият акаунт, нов проект). Backup/PITR — за преценка.
- **⚠️ P2-01 (сигурност):** ротирай прод DB парола + `SUPABASE_SECRET_KEY` (минаха през чата при setup на прод) → обнови `.env.prod.local` + Vercel. Изисква Supabase достъп.
- **Vercel prod env vars при push:** увери се, че `CRON_SECRET` е там (за cron) + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `NEXT_PUBLIC_SITE_URL`; всяко добавяне → **Redeploy**.
- **Schema дрифт dev↔прод:** проверявай с `scripts/verify-schema-parity.mjs` (`DB_A`/`DB_B` env; колони+enum+индекси) след всеки push. **trgm GIN индексите не са в `schema.ts`** → на прод ползвай таргетиран SQL, не `drizzle-kit push`.

**Какво следва:** външната работа (виж дневника 2026-07-12) — домейн setup (чака SuperHosting до 24ч),
Stripe live активиране (кодът готов), Еконт/Спиди (спец/план готови, чакат ключове), inv.bg фактури
(Случай A), Sentry. + `2026-07-06-builder-roadmap.md` (Вълна 4). **Social login (Google) — ✅ готов.**

---

## Работни правила (кратко — пълните са в CLAUDE.md)

- Inline изпълнение, без паралелни субагенти освен при изрично разрешение (пази usage лимита).
- UI текст на български, типографски кавички „…“ (прав `"` чупи JS/YAML).
- Валута EUR в integer центове.
- Дизайн токени, без хардкоднати стойности; reusable компоненти в `src/components/ui/`.
- Magnific генериране: единично, с план + одобрение + обосновка на модела преди всяко.
- Потребителят тества визуално сам; Claude прави `pnpm check` + commit.
- **`dev` = Vercel production.** Push към `dev`: питай + качи само при разрешение. `main` не се ползва.

---

## Дневник (най-новото най-отгоре)

- **2026-07-23 (10) — BL-01 РЕШЕНО (cross-month таксов кредит, running balance).** Потребителят делегира
  решението с пълно доверие. Проблемът: билингът смяташе дължимото за КАЛЕНДАРЕН месец → кредит от прието
  връщане (occurredAt=returnedAt), попаднал в месец без продажби, се губеше (amountDue≤0→continue). ~половината
  връщания (14-дневен прозорец + месечен billing). Условията чл.3 обещаваха „кредит в следваща фактура" →
  кодът не го спазваше + спецът си противоречеше (ред 198 „пренася се" vs §7.2 „не"). **Фикс (running balance):**
  нова `getCumulativeBillableBalance` — дължимо = кумулативен нетен ledger (до periodEnd) − вече издадени
  положителни фактури → отрицателен остатък се пренася, покрива бъдещи такси. bill-fees cron ползва новата
  заявка. 4 unit теста (март→април→май→юни, общо платено = реалните такси). ADR
  `decisions/2026-07-23-cross-month-fee-credit-carryover.md`; спец §7.2+ред 198 съгласувани. `pnpm check` = 493.

- **2026-07-23 (9) — ОДИТЕН ЦИКЪЛ #3 (нови измерения) + 8 поправки + 1 отворено.** Трети одит (Error/
  resilience, Business-logic, Performance/N+1, Auth/session; workflow 16 агента, 0 грешки, 0 повторения,
  ✅ агентите НЕ пипнаха файлове — усилен промпт). 11 нови находки. Доклад: `audits/2026-07-23-audit-cycle-3.md`.
  **ПОПРАВЕНИ 8** (план `2026-07-23-audit-fixes-3.md`, `pnpm check` = 489 теста): **PERF-01** (reorderToCart
  N+1 → batch inArray) · **AUTH-01** (searchOfficesForShop rate limit — публичен endpoint изчерпваше куриерската
  квота) · **ERR-01** (notifyStockAlerts try/catch — unhandledRejection) · **ERR-02** (auto-complete cron
  per-order try/catch + CAS брояч) · **BL-02** (ALLOWED_TRANSITIONS +completed→return_requested + re-request
  guard) · **PERF-04** (getShopQuestions cap 200) · **PERF-02/03** (partial индекси orders(status,updatedAt
  WHERE shipped) + payment_intents(status,createdAt WHERE pending) — таргетиран SQL на прод, pg_trgm запазени,
  verify-schema-parity dev↔прод ЧИСТ). ⚠️ Гоча пак: `drizzle-kit push` на dev изтри trgm → възстановени с
  setup-search. **🟠 ОТВОРЕНО (изисква решение): BL-01** — cross-month return кредит се губи (търговец надплаща);
  УМИШЛЕНО (спец §7.2), но спецът СИ ПРОТИВОРЕЧИ (schema ред 198 „пренася се" vs §7.2 „не се пренася"). Дребните
  BL-03/04/PERF-05 → дълг. Чака push.

- **2026-07-23 (8) — ОДИТЕН ЦИКЪЛ #2 (нови измерения) + 11 поправки.** Втори одит по същия процес
  (subagenti workflow, 4 НОВИ измерения: Валидация/санитизация, A11y дълбок, Кеш/RSC, Concurrency дълбок;
  17 агента, 0 грешки). Подадени находките от #1 → 0 повторения; 13 уникални нови находки. Доклад:
  `docs/superpowers/audits/2026-07-23-audit-cycle-2.md`. ⚠️ verify-агент наруши „само откриване" и пипна
  5 файла → **върнати** (git checkout). Вторична проверка: сверих CONC-01/CACHE-01 срещу кода + VAL-01
  **емпирично** (`z.url()` наистина приема `javascript:`). **ПОПРАВЕНИ 11** (план `2026-07-23-audit-fixes-2.md`,
  `pnpm check` зелен = 488 теста): **CONC-01** (expire-payments cron CAS guard — отменяше платена поръчка,
  същият клас като DATA-01 но cron остана незащитен) · **CONC-02** (newsletter CAS — дублиран welcome купон
  при паралелно потвърждение) · **CACHE-01/02** (ePay поръчка/webhook/cron сега инвалидират feed кеша —
  COD пътят го правеше, ePay не → feed рекламираше грешна наличност) · **CACHE-03** (нов `siteUrl()` helper
  за metadataBase+sitemap — хардкоднат vercel.app щеше да чупи canonical/sitemap след смяна на домейн) ·
  **VAL-01** (нов `safe-url.ts`: `isSafeHref`/`safeHref` — storefront link полета приемаха `javascript:`/`data:`
  URL → stored XSS; schema refine + render defense-in-depth на socials/hero/announcement/promo/navLinks) ·
  **A11Y-01/04** (warning-600/success-600 затъмнени за WCAG AA в light) · **A11Y-02** (купон input aria-label) ·
  **A11Y-03** (role=alert на 5 форми) · **A11Y-05** (нов `useFocusTrap` хук в Drawer+Modal). **ОТЛОЖЕНИ:**
  CACHE-04 (react cache дедуп), CACHE-05 (ownerId в RSC). Чака push разрешение.

- **2026-07-23 (7) — ОДИТЕН ЦИКЪЛ (нов+стар код) + 7 поправки.** Процес: субагенти (workflow, 4
  измерения × find+adversarial verify = 20 агента) → моя вторична проверка (лично сверих 5 срещу
  кода, 0 халюцинации) → триаж → inline поправки. Резултати: `docs/superpowers/audits/2026-07-23-audit-cycle.md`
  (15 уникални находки; основите солидни — 0 находки в стария утъпкан код освен известните).
  **ПОПРАВЕНИ 7 (план `2026-07-23-audit-fixes.md`, `pnpm check` зелен, 485 теста):**
  DATA-01 (CAS status-guard в updateOrderStatus срещу двоен-клик oversell) · DATA-02 (return window
  от completedAt котва, не плаващия updatedAt) · BILL-01 (bill-fees Stripe idempotencyKey + per-shop
  try/catch — двойна фактура + един провал спираше всички) · BILL-02 (webhook paid→issued guard,
  `ne(status,'paid')` — пренаредено събитие блокираше платен магазин) · REL-01 (Stripe outage
  fail-open в requiresCard — билинг проблем сваляше публичния checkout) · SEC-01 (гост-поръчки се
  свързват по ВЕРИФИЦИРАН имейл вместо самоописан телефон — беше IDOR/PII теч; email мач
  case-insensitive, празен имейл не мачва; спряно фалшивото phoneVerified=true). **ОТЛОЖЕНИ (записани
  като дълг):** DATA-02b (deleteAccount трие неплатен дълг), SEC-02 (ключове в RSC payload), REL-02
  (billing страница крие DB фактури при Stripe outage) + 4 дребни. Чака push разрешение.

- **2026-07-23 (6) — РЕВИЗИЯ „докъде сме + какво остава" → `docs/STATUS-2026-07-23.md`.**
  Пълна проверка на плановете срещу реалността (git + read-only проверка на прод базата, НЕ по памет).
  **Открития:** (1) целият код е на прод — много memory файлове твърдяха „локално, НЕ push-нато" /
  „чака db:push" → ОСТАРЯЛО, поправено. (2) Прод базата (Frankfurt) е в пълен schema-parity: made-to-order
  колони, `orders.completed_at/returned_at/buyer_id`, fee/куриери/плащане таблици, и трите pg_trgm индекса —
  всичко там → **made-to-order db:push НЕ е нужен** (вече направен). (3) ✅ **Спиди имейл за тест ключове
  ИЗПРАТЕН** до `api.registration@speedy.bg` (Фризмо Тех ЕООД, ЕИК 208752971) → чака отговор. Пълната
  снимка на „готово / чака външен акаунт / неписано / конфиг дълг" е в новия `docs/STATUS-2026-07-23.md`.
  **Остатък:** жив тест на монетизацията (7 стъпки) · Спиди/Еконт prod/ePay реални акаунти ·
  inv.bg + Sentry (неписани) · `NEXT_PUBLIC_SITE_URL` на Production (конфиг фикс).

- **2026-07-23 (5/LIVE) (`0708eea` dev+main/ПРОД) — БИЛИНГЪТ Е 100% LIVE НА ПРОД.**
  Месечната фактура тествана end-to-end на живо (`scripts/seed-fee-invoice.mjs`: charge в минал месец → агрегация →
  Stripe фактура → авто-теглене от картата → paid; потвърдено „юни 2026 · 2€ · Платена"). „Премахни карта"
  добавено (`removeCard` action + бутон с потвърждение). **Live Stripe проверен обективно (read-only):** акаунт
  FRIZMO (`acct_1TASaqRq5DJiUm57`), BG/EUR, charges+payouts enabled (готов за реални пари); live webhook
  `https://frizmoshops.bg/api/webhooks/stripe`, enabled, API 2026-06-24.dahlia, събития invoice.paid+payment_failed.
  **Vercel Production env:** трите live ключа (sk_live/pk_live/whsec) + Redeploy (Ready). Landing на прод показва
  новите текстове. **СПОДЕЛЕН Stripe акаунт** със салоните (`api-dev.frizmo.bg` webhook) — изолация през
  `metadata.app==="frizmo-shops"` guard + отделен наш live webhook. Стари абонаментни продукти архивирани в TEST.
  **ОСТАВА само предстартов жив тест** на frizmoshops.bg (7-стъпков план в паметта [[transaction-fee-monetization]])
  преди реклами. ⚠️ Live = реални пари.

- **2026-07-23 (4/ФИНАЛ) (`c3a6d75` dev+main/ПРОД) — card форма работи end-to-end; БИЛИНГЪТ НА ПРОД.**
  Card-gate формата вече работи изцяло, потвърдено на живо (dev+прод). **Root cause на висенето беше ДВОЕН:**
  (а) `elements.submit()` е ЗАДЪЛЖИТЕЛЕН преди `confirmSetup` в react-stripe-js 6.x — иначе confirmSetup виси
  безкрайно без грешка (`da70c56`, guard-нат с withTimeout 25с); (б) **КЛЮЧОВОТО** — `confirmSetup` САМО записва
  картата към customer-а, но НЕ я прави default. Без изричен `default_payment_method`, `customerHasDefaultCard`
  остава false → card-gate никога не пада → формата „виси" от гледна точка на потребителя. **Фикс (`f89e6fd`):**
  нов server action `setDefaultCard` (`src/actions/card-setup.ts`) — взима customerId САМО за текущия shop (не от
  SetupIntent-а → защита срещу чужд customer), валидира `intent.customer === sub.customerId`, вика
  `stripe.customers.update(...default_payment_method...)`; формата го извиква с `confirmRes.setupIntent.id` веднага
  след confirmSetup. **Card визуализация (`152cea4`):** нов `SavedCard` (`src/components/dashboard/saved-card.tsx`)
  — brand + •••• last4 + „Изтича MM/YY" + „Смени" (инлайн CardSetupForm); `getDefaultCard` helper в `stripe.ts`;
  invoice статуси с цветови тон. Debug логовете от диагностиката махнати (`c3a6d75`, запазени timeout guard +
  try/catch + setDefaultCard). **Обективна проверка на живо:** Stripe Customer `cus_Ur6uz3...`, default карта
  VISA •••• 4242 exp 2/2029, fee_events 2 charge = 1.30€. **Прод база:** `fee_events`+`fee_invoices`+
  `orders.completedAt/returnedAt` приложени с **таргетиран SQL** (не drizzle push — pg_trgm 3/3 цели).
  **БИЛИНГЪТ Е НА ПРОД:** `origin/main == origin/dev == c3a6d75` (линеен, нула дивергенция).
  **ОСТАВА (не блокира кода, само реалната активация):** (1) live Stripe ключове за реални плащания (сега test
  mode); (2) Vercel Production Stripe env ако тестваш на прод домейн; (3) по избор — „изтрий стари карти при
  смяна" (иначе payment methods се трупат в customer-а — при теста станаха 10).

- **2026-07-23 (3) (`da70c56` dev/preview) — БИЛИНГ Task 7-8 + card E2E на живо + 7 находки.**
  Завършена цялата **картова верига (Task 7, `89578e0`):** `createSetupIntent` (`src/actions/card-setup.ts`,
  SetupIntent `usage:off_session` + `payment_method_types:["card"]`); `ensureStripeCustomer`/`customerHasDefaultCard`
  (`src/lib/stripe.ts`); реалният `requiresCard(shopId)` е в `src/lib/selling-gate.ts` (НЕ fees.ts — заради
  server-only); UI през `billing-panel.tsx` + `card-setup-form.tsx` + `stripe-client.ts` (`getStripe()` чете
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`). **Task 8 (`6dc85c4`):** месечен cron `bill-fees/route.ts` (CRON_SECRET,
  `getBillableBalanceForPeriod→recordInvoiceForPeriod→markInvoiceIssued`, Stripe `charge_automatically`) + webhook
  (`invoice.paid→paid`/`payment_failed→issued`, dedup stripeEvents). Идемпотентност: unique(shopId,periodStart).
  **7 НАХОДКИ/ФИКСА:** (1) invoice→invoiceItem ред за Stripe 2026-06-24 — draft `invoices.create` ПЪРВО, после
  `invoiceItems.create` с явен `invoice:id`, иначе фактура за **0€** (`faa5f9b`); (2) индикация за нужна карта —
  банер `card-required-banner.tsx` + nav „!" badge на таб Такси + `sendCardRequiredEmail` при 1-ва завършена
  продажба (countFeeCharges===1) (`57832fc`); (3) **card-gate дупка** — `canAcceptOrders` гард добавен и на
  `createManualOrder` (`orders.ts:535`), не само онлайн checkout (иначе търговецът заобикаля през касата) +
  регресионен тест (`8a495e1`); (4) ранно предупреждение на `/dashboard/orders/new` вместо форма (`24a2646`);
  (5) SetupIntent само карта — Pix/Bancontact махнати (нерелевантни за BG) (`0b88f2d`); (6+7) **висенето на
  картата** — `da521f9` (изключен Stripe Link + return_url), после финалният фикс `da70c56`: **`elements.submit()`
  ЗАДЪЛЖИТЕЛЕН ПРЕДИ `confirmSetup`** в react-stripe-js 6.x (без него confirmSetup виси безкрайно без грешка;
  диагностицирано чрез systematic-debugging + жива инструментация + Stripe docs). **Тестове:** 483 (80 файла),
  0 fail. Verify (ръчни): `verify-fees.mjs` (ledger) + `verify-billing-e2e.mjs` (реален Stripe test: SetupIntent→
  карта→фактура→теглене, `amount_paid=105`). Оправен и `.env.example` (добавен PUBLISHABLE_KEY, махнати остарели
  STRIPE_PRICE_*). Git: чисто, `dev==origin/dev` (`da70c56`, Vercel preview); `origin/main` непокътнат — нищо
  билинг в прод. **ОСТАВА:** (1) Vercel **Preview** env — test Stripe ключове (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  + `STRIPE_SECRET_KEY`, `WEBHOOK_SECRET` само за фактури) → Redeploy → жив тест на dev; (2) прод активиране:
  live Stripe + merge main + **таргетиран db:push** на fee таблиците (`fee_events`/`fee_invoices`, не drizzle push).

- **2026-07-23 (2) (`c93b9e8` dev/preview) — БИЛИНГ ИМПЛЕМЕНТАЦИЯ: ядро (Задачи 1-6) + текстове (9) на dev.**
  От одобрения спец → **имплементационен план** `docs/superpowers/plans/2026-07-23-transaction-fee-monetization.md`
  (9 задачи, TDD; self-review хвана 3 несъответствия с кода: requireShop сигнатура, owner имейл
  през Supabase admin, reuse ensureCustomer). Изпълнени **inline Задачи 1-6 (ядро) + 9 (текстове)**;
  Задачи 7-8 (Stripe card/фактуриране) ОТЛОЖЕНИ за live ключове.
  **Направено (на dev):** (1) `src/lib/fee.ts` — 5% + мин 0.30€ + таван 50€, база subtotal−discount,
  база≤0→0, монотонна; 10 теста. (2) Схема — `fee_events` (immutable ledger, unique(orderId,type)) +
  `fee_invoices` (unique(shopId,periodStart)) + `orders.completedAt`/`returnedAt` + индекс; db:push на dev.
  (3) `src/db/queries/fees.ts` — recordFeeCharge/recordFeeCredit (идемпотентни) + getBillableBalanceForPeriod
  + hasOverdueFees + requiresCard (DB-only засега); `scripts/verify-fees.mjs` (8 проверки). (4) charge при
  `→completed` + credit при `→returned` в `updateOrderStatus` (в транзакция, completedAt/returnedAt); verify
  „двойно completing→1 charge". (5) `auto-complete-orders` cron (30 дни shipped→completed+charge, anti-gaming)
  + vercel.json. (6) **plan.ts ИЗТРИТ** → `src/lib/selling-gate.ts` (`canAcceptOrders` = !hasOverdueFees &&
  !requiresCard); 5 вносителя мигрирани (orders/products/billing/checkout/layout); maxProducts лимит премахнат.
  (9) Оттеглено „без комисиона": `platform-legal.ts` раздел 3 (такса за продажби), landing hero „Без хаос"
  (комисиони→хаос акцентна дума), FAQ, trust баджове, `plans-content.ts` (1 безплатен план вместо Starter/Pro),
  ADR `docs/decisions/2026-07-23-transaction-fee-monetization.md`. 478 теста + 2 verify зелени.
  **ГОЧА ПОТВЪРДЕН:** `drizzle-kit push` на dev ИЗТРИ pg_trgm индексите → възстановени с `setup-search.mjs`.
  → прод db:push ТРЯБВА да е таргетиран SQL (не push).
  **ОСТАВА за пълен билинг:** Task 7 (card SetupIntent, `requiresCard` реален Stripe), Task 8 (месечен
  billing cron + Stripe charge_automatically + webhook) — чакат Stripe акаунт (test за код, live за прод).
  Прод активиране: 7-8 готови → Stripe live + Vercel env → таргетиран db:push на fee таблиците → merge main.
  ⚠️ Task 9 текстовете са на dev preview, НЕ на прод (не рекламирай такса без работещ механизъм).

- **2026-07-23 (`842b440` dev+main/PROD) — made-to-order cap фикс + монетизационен спец + build hardening + прод env.**
  **НАПРАВЕНО и ТЕСТВАНО (на прод):** (1) **Made-to-order cap фикс** — таванът броеше редове
  (order_items), сега брои **БРОЙКИ**: `sumActiveMadeToOrderQty` (`src/db/queries/orders.ts:80-96`,
  `coalesce(sum(quantity),0)` под FOR UPDATE лок) + гард `active + qty > cap`. Регресия в
  `verify-order-concurrency.mjs` (1 поръчка 4бр при таван 3 → отказ). `88744cf`. (2) **Made-to-order**
  цялата вертикала вече на **main (prod)** — беше само на dev. (3) **Auth chosenRole** на прод
  (`7c94f28`). (4) **Хедър едно сърце** + видим „Изход" за купувачи на прод (`72de3ca`,`a593e2e`,`062a6fa`).
  (5) **Build фикс** — `next.config.ts` устойчив на празна `NEXT_PUBLIC_SUPABASE_URL` (`?.trim()`+try/catch,
  `next.config.ts:6-15`); прод билдът гърмеше с `ERR_INVALID_URL` от празна env var. `842b440`.
  478 теста зелени, gate чист. Git: `main`==`dev`==`842b440`, синхронизирани.
  **РЕШЕНИЕ — Монетизация (СПЕЦ готов, план НЕ, имплементация ОТЛОЖЕНА):**
  `docs/superpowers/specs/2026-07-23-transaction-fee-monetization-design.md` (`f699ac4`,`ad36074`).
  Смяна от flat абонамент → **безплатен вход + такса на транзакция**, месечна фактура (Модел А —
  парите НЕ минават през нас). Заключено: **5%** + мин **0.30€** + таван **50€**; база
  **subtotal−discount** (само стоката); **без планове** (`plan.ts` се изтрива → `selling-gate.ts`
  +`fees.ts`); таксуема при `completed` + авто-completed на 30 дни; кредит при връщане (immutable
  `fee_events` ledger); **авто-теглене** от карта (Stripe `charge_automatically`); **card-gate** —
  карта се иска чак СЛЕД първата завършена продажба; grace 14 дни. ADR още НЕ написан.
  **ENV SPLIT УРОК (важно):** при env split прод копията паднаха на дължина 0 → билд гърми.
  Създадени готови за импорт файлове: **`.env-import/.env.dev`** (изцяло готов) +
  **`.env-import/.env.prod`** (3 Frankfurt тайни за попълване) — папката е в `.gitignore`.
  **ОСТАВА:** (а) утре — импорт на env файловете (dev+prod, през Git Bash файл-stdin, не PowerShell pipe);
  (б) `db:push` на made-to-order/auth колоните към прод Frankfurt база (таргетиран SQL, НЕ drizzle push —
  пази pg_trgm индексите; провери с `verify-schema-parity.mjs`); (в) DNS пропагация → Refresh →
  redeploy → жив тест от 0; (г) билинг имплементация (план→ADR→код, отделна сесия); (д) отложени:
  P2-01 ротация, почистване стар акаунт/дубликат, реални ключове куриери/ePay, Stripe live.

- **2026-07-22 (AUTH/РОЛЯ ПРЕРАБОТКА — контекстно-базирана роля, dual-role акаунт)** —
  Потребителят откри реален конфликт: dual-role акаунт (един user = owner на магазин + купувач)
  → изборът „Пазарувам" при вход се игнорираше, вкарваше в dashboard. Диагностика с **2 workflow-а
  (7 агента)**: картографирани всичките 26 вход-сценария. Спец `2026-07-22-context-based-role-design.md`.
  **Коренна причина:** `hasShop` се ползваше като „активна роля" и надделяваше над всеки избор — на
  3 огнища: (A) `signIn` не четеше role (loginSchema без поле), (B) `resolvePostAuthPath` слагаше
  hasShop над намерението, (C) proxy триеше `?role`/`?next` за логнати.
  **Решение (принцип на потребителя): РОЛЯТА СЕ ОПРЕДЕЛЯ ОТ КОНТЕКСТА/ДЕЙСТВИЕТО, не от акаунта.**
  chosenRole побеждава hasShop. Промени: (1) `loginSchema` +role; (2) `resolvePostAuthPath` +chosenRole
  параметър, нова йерархия (chosenRole="buyer" → /account ДОРИ да има магазин); (3) `signIn`/`signUp`
  четат+подават role; (5) proxy НЕ се меси при role/next (огнище C); (6-8) OAuth seller явен + entry
  points козметика (next=/account, ?role=seller). **Гранични връзки** (owner-only, контекстни не
  stateful switcher): /account → „Табло на магазина"; /dashboard → „Пазарувам". 5 нови теста за
  chosenRole (478 общо). **+ Бързи UX фикса от диагнозата:** двойно сърце (ShopFavoriteButton → store
  икона, разграничено от любими продукти), невидима stock грешка (контекстен hint в made-to-order
  панела). **+ Купувачки logout** (беше скрит само в settings; добавен видимо в AccountNav → каталога).
  Гейт зелен, build ок. **На dev локално, НЕ push-нато.** НЯМА двоен профил (потвърдено — 1 auth user).
  Детайли: [[context-based-role-feature]].

- **2026-07-22 (РЪЧНА ИЗРАБОТКА / ПО ПОРЪЧКА — имплементирана, тествана, на dev)** —
  Нова pure-code функция за ръкоделческата публика (картини/шиене/бижута). Спец
  `2026-07-22-made-to-order-design.md`, план `2026-07-22-made-to-order.md` (10 задачи, TDD).
  **Модел:** per-продукт флаг → при изчерпани готови бройки (stock=0) продуктът приема поръчки
  „по изработка" (срок диапазон min–max дни + опционален таван на опашката), вместо „изчерпано".
  Един продукт, 3 състояния: stock>0 готово · stock=0+madeToOrder по изработка · stock=0+не/таван
  достигнат изчерпано. **Backend:** 7 нови колони (products 4 + order_items 3 snapshot); Zod
  cross-field (superRefine); made-to-order резолюция в `priceCart` (чиста функция — при недостиг за
  madeToOrder продукт цялото количество е „по изработка"); checkout приема без декремент + **cap
  enforcement под FOR UPDATE лока** (`countActiveMadeToOrder`, race-safe като overselling guard) →
  MADE_TO_ORDER_FULL; snapshot в order_items; и двата пътя (createOrder + manualOrder). **Verify
  скрипт:** 2 паралелни поръчки по изработка при cap=1 → точно 1 минава. **UI (горд знак, не
  извинение):** продуктова форма секция (тогъл+срок+таван, logistics таб); storefront акцентна
  кутийка „Изработва се специално за теб · срок" (VariantPicker не блокира бутона при stock=0,
  неограничено количество), card badge „Ръчна изработка" (без „Изчерпано" overlay), кошница+
  потвърждение срок, dashboard „По изработка" бадж. Гейт: **469 теста** (16 нови), lint чист, build
  ок. `db:push` на dev. **8 commit-а на dev, НЕ push-нати.** Билинг темата (транзакционна такса)
  ОТЛОЖЕНА за отделна сесия. Детайли: [[made-to-order-feature]].

- **2026-07-22 (PROD ДЕПЛОЙ НА НОВ VERCEL АКАУНТ + main=prod + env split + домейн — В ХОД)** —
  **Vercel достъпът се възстанови** (стар акаунт `supportfrizmo-2377` беше заключен с 2FA; влизане
  през Google OAuth `supportfrizmo@gmail.com` + после обезопасен с TOTP Authenticator). Решение:
  **мигрирахме frizmo-shops на НОВИЯ акаунт** `frizmotech-2481` (`frizmo.tech@gmail.com`, обезопасен),
  за да няма риск от повторно заключване. **Node локално върнат на 24** (беше паднал на 20 → `pnpm`
  гърмеше на `node:sqlite`; `nvm use 24.18.0`). Gate зелен: **449 теста, lint, build**.
  **Свършено:**
  1. **Нов Vercel проект `frizmo-shops-final`** в `frizmotech-2481` (Pro upgrade — cron-овете искат
     Pro), import от GitHub `EvgeniKostadinov321/frizmo-shops`, 14 env vars през Import .env.
     Prod URL `frizmo-shops-final.vercel.app` — ✅ работи (homepage + демо магазин от прод база).
  2. **main=prod / dev=preview**: `main` беше 303 commit-а зад `dev` (изоставен) → fast-forward до
     `dev` (0 конфликта) + push. Production вече деплойва от `main`; `dev` = Preview. **29-те
     неpush-нати commit-а (куриери/профил/ePay/одити) вече на GitHub.**
  3. **Env скоупове разделени** (Vercel CLI): 4 var-а (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL/
     ANON_KEY`, `NEXT_PUBLIC_SITE_URL`) → Production=прод (Frankfurt), Preview=dev (Париж). Останалите
     10 споделени. ⚠️ Гоча: при rm+add Production копията паднаха → върнати ръчно; всичките 14 в
     Production потвърдени. Preview деплоите вече пишат в dev база, не прод.
  4. **Домейн `frizmoshops.bg`** добавен във Vercel (Production, redirect apex→www). DNS записи
     въведени в SuperHosting: `@` A→`216.150.1.1`, `www` CNAME→`e2bdad7c0168b5a6.vercel-dns-016.com`.
     ⏳ **Чака DNS пропагация** (SuperHosting 15-60мин) → после Refresh във Vercel → SSL авто.
  **ОСТАВА:** DNS резолв → Vercel Refresh → `NEXT_PUBLIC_SITE_URL=https://frizmoshops.bg` redeploy;
  изтрий дубликата `frizmo-shops` (blush) проект; свали/зачисти стария `supportfrizmo-2377` (там още
  живеят frizmo-web/app.frizmo.bg, frizmo-landing/frizmo.bg, englishwithbozhi — ПРОВЕРИ дали са живи
  бизнеси преди Hobby downgrade). **P2-01 ротация ОТЛОЖЕНА** (0 юзъри, преди реален старт). Детайли:
  [[prod-environment]].

- **2026-07-13 (ПРЕДСТАРТОВИ ОДИТИ — 5 одита на новия код + всички находки обработени)** —
  5 одита на НЕОДИТИРАНИЯ нов код (онлайн плащане ePay, куриери Еконт+Спиди, глобален
  профил, режим на сложност, InfoHint, storefront сърца), всеки резултат в отделен файл
  `docs/superpowers/audits/2026-07-13-audit-{1..5}-*.md` (security/production/payments/data/UX).
  **Нула критични в стария код** — основите солидни (webhook подпис timing-safe, buyer изолация
  през сесията, център-аритметика integer, RLS/индекси/snapshot оцеляване, ключове никога към
  клиента). **Обработени ВСИЧКИ находки в 3 commit-а (локално, `pnpm check` зелено, 449 теста):**
  (1) `3ee43fe` **3 code блокера** — S1-01 (`payment_intents_ref_idx` → `(shopId,provider,providerRef)`;
  orderNumber е per-shop → без shopId вторият магазин удря 23505), S1-02 (`URL_OK` носи `?t=<token>`
  → без него потвърждението дава 404), S3-01 (cancel на `pending_payment` маркира intent-а `expired`
  в същата транзакция → иначе закъсняла PAID нотификация „възкресява" отменена поръчка); (2) `b58fdbf`
  **4 препоръчани** — P2-02 (`CRON_SECRET` warning), S3-02 (paid-after-expire лог + cron граница =
  ePay EXP+30мин), P4-01 (`deleteBuyerAccount` в транзакция), P5-01 (submit disabled по време на ePay
  redirect); (3) `67f4c85` **7 дребни** — S1-03 (webhook rate-limit 600/мин), S1-04/S3-05 (multi-tenant
  webhook регресия тест), P4-04 (нов `scripts/verify-schema-parity.mjs` — колони+enum+ИНДЕКСИ dev↔прод),
  P5-02 (redirect overlay „Пренасочваме те към ePay…"), P5-03 (бадж „Плащаш сега с карта" + submit
  „Към плащане"), P5-04 (InfoHint clamp 375px). **🔑 verify-schema-parity веднага хвана РЕАЛЕН прод
  дрифт:** прод `payment_intents_ref_idx` беше още старият `(provider,provider_ref)` → **S1-01/P4-03
  приложен на прод с ТАРГЕТИРАН SQL** (drop+recreate, прод чист; НЕ `drizzle-kit push` — той щеше да
  изтрие 3-те `pg_trgm` search индекса, които са само в `setup-search.mjs`); `setup-search.mjs` пуснат
  и на dev → **parity dev↔прод сега ЧИСТ** (commit `2e437ff`). **ТРАЙНО ПРАВИЛО:** trgm GIN индексите
  живеят извън `schema.ts` → на прод ползвай таргетиран SQL или пусни `setup-search` след push.
  **ОСТАВА:** P2-01 (ротирай прод парола+`SUPABASE_SECRET_KEY` — минаха през чата), push на кода +
  прод деплой (чака Vercel достъп), по решение: P4-02 (shop cascade?), P2-03 (Sentry DSN), P2-04/05.
  Детайли: [[pre-launch-audits-2026-07-13]], [[prod-environment]].

- **2026-07-13 (PROD СРЕДА ОТДЕЛЯНЕ — В ХОД: прод база готова, чака Vercel достъп)** —
  Отделяме реална production среда от dev (беше една база). Спец
  `2026-07-13-prod-environment-split-design.md`, план `2026-07-13-prod-environment-split.md`
  (runbook, 7 задачи, роли потребител/агент + health-check). **Решения:** отделна PROD Supabase
  база **чиста БЕЗ демо** (тест от 0); Vercel „Production" scope = prod база (същият проект,
  `dev`=Production deploy); `.env.local` остава dev; база първо, домейн паралелно. **✅ Готово
  (агент, Tasks 1-3):** health-check скрипт (`bd8dfdc`); прод Supabase проект (ref
  `vhpiskaugipevkvwduwd`, Frankfurt); `db:push` (34 таблици) + `setup-storage` (bucket) +
  `setup-search` (pg_trgm/GIN) срещу прод → **чиста, готова**. Прод ключове в `.env.prod.local`
  (gitignored, НЕ за приложението). **Гоча:** и 6543 (app), и 5432 (миграции) са pooler хост
  (не direct `db.<ref>` — ENOTFOUND); различават се само по порт. **⏳ ЧАКА Vercel достъп**
  (потребителят заключен — 2FA recovery в поддръжката, забавяне): Task 4 (env в Production scope
  + първи прод деплой = носи неpush-натия ePay+профил код, ~21 commit-а, изисква push разрешение),
  Task 5 (пълен поток от 0 — ePay webhook става публичен), Task 6 (домейн frizmoshops.bg + Resend).
  **⚠️ Ресетни прод паролата** (мина през чата) щом всичко работи. Детайли: [[prod-environment]],
  [[env-vars-reference]].

- **2026-07-13 (ОНЛАЙН ПЛАЩАНЕ ePay.bg — имплементирано, commit-нато на `dev` локално, НЕ push-нато)** —
  Marketplace плащане (**Модел А**: купувачът плаща на ТЪРГОВЕЦА, не на платформата — без лиценз/AML).
  Спец `2026-07-13-online-payments-design.md`, план `2026-07-13-online-payments.md` (12 задачи, inline,
  TDD). Commit-и `ce723f3`…`7759196`. **Архитектура:** pluggable `PaymentProvider` интерфейс + registry
  (`src/lib/payments/`, като куриерите); ePay първи (HMAC-SHA1 redirect протокол, `PAGE=paylogin`).
  Per-shop KIN+secret в `shop_payment_accounts` (никога env/NEXT_PUBLIC_). **Поток pending→webhook:**
  `createOrder` при `online_card` → поръчка `pending_payment` + резервира наличност + `payment_intent`
  → връща ePay пакет → checkout auto-submit-ва форма към ePay → купувачът плаща → **webhook**
  (`/api/payments/epay/notify`) проверява CHECKSUM със secret-а на магазина + сверява сумата →
  идемпотентно `pending_payment→new` (или отмяна + restock) → отговаря `INVOICE=N:STATUS=OK`. Cron
  (`/api/cron/expire-payments`, `*/15`, гард CRON_SECRET) auto-cancel-ва неплатените >2ч + връща
  наличността. **Валута EUR** (отворен въпрос до жива проверка). **Сигурност:** webhook = единственият
  източник на истина (не redirect-ът); подписът с per-shop secret = автентикация; идемпотентност през
  `payment_intents.providerRef` unique; сверка на сумата срещу подправяне; status guards срещу race с
  cron-а. Нова схема: `online_card` тип, `pending_payment` статус (пръв), таблици `shop_payment_accounts`
  + `payment_intents`, `db:push` изпълнен. Dashboard таб ePay (в „Плащане", InfoHint за КИН/secret).
  `ALLOWED_TRANSITIONS` изнесен в `src/lib/order-status.ts` (беше в orders.ts — „use server" не експортва
  константи). Гейт зелен (77 файла / 445 unit); e2e **online-payment 1/1** + регресия **orders 1/1**
  (офлайн поръчков цикъл непокътнат) + buyer/global-account 6/6. **MVP ядро** — refunds/tokenization/
  капаро ОТЛОЖЕНИ (търговецът връща пари ръчно през ePay засега). **DEV:** demo.epay.bg + demo KIN/secret
  за `atelie-glina` (seed). **ЧАКА:** (1) push разрешение; (2) реален ePay акаунт → жива проверка на
  payload/CHECKSUM/валута (както Спиди/Еконт demo); (3) Vercel env `EPAY_API_BASE` (prod) + `CRON_SECRET`
  (за expire-payments cron). [[stripe-billing-status]] е РАЗЛИЧНО (там купувачът плаща на НАС).

- **2026-07-13 (ПРОФИЛ ПОЛИРАНЕ: любими акаунт-базирани + десктоп layout + checkout дропдаун — commit-нат локално, НЕ push-нат)** —
  Три поправки след жива проверка (акаунт `e.s.kostadinov34@gmail.com`). (1) **Десктоп layout
  на `/account`** (`6e5c1c9`): страничен sidebar + широка колона (max-w-6xl) по идиома на
  dashboard-а; `AccountNav` responsive (табове мобилно, вертикален sidebar с икони десктоп).
  (2) **Любимите станаха АКАУНТ-БАЗИРАНИ при логнат** (`1747d37`) — беше бъг: сърцето на
  продукта пишеше само localStorage → `/account/favorites` празно. Ново `toggleFavoriteProduct`;
  `FavoriteButton` при логнат пише в базата (гост → localStorage); `ProductCard`/`VariantPicker`
  приемат `loggedIn`+`favorited` (server-rendered), нишкат се от продуктова страница/листинг;
  `FavoritesView` логнат → акаунт любимите (un-favorite маха картата на живо). Сърце „любим
  магазин" добавено и на каталог картите `/shops` (`ShopFavoriteHeart`). (3) **checkout „Запазен
  адрес" дропдаун** (`c2672fb`): appearance-none + собствен chevron + къс текст на опцията (беше
  грозен нативен select). Гейт зелен (68 файла / 419 unit); e2e **5/5** (добавен: любим продукт
  логнат → в профила). HERE autocomplete + „Адрес преди Град" в адресната книга (`4968346`).
  `store-products.spec.ts` флейква (потвърдено и на baseline — не е регресия). **✅ ТЕСТВАН НА
  ЖИВО (потребителят: „всичко работи перфектно"). Чака САМО push разрешение.**

- **2026-07-13 (ГЛОБАЛЕН КУПУВАЧЕСКИ ПРОФИЛ — имплементиран, commit-нат на `dev` локално, НЕ push-нат)** —
  Разширение на per-магазин профила: един **глобален `/account`** (платформена страница в
  група `(catalog)`, токени `ink-*`/`surface-*`/`brand-*` — НЕ `--sf-*`). Причина за смяната:
  потребителят тества per-магазин версията, озова се на `/shops` без достъп до профил → per-shop
  моделът бе объркващ. Спец `2026-07-13-global-buyer-account-design.md`, ADR
  `2026-07-13-global-buyer-account.md` (записва обрата), план `2026-07-13-global-buyer-account.md`
  (13 задачи, inline, TDD). Commit-и `c63d600`…`edde5d4`. **Обхват:** (1) нова таблица
  `buyerFavoriteShops` (uniqueIndex buyer+shop, `db:push`); (2) `confirmDeleteWord` (потвърждение
  с думата „ИЗТРИЙ"); (3) глобални queries `buyer-global.ts` (поръчки/любими продукти/магазини —
  всичко филтрирано по `buyerId`, cross-buyer теч = критичен бъг); (4) `toggleFavoriteShop`
  мутация (own, оптимистична); (5) `deleteBuyerAccount` — анонимизира поръчките (`buyerId→null`,
  търговецът ги пази за счетоводство), трие адреси/любими/любими магазини + Supabase auth юзъра,
  **гард: акаунт с магазин → отказ**; (6) купувач след вход → `/account` (+ Google fallback);
  (7) профил икона в `SiteHeader` (каталог + landing, логнат → `/account`, гост → „Вход");
  (8) `/account` layout + табло (nav Табло/Поръчки/Любими/Адреси/Настройки + link-orders банер);
  (9) `/account/orders` — всички поръчки с бадж за магазина; (10) `/account/favorites`
  (табове продукти/магазини) + `/account/addresses` + `/account/settings` (профил + изтриване);
  (11) старите `/s/{slug}/account/*` → `redirect("/account")` (изтрити под-страници + стари
  storefront профил компоненти, запазен favorites-merger); (12) сърце „любим магазин" в трите
  storefront header варианта (логнат → toggle, гост → вход); (13) e2e `global-account.spec.ts`
  (глобален профил с табове + любим магазин от хедъра → в профила) + актуализиран
  `buyer-account.spec.ts` към глобалния модел. `pnpm check` зелен; e2e впоследствие **5/5**.
  **✅ ТЕСТВАН НА ЖИВО** (виж полиране-записа отгоре); чака само push разрешение. Заедно с
  per-магазин частта това е [[buyer-account-feature]].

- **2026-07-13 (КУПУВАЧЕСКИ ПРОФИЛ — имплементиран, commit-нат на `dev` локално, НЕ push-нат)** —
  Голямата „самостоятелна" функция. Спец `2026-07-13-buyer-account-design.md`, план
  `2026-07-13-buyer-account.md` (12 задачи, inline, TDD). Commit-и `d641f07`…`f35dfbf`.
  Гейт зелен (64 файла / **404 unit теста**, lint, build) + **e2e 2/2** (буилд+сервира+тества).
  **Среден обхват (решение):** „Моите поръчки" + адресна книга (с офис опция) + любими синхрон;
  ревюта/Q&A остават както са; мулти-user екипи ПРЕМАХНАТИ от обхвата (overkill). **Обхват:**
  (1) схема — `profiles` +`preferredRole`/`phoneVerified`, `orders.buyerId` (nullable, set null),
  нови `buyerAddresses` (с куриерски офис полета) + `buyerFavorites` (uniqueIndex); `db:push`
  изпълнен; (2) `requireBuyer()` изолационен wrapper + `ensureProfile` с телефон; (3) Zod схеми
  адрес/профил; (4) query слой (всичко филтрирано по `buyerId` — cross-buyer теч = критичен бъг);
  (5-7) мутации: адреси (own-only), любими (toggle/merge), `updateBuyerProfile`, свързване на
  минали гост-поръчки по потвърден телефон + клик (без SMS); (8) `resolvePostAuthPath` (изнесен в
  `src/lib/auth-redirect.ts` — `use server` файл не може sync export; продавач/има магазин →
  dashboard, купувач → валиден `next` или `/shops`); (9) AuthForm toggle „Пазарувам/Продавам"
  (различен copy, hidden role+next); (10) checkout попълва `buyerId` при логнат + autofill от
  адресната книга; (11) профилни страници `/s/{slug}/account/*` (табло+банер „свържи минали
  поръчки", поръчки per-магазин, адресна книга CRUD drawer, настройки) + профил икона в 3-те
  header варианта (`viewerLoggedIn` от layout) + нова `user` икона; (12) любими сървърен merge
  при вход (`FavoritesMerger`) + e2e. **Роля производна** от „имаш ли магазин"; `preferredRole` е
  само redirect памет. **Известно ограничение (следваща итерация):** favorite-button/
  favorites-view още четат localStorage за ПОКАЗВАНЕ дори за логнати — merge-ът влива в акаунта,
  но UI-ят не е сменен на сървърен източник (само данните се синхронизират). **Чака:** ръчна
  проверка на живо (toggle на входа + Google като купувач + „моите поръчки" + адрес autofill в
  checkout + свързване на стари поръчки) + push разрешение → `dev`(=прод).

- **2026-07-13 (КУРИЕРИ Еконт+Спиди — имплементирани, commit-нати на `dev` локално, НЕ push-нати)** —
  Спец `2026-07-12-courier-integration-design.md`, план `2026-07-12-courier-integration.md`
  (изпълнен inline, 10 задачи, TDD). **Предусловието тегло-на-продукт беше вече готово.**
  Commit-и `1ee23bd`…`0b5893d`. Гейт зелен (374/374 теста, lint, build). **Обхват:**
  (1) схема — `shop_courier_accounts` (per-shop ключове в `credentials` jsonb), `courier_offices`
  (кеш, unique по provider+officeId) + куриерски колони на метод/поръчка (всички nullable),
  `db:push` изпълнен; (2) чисти функции (TDD) — `aggregateOrderWeight` (fallback 500г) +
  `resolveCodAmount` (авто COD при наложен платеж); (3) `CourierProvider` интерфейс + `getCourier(id)`
  registry — HTTP изолиран по провайдър; (4) **Еконт** провайдър — **сверен на живо срещу demo API**
  (`iasp-dev`/`1Asp-dev` → `demo.econt.com`; getCities/getOffices минаха, 114 офиса София в правилен
  `Office` формат; реални полета `o.address.city.name`, `isAPS→"apt"`); (5) **Спиди** провайдър —
  skeleton + mock (REST `api.speedy.bg/v1`, чака ключове); (6) account Zod + queries + actions
  (save/delete/test/refresh офиси); (7) dashboard таб „Куриери" (свързване/тест/изтриване, refresh);
  (8) checkout офис-picker по град (публичен `searchOfficesForShop(shopId, provider, city)` — купувачите
  са анонимни; офисите са несензитивна номенклатура) + сървърна валидация (без офис при
  `deliveryTarget==="office"` → блокирана поръчка) + snapshot; (9) `generateWaybill(orderId)` —
  идемпотентен, tenant guard по `shopId`, tracking линк + бутон на поръчката (само при
  `courierProvider != null`). **Демо Еконт ключове в `.env.local` = само DEV fallback**
  (`ECONT_DEMO_USERNAME/PASSWORD/API_BASE`; Спиди коментирани). Ключове никога не се логват,
  не са `NEXT_PUBLIC_`, маскирани в UI. **Чака (външно, не мога аз):** push разрешение → `dev`(=прод);
  ръчна проверка на живо; Спиди ключове (имейл до `api.registration@speedy.bg`); реален Еконт prod
  ключ (per-shop в dashboard); жива проверка на `createWaybill` payload срещу реален акаунт.

- **2026-07-13 (SOCIAL LOGIN Google — имплементиран, тестван на живо + PUSH)** —
  Първата външна функция, за която ключовете дойдоха. Спец `2026-07-12-social-login-design.md`,
  план `2026-07-12-social-login.md` (изпълнен). **5 задачи (TDD, чести commit-и):**
  (1) `safeNextPath` — open-redirect гард (чиста функция, 6 теста); (2) `ensureProfile(userId,
  fullName?)` — записва OAuth името при първо влизане (идемпотентен); (3) `signInWithProvider(next?)`
  action — `signInWithOAuth({provider:"google"})`, `origin` от заявката (localhost/прод), не
  хардкоднат; (4) callback route `app/(auth)/auth/callback/route.ts` — `exchangeCodeForSession` +
  `ensureProfile` + redirect към валидиран `next`; (5) бутон „Продължи с Google" (официално
  multicolor „G" SVG inline) + „или" divider над имейл формата в `AuthForm` (покрива login+register)
  + грешка `?error=oauth`. **Само Google** първа итерация; Client ID/Secret живеят в **Supabase**
  (не env — Supabase е OAuth медиаторът). `next` параметризиран → преизползваемо за купувачески
  акаунт (S3) по-късно. **Тествано на живо:** реален Google вход (blendbg34@gmail.com) → callback
  размени code за сесия → профил създаден **с името от Google** („Djini kostadinov", не празен) →
  нов юзър без магазин → онбординг екран; имейлът авто-потвърден. Проверено директно в базата
  (auth.users провайдър=google + profiles.full_name + shops празно). `pnpm check` зелен
  (51 файла / 360 теста). **Setup за живо:** Supabase → Auth → URL Configuration → Redirect URLs
  трябва да включва `localhost:3000/**` (dev) + прод домейна. Commit-и `25668c5`..`f793bb3`.

- **2026-07-12 (E2E СТАБИЛНОСТ + Фаза 1/2 привеждане + ember a11y fix — тествано + PUSH)** —
  „Технически дълг" сесия докато чакаме домейна. Открих, че e2e тестовете са били
  СЧУПЕНИ от Фаза 1+2 (не просто флейкащи). Спец/план: `2026-07-12-e2e-stability.md`.
  **Config:** `playwright.config.ts` → `webServer: "pnpm build && pnpm start"` (прод билд,
  без dev on-demand компилация = главната причина за флейк) + `retries: 1` + `reuseExisting:
  !CI`. **Всичките 7 e2e spec минават срещу прод билд** (беше нужно и `playwright install
  chromium` — липсваше на машината). Открити и оправени изоставания (всичките ТЕСТОВЕ зад
  продукта, НУЛА продуктови бъгове): (1) wizard 4-та стъпка „Сложност" (Ф2) — helpers.ts +
  store-products inline; (2) **продуктовата форма е с ТАБОВЕ в пълен режим** (Ф1) → тестовете
  кликат таб „Варианти" преди опции/промоция (store-products/storefront/orders); (3)
  `createShopViaWizard` получи `mode` параметър (default business; orders/storefront ползват
  „full" за deal/варианти — те са само в пълен режим); (4) **publishShop гард** (ЗЗП чл.47:
  иска телефон+адрес) → helper вече ги попълва (иначе публикуването се проваляше тихо); (5)
  custom sr-only checkbox → клик label вместо `.check()`; (6) стабилни селектори (Нисък склад
  badge, #0001 дубликат в 2 елемента, орders таб „Плащане"); (7) storefront проверява „Скрий
  магазина" вместо ефимерен toast; (8) cookie бутон „Приемам" (не стар „Разбрах"). **Bonus
  реален a11y дълг** (потребителят избра да оправим): ember акцентът в логото „Shops" падаше
  под WCAG AA (3.3:1 на светъл фон) → нов **`ember-700` токен** (`#9c5a18` light / `#d68f45`
  dark, минава AA 4.5+ в двете теми, изчислено с `src/lib/contrast.ts`); `logo.tsx` +
  `install-app-section.tsx` ползват ember-700; landing-a11y пак зелен (0 axe нарушения). Гоч:
  прод-билд e2e разкрива изоставания, които dev флейкът маскираше. `pnpm check` зелен (342).

- **2026-07-12 (ВЪНШНА РАБОТА: домейн поръчан + Sentry/inv.bg обхват решен — ЧАКА setup)** —
  След UX Фаза 1+2 захванахме „външната работа". Взети решения (обхват; формални спец/план
  ще се пишат при захващане):
  - **ДОМЕЙН: `frizmoshops.bg`** — избран (вече заложен в кода 13×; `.bg`=доверие за БГ пазар;
    „shops"=платформа, различен от `frizmo.bg` еталона). Само основния (без отбранителен засега).
    **ПОРЪЧАН от SuperHosting.bg (2026-07-12) — до 24ч setup, ЧАКАМЕ.** Следва: добавяне във
    Vercel → DNS записи при регистратора → SSL авто → `NEXT_PUBLIC_SITE_URL=https://frizmoshops.bg`
    в Vercel env + Redeploy → миграция на всички линкове/OG/canonical/sitemap от
    `frizmo-shops.vercel.app` fallback → Resend верификация за `shops@frizmoshops.bg`.
  - **inv.bg — САМО абонаментни фактури (Случай A).** Ключово разграничение направено с
    потребителя: (A) фактури за АБОНАМЕНТА (търговец плаща на нас) = логично през нас, твоята
    фирма фактурира, закача се за Stripe webhook „плащане успешно" (Stripe собствените invoices
    не са валидни БГ фактури); (B) фактури за ПРОДАЖБИТЕ (купувач плаща на търговеца) = НЕ през
    нас (не сме страна по сделката; юридически/данъчно грешно от наш ключ; правилно би било
    per-shop inv.bg ключ) → **ОТЛОЖЕНО/никога през нас**. Правим само A. inv.bg акаунтът е
    същият като другия Frizmo (един ключ, отделна номерационна серия за Shops). Реалистично
    идва СЪС/СЛЕД Stripe live (закача се за webhook-а; може да се кодира/тества в test mode).
    Остава за брейнсторминг: точен момент на издаване, данни на търговеца, копие в базата, ДДС.
  - **Sentry — същият акаунт/организация, НОВ проект** („frizmo-shops" → нов DSN, за да не се
    смесват грешките). Обхват: production error monitoring (сървър+клиент+edge), source maps,
    PII филтриране, quota. Независим, нискорисков, не чака нищо освен DSN + auth token от
    потребителя. Следва брейнсторминг → спец → план → имплементация.
  - **Ред:** препоръчан — Sentry първо (независим), inv.bg след Stripe live. Всичко чака домейн
    setup-а (до 24ч) ИЛИ външни ключове от потребителя.

- **2026-07-12 (UX ФАЗА 2: РЕЖИМ НА СЛОЖНОСТ — тестван на живо + PUSH-нат · `9023484..8f826ca`)** —
  Втората фаза от UX инициативата (виж Фаза 1 по-долу). **Режим на сложност** — глобален
  превключвател на магазина (Хоби/Малък бизнес/Пълна настройка), който скрива напреднали
  nav секции + продуктови полета. **Разделен от плана** (безплатен за всеки; план=лимити,
  режим=UI). **Чисто презентационен — НИКОГА не трие/спира данни** (скрит welcome купон пак
  работи на storefront; downgrade философия от CLAUDE-backend.md). НЕ е security gate —
  директен URL към скрита страница работи. Механика: всяка секция/поле носи `minMode` (число);
  показва се ако `MODE_LEVEL[mode] >= minMode`. Централен модул `src/lib/complexity.ts`
  (`ComplexityMode`, `MODE_LEVEL` hobby=0/business=1/full=2, `MODE_META`, `isVisible`, TDD).
  Нова колона `shops.complexityMode` (pgEnum `complexity_mode`, **default full → съществуващите
  магазини не губят нищо**; `db:push` приложен). `setComplexityMode` action + `createShop` чете
  избора от wizard (default business за нови). Nav филтриране: `NAV_ITEMS[].minMode` + layout
  подава `shop.complexityMode` на DashboardNav/MobileMenuButton. `ComplexityModeSwitcher` —
  десктоп компактен popover в хедъра; **мобилно = ИНЛАЙН в burger менюто** (popover се
  разливаше извън екрана — фикс след обратна връзка). Onboarding: 4-та стъпка „Сложност".
  **Продуктовата форма чете `complexityMode` prop → localStorage Бързо/Детайлно тогълът е
  ПРЕМАХНАТ** (`product-form-mode.ts` изтрит): hobby=3 карти без табове; business=Основно+
  Логистика; full=4 таба. Матрица: Хоби 7 nav секции, Малък бизнес 11, Пълна 14. Спец/план:
  `2026-07-12-complexity-mode-design.md` / `2026-07-12-complexity-mode.md`. `pnpm check` зелен
  (342 теста). Гоч: `db:push` на тази машина иска ръчно зареждане на `DATABASE_URL_MIGRATIONS`
  от `.env.local` (скриптът е гол `drizzle-kit push`, не зарежда env). **С Фаза 1+2 двата
  дълбоки UX проблема са адресирани.** ЧАКА PUSH разрешение.

- **2026-07-12 (UX ФАЗА 1: ТАБОВЕ + PUSH · `72a5d9f..e5091ac`, 9 commit-а на prod)** —
  Нова инициатива след разговор за 2 дълбоки UX проблема: (1) претрупани страници →
  табове; (2) твърде много функции за начинаещ → режим на сложност (Хоби/Бизнес/Пълен,
  **разделен от плана**, скрива nav + полета, контрол в onboarding + хедър дропдаун; планове
  2.1 отложени за Stripe live). **Фаза 1 (табове) завършена и тествана на живо ✅.** Нов
  reusable `ui/Tabs`+`TabPanel` примитив (URL `?tab=` + плитка навигация през `history.
  replaceState` без re-fetch → drawer/form state оцелява; всички панели монтирани, неактивните
  `hidden`; a11y tablist/tab/tabpanel + клавиатура ←/→/Home/End; marker точка за таб с грешка;
  хоризонтален скрол на лентата на мобилно `scrollbar-none`; 7 Vitest теста). Табове на 5
  страници: fulfillment (Доставка/Плащане/Поръчки-връщания — `FulfillmentManager` получи `only`
  prop), subscribers (Абонати/Кампании/Купони), analytics (Общ преглед/Разрези/Клиенти — период
  над табовете), store `ShopForm` (Основни/Контакти/Социални — един form, общ Запази, marker,
  delete извън табове), product-form (Основно/Логистика/Кодове-SEO/Варианти — само в Детайлно,
  „Бързо" непокътнат, карти извлечени в променливи). Онбординг deep-link `?tab=`. Гочи: (а)
  jsdom няма `scrollIntoView` → guard на метода; (б) `setActive` от URL в effect чупи
  react-compiler lint → `queueMicrotask` (проектна конвенция). Спец/план:
  `2026-07-12-dashboard-tabs-design.md` / `2026-07-12-dashboard-tabs.md`. `pnpm check` зелен
  (337 теста). **СЛЕДВА: Фаза 2 — режим на сложност** (табовете подготвиха чисти шевове).

- **2026-07-12 (ТЕСТ-СЕСИЯ В+Г+Д + PUSH · `b10ffb2..a829ea2`, 37 commit-а на prod)** —
  **Всички pure-code пакети (А–Д) вече ТЕСТВАНИ НА ЖИВО и PUSH-НАТИ.** Потребителят изтества
  В (welcome/реферали/analytics), Г (reorder/печат), Д (IBAN/зони/категории 3 нива/онбординг).
  **Пътьом поправени на живо:** (1) THead/TRow hydration bug (THead сам обвива в `<tr>` → не се
  слага TRow вътре); (2) IBAN blur-валидация (не чака submit); (3) growth field грешки под полето
  + toast вместо голи цветни редове; (4) **dirty-guard на всички редакционни форми** (`isDirty`
  helper — бутонът „Запази" неактивен без промени; форма без промени правеше заявки); (5) success/
  error → единни toast (sonner, вече установен стандарт); (6) **зони на доставка редизайн** —
  оригиналният picker объркващ → адрес autocomplete → авто-мач по град БЕЗ picker (нов спец/план
  `2026-07-12-address-autocomplete-auto-zones`; `matchZone` TDD; `shipping_zones.cities`+`isFallback`;
  редактор „град=цена"; `SfAddressAutocomplete` + споделен `useAddressSuggest` hook; manual-order +
  shop-form autocomplete); (7) **3-нивен category dropdown fix** (продуктовият избор + storefront
  filter строяха само 2 нива → `flattenCategoryOptions` helper + toolbar depth 0/1/2); (8) онбординг
  CTA „Публикувай"→/website. `pnpm check` зелен (330 теста) на всяка стъпка; финалният хвана type
  грешка (CategoryLeaf.children) → оправена преди push. **СЛЕДВА: външната работа (Stripe live/
  Еконт-Спиди/Social login/inv.bg/Sentry/домейн).**

- **2026-07-11 (ПАКЕТИ В+Г+Д — ✅ КОД, НЕ push-нато) · спец `f429b43` · планове `3ee2a0d` · В `1506fa9`→`d1b4758` · Г `1c704e4`→`97fb22e` · Д `8ef30d0`→`b04479d`** —
  **Последните 3 pure-code пакета планирани заедно + имплементирани, inline, TDD.** Един обединен
  спец (`docs/superpowers/specs/2026-07-11-growth-orders-setup-design.md`) + 3 плана.
  **Пакет В „Растеж":** welcome купон (авто персонален еднократен код при потвърждение на абонат),
  купон-базирани реферали (таблица `referrals`, брой доведени), 4 analytics разреза (източници/
  конверсия абонати→клиенти/повторни клиенти/по категория). **Пакет Г „Поръчков поток":** reorder
  („Поръчай пак същото" на потвърждението, по publicToken), печатна складова бележка (packing slip,
  `/orders/[id]/print`). **Пакет Д „Setup & доставка":** IBAN mod-97 валидация (bank_transfer),
  зони на доставка (таблица `shipping_zones`, цена по град/регион, pricing на сървъра), категории
  3 нива (гард + storefront филтър включва наследниците), онбординг чеклист на dashboard (авто-скрива).
  `db:push` изпълнен (`referrals` за В, `shipping_zones` за Д). **`pnpm check` ✓ (44 файла / 317 теста
  + build).** **ЧАКА push разрешение — НЕ е push-нато.** Гочи: „use server" файл експортира само
  async → чистите helper-и (resolveReorderLine, categoryDepth, welcomeCouponLabel) изнесени в
  неутрални `@/lib/*` модули (капан бие само в build, не в tsc/lint). **УТРЕ СУТРИН (2026-07-12):
  тест на живо на В+Г+Д, поправки при нужда, после push. След това започва „външната" работа
  (Stripe live / Еконт-Спиди / Social login / inv.bg / Sentry / домейн).**

- **2026-07-11 (ПАКЕТИ A+Б ТЕСТВАНИ + ВИЗУАЛНИ ФИКСОВЕ · push към dev)** — Ръчна проверка на
  Пакет A на живо: identifiers/GTIN валидация/марж/feed/SEO/size guides — всичко минава. Пътьом
  оправени UX/визуални неща (commits `694ac31`→`aece04a`): (1) size-guide редактор по-подреден
  (колони като chip-ове + таблица с номера на десктоп + карти на телефон); (2) „× Премахни" таблица
  от продукт до dropdown-а; (3) продуктова страница — марка/„X продадени"/size guide/доставка минаха
  в дясната колона под CTA (нов `sidebar` prop на VariantPicker) → изчезна ~450px празнина на
  десктоп; (4) ревю ред на телефон двуредов (звезди+име / бадж+дата); (5) trust badges на checkout
  2×2 grid на телефон. `pnpm check` ✓ (280 теста). **Пакети A+Б push-нати на dev(=prod).**

- **2026-07-11 (ПАКЕТ Б — „Доверие на продукта" ✅ КОД) · commits `edfeb98`(спец)→`1320871`(план)→`411b9d9`…`c90a5e8`(имплементация)** —
  Вторият групиран пакет. 2 функции през spec→plan→TDD→gate, inline: **(1) „X продадени" бадж** —
  `getSoldCount` (агрегат от order_items×orders, само confirmed/shipped/completed, не new/cancelled),
  праг 5+, само продуктовата страница; нов индекс `order_items_product_idx`. **(2) Q&A на продукт** —
  нова таблица `product_questions` + enum `question_status` (pending→answered); публична форма
  (`QuestionForm`, rate limit + honeypot) → влиза pending → търговец отговаря в `/dashboard/questions`
  и публикува → само answered се виждат; nav badge за чакащи (desktop+mobile). Огледало на
  ревю-модерацията. `db:push` приложен. `pnpm check` ✓ (280 теста + build). **Чака ръчна проверка → push.**

- **2026-07-11 (ПАКЕТ A — „Продуктова форма 2.0" ✅ КОД) · commits `7c3d1ec`(спец)→`3a42ead`(план)→`b50a37a`…`4d0d513`(имплементация)** —
  Първият групиран пакет от оставащите pure-code функции. 4 функции през spec→plan→TDD→gate,
  inline: **(1) Product identifiers** (SKU→g:mpn, GTIN с GS1 mod-10 валидация→g:gtin +
  `identifier_exists=yes`, марка override→g:brand, доставна цена→марж % в admin) — надграждат feed-а
  + CSV експорт/импорт; **(2) SEO override** (seoTitle/seoDescription per продукт → generateMetadata
  с fallback, JSON-LD непроменен); **(3) Size guides** (нова таблица `size_guides` per магазин,
  `/dashboard/size-guides` CRUD + динамичен редактор + публичен modal, икона `ruler`);
  **(4) „Бързо/Детайлно" тогъл** (localStorage/useSyncExternalStore, default детайлно, onboarding
  закован „Бързо", само визуален — без загуба на данни). `db:push` приложен (7 нови колони + таблица).
  `pnpm check` ✓ (271 теста, build). **Чака ръчна проверка → после push разрешение.**

- **2026-07-11 (ТЕСТ-СЕСИЯ ПРИКЛЮЧЕНА) · push `7c236e7`→`bd306c5`** — **Всичките 7 pure-code
  функции тествани на живо и минаха.** №1–7 ✅ (№3 abandoned cart с реален имейл в пощата; №5
  изтриване на реален втори акаунт, потвърдено в базата; №7 verified бадж с реален match). Пътьом
  оправени визуални бъгове: двоен native search „×" (globals.css `::-webkit-search-cancel-button`),
  `header-search` type=text + min-w-0, `TransitionLink` relative-override чупеше absolute „×" (→ `Link`),
  `inputMode` на числови полета, пояснения тегло↔количество. Всичко commit-нато + **PUSH-нато**
  (trust+AOV пакетът също вече е на прод). Остава: почистване на тест-данни в test-magazin-1 +
  потвърждение на Vercel `CRON_SECRET`.

- **2026-07-11 (ТЕСТ-СЕСИЯ) · ръчна проверка на живо (dev + прод)** — **№1–3 минаха.**
  **№1 тегло/размери/количество ИЗЦЯЛО** (форма; публичен изглед — количество видимо, тегло/размери
  скрити; JSON-LD `weight` 25000 GRM; CSV експорт+импорт вкл. **десетичен** размер / празно→NULL /
  невалиден→пропуска ред, проверено в базата). Пътьом: добавени пояснения тегло↔количество + `inputMode`
  на числовите полета (product-form / variants-table / manual-order-form) — **НЕ commit-нато още**
  (чака `pnpm check`). **№2 Product feed** (валиден RSS, 9 продукта, всички `g:` полета коректни,
  Copy бутон). **№3 Abandoned cart ИЗЦЯЛО end-to-end** (opt-in → cron гардиран → **имейл в пощата**
  → `sent`; 401 без `CRON_SECRET`; без повторение) — остава само `CRON_SECRET` във Vercel prod +
  Redeploy. Пълен чек-лист: `docs/testing-checklist.md`. **Остават №4–7.**

- **2026-07-11 · `f34c469`…`eacf74a` (dev, НЕ push-нато)** — **Доверие + AOV пакет: verified
  ревюта · cross-sell в количката · „Нов" badge.** Спец
  (`docs/superpowers/specs/2026-07-11-trust-aov-bundle-design.md`) → план
  (`docs/superpowers/plans/2026-07-11-trust-aov-bundle.md`) → inline (7 задачи, TDD). **A:** нова
  колона `reviews.verified` (`db:push` приложен на общата база); опционален телефон в ревю формата →
  `hasPurchasedProduct` (поръчка confirmed/shipped/completed + продукта) → бадж „Потвърдена покупка";
  телефонът НЕ се пази; модерацията непроменена. **B:** `getCartSuggestions` action (категориите на
  количката, извън нея, ≤4) → лента „Може да ти хареса" в `CartView` (drawer + /cart). **C:**
  `isNewProduct(createdAt, now, 14)` (тествана) → бадж „Нов" top-left в `ProductCard` (стек с промо).
  react-compiler фиксове (Date.now нарочен per-request; без синхронен setState в effect). `pnpm check`
  минава (5 нови теста). **Тест (ръчно, light+dark+375px):** verified бадж след ревю с телефон,
  съвпадащ с поръчка (и без съвпадение → без бадж); cross-sell лента в drawer/cart; „Нов" бадж на
  скоро добавени продукти. **Остава:** ръчна проверка + push.

- **2026-07-11 · `affe693`…`0b737ca` (dev, PUSH-нато на prod)** — **Конверсионно трио: търсене в
  хедъра · доставка на продукта · trust badges на checkout.** Спец
  (`docs/superpowers/specs/2026-07-11-conversion-trio-design.md`) → план
  (`docs/superpowers/plans/2026-07-11-conversion-trio.md`) → inline (5 задачи, TDD). **A:** нов
  `HeaderSearch` (лупа → `fixed` overlay лента) в 3-те header варианта, видим на всички
  breakpoints; submit към готовата `/products?search=` (без промяна по `getActiveProducts`).
  **B:** server блок `ProductDelivery` на продуктовата страница (име · цена или „Безплатна" ·
  срок през `deliveryHoursLines`) от `getShippingMethods`; празно → не се рендира. **C:** авто
  hairline trust лента на checkout — `buildCheckoutBadges(returnWindowDays, hasCod)` (тествана,
  5 теста): плащане при доставка (ако COD) / връщане до N дни / сигурна поръчка / без регистрация.
  Нула нови таблици/ключове; реюз навсякъде. `pnpm check` минава. **Тест (ръчно, light+dark+375px):**
  търсене от хедъра на различни страници + мобилно; блок „Доставка" (със/без методи); trust лента
  (със/без COD, със/без връщане). **PUSH-нато на prod 2026-07-11.** **Остава:** ръчна визуална проверка.

- **ЧАКА РЪЧНА ПРОВЕРКА (не блокира):** всичко е push-нато на `dev`(=prod). За визуален тест от
  потребителя: конверсионното трио (търсене/доставка/trust лента) + **Опасна зона** за изтриване
  на акаунт (тествай със **СЛУЖЕБЕН** акаунт — реално трие; ядрото е доказано от verify скрипта) +
  4-те по-ранни pure-code функции (тегло/feed/abandoned/order-lookup). Отделно: **Vercel Redeploy**
  за abandoned cart (`CRON_SECRET`). Следващи кандидати: тогъл „Бързо-Детайлно" / зони на доставка.

- **2026-07-11 · `af9bd33`…`f8ba5c4` (dev, PUSH-нато на prod)** — **Изтриване на акаунт
  (GDPR чл.17) — 5-та „pure code" функция.** Спец
  (`docs/superpowers/specs/2026-07-09-account-deletion-design.md`, сверен със схемата днес:
  каскадата е ~19 таблици вкл. `subscriptions`/`abandoned_carts`; `push_subscriptions`
  каскадят към `profiles`; добавен guarded Stripe cancel) → план
  (`docs/superpowers/plans/2026-07-11-account-deletion.md`) → inline изпълнение (6 задачи, TDD).
  „Опасна зона" в `/dashboard/store` → `Modal` с typed confirmation (името на магазина) →
  `deleteAccount` (`src/actions/account.ts`): guarded Stripe cancel (спящ билинг → пропуска) →
  best-effort Storage cleanup (рекурсивен list) → `delete shops` (каскада) → `delete profiles`
  (каскада `push_subscriptions`) → `auth.admin.deleteUser` → signOut → клиентът redirect към
  landing с toast „Акаунтът е изтрит". `confirmNameMatches`/`isStripeConfigured` чисти + тестове.
  **Обективен verify скрипт** `scripts/verify-account-deletion.mjs` (9/9 ✓: създава хвърляем
  акаунт, трие по същия ред, проверява 0 остатъци във всички таблици, самопочиства). `pnpm check`
  минава. **PUSH-нато на prod 2026-07-11.** **Остава:** ръчна проверка на Опасна зона flow-а (със служебен акаунт).

- **2026-07-11 · `147cd76`…`4bd2e2e` + `d52623c` (dev, PUSH-нато на prod)** — **„Провери поръчка" от
  купувача — 4-та „pure code" функция.** Спец
  (`docs/superpowers/specs/2026-07-10-order-lookup-design.md`) → план
  (`docs/superpowers/plans/2026-07-10-order-lookup.md`) → inline изпълнение (5 задачи, TDD).
  Публична страница `/s/{slug}/order-status`: купувачът въвежда номер + телефон → нов
  `lookupOrder` action (строг rate-limit 5/15мин на IP, `parseBgPhone` e164 сравнение, ОБЩА
  грешка — не разкрива дали номер съществува) → при съвпадение връща path към готовата
  confirmation страница, клиентът навигира (DRY, преизползва UI-я). `parseOrderNumber` чист
  модул + тестове. Footer линк „Провери поръчка" в 2-та варианта. Без нови колони/таблици/cron
  — стъпва на `orderNumber`/`customerPhone`(e164)/`publicToken`. `pnpm check` минава (238 теста).
  **Забележка (среда след преинсталация):** Node 24 (`nvm use 24`, pnpm 11 иска ≥22.13);
  `pnpm-workspace.yaml` фиксове (`verifyDepsBeforeRun`/`allowBuilds`/`minimumReleaseAgeExclude`
  stripe); `.nvmrc=24`. **PUSH-нато на prod 2026-07-11** (origin/dev `b3a0769`→`d52623c`, заедно с env фиксовете `2bbf1e2`). **Остава:** ръчна проверка на живо (виж „Листа за тестване" горе).

- **2026-07-10 · `e367ac7`…`51ace8c` (dev, НЕ push-нато още)** — **Abandoned cart recovery
  имейл — 3-та „pure code" функция.** Спец
  (`docs/superpowers/specs/2026-07-10-abandoned-cart-design.md`) → план
  (`docs/superpowers/plans/2026-07-10-abandoned-cart.md`) → inline изпълнение (9 задачи, TDD).
  Нова таблица `abandoned_carts` (state pending/sent/converted, unique (shopId,email) upsert
  дедуп); `db:push` изпълнен. Количката е клиентска (localStorage) → улавяне на сървъра става
  на checkout: **opt-in checkbox „Напомни ми"** (GDPR, неотметнат default) + дебоунснат
  тригер → `saveAbandonedCart` action (snapshot през `priceCart`, сървърни цени). Прозорец:
  изоставена 1ч → **1 имейл**, никога повторно. `sendAbandonedCartEmail` (Resend, общ shell/esc).
  **Vercel Cron** `/api/cron/abandoned-carts` всеки час (`0 * * * *`), гард `CRON_SECRET`;
  `vercel.json` нов. Завършена поръчка (`createOrder`) → `converted` (не и `createManualOrder`).
  `dueAbandonedCarts` чиста логика + тестове. `pnpm check` минава (229 теста). **Единствена
  външна настройка:** `CRON_SECRET` (добавен локално + Vercel от потребителя). **Остава:**
  ръчна проверка + push (заедно с №1/№2) + **Vercel Redeploy** след push (за CRON_SECRET).

- **2026-07-10 · `59193bc`…`a92d3d0` (dev, НЕ push-нато още)** — **Product feed (Google
  Merchant / Facebook каталог) — 2-ра „pure code" функция.** Спец
  (`docs/superpowers/specs/2026-07-10-product-feed-design.md`) → план
  (`docs/superpowers/plans/2026-07-10-product-feed.md`) → inline изпълнение (6 задачи, TDD).
  Route `/s/{slug}/feed.xml` (dynamic + ISR `revalidate=3600`, инвалидира се при продуктова
  мутация чрез съществуващия `revalidateShop`); само published магазини, иначе 404. Билдът
  потвърди, че `.xml` в динамичен сегмент работи в Next 16. `src/lib/product-feed.ts`:
  `buildProductFeed`/`escapeXml`/`plainText` (чисти, тествани — 15 теста). RSS 2.0 + Google
  namespace; **нула конфиг** за нетехничния търговец: `identifier_exists=no`, `g:brand`=име на
  магазина, `g:condition=new`, един ред на продукт. Тегло→`shipping_weight`, промо→`sale_price`,
  наличност→`in_stock`/`out_of_stock`, продукт без снимка се пропуска. Заявки `getFeedProducts`
  + `getShopCategoryNames` (storefront.ts). Discovery: ред „Product feed за реклами" + нов
  `CopyButton` в `/dashboard/store` (само published). `pnpm check` минава (223 теста).
  **Остава (2026-07-11):** ръчна проверка (feed в браузър, UI ред, мобилно) + push (заедно с
  функция №1, при разрешение).

- **2026-07-10 · `a58aab5`…`bdcd244` (dev, НЕ push-нато още)** — **Тегло/размери/количество
  на продукт (чисто в кода, 1-ва от 7 „pure code" функции).** Спец
  (`docs/superpowers/specs/2026-07-10-product-weight-design.md`) → план
  (`docs/superpowers/plans/2026-07-10-product-weight.md`) → inline изпълнение (10 задачи, TDD).
  6 нови **nullable** колони на `products` (`weight_grams`, `length_mm/width_mm/height_mm`,
  `net_quantity_value`, `net_quantity_unit`) — всичко ПО ИЗБОР, без backfill/NOT NULL
  (доставката вече работи с фиксирана цена `shipping_methods.priceCents`, тегло не е
  предусловие). `db:push` изпълнен на прод базата. Helpers в `money.ts`: `parseScaled`
  (общ, симетричен на `toCents`) + `cmToMm`(×10)/`toMilliQuantity`(×1000)/`formatNetQuantity`/
  `scaledToInput`. **Модел на количеството: винаги ×1000** (потвърдено с потребителя —
  спецът имаше непоследователни примери, поправен). Zod: `optionalWeight`/`optionalDimension`/
  `netQuantity` (всички по избор). `productValues` изнесен в `src/actions/product-values.ts`
  (чист, тестван). Форма: секция „Тегло и размер" (в `!simple` блока — onboarding остава
  опростен). Публична страница: количество като първи ред в „Характеристики"; условен `weight`
  в Product JSON-LD (GRM); тегло/размери СКРИТИ за купувача. CSV: 6 колони експорт (route.ts) +
  импорт (`parseCsvMeasures`, тестван — празно=NULL, невалидно пропуска реда). `pnpm check`
  минава (208 теста). **Остава (2026-07-11):** ръчна визуална проверка от потребителя
  (форма нов/edit, публична страница количество+JSON-LD, CSV експорт/импорт, мобилно 375px),
  после **push към dev** — само при изрично разрешение.

- **2026-07-10 · `ba276b3`…`5e1204b` (dev, PUSH-нато)** — **Stripe billing (План 6 Фаза Б).**
  Пълна billing интеграция чрез Subagent-Driven Development (9 задачи + финален
  broad review). Нови таблици `subscriptions` (billing статус ос: trialing/active/
  past_due/suspended/canceled — ОТДЕЛНА от модерацията `shops.status`) + `stripe_events`
  (webhook dedup); `db:push` изпълнен. `src/lib/stripe.ts` (lazy Proxy клиент — `new
  Stripe('')` хвърля синхронно на празен ключ, чупеше build; API `2026-06-24.dahlia`),
  `priceIdForPlan`, `STRIPE_APP_TAG`. `plan.ts`: `resolvePlan`/`billingAllowsSelling`
  (чисти, 13 теста) + `getShopPlan`/`isShopActive`; магазин без subscription = 30-дневен
  signup trial по `createdAt`. Actions (`billing.ts`): checkout (mode:subscription,
  trial 30д, промо FRIZMO50 -50% еднократно, idempotent customer), portal, status.
  Webhook (`/api/webhooks/stripe`): raw body + подпис + dedup + `metadata.app` изолация
  (споделен Stripe акаунт с frizmo-tech!) + status синх + 500 при липсващ secret +
  revalidatePath. Публичен `createOrder` gated от `isShopActive` (спрян билинг →
  „временно затворено"); storefront банер + checkout блок. Billing страница (dashboard,
  wallet nav) + панел (абониране/промо/портал). Landing: махнат неверният „без карта".
  **E2e тестван на живо (Stripe test mode)**: checkout→webhook[200]→subscription→портал,
  FRIZMO50 даде 5€ първи месец. Дев базата изчистена (43 боклук e2e магазина, останаха
  11 = 9 демо + 2 test). Спец: `specs/2026-07-10-stripe-billing-design.md`, план:
  `plans/2026-07-10-stripe-billing-plan.md`. **ВАЖНО за истинско пускане:** Vercel prod
  env vars липсват (STRIPE_SECRET_KEY live `rk_`, STRIPE_WEBHOOK_SECRET от истински
  endpoint, STRIPE_PRICE_* live) + пресъздаване на ресурсите в live mode + Redeploy;
  до тогава билингът е „спящ" на Vercel (env.ts warnings, lazy клиент — не гърми).

- **2026-07-10 · `f8d3018`+`dbd74ea` (dev, PUSH-нато на прод)** — **доставка UX.**
  Преименуване „Локална доставка" → „Доставка от производителя" (беше подвеждащо).
  Ново: опционално **време за доставка per метод** (`shipping_methods.delivery_hours`
  jsonb) — търговецът задава дни+часове чрез съществуващия WorkingHoursEditor
  (реюз); клиентът вижда „пон–пет 09:00–18:00" под метода на checkout (само инфо,
  не блокира). Хелпър `deliveryHoursLines` в working-hours.ts. Пътьом: WorkingHoursEditor
  преработен на компактен вертикален ред (label+Почивен горе, часове с flex-1 отдолу)
  — старият w-40 + sm:flex-row преливаше в тесен drawer (хоризонтален скрол). db:push
  приложен. Качено с 5-те чакащи commit-а (5c0cd80..dbd74ea).

- **2026-07-09 (вечер) · `e1994db`+`85ff06f` (dev, вече PUSH-нато на 10-ти)** — **след-одитни
  довършвания + ПРОДУКТОВ GAP ОДИТ.** Дребни от Група В: getCategoryCovers → SQL
  агрегат (край на N+1, верифицирано срещу база). Спец за self-service изтриване
  на акаунт (GDPR чл.17): `docs/superpowers/specs/2026-07-09-account-deletion-design.md`
  — чака одобрение за имплементация. **Решения по 7-те оставащи одит точки:**
  Sentry ✅ (искаме, като другия Frizmo — чака DSN ключ); backup → за прод сетъп;
  inv.bg → счетоводителят фактурира ръчно (не иска код); изтриване на акаунт →
  добавяме (спец готов); bounce → провери в Resend (същ акаунт като другия Frizmo);
  analytics → Vercel Analytics + рекламни pixel-и стигат за старта.
  **ПРОДУКТОВ GAP ОДИТ (5 паралелни прегледа) → артефакт + чака преглед УТРЕ:**
  нови находки извън стария roadmap с висок ефект — **product feed** (Google
  Merchant/FB Catalog за реклами) + **abandoned cart** recovery имейл. Потвърдени
  и: Еконт/Спиди (иска тегло на продукт първо!), Stripe билинг > онлайн карта,
  купувачески акаунт = OVERKILL сега (по-евтина алтернатива: order lookup по
  номер+телефон). Евтини конверсионни печалби: търсене в хедъра, доставка на
  продуктовата страница, trust badges. Пълните находки+приоритети:
  `docs/superpowers/plans/2026-07-09-product-gap-audit.md`.
  **2 непушнати commit-а на dev (getCategoryCovers + спец).**

- **2026-07-09 · `4c3317f`→`4f50799` (dev, PUSH-нато на прод)** — **PRODUCTION
  ОДИТ + фиксове.** 5-измерен одит на целия проект (сигурност/данни/операции/
  право/frontend) → 19 находки, 12 оправени. **2 критични (верифицирани срещу
  базата чрез `scripts/verify-order-concurrency.mjs`):** overselling
  (getPricingProducts четеше извън tx + сляп декремент → сега conditional update
  `where stock>=qty returning`, четене през tx); пореден номер (счупен retry в
  abort-ната tx → `pg_advisory_xact_lock` per магазин). **XSS:** `jsonLdHtml()`
  escape на JSON-LD (`</script>`+U+2028/9). **Идемпотентност на checkout:**
  `orders.idempotency_key` + partial unique index (двоен клик/timeout не прави
  дубъл). **Група А:** env fail-fast (`src/env.ts`+`instrumentation.ts`),
  `revalidateTag` в order actions, ЗЗП контакт-guard в publishShop, GDPR privacy
  линк на checkout, промо бадж само при promo<цена. **Група Б:** touch targets
  ≥44px, canonical URL-и (storefront), error boundaries на всички route групи +
  `global-error.tsx`. **Група В (дребни):** rate_limits opportunistic cleanup,
  searchShops `DISTINCT ON` (край на N+1 fan-out). Нови DB колони приложени с
  db:push (общата база = прод). Доклад-артефакт генериран.
  **Остава (иска решение):** мониторинг (Sentry?), backup/PITR потвърждение,
  inv.bg, self-service изтриване на акаунт, bounce handling.

- **2026-07-09 · `86fc2a2` (dev, PUSH-нато на прод)** — **N9 подобрение +
  брандирани чекбокси.** Подаръчната опция вече е ДВЕ независими: „опаковка"
  (с такса) и „картичка" (безплатно) — собственикът избира от Доставка кои да
  предлага (`shops.giftCardEnabled`); клиентът вижда само включените. Нова колона
  `orders.giftCard` (db:push приложен на общата база — важи и за прод). **Дългът
  изчистен:** giftWrapFeeCents вече минава през `priceCart` → `totalCents` го
  включва (единствен ценови източник, +5 теста); уеднаквен и manual order preview.
  Чекбокси: `Checkbox` компонентът пренаписан с брандирана кутия (peer+Icon вместо
  native accent-color) → ~8 места го получават; нов `SfCheckbox` за storefront
  checkout (--sf-* токени); `SelectCheckbox` в ръчна поръчка. order-settings
  подредено (kicker + hint текстове вдясно). Push: `b11dda4..86fc2a2` (вкл. и
  чакащите иконите/CSV надпис/hydration от предната сесия).

- **2026-07-08 (тест-сесия ПРИКЛЮЧЕНА) · `c5029f4`+ (dev)** — **цялата опашка
  от 12 фийчъра е тествана и работи** (потвърдено от потребителя): S1 ревюта,
  S4 newsletter, S5 аналитика, S6 филтър, S7 bulk, S8 CSV, S10 любими, S12
  аларми, S14 back-in-stock, N9 опаковка, N11 ръчна поръчка, N12 връщания.
  Пътьом фиксове: TransitionLink loading state (филтри/пагинация); мобилен
  dashboard nav → burger в header; storefront `/products` едноредова филтърна
  лента (ThemedDropdown, --sf-* токени); bulk ценова промяна отчита изчистени
  промо/сделки (транзакция); BG граматика одит + `docs/bulgarian-lang-guide.md`
  + `src/lib/plural.ts`; +5 тестови продукта със снимки; емоджита→Icon в поръчка;
  „до 1MB"→„максимум 1MB"; body suppressHydrationWarning (browser разширение).
  **Известен дълг:** N9 подаръчна такса се добавя извън `priceCart` (в orders.ts)
  — работи и е сървърно защитено, но два пъти се смята total; кандидат за
  рефактор (giftWrapFee параметър на priceCart). Push до `c5029f4` на прод;
  последните 3 commit-а (иконите, CSV надпис, hydration) чакат push.

- **СЛЕДВАЩА СЕСИЯ = ТЕСТ-СЕСИЯ** на цялата опашка от 12 фийчъра (решение на
  потребителя, 2026-07-08 вечер). Чек-списъците: roadmap-а („Чакащи тест") +
  5-те спеца от 2026-07-08. Без нови фийчъри преди теста.

- **2026-07-08 (5) · `432f9ae`→`b432427` (dev)** — **Група N9+N12** (спец
  `2026-07-08-gift-returns-design.md`): **N9** подаръчна опаковка — настройка
  „Поръчки и връщания" (toggle + такса), чекбокс + картичка в checkout и каса,
  таксата от сървъра, ред в суми/имейли/детайл · **N12** връщания — статуси
  `return_requested`/`returned`, срок настройка 14/30/45 дни, заявка от token
  страницата с причина, приеми (restoreStock) / откажи, имейл+push известия,
  `returned` вън от приходите (EXCLUDED_FROM_REVENUE). db:push ✅ (shops/orders
  колони + enum). **Чакащи тест: S12, S6, N11, S7, S8, S10, S14, S1, S5, S4,
  N9, N12 (12 бр.).** От одобрения roadmap за код остава само S3 (планираща
  сесия) + блокираните от външни ключове (M0, M2+S2, M3+S11, S13 inv.bg) +
  N4/N5/N10.

- **2026-07-08 (4) · `639e0ce`→`43768d4` (dev)** — **Група S4+S5** (спец
  `2026-07-08-newsletter-analytics-design.md`): **S5** аналитика —
  `/dashboard/analytics` (нав линк), период 7/30/90, 4 метрики със сравнение
  спрямо предишния период, SVG bar chart приходи по дни (без библиотека), топ 5
  продукта от order_items snapshot-и; БЕЗ конверсия (не следим трафик по дизайн)
  · **S4** newsletter кампании — таблица `campaigns` (db:push ✅), композер в
  Абонати (тема + обикновен текст), само confirmed, лимит 1/час, „Отпиши се"
  през token механизма, история с реален брой изпратени. **Чакащи тест
  (заедно): S12, S6, N11, S7, S8, S10, S14, S1, S5, S4.**

- **2026-07-08 (3) · `cb0594d`→`b026851` (dev)** — **Група „Купувачът се връща"**
  (спец `2026-07-08-buyer-retention-design.md`): **S10** любими — localStorage
  per магазин (`favorites-storage`, useSyncExternalStore), сърце на карта +
  продуктова страница, брояч в 3-те header варианта, `/s/{slug}/favorites`
  (данните от сървъра, noindex) · **S14** back-in-stock — таблица `stock_alerts`
  (db:push ✅), форма при stock=0, тригер 0→>0 в saveProduct + CSV импорт,
  race-safe notifiedAt + имейл · **S1** ревюта — таблица `reviews`, публична
  форма (pending, rate limit/honeypot), предварителна модерация в
  `/dashboard/reviews` + nav badge, звезди на карти/страница + JSON-LD
  aggregateRating. Потвърдени решения: модерация задължителна, ревю пише всеки,
  S14 само имейл. **Чакащи тест (заедно): S12, S6, N11, S7, S8, S10, S14, S1**
  — чек-списък в plan-а + спецовете.

- **2026-07-08 (2) · `df3af79`→`4bc1e75` (dev)** — **Група „Търговски операции"**
  (спец `2026-07-08-merchant-ops-design.md`): **N11** ръчна поръчка „каса" —
  `/dashboard/orders/new`, `createManualOrder` (requireShop, същата транзакционна
  логика като checkout — общото извлечено в `insertOrderWithNumber`; статус
  директно „confirmed" + имейл до купувача; override на цена доставка) · **S7**
  bulk операции продукти — чекбокси + action лента (активирай/деактивирай/изтрий/
  цени ±% или ±сума), `bulkProductAction` до 100 id-та, tenant-изолирано; БЕЗ bulk
  за поръчки (решение) · **S8** CSV импорт/експорт — export route (BOM+CRLF за
  Excel), собствен RFC 4180 парсер (`src/lib/csv.ts` + 7 теста, и `;` Excel BG),
  импорт drawer: match по slug (update/create), категория по име, планов лимит,
  per-ред докладване. Трите очакват тест от потребителя (заедно със S12/S6 от
  сутринта).

- **2026-07-08 · `664ee2c`→`ad87769` (dev)** — **Post-audit roadmap: 5 фийчъра
  имплементирани** (един по един, спец + гейт + тест от потребителя): **M1** имейл
  до купувача при смяна на статус (потвърдена/изпратена/отказана, `sendOrderStatusEmail`,
  тествано ✅) · **кликаем ред** в поръчките (`TableRowLink` с `router.push` — CSS
  подходът не работи на table елементи, тествано ✅) · **M5** търсене на поръчки
  (име/телефон/номер, debounce, URL-driven, тествано ✅; + `seed-test-orders.mjs`)
  · **M4** cookie банер „Приемам" без емоджи · **S12** складови аларми
  (`countLowStock`, праг ≤3, StatTile на таблото + `?stock=low` филтър + badge
  „Изчерпан"/„Нисък склад") · **S6** ценови диапазон + „в наличност" филтър в
  каталога и storefront листинга (по ефективната цена, общ `PriceStockFilter`,
  server-side без JS). S12/S6 очакват тест от потребителя. Спецове:
  `2026-07-08-order-status-notification-design.md`, `-order-search-design.md`,
  `-cookie-stock-filter-design.md`.

- **2026-07-07 (3) · `9d3cc1b`→`51d4c65` (само dev)** — **Цикъл от 4 фокусирани
  одита** („тази част на 100%" преди нови фийчъри). Брифове: `docs/superpowers/audits/`
  (самостоятелни, inline изпълнение, само откриване → после поправки). **20 находки,
  0 критични, 0 отворени HIGH.** Кодовата база излезе много здрава — предимно калени
  ръбове, не дупки.
  - **Одит 1 — Security** (`9d3cc1b`): 5 находки. IDOR на страницата с потвърждение
    на поръчка → нова колона `orders.public_token` (URL носи `?t=<token>`); newsletter
    потвърждение/отписване изнесено от GET рендер в action+бутон (prefetch вече не
    мутира); push абонамент не се „краде" (без презапис на userId); fulfillment
    UPDATE/DELETE вече носят `shopId` в where (дълбочина); UUID regex → `z.uuid()`.
  - **Одит 2 — Accessibility** (`82fc968`): 7 находки. `--sf-muted` под 4.5:1 на efir
    (3.32) + atelie (4.07) → потъмнени (WCAG PASS); грешките във формите `role="alert"`;
    фокус на първото невалидно поле; cart drawer focus trap + връщане на фокуса; nav
    „⌄" емоджи → `<Icon>`; countdown `role="timer"`; honeypot typo.
  - **Одит 3 — Performance** (`8ca0adb`): изображения/CLS/заявки бяха вече образцови.
    Поправени: N+1 при featured-products (1 заявка + JS разпределение); 5-те
    storefront-темови шрифта → `preload:false` (не тежат извън магазините). Оттеглено:
    гол `<img>` в pwa-splash (съзнателно). **ОТЛОЖЕНО (архитектурен дълг): storefront е
    изцяло dynamic — нула кеш** (виж cache-architecture-deep-dive.md; безрискова
    revalidateTag подготовка е commit-ната отделно).
  - **Одит 4 — UX/Conversion** (`51d4c65`): 4 находки. Storefront нямаше `error.tsx`/
    `loading.tsx` → добавени; builder `beforeunload` guard при незапазена чернова;
    createOrder `try` вече има `catch` (мрежов срив → ясно съобщение); order confirmation
    „запиши си номер N" подсказка.

- **2026-07-07 (2) · `46a8cbf` (dev+prod)** — **Тестване на Вълни 2–3Б + визуални
  поправки + prod deploy.** Потребителят изтества всичко; 6/7 фийчъра перфектни от
  раз. Поправки: (1) промо код приемаше само латиница → regex `[\p{L}\p{N}_-]/u`;
  (2) промо код поле+бутон стърчеше → общ „pill" бордер + Enter прилага; (3) date picker
  икона черна на тъмна тема → `color-scheme:dark`; (4) checkout адрес autofill → добавени
  `name` атрибути; (5) storefront empty states показват логото на търговеца, не Frizmo
  пчелата (тя е само за платформените екрани). Качено на dev И prod. **Env одит:** на prod
  липсват `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `NEXT_PUBLIC_SITE_URL` (има fallback).

- **2026-07-07** — **Website builder Вълни 1–3Б.** Пътна карта:
  `docs/superpowers/plans/2026-07-06-builder-roadmap.md`. **Вълна 1** (`c78c543`): соц мрежи
  (TikTok/YouTube/Viber), магически поведения → toggle-и, countdown, announcement dismiss,
  empty-state предупреждения, preview табове. **Вълна 2**: правни текстове override, избор
  на шрифт (`font-pairs.ts`), навигационно меню (navLinks + „Още" dropdown), video hero
  (poster вариант, 15MB, reduced-motion→постер). **Вълна 3А**: контактна форма (/contact),
  newsletter double opt-in (таблица `subscribers`, таб „Абонати" + CSV, БЕЗ изпращане).
  **Вълна 3Б**: промо кодове (таблица `coupons`, `pricing.ts` разширен, dashboard CRUD,
  checkout поле, race-safe usedCount в транзакция). `db:push` изпълнен. Известно
  ограничение: hero видео autoplay строг в Opera (документиран fallback).

- **По-старо (2026-07-04 … 07-06) — свито.** Интензивни визуален/UX/редизайн сесии:
  брандов маскот (clay пчела) + auth редизайн, dashboard/onboarding мобилен UX пакет,
  PWA splash анимация + install guide, full-screen website builder, 9 storefront теми
  (вкл. 3 тъмни) + вариантна система (30 композиции) + темови подписи + ефектна система,
  вътрешни storefront страници редизайн, onboarding wizard, количка smart UI пакет,
  e2e спасяване + бъгове, полиране на редактора, responsive/PWA одит, функционален одит
  → builder roadmap. Цени финализирани 10/20 € (Starter/Pro). Всичко завършено и в кода;
  детайлите — в git история + `executed-plans-summary.md`.
