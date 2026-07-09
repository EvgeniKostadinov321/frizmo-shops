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
   Нужни ключове (виж и `CLAUDE.md`): Supabase URL/publishable/secret, `DATABASE_URL` (:6543, transaction pooler) / `DATABASE_URL_MIGRATIONS` (:5432, session pooler), `NEXT_PUBLIC_HERE_API_KEY`, `RESEND_API_KEY`, VAPID двойка + subject, `PLATFORM_ADMIN_EMAILS`.
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

## Текущо състояние (2026-07-08)

- **Клонове:** `dev` = preview · `main` = production. Push към `main` само при изрична заявка. Последно голямо качване на prod: `46a8cbf` (2026-07-07). Одит-поправките (07-07(3)) + кеш подготовката са на **dev**.
- **Планове 1–5 ✅** · **План 6 Фаза А (админ) ✅**. Резюме: `docs/superpowers/plans/executed-plans-summary.md`.
- **`getShopPlan()` е stub** (src/lib/plan.ts) → всички магазини са "pro". План 6 Фаза Б (Stripe) = **M2** в post-audit roadmap-а.
- **Website builder Вълни 1–3Б ✅** (dev+prod, тествани). Остава Вълна 4 (undo/версии, домейн, i18n).
- **Одит цикъл ✅** (2026-07-07): 4 одита (security/a11y/perf/UX), 20 находки 0 критични, поправени на dev. `docs/superpowers/audits/`.
- **Продуктов gap одит ✅** (2026-07-07): пълен must/should/nice спрямо e-commerce стандартите → `docs/superpowers/plans/2026-07-07-post-audit-roadmap.md`. + social login спец (`docs/2026-07-08-social-login/`).

**Открити нишки (не спешни):**
- Кеш архитектура — отложена (пълно решение = Next `cacheComponents`, собствен цикъл). Анализ + готова инфраструктура: `docs/superpowers/audits/2026-07-07-cache-architecture-deep-dive.md`.
- `orders.public_token` — `db:push` срещу prod ако някога има ОТДЕЛНА prod база (най-вероятно е една обща).
- Vercel prod env: липсват `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (push) + `NEXT_PUBLIC_SITE_URL` (имейл линкове, има fallback). Добавяне → Redeploy.

**Какво следва:** `docs/superpowers/plans/2026-07-07-post-audit-roadmap.md` (продуктови gap-ове) + `2026-07-06-builder-roadmap.md` (Вълна 4).

---

## Работни правила (кратко — пълните са в CLAUDE.md)

- Inline изпълнение, без паралелни субагенти освен при изрично разрешение (пази usage лимита).
- UI текст на български, типографски кавички „…“ (прав `"` чупи JS/YAML).
- Валута EUR в integer центове.
- Дизайн токени, без хардкоднати стойности; reusable компоненти в `src/components/ui/`.
- Magnific генериране: единично, с план + одобрение + обосновка на модела преди всяко.
- Потребителят тества визуално сам; Claude прави `pnpm check` + commit.
- Push към `main` (prod): питай + качи само при разрешение.

---

## Дневник (най-новото най-отгоре)

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
