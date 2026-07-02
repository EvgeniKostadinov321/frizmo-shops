# Plan 5: Каталог, Landing, Блог, SEO + Визуален pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Inline режим). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Платформата става откриваема и продаваща: публичен каталог с магазини и продукти (full-text търсене + филтри), силна landing страница с живи демо магазини, MDX блог за SEO, правни страници + cookie consent — и визуалният pass, който прави всичко красиво (отчетливи теми, нова палитра, типография, dark mode toggle).

**Architecture:** Търсенето е Postgres full-text (`pg_trgm` GIN индекси — без външни услуги). Каталозите са SSR страници върху вече публикуваните магазини. Landing-ът е статичен (компоненти в `marketing/`), блогът е MDX файлове в `content/blog/`. Визуалният pass променя САМО стойности (tokens.css, THEME_PRESETS, шрифтове) + полира секционните компоненти — архитектурата остава.

**Tech Stack:** наличният + `@next/mdx` (+ gray-matter за frontmatter листинг) + 2 нови Google шрифта през `next/font`.

---

## Ключови решения

1. **Търсене**: `pg_trgm` extension + GIN индекси върху `products.name`, `shops.name/description` — ILIKE заявките стават бързи и толерантни. Extension-ът се създава от еднократен скрипт (`scripts/setup-search.mjs`), не от drizzle.
2. **Каталог /products** (крос-магазинен): търсене + филтър по бизнес категория на магазина + „само промоции" + пагинация. Продуктовата карта показва и името на магазина. Без крос-магазинен ценови филтър в MVP (различни ниши = несравними цени).
3. **Каталог /shops**: карти (лого, име, описание, категория, град) + търсене + филтри категория/град (градовете — distinct от published магазини).
4. **Landing hero визуал**: стилизиран „браузър прозорец" с мини-витрина, изграден с CSS (без скрийншоти — не остаряват, теглят се бързо, винаги в бранд цветовете).
5. **Демо магазини**: 3 реални акаунта (`demo+{niche}@frizmoshops.bg` с random парола) + published магазини в ниши храни / ръчна изработка / козметика, сийднати от разширения seed скрипт. Landing-ът линква към тях; каталогът не е празен.
6. **Блог**: MDX файлове; листинг чете frontmatter (title, description, date, slug); 2 стартови статии: „Как да продаваш онлайн без сайт и програмист" и „Наложен платеж, връщане и ЗЗП: какво трябва да знае всеки онлайн търговец".
7. **Cookie consent**: информативен банер (ползваме само строго необходими cookies — auth сесия; няма analytics) с „Разбрах" + линк към /privacy; localStorage персистенция.
8. **Визуален pass — обхватът е backlog-ът** (docs/visual-polish-backlog.md):
   - Теми: различни шрифтови двойки (classic: Inter; modern: Space Grotesk; warm: Lora за заглавия) + по-смели разлики в радиуси/повърхности; тъмни щрихи в modern.
   - Курирани цветови presets (6 комбинации primary+accent) в theme panel-а, вместо само color picker.
   - Нова дефолтна палитра на платформата (по-плътно зелено, по-топли неутрални) — само стойности в tokens.css.
   - Секциите: hero полировка (типографска скала, отстояния, по-добър overlay), консистентни section paddings, hover преходи, продуктова карта.
   - **Dark mode toggle** в dashboard header-а (🌙/☀️): localStorage + `prefers-color-scheme` + инлайн скрипт срещу FOUC (изпълнява ADR-а).
9. **Sitemap**: генериран от published магазини + активните им продукти + блог статиите; продуктите на draft магазини не влизат.

---

### Task 1: Търсене (pg_trgm) + каталожни заявки
- `scripts/setup-search.mjs`: `create extension if not exists pg_trgm` + GIN индекси (`products_name_trgm`, `shops_name_trgm`) — script `search:setup`, изпълнява се веднъж.
- `src/db/queries/catalog.ts`: `searchShops({ search, category, city, page })` (само published), `searchCatalogProducts({ search, category, promoOnly, page })` (join shops, само published+active, връща продукт + shop name/slug), `getShopCities()`, брой резултати за пагинация.
- Commit.

