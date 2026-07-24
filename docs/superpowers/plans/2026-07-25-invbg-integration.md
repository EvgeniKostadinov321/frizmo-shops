# План: inv.bg интеграция — официални български фактури за таксата

**Дата:** 2026-07-25
**Обхват:** Случай A — фактура за месечната транзакционна такса (търговец → НАС). Законово наше
задължение (ние сме продавач на услугата „платформа"). Случай B (продажбите) НЕ се прави.
**Референтна имплементация:** Frizmo monorepo `d:/Personal projects/Saas/apps/api/src/lib/invbg.ts`
(работеща production; копираме адаптирано).
**Свързано:** [[invbg-integration-research]], [[transaction-fee-monetization]], [[external-work-scope]].

## Решения (потвърдени с потребителя 2026-07-25)
- **Тип:** два — частно (ЕГН) и фирмено (ЕИК), с toggle. Като Frizmo.
- **Кога данни:** при card-gate (попълване на карта след 1-вата продажба) + редактиране после в Настройки.
- **Кога издаване:** при **успешно плащане** (`invoice.paid` Stripe webhook) — само реално платени такси,
  без анулирания при провал. Като Frizmo.
- **Валута:** такса е в EUR евроценти → фактурата иска и BGN (курс 1.95583, `main_currency` блок).
- **ДДС:** 0% с основание `чл.113 ал.9 от ЗДДС`. ✅ ПОТВЪРДЕНО (2026-07-25): фирмата НЕ е по ДДС
  (далеч от прага; ~320€ приходи). Копираме Frizmo модела 1:1, без 20% усложнения.

## Предпоставки (ръчни стъпки на потребителя — дадени 2026-07-25)
1. **inv.bg API токен** — Настройки → Интеграция/API → генерирай ключ → `INV_BG_TOKEN` (таен; само прод +
   .env.local). ⏳ ЧАКА потребителя.
2. **Отделна номерационна серия/кочан за Shops** — Настройки → Номериране → нов кочан „Frizmo Shops — такси"
   (да не се смесва с Frizmo абонаментите в НАП). ⏳ ЧАКА потребителя. Ако планът дава само 1 серия → да се реши.
3. **Данни за издателя** (нашата фирма) — авто от inv.bg акаунта; потребителят проверява фирма/ЕИК/адрес/МОЛ
   попълнени + режим „по ДДС" ИЗКЛЮЧЕН (0% основание). ⏳ ЧАКА потребителя.

**ДДС:** ✅ РЕШЕНО — 0% (фирмата НЕ е по ДДС, ~320€ приходи, далеч от прага).

**Забележка:** стъпки 1-3 от имплементацията (схема, invbg.ts, UI форма) са ЧИСТ КОД — не чакат токена;
токенът трябва чак за стъпка 4 (реално издаване). Може да се кодира+тества в test/dev без реален POST.

## Стъпки (implementation)

### 1. Схема — нова таблица + snapshot колони
- **`merchant_billing_details`** (нова, аналог на Frizmo `billing_profiles`): `id`, `shopId` (unique, FK
  cascade), `clientType` enum `["company","individual"]` default company, `companyName`, `eik`, `mol`,
  `vatNumber`, `egn`, `address`, `city`, `createdAt`, `updatedAt`. `.enableRLS()`. Индекс на `shopId`.
- **`fee_invoices` snapshot колони** (schema.ts:684) — замразяване в момента на издаване (НАП 10г):
  `billingClientType`, `billingCompanyName`, `billingEik`, `billingMol`, `billingVatNumber`, `billingEgn`,
  `billingAddress`, `billingCity` (всички text nullable) + `invBgId` (integer), `invBgNumber` (text),
  `invBgPdfLink` (text), `invBgStatus` enum `["pending","issued","failed"]` nullable.
- `pnpm db:push` (таргетиран — паметта [[prod-environment]] предупреждава за trgm дрифт).

### 2. `src/lib/invbg.ts` — API клиент (копие от Frizmo, адаптиран)
- `createInvBgInvoice(billing, invoice)` → POST /invoices (payload с is_to_person toggle, EUR+BGN,
  vat 0%+reason, items) → POST /links/share за PDF линк (30 дни).
- `createInvBgInvoiceWithRetry` (3 опита exp backoff).
- `annulInvBgInvoice(id)` (PATCH is_annulled) — за корекции.
- Item name: „Такса за продажби (Frizmo Shops) — YYYY-MM" (не „Абонамент" както Frizmo).
- BASE `https://api.inv.bg/v3`, Bearer `INV_BG_TOKEN`, `Accept-Language: bg`.

### 3. UI форма — данъчни данни с toggle
- Zod схема `src/schemas/billing-details.ts`: toggle company/individual; company→eik(9-13 цифри)+mol
  задължителни; individual→egn(10 цифри) задължителен; общо companyName+address+city. Валидация на
  ЕИК/ЕГН формат (conta check по възможност).
- Server action `src/actions/billing-details.ts` през `requireShop()` wrapper (tenant изолация).
- Компонент форма (drawer, `<Drawer>` не modal — правило) с toggle бутон (нов или Tabs примитив).
- Точки на показване: (а) card-gate момента (след 1-вата продажба, до/след картовата форма);
  (б) dashboard → Фактуриране таб → „Данни за фактура" (редактиране).

### 4. Издаване при плащане
- `src/app/api/webhooks/stripe/route.ts` — в `invoice.paid` case (ред 59-63), СЛЕД маркиране `paid`:
  вземи merchant_billing_details за shopId → ако липсват/wantsInvoice false → skip (само лог, не блокира);
  → `getBillingSnapshot` (замрази в fee_invoice) → `createInvBgInvoiceWithRetry` → запиши invBgId/number/
  pdfLink + invBgStatus. Идемпотентност: ако invBgId вече е сложен → skip (дубъл гард).
- **PROD-ONLY гард** (критично — inv.bg = реални НАП записи от една серия): издавай само ако
  `NODE_ENV === "production"` И (напр.) `VERCEL_ENV === "production"`. Dev/preview → лог, без реален POST.
- Retry на pending (по избор): cron стъпка за invBgStatus='pending'/'failed' → повторен опит.

### 5. Dashboard — линк към PDF
- `src/actions/billing.ts` `getBillingStatus()` → добави invBgPdfLink/invBgNumber към върнатите invoices[].
- billing-panel.tsx → бутон „Изтегли фактура (PDF)" на всеки платен ред с invBgPdfLink.

### 6. Env + документация
- `INV_BG_TOKEN` в `.env.local` (за test) + Vercel Production + `src/env.ts` warning (опц.).
- CLAUDE.md env списък + WORKLOG + памет.

## Тестове
- Unit: invbg payload builder (EUR→BGN, toggle частно/фирмено, vat block), snapshot freeze,
  idempotency гард, prod-only гард.
- Мануален: test mode с реален inv.bg токен (ако inv.bg има sandbox — да се провери; ако не → внимателен
  единичен реален тест + анулиране).

## НЕ в този пакет (отделно после)
- GDPR/легален пакет: обнови условия/съгласия при регистрация + триене на данни + експорт на данни.
- Случай B (фактури за продажбите на купувачите) — отложено, per-shop ключове.
