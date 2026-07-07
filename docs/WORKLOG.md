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

## Текущо състояние (2026-07-05 късна нощ — ВСИЧКО комитнато и качено на dev + main: вариантна система 30 композиции, responsive/PWA одит, тема-спасяване + ефектна система)

- **Клонове:** `dev` = preview · `main` = production (двата синхронизирани на `ced7e55`). Push към `main` само при изрична заявка от потребителя.
- **Deploy:** Vercel. ⚠️ В repo-то няма `vercel.json`/линкнат `.vercel` проект — трябва да се потвърди в Vercel dashboard, че production сочи `main`.
- **Планове 1–5 ✅** (MVP: фундамент, магазин/продукти, storefront, количка/поръчки, каталог/landing/блог/SEO).
- **План 6:** Фаза А (платформен /admin) ✅ · Фаза Б (Stripe абонаменти) — **чака старт по изрична заявка**. Дотогава `getShopPlan()` (src/lib/plan.ts) е stub → всички магазини са "pro".

### Брандов маскот (нов, 2026-07-04)
Clay пчела, заключена като Magnific character асет (id 2001559). Първо приложение:
auth редизайн. Жив прогрес: `docs/design/mascot-progress.md`. Пости за нови пози
(onboarding празник, empty states, 404) — по желание при следваща сесия.

### Post-MVP визуален редизайн (в ход)
Спец: `docs/docs-03-07-2026/2026-07-03-visual-redesign-spec.md` · план: `docs/superpowers/plans/2026-07-03-landing-visual-redesign.md`

Ключови решения:
- **Бранд:** зелено → **теракота** (`brand-*` в `src/styles/tokens.css`). Градиентният акцент (теракота) е само върху акцентната дума в hero H1. Primary бутон = тъмен (`bg-ink-900`).
- **Тема:** публичните страници са **само светли**. Dark е само за `/dashboard` + `/admin` (anti-FOUC скриптът в `layout.tsx` е гейтнат по път; `ForceLightTheme` на marketing). ADR: `docs/decisions/2026-07-03-dark-mode.md`.
- **Цени:** 20 € (Starter) / 35 € (Pro). Trial 30 дни, без grace период. Източник: `src/lib/plans-content.ts`.
- **Асети:** логото (`public/logo-mark.png`) и CTA/OG снимките (`public/cta-workshop.webp`, `public/og-bg.jpg`) са AI-генерирани през Magnific.