### Task 2: Каталог страници
- `(catalog)/shops/page.tsx`: header с търсачка, филтри (Select категория, Select град), grid от ShopCard (`marketing/shop-card.tsx`: лого/инициал, име, категория Badge, град, описание 2 реда, „Разгледай"), пагинация, EmptyState.
- `(catalog)/products/page.tsx`: търсачка + категория + „само промоции" toggle, grid от CatalogProductCard (снимка, име, цена/промо, име на магазина → линк), пагинация.
- Платформен header за (marketing)+(catalog) група: лого Frizmo Shops, линкове Магазини/Продукти/Блог/Цени, CTA „Създай магазин" (`marketing/site-header.tsx` + `site-footer.tsx` с правните линкове).
- SEO metadata и за двете. Commit.

### Task 3: Landing (7 секции по спец §11)
`(marketing)/page.tsx` + `marketing/` компоненти: Hero („Твоят онлайн магазин. Готов днес. Без програмист." + CSS browser-mockup визуал), Болката (3 карти: Facebook хаос → изгубени поръчки → без видимост), Как работи (3 стъпки), Витрина (3-те демо магазина — живи линкове + мини-описания), Функции (3 редуващи се блока със стилизирани визуали), Цени (Starter/Pro сравнителна таблица от една константа `src/lib/plans-content.ts`, „14 дни безплатно, без карта"), FAQ (5 въпроса, същия акордеон патърн), финален CTA. JSON-LD `SoftwareApplication`. Commit.

### Task 4: Блог (MDX)
- `pnpm add @next/mdx @mdx-js/loader @mdx-js/react gray-matter`; next.config mdx настройка.
- `src/lib/blog.ts`: чете `content/blog/*.mdx` frontmatter (fs при build); `(marketing)/blog/page.tsx` листинг; `(marketing)/blog/[slug]/page.tsx` рендер (dynamic import на MDX) + typography стилове (prose-подобни класове с токени, без плъгин).
- 2 пълни статии (800+ думи всяка, реално полезни, с вътрешни линкове към landing/цени).
- Commit.

### Task 5: Правни страници + cookie consent
- `src/lib/platform-legal.ts` + `(marketing)/terms/page.tsx`, `(marketing)/privacy/page.tsx` — условия за ползване на платформата (SaaS отношение търговец↔Frizmo Shops) и поверителност (какви данни, Supabase/Vercel/Resend като обработващи).
- `CookieConsent` client компонент в root layout: банер долу, „Разбрах" + линк, localStorage.
- Commit.

### Task 6: Демо магазини
- `scripts/seed-demo-shops.mjs`: създава 3 акаунта през Supabase Admin API (`admin.auth.admin.createUser`, email_confirm: true) + profiles + published магазини + категории/продукти/настройки per ниша (Unsplash снимки, проверени URL-и) + fulfillment дефолти. Ниши: „Ферма Зелена долина" (храни), „Ателие Ръчичка" (ръчна изработка), „Глоу Козметика". Идемпотентен (по slug).
- Landing витрината чете същите slug-ове (константа `DEMO_SHOP_SLUGS`).
- Run + commit.

### Task 7: Визуален pass (backlog-ът)
- Шрифтове: Space Grotesk + Lora през next/font в root layout (variables); THEME_PRESETS добива `--sf-font-heading`/`--sf-font-body` + отчетливи стойности; storefront компонентите ползват font променливите (замяна на fontWeight хака).
- 6 курирани палитри в theme panel (swatch бутони) + запазен custom picker.
- tokens.css: нова платформена палитра (+ dark стойностите съответно).
- Полировка: hero (3-те layout-а), секционни paddings/типография, ProductCard hover, storefront header/footer, checkout/cart четимост, landing консистентност.
- **Dark mode toggle**: `ThemeToggle` в dashboard header + inline anti-FOUC скрипт в root layout + localStorage/system fallback.
- Визуална проверка на 3-те теми × мобилно/десктоп през Playwright screenshots (ръчен преглед). Commit-и по стъпки.

### Task 8: SEO инфраструктура
- `src/app/sitemap.ts` (landing, каталози, блог, published магазини + активни продукти), `src/app/robots.ts` (disallow /dashboard, /admin, /auth), дефолтен OG image (генериран 1200×630 PNG със System.Drawing — бранд фон + текст), `metadataBase`. Commit.

### Task 9: e2e + гейт + deploy
- `e2e/catalog.spec.ts`: каталогът намира демо магазин по търсене; продуктовият каталог филтрира по промоции; landing рендерира с CTA; блог статия се отваря; cookie банерът се затваря.
- Пълен suite + `pnpm check`; push; preview проверка; ✅ в roadmap; изчистване на визуалния backlog файл (изпълнените точки).

---

## Definition of Done (План 5)
- [ ] Купувач намира магазини/продукти през каталозите с търсене и филтри
- [ ] Landing-ът продава: hero, болка, стъпки, живи демота, цени, FAQ, CTA
- [ ] 3 демо магазина published с пълно съдържание; каталогът не е празен
- [ ] Блогът има 2 статии; sitemap/robots/OG работят
- [ ] Правни страници + cookie consent (EU)
- [ ] Трите теми са визуално отчетливи; курирани палитри; dark mode toggle в dashboard-а
- [ ] `pnpm check` + пълен e2e зелени; preview deploy проверен
