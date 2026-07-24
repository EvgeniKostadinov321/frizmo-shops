# План: GDPR пакет — съгласия, експорт, легални документи, данъчни конфликти

**Дата:** 2026-07-25
**Обхват (потвърден с потребителя):** 4 части — (1) поправка на данъчните конфликти erasure↔НАП;
(2) consent при регистрация; (3) експорт на данни (чл.20); (4) разширени легални документи + Cookies policy.
**Свързано:** [[gdpr-package-research]], [[account-deletion-feature]], [[invbg-integration-research]].
**Разузнаване:** триене (чл.17) ВЕЧЕ ИМА за двете роли — надграждаме, не пишем наново.

## Част 1 — Данъчни конфликти (КРИТИЧНО, прави се пръв — пипа триенето)

### 1a. fee_invoices + fee_events → архивиране вместо cascade delete
Проблем: `delete shops` каскадно трие `fee_invoices` (НАП запис, 10г) заедно с ЕГН/ЕИК snapshot.
Решение (като Frizmo): при триене на магазин тези таблици се ЗАПАЗВАТ, връзката се къса.
- Схема: `fee_invoices.shopId` и `fee_events.shopId` → **nullable** + FK `onDelete: "set null"` (не cascade).
  Идентификацията остава в billing snapshot колоните (billing_company_name/eik — вече добавени днес) за
  fee_invoices. За fee_events (само сума/дата/orderId) — губи се търговецът, но остава сумата за одит;
  приемливо (реалният данъчен документ е fee_invoices).
- `account.ts deleteAccount`: ПРЕДИ `delete shops` → експлицитно `UPDATE fee_invoices SET shop_id=null`,
  `UPDATE fee_events SET shop_id=null` за този shop (за да не ги хване cascade-ът, ако schema още не е
  приложена; + явно намерение).
- Прод+dev db:push: таргетиран SQL (nullable + drop constraint + set null FK) — НЕ drizzle push (trgm!).

### 1b. Търговското триене → в транзакция
Проблем: `deleteAccount` е поредица без транзакция → полуизтрит акаунт при провал по средата.
Решение: обвий DB частта (set null fee_*, delete shops, delete profiles) в `db.transaction`. Best-effort
външните (Stripe cancel, Storage, auth deleteUser, signOut) ОСТАВАТ извън транзакцията (не са DB, не могат
rollback) — но се логват. Ред: транзакция първо (данните), после външни cleanup.

### 1c. Явен текст за конфликт 2 (orders PII остават след купувачко триене)
Купувачкото триене анонимизира orders.buyerId→null, но customer_name/phone/address остават (търговецът
пази за счетоводство, чл.17(3)(б)). Добави в delete-account UI (купувач) + в Политиката за поверителност
явно изречение: „Данните в вече направени поръчки се пазят от съответните търговци за счетоводни/данъчни
цели, дори след изтриване на профила ти."

## Част 2 — Consent при регистрация
- Схема `registerSchema` (schemas/auth.ts): + `acceptTerms: z.literal(true, {...})` (задължително true).
  Опц. `acceptMarketing: z.boolean().default(false)` (за бъдещ маркетинг).
- Форма `auth-form.tsx`: само при `isRegister` → Checkbox „Приемам Условията за ползване и Политиката за
  поверителност" (с линкове към /terms /privacy, target _blank). Задължителен (submit disabled без него ИЛИ
  Zod грешка). Опц. втори checkbox за маркетинг.
- `signUp` action (actions/auth.ts): парсва acceptTerms; ако false → грешка. Записва съгласието:
  нова колона на `profiles` — `termsAcceptedAt` (timestamp) + `termsVersion` (text, напр. "2026-07-25").
  (Запис на КОГА и КОЯ версия е приета — GDPR доказуемост.)
- Схема: `profiles` + `terms_accepted_at`, `terms_version`, `marketing_consent` (bool). Таргетиран SQL.

## Част 3 — Експорт на данни (чл.20)
Ново — сваляне на своите лични данни като JSON. Две роли, различен обхват.
- Купувач: `exportBuyerData()` action (requireBuyer) → JSON { profile, orders (свои, с buyerId), addresses,
  favorites, favoriteShops }. Само СВОИ данни.
- Търговец: `exportMerchantData()` action (requireShop) → JSON { profile, shop, billingDetails, feeInvoices
  (свои), subscription }. ⚠️ БЕЗ чужди PII — НЕ включва клиентските поръчки/subscribers (те са лични данни
  на трети лица, търговецът е техен обработващ, не субект). Каталог (продукти) вече има CSV експорт отделно.
- UI: бутон „Изтегли моите данни (JSON)" в settings (купувач: account/settings; търговец: dashboard/store
  Опасна зона или отделна секция). Server action връща JSON string → клиентът сваля като файл (Blob).
- Формат: четим JSON с BG етикети/коментар или ключове на английски + дата на експорта.

## Част 4 — Легални документи + Cookies policy
- Разшири `PLATFORM_TERMS` (platform-legal.ts): добави секция за официалните фактури (inv.bg, месечна
  фактура за таксата, данъчно задържане 10г). Актуализирай „прекратяване" с реф към експорт (вече ще има).
- Разшири `PLATFORM_PRIVACY`: (а) явен текст за orders PII при търговците (конфликт 2); (б) данъчно
  задържане на fee_invoices (10г, законово изключение от изтриване); (в) правата чл.15-20 изброени +
  как да ги упражни (експорт бутон + триене). Обработващи лица: Supabase, Vercel, Resend, Stripe, inv.bg.
- Нова страница `/cookies` (marketing) + `PLATFORM_COOKIES` секция в platform-legal.ts: какви бисквитки
  (само essential — сесия/вход), без tracking. Footer линк добавен (site-footer.tsx).
- BG език: типографски кавички „…", без англицизми (docs/bulgarian-lang-guide.md).

## Тестове
- Unit: consent валидация (acceptTerms false → грешка); експорт обхват (купувач НЕ вижда чужди; търговец
  НЕ включва клиентски PII); архивиране (fee_invoices оцелява след shop delete — mock/verify).
- verify скрипт: разшири verify-account-deletion.mjs да провери, че fee_invoices остава след триене на shop.

## Ред на имплементация
1. Част 1 (схема + триене) — пръв, защото пипа съществуващо триене + прод db:push.
2. Част 2 (consent) — схема + форма + action.
3. Част 3 (експорт) — actions + UI.
4. Част 4 (легални текстове) — само съдържание, най-безопасно.
5. pnpm check + прод db:push (таргетиран) + push.

## НЕ в този пакет
- Реален cookie opt-in с категории (нужен само ако се добави tracking/аналитика — сега няма).
- Автоматична retention/изтриване на стари PII (напр. стари abandoned_carts) — отделно, по-късно.