Редизайнирани и качени секции:
- **Landing** (`src/app/(marketing)/page.tsx`): hero (профит-first, „Продавай повече."), before/after (болка), step visuals (как работи), feature bento, done-for-you сервиз (тел. +359877167007, имейл supportfrizmo@gmail.com), responsive header с мобилно меню, редизайниран footer (без BG флагове).
- **`/shops`** и **`/products`**: editorial hero зона, cover снимки на картите, сортиране, активни филтър-чипове, скрити тест-магазини (slug `test-`/`тест-`).
- **`/blog`** + статия: editorial списък с акцентна статия, 5 статии с категория/време за четене/TOC (табле със заглавия), поправени остарели цени в старите статии.
- Всичко проверено **responsive на 375px** (0 overflow на трите каталог/блог страници).

---

## Следващо (кандидати — уточни при следваща сесия)

- Продължаване на секция-по-секция редизайн — **остана storefront `/s/{slug}`** (публичният магазин; той има собствена `--sf-*` тема, „Пазарен ден" НЕ важи там). Dashboard/onboarding/auth вече редизайнирани.
- План 6 Фаза Б — Stripe абонаменти (само при изрична заявка).
- Проверка, че Vercel production е вързан към `main`.
- Пренасяне на живата документация и в Saas проекта (по желание).

---

## Работни правила (кратко — пълните са в CLAUDE.md)

- Inline изпълнение, без паралелни субагенти (пази usage лимита).
- UI текст на български, типографски кавички „…“ (прав `"` чупи JS/YAML).
- Валута EUR в integer центове.
- Дизайн токени, без хардкоднати стойности; reusable компоненти в `src/components/ui/`.
- Magnific генериране: единично, с план + одобрение + обосновка на модела преди всяко.
- Потребителят тества визуално сам; Claude прави `pnpm check` + commit.

---

## Дневник (най-новото най-отгоре)

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
    изцяло dynamic — нула кеш**, защото `getPublicShop` вика `supabase.auth.getUser()`;
    ISR + on-demand revalidation за анонимни посетители (без да се чупи owner draft
    preview) е следващата голяма performance стъпка, иска собствен план.
  - **Одит 4 — UX/Conversion** (`51d4c65`): 4 находки. Storefront нямаше `error.tsx`/
    `loading.tsx` → добавени (брандиран „Опитай пак" + спинър); builder `beforeunload`
    guard при незапазена чернова; createOrder `try` вече има `catch` (мрежов срив →
    ясно съобщение, не гола грешка); order confirmation „запиши си номер N" подсказка.
  - ⚠️ **`orders.public_token` е само на dev/облачната база** (db:push изпълнен). Ако
    някога има ОТДЕЛНА prod база — db:push срещу нея преди първа поръчка на живо, иначе
    checkout гърми. (Одит установи: най-вероятно няма отделен prod — една обща база.)

- **2026-07-07 (2) · `46a8cbf` (dev+prod)** — **Тестване на Вълни 2–3Б + визуални
  поправки + prod deploy.** Потребителят изтества всичко; 6/7 фийчъра перфектни от
  раз. Поправки след тестване: (1) промо код приемаше само латиница → regex
  `[\p{L}\p{N}_-]/u` за кирилица (напр. „ЛЯТО26"); (2) промо код поле+бутон стърчеше
  извън резюме карето → общ „pill" бордер, бутон вътре + Enter прилага; (3) native
  date picker икона черна на тъмна тема → `color-scheme:dark` в globals.css за
  `input[type=date/datetime-local/time/month]` под `[data-theme=dark]`; (4) checkout
  адрес не се autofill-ваше → добавени `name` атрибути (браузърът разчита на тях, не
  само на autoComplete); (5) storefront empty states (празна количка/продукти/търсене)
  показваха Frizmo пчелата на ЧУЖДИЯ магазин → `MascotState` показва **логото на
  търговеца** (кръгло каре) или неутрална икона (cart/store/search); пчелата остава
  само за платформените екрани (dashboard/auth/PWA/глобален 404). **Качено на dev И
  prod** (fast-forward, 77 файла на main). **Env одит за Vercel:** кодът ползва 13 env
  vars; на prod ЛИПСВАТ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (push нотификации — трябва да се
  добави) и `NEXT_PUBLIC_SITE_URL` (имейл линкове — има hardcoded fallback
  `frizmo-shops.vercel.app`, работи и без него). `DATABASE_URL_MIGRATIONS` НЕ трябва в
  Vercel (само локални db:push/seed скриптове). Новите фийчъри НЕ зависят от липсващите
  → prod е готов за тестване от външен човек. Prod URL: `frizmo-shops.vercel.app`.

- **2026-07-07** — **Website builder Вълни 1–3Б (функционалните фийчъри от одита).**
  Пътна карта: `docs/superpowers/plans/2026-07-06-builder-roadmap.md`; спецове в
  `docs/superpowers/specs/2026-07-0{6-wizard,7-builder-wave-2,7-builder-wave-3a,7-builder-wave-3b}`.
  **Вълна 1** (commit `c78c543`): още соц мрежи (TikTok/YouTube/Viber, общ
  `lib/socials.ts`), магически поведения → toggle-и (hero accentLastWord/showStoryLink,
  promo kicker поле), countdown таймер на promo-banner, announcement dismiss, empty-state
  предупреждения в редактора (`lib/section-warnings.ts`), preview продукт+количка табове.
  **Вълна 2**: правни текстове override по секция (нов таб „Правно", `legal-template.ts`
  рефактор с id-та), избор на шрифт (`lib/font-pairs.ts`, 6 курирани двойки, themeStyle
  override), навигационно меню (ръчни navLinks + „Още" dropdown `header/nav-overflow.tsx`
  за варианти 1/2), video hero (нов storage тип video 15MB, `video-uploader.tsx`,
  `hero-video.tsx` само poster вариант, reduced-motion→постер, autoplay подсилен с JS).
  **Вълна 3А** (комуникация): контактна форма на /contact (само имейл до търговеца,
  reply-to клиента), newsletter double opt-in (нова таблица `subscribers`, секция
  „Бюлетин", `/newsletter/confirm` route, dashboard таб „Абонати" + CSV експорт, БЕЗ
  изпращане на бюлетин). **Вълна 3Б** (промо кодове): нова таблица `coupons` (percent/fixed,
  мин. сума, лимит, срок), `pricing.ts` разширен с купон (отстъпка върху subtotal, +6 unit
  теста), dashboard таб „Промо кодове" (CRUD), checkout поле + **race-safe** декремент на
  usedCount в транзакцията (`FOR UPDATE`, като наличностите). `pnpm check` зелен (137 теста).
  ⚠️ **НЕ тествано още** — качено на dev за тестване утре. `db:push` изпълнен (subscribers +
  coupons таблици). Bucket обновен на 15MB + видео MIME (`setup-storage.mjs`). Известно
  ограничение: hero видео autoplay е по-строг в Opera → без постер = черно (документирано в
  спец 2, реализиран градиент fallback). Остава: Вълна 4 (undo/redo версии, custom домейн,
  i18n — всяко отделен голям проект).

- **2026-07-06 (6)** — **Полиране на редактора + responsive одит + функционален одит →
  пътна карта.** Няколко UX кръга по website редактора след live тестване от потребителя:
  (1) **Tooltip примитив** (`ui/tooltip.tsx`, CSS-only, 300ms delay, работи на disabled и
  клавиатурен фокус) → hover обяснения на top-bar действията. (2) **„+ Добави" фикс**
  (иконка+текст вместо пренасящ се `+`). (3) **Палитри per тема в редактора** — theme
  панелът вече ползва `THEME_PALETTES[theme]` (site-recipes) вместо общия PALETTE_PRESETS,
  който е **изтрит** от themes.ts; смяната на тема показва нейните курирани комбинации.
  (4) **`logoOnly` настройка** (`site-settings.ts`) — чекбокс „само логото без името" в
  таб Тема (само при качено лого); прилага се в `Brand` (3 header варианта + мобилно меню);
  защита: без лого името винаги се показва. (5) **Upload прогрес + паралелно качване**
  (`lib/upload-to-signed-url.ts` — XHR с реален %, репликира Supabase signed-upload контракта;
  fallback към SDK-то; `image-uploader.tsx` качва с `Promise.all`, прогрес-карти вместо
  spinner). (6) **promo-banner без снимка** заливаше 400px+ с неонов primary (Пулс лайм) →
  surface фон + primary само в акцентите (лента/kicker/CTA/талон). (7) **DB singleton**
  (`db/index.ts`) — dev hot-reload пресъздаваше postgres клиента → изчерпани връзки →
  произволни „Failed query"; фикс: кеш на globalThis. (8) **Responsive одит на 375px**
  (обективно измерен през временен Playwright тест, после изтрит): top-bar на редактора
  преливаше с 21px („Публикувай промените" отрязан) → двуредова лента на мобилно;
  секционни икони/табове/карусел точки < 44px → тъч цели. ⚠️ **Функционален одит**
  (2 паралелни Explore агента + ръчна проверка) → идентифицирани 13+ липсващи фийчъра;
  резултатът е **нова пътна карта** в `docs/superpowers/plans/2026-07-06-builder-roadmap.md`
  (4 вълни). Onboarding wizard спецът от (4) е imported и допълнен. `pnpm check` зелен
  (131 теста). Гоча: freeze при качване на файл = Windows Explorer диалог (thumbnails/
  OneDrive), НЕ наш код — само нативният OS модал заключва целия браузър.

- **2026-07-06 (5)** — **E2e спасителна операция + 2 реални бъга.** Пълният
  e2e suite не беше пускан от редизайн-ерата и беше изгнил. Реални бъгове,
  хванати от тестовете: (1) wizard-ът се подменяше с редактора ПРЕДИ финалния
  екран (revalidatePath от saveSiteSettings пре-рендерира страницата → ред
  вече има → editor; фикс: wizard-ът закотвя URL на ?wizard=1 при mount);
  (2) **landing-ът беше загубил демо картите и hero телефона** —
  DEMO_SHOP_SLUGS сочеше изтритите стари демота (ferma-zelena-dolina…);
  фикс: 3 от тематичните (atelie-glina/puls/efir), hero = Ателие Глина.
  Тестова хигиена: нови helpers (createShopViaWizard, completeWebsiteWizard),
  selectOption с hydration retry (toPass), „Табло" heading → toHaveURL
  (дашбордът има h1 = името на магазина), sonner hover-pause гоча (мишката
  паузира dismiss → mouse.move + чакане toast=0), strict-mode дубли (.first()/
  exact/table-scope), стар empty-state/toast текст. **13/13 зелени** (без
  landing-a11y — 93 РЕАЛНИ контраст нарушения от теракота редизайна, чака
  дизайн решение). Гоча: 7 фейла за 30 сек = EMAXCONN, не код.

- **2026-07-06 (4)** — **Onboarding wizard „до хубав сайт за 5 минути"**
  (спец: docs/superpowers/specs/2026-07-06-website-onboarding-wizard.md).
  Нов `src/lib/site-recipes.ts`: THEME_PALETTES (4 палитри × 9 теми),
  CATEGORY_SUGGESTIONS + CATEGORY_CONTENT (текстови шаблони по 9-те бизнес
  категории), buildRecipeSections (реда на демотата, БЕЗ фалшиви отзиви —
  секцията празна+изключена). Wizard (dashboard/website/wizard/): Поздрав →
  Тема (РЕАЛНИ скрийншоти на демотата, public/theme-previews/ + README) →
  Цветове → Снимки (дропзона, най-хоризонталната → hero) → Категории/продукти
  (по желание) → финал с „Разгледай" + „Публикувай" (publishSiteSettings +
  publishShop). Прогрес в localStorage (draft-ът е стриктен Zod — не носи чужди
  ключове); резултатът се пише в draft през saveSiteSettings. Гейт „Първо
  добави продукт" на целия таб Уебсайт (≥1 продукт). „Започни отначало" в
  theme панела (?wizard=1, confirm). 4 нови маскот пози (Nano Banana Pro +
  character ref): bee-palette, bee-camera, bee-product, bee-party.
  Скрийншотите — механично с Playwright (1200×760 → 600px JPEG).

- **2026-07-06 (3)** — **Terms редизайн + statement еталон + втори пласт
  подписи + 3 микро-фикса.** Terms: PageHeader + номерирани секции (display
  цифри) + hairlines + пълноконтрастен текст (беше най-грубата страница точно
  на checkout доверие-момента). Гранит демото → statement hero (жив еталон;
  seed поддържа heroLayout per ниша). Нови подписи: Сигнал ъглови
  скоба-маркери ⌐ (`--sf-photo-corners` → 8 фонови слоя в .sf-frame::after);
  Ателие хартиено зърно (`--sf-surface-grain: 0.05`, Ефир 0.03) в SectionShell
  surface. Микро: FAQ/details плавно отваряне (::details-content +
  interpolate-size, прогресивно); темови radio бутони (appearance-none, --sf-*
  цветове, focus-visible); footer контактната колона 1.4fr (имейлът на 1 ред).
  Отложено съзнателно: визуални variant picker-и за секциите (следваща тема).

- **2026-07-06 (2)** — **Всичките 8 отворени точки затворени.** (1) Mini-cart
  drawer: страничен панел (portal механиката на MobileMenu) с ПРЕИЗПОЛЗВАН
  CartView (`onNavigate` затваря при линк); CartButton отваря drawer-а
  (custom event `frizmo-cart-open`), toast действието също. (2) „Последно
  разглеждани" на продукта: id-та в localStorage (lib/recently-viewed) +
  публичен `getProductsByIdsAction` (actions/storefront.ts, rate limit).
  (3) Checkout полетата (име/телефон/имейл/адрес/град) се помнят per-магазин.
  (4) Оникс: двоен златен кант (1px + hairline на 10px — 1px сам беше
  невидим). (5) Основа: подпис „носеща греда" под hero кадъра. (6) Ефир:
  органична blob „капка" (арката остана само на Ателие). (7) Seed фикс: Ателие
  акцент → керемида #c2410c. (8) Trust badges: вариант 2 „тиха hairline
  лента" → всички секции с варианти, 32 композиции. Гейт зелен.

- **2026-07-06** — **Функционален одит на количката + умен UI пакет.** Одит на
  цялата верига (variant-picker → cart-storage → pricing → createOrder):
  backend-ът коректен (сървърно ценообразуване, FOR UPDATE транзакция), но UX
  дупки. Оправено: (1) живо „Общо за N бр" + „Спестяваш X" на продукта (deal
  формулата от pricing engine-а, sticky лентата също показва total);
  (2) количката е stale-while-revalidate — количествата мигновени от
  localStorage, optimistic суми, 250ms debounce, БЕЗ премигване/skeleton при
  +/− (беше пълен re-render на компонента при всеки клик); (3) clamp на „+"
  по наличност (`PricedLine.stockLeft`, +3 unit теста); (4) toast с действие
  „Виж количката"; (5) „Още X € до безплатна доставка" прогрес-лента (най-
  ниският праг от активните методи). (6) Темови toast-ове: --sf-toast-* вар.
  инжектирани на <html> (sonner е в root body, извън storefront обхвата —
  същият трик като скролбарите) + микро-ефекти (израстваща акцентна лента,
  пружинен icon pop, primary пилюла бутон; reduced-motion уважен). ГОЧА:
  редактиран globals.css НЕ се появи в dev — стар Turbopack кеш в .next;
  фикс: изтрий .next + рестарт. Checkout страницата получи PageHeader.

- **2026-07-05 (след полунощ)** — **Редизайн на вътрешните storefront страници
  + маскот в празните състояния.** Одит показа, че Продукти/Количка/За нас/
  Контакти/детайлен продукт са останали на MVP ниво (голи h1, admin-вид search,
  без темов подпис). Нови примитиви: `PageHeader` (kicker + display h1 +
  hairline) и `MascotState` (дискретен статичен PNG). Продукти: search с лупа
  в инпута + „ד, сортиране (Най-нови/Цена ↑↓, server чипове), брой резултати,
  двустепенни категорийни чипове, „Страница N" пагинация; заявката връща total
  + сортира. Детайлен продукт: h1+категория в дясната колона, swipe галерия
  (scroll-snap + брояч) с lightbox, −% badge, **sticky „Добави" лента на
  мобилно** (safe-area). Количка: skeleton вместо „Зареждане…", „Общо без
  доставка" ред, 44px степер. Контакти чете варианта на секцията от
  site_settings (беше хардкоднат 1). За нас: editorial (kicker, водеща снимка
  с ТЕМОВАТА hero рамка, drop cap). Емоджитата ✅/🏪 → икона/маскот. Две нови
  Magnific генерации (Nano Banana Pro + library character, 156 кредита):
  `bee-lost.png` (лупа, за 404/празно търсене) и `bee-basket.png` (празна
  кошница, за количката) — remove-bg + trim/512px през sharp от pnpm store.
  Гейт зелен. Commit: виж git.

- **2026-07-05 (късна нощ)** — **Спасяване на 4-те „меки" теми + ефектната
  система.** Одит защо Ефир/Сигнал/Класик/Ателие четяха „евтино" срещу 5-те
  добри: statement hero без фотография + контраст под прага + кален акцент.
  Оправено: демотата → split/poster; Класик heading → Onest 800 (Inter беше
  забраненото generic); Ефир → тежест 700 + „Роза" палитра + дълбочина;
  Сигнал → подпис „техническа плоча" (двоен primary кант); Ателие акцент →
  керемида #c2410c; сенките на светлите теми осезаеми. **Ефектни токени**
  (A wash / B mist / C материален CTA / D кадър-ринг / E hover елевация) —
  селективна карта по теми в `docs/design-final-guide/theme-signatures.md`;
  класове `.sf-cta`/`.sf-frame`; покритие: всички варианти + продуктова
  страница/количка/checkout. Statement hero полиран (плътни кръгове,
  паспарту рамка) — вече само builder опция.

- **2026-07-05 (нощ)** — **Вариантната система ЗАВЪРШЕНА (30
  композиции) + responsive/PWA одит.** Всички секции/елементи с варианти
  (пълната таблица: `docs/design-final-guide/variants-architecture.md`):
  Продукти ×2 (editorial ⭐ = обявен от собственика за еталон; мобилно =
  swipe слайдър — принципът „интеракцията се превъплъщава, не се осакатява"),
  Категории ×2 (номериран списък-меню + плаваща снимка), Промо „купон-билет",
  Снимка+текст ×2 (застъпване с grid overlap), Текст ×2 (drop cap /
  асиметричен spread), Галерия ×3 (masonry / филмова лента / движеща се
  стена — безшевен marquee loop), Отзиви ×2, FAQ ×2 (spread с „+"→„×"),
  Контакти ×3 (редове+маршрут / панел върху картата / визитка), Socials ×3,
  Footer ×2 (богат+година / минимален центриран; footerVariant в схемата).
  Демотата разпределени по вариантите; двете featured секции на страница са
  в различни варианти. Гранит получи подпис: офсетна стоманена плоча.
  Custom scrollbar-ите + editorial локацията одобрени. **Responsive/PWA
  одит** (код, без Playwright): 8 находки поправени (nowrap kicker overflow,
  w-screen скролбар, absolute→grid overlap на плаващите панели, 44px footer
  цели, wrap-break-word на заглавията, safe-area на drawer-а, per-shop
  theme-color, overflow-x-clip мрежа) — уроци в
  `docs/design-final-guide/responsive-pwa-audit-2026-07-05.md`.
  Остава: trust badges варианти (по желание). `pnpm check` зелен.

- **2026-07-05 (късна вечер)** — **Вариантна система: Header ×3 + Hero ×3
  (одобрени от собственика).** По `docs/design-final-guide/variants-architecture.md`:
  (а) **Header**: папка `header/` с dispatcher; `headerVariant 1|2|3`
  (inline / split bar — лого център, nav отдвете / минимал с drawer);
  поглъща `headerLayout` през preprocess; визуален picker в theme панела;
  мобилното меню = страничен drawer с плавна анимация през ПОРТАЛ
  (body-контейнер) — fixed в sticky+blur header се чупи, а
  overflow:hidden на <html> чупи sticky (заключване с компенсиран скролбар).
  (б) **Hero**: папка `sections/hero/` с dispatcher; `layout:
  split|poster|statement` (legacy full/slideshow/duo/frame → preprocess);
  split = еталонът Пулс (непокътнат); poster = editorial корица (текст
  долу-ляво, двоен scrim — четим и на светла снимка); statement = surface
  блок + накривена снимка-картичка с primary офсетна сянка + тонални
  кръгове + marquee. Височина: `--sf-chrome` в layout-а (topbar + header
  според overlay) → точно 100dvh при всяка комбинация. Гоча: px-calc
  подравняване НИКОГА вътре в max-w кутия (текстът колабира дума по дума).
  (в) Custom скролбари за storefront (тънки, темови цветове; html:has() +
  инжектирани --sf-sb-* от layout-а). (г) Демо разпределение: split =
  Пулс/Ателие/Витрина…, poster = Оникс/Витрина/Гранит/Основа, statement =
  Ефир/Сигнал/Дом и Уют; header 2 = Оникс/Ателие, 3 = Витрина. Ателие
  акцентът сменен на топъл #7a5c2e (одит дисонанс).

- **2026-07-05 (вечер)** — **Header + Hero редизайн v2 +
  `docs/design-final-guide/`.** (а) Header: sticky прозрачен→плаващ (overlay
  върху full/slideshow hero на началото), wordmark с `--sf-font-heading`,
  активен линк + underline анимация, мобилен бургер → fullscreen меню,
  announcement = topbar НАД header-а (фикс. h-9 → `--sf-topbar`); (б) Hero:
  истински 100svh (вади topbar/header през calc), split 7/5 с вписан „арков
  прозорец" (`--sf-hero-radius` пълен border-radius) + темова рамка
  (`--sf-hero-frame`: Пулс офсетен блок, Оникс злат. кант), staggered reveal
  (`sf-rise`), Ken Burns, акцентна дума (`--sf-accent-ink*` изчислени),
  водна буква + зърно; 5 нови темови токена + `accentInk()` в contrast.ts.
  (в) **НОВА ПАПКА `docs/design-final-guide/`** — задължителният дизайн
  контекст: README (работен ред), двата skill дока (ПРЕМЕСТЕНИ от
  docs/design/), variants-architecture (3 варианта/секция — план, БЕЗ код
  още), theme-signatures (подпис per тема), hero-header-audit (защо Пулс ★★★,
  Гранит ★). CLAUDE-frontend.md сочи новата папка. `pnpm check` зелен.

- **2026-07-05 (следобед)** — **Тотален редизайн на storefront
  секциите (Фази 0–5 + дизайн адаптации).** Спец:
  `docs/superpowers/specs/2026-07-05-storefront-sections-redesign.md`.
  (0) 6 нови `--sf-*` токена: `on-primary`/`on-accent` (ИЗЧИСЛЕНИ от
  потребителския цвят — WCAG, `src/lib/contrast.ts`), `surface-raised`,
  `shadow` (тъмните теми: бордер вместо сянка), `overlay`; SectionShell с
  kicker + clamp заглавия + автоматично редуване bg/surface (`renderSections`);
  продуктова карта 4:5 + hover втора снимка + −% badge + име·цена на един ред.
  (1) Hero 80–88svh edge-to-edge + kicker „категория · град" + CSS slideshow.
  (2) Featured адаптивен: 1→spotlight, 5→асиметрия (голяма+2×2), 2/3/4/6→равни
  редове, 7+→карусел (`carousel.tsx`, scroll-snap без библиотека).
  (3) Категории: пълноширинна мозайка със снимки от продуктите
  (`getCategoryCovers` — брои и подкатегориите към родителя), 5 layout-а по брой.
  (4) Промо: плътен primary + огромно заглавие + dashed „купон" CTA; отзиви:
  тъмна инверсия (`bg---sf-text`) + златни кавички + звезди; trust: плочки.
  (5) Image-text edge-to-edge; галерия masonry + lightbox (`<dialog>`);
  контакти label/value таблица; footer тъмен богат; header: категориите в
  навигацията (при ≤4). Дизайн еталон: Claude design HTML
  (`claude-design/…standalone.html`) — одобрен от собственика; решение:
  асиметрия до 6, карусел за 7+. `pnpm check` зелен (128 теста).
  ⚠️ Некомитнато — чака визуален тест на собственика. Гоча ×2 тази сесия:
  EMAXCONN от dev hot-reload → рестарт на dev преди build.

- **2026-07-05 (следобед)** — **Дизайн skills одит + инсталация.** Ресърч
  (skills.sh + Snyk + Superdesign ревюта 07.2026): №1 = Anthropic
  `frontend-design` (626K инсталации, вече като плъгин), №1 по данни =
  `ui-ux-pro-max` (250K; 161 палитри, 99 UX правила, 31 CSV). Инсталиран
  ui-ux-pro-max в `~/.claude/skills/`; изтрити всички други дизайнерски
  skills (3d-web-experience, threejs, interior-design, fal-tryon + 6-те
  странични от пакета). **НОВО ПРАВИЛО** (в CLAUDE-frontend.md): преди
  всяка дизайн промяна се четат `docs/design/skill-frontend-design.md` +
  `docs/design/skill-ui-ux-pro-max.md`.

- **2026-07-05 (обед) · `8c2df58`** — **Уебсайт билдър: истинска чернова.**
  „Запази" пише само в draft (само собственикът вижда); нов бутон
  „Публикувай промените" (draft→settings, клиентите виждат); „Публикувай/
  Скрий магазина" преименувани; badges „На живо/Скрит/Непубликувани промени".
  Попътно: 🎉/↗/🏷 → икони (+`external-link` в icon.tsx); дефолтните
  storefront цветове зелено `#178150` → неутрален графит `#1f2937`/`#b45309`
  (fallback до wizard-а). e2e обновен.

- **2026-07-05 · `f9c3b2d`** — **9 storefront теми (вкл. 3 тъмни).** Разширени от 3 на 9,
  всяка с вертикално предназначение: Класическа, Ателие (топла/занаяти), Витрина
  (image-first/мода), Пулс (тъмна/младежко), Ефир (wellness/козметика), Оникс (ТЪМНА
  premium/бижута), Сигнал (техника), Основа (индустриална/строителни), Гранит (ТЪМНА
  индустриална). **Тъмните са отделни теми, не превключвател** (решение от брейнсторм).
  Добавени: `THEME_META` (усещане/за кого/isDark — за wizard preview), `CATEGORY_THEME_
  RECOMMENDATIONS` (категория→2-3 теми) + `recommendedThemesFor()`, `BusinessCategory`
  тип. Нови шрифтове: Playfair Display (Оникс) + Oswald кондензиран (Основа/Гранит).
  ThemePanel вече показва 9 групирани светли/тъмни. Storefront секциите непроменени
  (четат само `--sf-*`). 128 unit теста. Спец+план+проучване:
  `docs/superpowers/specs/2026-07-05-storefront-themes-catalog-design.md`,
  `docs/superpowers/plans/2026-07-05-storefront-themes-catalog.md`,
  `docs/research/2026-07-05-ecommerce-design-research.md`. ⚠️ **Визуалният pass на
  9-те теми × секции чака преглед от собственика** (базата е празна — създай магазин).

- **2026-07-05** — **Onboarding/теми стратегия — 4 спека (посока, не изпълнение).**
  Обсъдена цялата визия за нов търговец: (1) setup wizard хибрид (3 задължителни →
  готов сайт → 3 опц. бонус; типът магазин вече известен от `businessCategory`; „уау"
  екран); (2) каталог 9 теми (горе); (3) **варианти на секциите** — всяка секция 2
  layout варианта (основен+алт), dropdown избор, ново поле `variant` в base (default
  primary); (4) e-commerce проучване база. Ред на изпълнение: теми → варианти →
  стартови набори секции → wizard UI. Спекове в `docs/superpowers/specs/2026-07-05-*`.

- **2026-07-05** — **⚠️ Базата изчистена НАПЪЛНО** (по изрична заявка — всичко беше
  seed/тестове). Изтрити всички 17 магазина + 20 профила + 20 auth акаунта (вкл.
  собствените логини) + всички storage файлове. **Последица:** landing/каталог няма
  демо магазини — пусни `node scripts/seed-demo-shops.mjs` при нужда. Собственикът се
  регистрира наново.

- **2026-07-04 · `2378545`** — **Full-screen уебсайт билдър + welcome модал.** Редакторът
  на магазина (таб „Уебсайт") вече заема целия екран вместо да е притиснат в dashboard
  контейнера. Изнесен в собствена route група `(builder)/dashboard/website` без dashboard
  header/sidebar (URL остава `/dashboard/website`; guard в page чрез `requireShop()`). Нов
  layout: топ-бар (← Табло, име, статус, Публикувай/Запази) + ляв панел 380px с **3 таба**
  (Тема/Секции/За нас) + голяма preview зона; на телефон 4-ти таб „Преглед" показва iframe-а
  на цял екран. Welcome intro модал (`website-intro-modal.tsx`) при всяко влизане (localStorage
  „не показвай повече"): билдърът е за десктоп + done-for-you настройка през
  **supportfrizmo@gmail.com**. Попътно: **всички емоджита в билдъра → `<Icon>`** (правило
  без емоджита в платформения UI) — +16 нови икони в `icon.tsx` (секционни + grip/monitor/
  smartphone/sparkles), Modal close бутонът също. Данните/мутациите непроменени. Спец+план:
  `docs/superpowers/{specs,plans}/2026-07-04-website-builder-fullscreen*.md`. Гейт зелен
  (119 unit теста). ⚠️ Гоча при build: dev сървър на порт 3000 беше натрупал 195 DB конекции
  (dev hot-reload leak) → изчерпан Supabase pooler (limit 200) → `EMAXCONN` при prerender.
  Фикс: спри dev сървъра преди build (освобождава конекциите), после рестартирай.

- **2026-07-04** — **Post-MVP стратегически roadmap** (посока, не изпълнение):
  `docs/superpowers/specs/2026-07-04-post-mvp-roadmap.md`. 6 теми от реалния опит на
  собственика: §1 плащания на абонаменти (Epay+банков хибрид+Stripe, абстрактен
  PaymentProvider), §2 куриери (Econt/Speedy, фазово office-picker→tracking), §3
  наличности (§3a race fix — коректностен бъг! + §3b Supabase Realtime live),
  §4 известия (камбана+история+live), §5 клиентска част (guest остава, акаунти фазово),
  §6 housekeeping cron (orphan снимки, rate_limits, мъртви push, стари магазини).
  Всяка тема → собствен спец+план преди изпълнение.

- **2026-07-04** — **Цени 20/35 → 10/20 € (Starter/Pro).** Бизнес решение: „разумно
  евтино" за растеж на BG пазара (устойчиво, без болезнено вдигане скоро; вместо
  агресивните 5/10). Сменено навсякъде: `src/lib/plans-content.ts` (централен източник
  → landing), JSON-LD offer в landing (`price: "10"`), 2 блог статии („от 10 € на месец").
  Легалните документи говорят общо („месечен абонамент според избрания план" — без числа),
  затова остават валидни. Doc референции (CLAUDE.md, roadmap) обновени.

- **2026-07-04** — **PWA install секция + инструкции modal.** Landing секция „Frizmo
  винаги под ръка" (ползи + телефон визуал + бутон „Как да инсталирам") → цялоекранен
  modal с точни per-платформа/браузър стъпки (`src/lib/pwa-platform.ts`, unit-тестван:
  iOS Safari/не-Safari, Android Chrome/Samsung/Firefox, Desktop). Ръчен превключвател
  при грешна детекция. Секция вместо банер — избягва overlap с cookie банера. Съзнателно
  без native `beforeinstallprompt` (капризен) — само ръчни стъпки. Спец+план:
  `docs/superpowers/specs/2026-07-04-pwa-install-guide-design.md`,
  `docs/superpowers/plans/2026-07-04-pwa-install-guide.md`.

- **2026-07-04 · `9d8b8d4`** — **PWA splash / welcome анимация** (финализиран след
  тест на телефон: landing-мигане, статично видео на iOS, изрязване, lockup). Финалният
  вид: маскот видео в работилница + лого + „Frizmo **Shops**" (ember акцент) + „Старт"
  бутон; tap-to-skip; reduced-motion → статичен постер; iOS faststart фикс. Пълните
  детайли в записа по-долу + `docs/design/mascot-progress.md`.

- **2026-07-04** — **PWA splash / welcome анимация.** Нов `PwaSplash` компонент
  (`src/components/pwa-splash.tsx`), монтиран в root layout. Показва се САМО в standalone
  PWA (не в браузър таб — `display-mode: standalone` / iOS `navigator.standalone`), при
  всеки студен старт; **tap-to-skip** (клик затваря веднага), auto-dismiss при край на
  видеото или `MAX_MS=3.6s` предпазен таймер. Видео loop на маскота (Seedance 2.0, старт
  frame = одобрена работилница-сцена) + анимиран CSS wordmark „Frizmo Shops" (rise+fade)
  върху празното горе. **Звук:** тих по подразбиране (autoplay policy), пуска мелодийката
  на СЛЕДВАЩИЯ старт след първо взаимодействие (`localStorage frizmo-audio-ok`); fade-out
  при излизане. Reduced-motion → статичен постер вместо видео. iOS native splash преди
  React през `appleWebApp.startupImage`. Нови keyframes в globals.css (`splash-word`,
  `splash-out`). **Асети (Magnific, ~1.7MB общо в public/):** `splash-bee.mp4` (видео,
  1.4MB), `splash-bee-poster.jpg` (80KB, компресиран от 4.6MB PNG през headless Chromium
  — няма ffmpeg на тази машина), `splash-welcome.mp3` (240KB, ElevenLabs music v2, топла
  marimba). Сцена/постер = Nano Banana Pro 9:16 с `bee-wave.png` като референция (пчела-
  майстор в престилка). `pnpm check` зелен. Само dev (main по заявка).

- **2026-07-04** — **Мобилен UX за редактор на продукт (телефон тест 3).** `7d816ef`.
  ImageUploader: контролите триене/пренареждане винаги видими на тъч (не само hover),
  SVG икони; VariantsTable: mobile карти под md (таблицата не се събираше на 375px);
  OptionsEditor: SVG `x` вместо емоджи; ProductForm: футер бутоните в отделна карта.
  dev + main.

- **2026-07-04** — **Loading states + dashboard фиксове (телефон тест 2).** (1) Таблото:
  редът „последни поръчки" се чупеше на телефон (badge+сума извън контейнера) → преработен
  на 2-редов stack (номер+име горе, badge+дата долу, сума фиксирана вдясно `shrink-0`);
  `Badge` получи `shrink-0 whitespace-nowrap`. (2) Категории „премести нагоре/надолу"
  всъщност работеше (потвърдено в базата) — липсваше визуален feedback → сега spinner на
  бутона. (3+общо) **Loading states** навсякъде: `Button loading` вече замества съдържанието
  само със spinner (важи и за icon-only); per-item pending state в `categories-manager`
  (move), `fulfillment-manager` (eye toggle, `run(id, action)`), `product-list` (status
  toggle → opacity+disabled). (4) Навигация към страници без индикатор → добавени
  `loading.tsx` skeleton-и за **orders, orders/[id], categories, fulfillment**. `pnpm check`
  зелен (106 теста). Уебсайт билдър НЕ пипан.

- **2026-07-04** — **Dashboard мобилен UX пакет (6 проблема от тест на телефон).**
  (1) Мобилна навигация: `DashboardNav` → бутон „☰ текуща страница" отваря **fullscreen
  меню** (< md); десктоп = вертикална навигация. (2) Продукти/поръчки: **карти на
  мобилно** (`md:hidden`), таблица на десктоп (`hidden md:block`; `Table` вече приема
  className). (3+общо) **`ui/select.tsx` пренаписан като брандов custom dropdown**
  (панел като TimeSelect, затваря отвън/Escape, клавиатура, достъпен) — заменя грозния
  native select навсякъде вкл. iPhone. ⚠️ Запазен **event-съвместим API**
  (`onChange` подава `{target:{value}}`) → нито един от 11-те callers не се пипа;
  поддържа и controlled (dashboard) и uncontrolled `defaultValue`+`name` (каталог форми).
  6-те e2e `.selectOption()` мигрирани през нов `e2e/helpers.ts` (`selectOption` кликва
  тригер+опция). (4) Поръчки: pill филтри → dropdown (`OrderStatusFilter`); **6 фалшиви
  поръчки** (всички статуси) чрез `scripts/seed-my-orders.mjs`. (5+6) **Всички емоджи
  икони → SVG** (pencil/trash/arrow-up/down/eye/eye-off/image/receipt/palette в icon.tsx);
  `EmptyState.icon` вече е `IconName`, не емоджи. Стрелките в категории = „премести
  нагоре/надолу". `pnpm check` зелен (106 теста). Уебсайт билдър НЕ пипан (по заявка).

- **2026-07-04** — **Dashboard/onboarding UX пакет + slug втвърдяване + responsive фикс.**
  (1) Theme toggle: емоджи ☀️/🌙 → SVG икони (sun/moon в icon.tsx) с morph преход.
  (2) Onboarding: create вече е **3-стъпков wizard** (`shop-wizard.tsx`: Основно* →
  Контакти → Работно време; само стъпка 1 задължителна). Външният индикатор стана
  **progress лента** (`onboarding-progress.tsx`), вътрешен 3-точков в wizard-а.
  ⚠️ e2e/React гоча: клик на „Напред" насред re-render задействаше нативен submit →
  фикс с `onSubmit` guard (`if(!isLast) preventDefault`) + различни `key` на бутоните.
  (3) Работно време: опростено (Пон–Пет един ред + Съб + Нед) с toggle „Различно време
  по дни"; часовете са **24ч custom `<TimeSelect>`** (`ui/time-select.tsx`) вместо
  native `<input type=time>` (показваше AM/PM по локал). (4) Slug/URL: retry при
  UNIQUE race (`insertShopWithUniqueSlug`, Postgres 23505) + live preview на адреса на
  blur в onboarding + замразен URL показан read-only в edit. (5) Onboarding продуктова
  форма (simple): скрита „Категория" (още няма категории). (6) **Табло редизайн**:
  компактни `<StatTile>` KPI + „Последни поръчки" + „Следващи стъпки"; dashboard
  контейнер `max-w-6xl` → `max-w-7xl`. (7) Responsive одит на всички 8 dashboard
  страници на 375px (влязъл в реален магазин) → всички чисти, **освен таб „Уебсайт"**
  (грид не се свиваше) → фикс с `min-w-0` + theme picker `grid-cols-2 sm:grid-cols-3`.
  `pnpm check` зелен (105 теста), store-products e2e 2/2. Seed скрипт за личния магазин:
  `scripts/seed-my-shop.mjs` (таргет по slug + owner email проверка; НЕ пипа site_settings).

- **2026-07-04** — **Dashboard welcome + видео пчела + onboarding редизайн** (продължение
  на маскота). Празното табло → „момент на посрещане" (пчела + 3-стъпкова карта + CTA).
  Пчелата е видео loop в кръгъл медальон (Kling image→video, обработено с ffmpeg до
  ~90–150KB WebM/MP4). Onboarding редизайниран (маскот-водач + editorial progress).
  Всичко в light+dark, e2e селектори пазени. **Изисква ffmpeg** (инсталиран локално през
  brew — нужен и за бъдещи маскот видеа). Детайли: `docs/design/mascot-progress.md`.
  ⚠️ Ново решение: маскот видео пайплайн (Kling → ffmpeg изрязване → нативен loop);
  frame-by-frame и crossfade подходите отхвърлени. **НЕ commit-нато още.**

- **2026-07-04** — **Брандов маскот + auth редизайн.** Създаден маскот: clay пчела
  (идея „работлив като пчела" + занаятчийско ателие), теракота палитра, за системна
  употреба (auth, onboarding, empty states, грешки, имейли). **Заключен като Magnific
  character асет `frizmo-bee-mascot`, id 2001559** — консистентност през character
  референция вместо пресъздаване. Две пози в UI (`public/bee-wave.png` маха,
  `public/bee-peek.png` закрива очи). **Auth (login/register) цялостно редизайниран:**
  split екран (форма + брандов теракота панел с маскота), editorial типография,
  glow+noise; интеракция — фокус в паролата → пчелата закрива очи. e2e селектори
  запазени. `pnpm check` зелен (99/99 теста). Жив прогрес файл на маскота:
  **`docs/design/mascot-progress.md`** (чети него при продължаване). Style prompt:
  `docs/design/asset-prompts.md`; 2k оригинали: `docs/design/mascot-source/`.
  ⚠️ `mascot-refs/` (в корена на монорепото, извън frizmo-shops) е локална папка с
  изходните ChatGPT PNG-та — извън git. Пчелата е в Magnific акаунта (id 2001559),
  достъпна от всяка машина без локалния файл.

- **2026-07-04 · `ced7e55`** — Създаден `main` production branch (идентичен на `dev`). Обновени CLAUDE.md/roadmap/памет + този WORKLOG. Преди това: редизайн на `/shops`, `/products`, `/blog` (+ 3 нови блог статии), фикс dark mode да е само за dashboard/admin, rich OG image, PWA service worker глобално. Всичко на dev + main.
