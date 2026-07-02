# Plan 3: Публичен магазин — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Inline режим). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Всеки магазин получава публичен, красив, SEO-готов сайт на `/s/{slug}` — начална страница от подреждаеми секции, продуктов каталог с variant picker, страници За нас/Контакти/Условия — плюс таб „Уебсайт" с drag & drop редактор, live preview и публикуване.

**Architecture:** Настройките на сайта живеят в нова таблица `site_settings` (JSON, валидиран от Zod `SiteSettings`). Всяка секция = Zod схема + server component, вързани в регистър. Темите са набори CSS variables (`--sf-*`), излети на storefront wrapper-а — един компонент рендерира всички теми. Публичните страници са SSR с кеширане и `revalidatePath` при промяна; draft магазин е видим само за собственика си (сесийна проверка, без токени). Редакторът държи настройките клиентски и ги стрийм-ва към iframe preview през `postMessage`; Save персистира; Publish сменя статуса.

**Tech Stack:** наличният + `@dnd-kit/core` + `@dnd-kit/sortable` (подредба на секции).

---

## Ключови решения

1. **Draft видимост без токени**: публичните route-ове на draft магазин викат `getOwnShop()`-подобна проверка — рендерират само ако текущата сесия е собственикът; иначе `notFound()`. Просто, сигурно, работи и за iframe preview-то.
2. **„Свободен текст" = многоредов plain text** (параграфи при рендер). Без HTML/Markdown от потребителя в MVP — нула XSS повърхност. Bold/списъци — бъдещо надграждане.
3. **Без количка в План 3**: продуктовата страница показва цена/варианти/наличност, но CTA „Добави в количката" идва в План 4 (там е количката). Storefront-ът в План 3 е пълноценна витрина + контакти.
4. **Кеширане**: публичните страници са динамични (SSR) с `revalidatePath` върху `/s/[slug]` дървото при: save на настройки, publish, промяна на продукт/категория (добавя се в съществуващите actions). Пълно ISR-кеширане с `"use cache"` се отлага — първо коректност.
5. **Всички 13 секции са включени за всички** (trial = Pro до План 6); `planTier` полето в регистъра ги маркира за бъдещия гейт.
6. **Лого**: качва се в таб „Уебсайт" (upload действие като продуктовите снимки, пътека `shops/{shopId}/branding/`).
7. **Секциите имат стабилни `id`** (uuid, генериран клиентски при добавяне) — ключове за dnd и postMessage диффове.
8. **Публикуване**: изисква ≥1 активен продукт; сваляне обратно в draft е позволено (бутон „Скрий магазина").

---

### Task 1: Схема и SiteSettings домейн

**Files:**
- Modify: `src/db/schema.ts` (нова таблица `site_settings`)
- Create: `src/schemas/site-settings.ts`, `src/lib/sections.ts` (регистър), `src/lib/sections.test.ts`

- [ ] **Step 1: Таблица** — `site_settings`: `id`, `shopId` (unique FK cascade), `settings` jsonb (целият SiteSettings обект), **`draft` jsonb nullable** (незапазените промени за live preview — Task 7), `createdAt/updatedAt`. `.enableRLS()`. `pnpm db:push`. (Едно jsonb поле вместо колона-по-настройка: настройките винаги се четат/пишат като цяло и Zod е валидаторът.)

- [ ] **Step 2: Zod схеми** (`src/schemas/site-settings.ts`) — дискриминиран union по `type` за 13-те секции:

```ts
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Невалиден цвят");
const shortText = (max: number) => z.string().trim().max(max).default("");

/* Всяка секция: { id, type, enabled, data } */
const base = { id: z.uuid(), enabled: z.boolean().default(true) };

export const sectionSchemas = {
  hero: z.object({ ...base, type: z.literal("hero"), data: z.object({
    layout: z.enum(["full", "split", "slideshow"]).default("full"),
    title: shortText(120), subtitle: shortText(200), ctaLabel: shortText(40),
    ctaHref: shortText(300), imagePaths: z.array(z.string().max(300)).max(5).default([]),
  }) }),
  announcement: z.object({ ...base, type: z.literal("announcement"), data: z.object({
    text: shortText(120), href: shortText(300),
  }) }),
  "featured-products": z.object({ ...base, type: z.literal("featured-products"), data: z.object({
    title: shortText(80), mode: z.enum(["manual", "newest", "promo"]).default("newest"),
    productIds: z.array(z.uuid()).max(8).default([]),
  }) }),
  "category-grid": z.object({ ...base, type: z.literal("category-grid"), data: z.object({
    title: shortText(80), categoryIds: z.array(z.uuid()).max(8).default([]),
  }) }),
  "promo-banner": z.object({ ...base, type: z.literal("promo-banner"), data: z.object({
    title: shortText(100), text: shortText(200), ctaLabel: shortText(40),
    ctaHref: shortText(300), imagePath: z.string().max(300).default(""),
  }) }),
  "image-text": z.object({ ...base, type: z.literal("image-text"), data: z.object({
    title: shortText(100), text: shortText(2000), imagePath: z.string().max(300).default(""),
    imageSide: z.enum(["left", "right"]).default("left"),
  }) }),
  "rich-text": z.object({ ...base, type: z.literal("rich-text"), data: z.object({
    title: shortText(100), text: shortText(5000),
  }) }),
  testimonials: z.object({ ...base, type: z.literal("testimonials"), data: z.object({
    title: shortText(80),
    items: z.array(z.object({ name: shortText(60), text: shortText(400) })).max(10).default([]),
  }) }),
  "trust-badges": z.object({ ...base, type: z.literal("trust-badges"), data: z.object({
    items: z.array(z.object({ icon: z.enum(["truck", "shield", "return", "phone", "leaf", "star"]), text: shortText(60) })).max(6).default([]),
  }) }),
  gallery: z.object({ ...base, type: z.literal("gallery"), data: z.object({
    title: shortText(80), imagePaths: z.array(z.string().max(300)).max(12).default([]),
  }) }),
  faq: z.object({ ...base, type: z.literal("faq"), data: z.object({
    title: shortText(80),
    items: z.array(z.object({ question: shortText(200), answer: shortText(1000) })).max(15).default([]),
  }) }),
  "contact-map": z.object({ ...base, type: z.literal("contact-map"), data: z.object({
    title: shortText(80), showMap: z.boolean().default(true),
  }) }),
  socials: z.object({ ...base, type: z.literal("socials"), data: z.object({
    title: shortText(80),
  }) }),
} as const;

export const sectionSchema = z.discriminatedUnion("type", [
  sectionSchemas.hero, sectionSchemas.announcement, sectionSchemas["featured-products"],
  sectionSchemas["category-grid"], sectionSchemas["promo-banner"], sectionSchemas["image-text"],
  sectionSchemas["rich-text"], sectionSchemas.testimonials, sectionSchemas["trust-badges"],
  sectionSchemas.gallery, sectionSchemas.faq, sectionSchemas["contact-map"], sectionSchemas.socials,
]);

export const THEMES = ["classic", "modern", "warm"] as const;

export const siteSettingsSchema = z.object({
  theme: z.enum(THEMES).default("classic"),
  primaryColor: hexColor.default("#178150"),
  accentColor: hexColor.default("#c98a1b"),
  headerLayout: z.enum(["logo-left", "logo-center"]).default("logo-left"),
  footerText: shortText(300),
  aboutText: shortText(5000),
  aboutImagePaths: z.array(z.string().max(300)).max(4).default([]),
  sections: z.array(sectionSchema).max(20).default([]),
});

export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
```

- [ ] **Step 3: Регистър** (`src/lib/sections.ts`): `SECTION_DEFS: Record<SectionType, { label, icon (emoji), planTier: "starter"|"pro", defaultData }>` + `defaultSections(shopName)` — начален набор при първо отваряне: hero (заглавие = името на магазина), featured-products (newest), contact-map. + `newSection(type)` — фабрика с uuid. Тестове: всеки тип от регистъра минава през своята Zod схема; `defaultSections` са валидни.

- [ ] **Step 4:** Query + upsert хелпър `src/db/queries/site-settings.ts`: `getSiteSettings(shopId)` → merge на съхраненото с дефолтите (tolerant parse — невалидна секция се изпуска, не чупи сайта); `upsertSiteSettings(shopId, settings)`.

- [ ] **Step 5:** Commit.

---

### Task 2: Тема система (CSS variables) + storefront shell

**Files:**
- Create: `src/lib/themes.ts`, `src/components/storefront/theme-style.tsx`
- Create: `src/app/(storefront)/s/[slug]/layout.tsx`, `not-found.tsx`
- Create: `src/components/storefront/header.tsx`, `footer.tsx`
- Create: `src/db/queries/storefront.ts`

- [ ] **Step 1: `src/lib/themes.ts`** — 3-те теми като стойности за `--sf-*` променливи:

```ts
export interface ThemeVars {
  "--sf-bg": string; "--sf-surface": string; "--sf-text": string; "--sf-muted": string;
  "--sf-border": string; "--sf-radius": string; "--sf-heading-weight": string;
}
export const THEME_PRESETS: Record<"classic" | "modern" | "warm", ThemeVars> = {
  classic: { "--sf-bg": "#ffffff", "--sf-surface": "#f7f7f7", "--sf-text": "#1c1c1c", "--sf-muted": "#6b6b6b", "--sf-border": "#e5e5e5", "--sf-radius": "0.5rem", "--sf-heading-weight": "700" },
  modern:  { "--sf-bg": "#fafafa", "--sf-surface": "#ffffff", "--sf-text": "#111111", "--sf-muted": "#555555", "--sf-border": "#dddddd", "--sf-radius": "1rem",  "--sf-heading-weight": "800" },
  warm:    { "--sf-bg": "#fdf9f3", "--sf-surface": "#ffffff", "--sf-text": "#2b2115", "--sf-muted": "#7a6a55", "--sf-border": "#eadfce", "--sf-radius": "0.75rem", "--sf-heading-weight": "700" },
};
export function themeStyle(settings: { theme, primaryColor, accentColor }): React.CSSProperties {
  return { ...THEME_PRESETS[settings.theme], "--sf-primary": settings.primaryColor, "--sf-accent": settings.accentColor } as React.CSSProperties;
}
```

Storefront компонентите ползват САМО `--sf-*` през Tailwind 4 канон синтаксиса за CSS променливи (`bg-(--sf-bg)`, `text-(--sf-primary)`) — темата е изцяло данни. (Изключение от „без hardcoded стойности": THEME_PRESETS *е* дефиницията на темите — техният tokens.css.)

- [ ] **Step 2: Storefront достъп** (`src/db/queries/storefront.ts`): `getPublicShop(slug)` → shop + settings; ако `status !== "published"` → връща shop само ако текущият user е owner (`viewerIsOwner` флаг), иначе null. `getActiveProducts(shopId, { категория, търсене, page })`, `getActiveProduct(shopId, productSlug)` (+ variants/options/attributes), `getRelatedProducts`.

- [ ] **Step 3: Layout** `/s/[slug]/layout.tsx`: `getPublicShop` → notFound при null; wrapper `<div style={themeStyle(...)} class="bg-(--sf-bg) text-(--sf-text) min-h-screen flex flex-col">`; `<StorefrontHeader>` (лого/име, навигация: Начало · Продукти · За нас · Контакти, header layout вариант) + `{children}` + `<StorefrontFooter>` (контакти, работно време — форматирано от `WorkingDay[]`, соц. линкове, линк към условията, "Създадено с Frizmo Shops"). Draft банер за собственика: „Виждаш чернова — само ти я виждаш" + LinkButton към /dashboard/website.
- Мобилно меню: header-ът е прост (4 линка) → horizontal scroll на мобилно, без hamburger в MVP.

- [ ] **Step 4:** `formatWorkingHours(days)` хелпър в `src/lib/working-hours.ts` — групира последователни дни с еднакви часове („Пон–Пет: 9:00–18:00, Съб: почивен…"). + unit тест.

- [ ] **Step 5:** Commit.

---

### Task 3: Секционните компоненти (всичките 13)

**Files:**
- Create: `src/components/storefront/sections/{hero,announcement,featured-products,category-grid,promo-banner,image-text,rich-text,testimonials,trust-badges,gallery,faq,contact-map,socials}.tsx`
- Create: `src/components/storefront/sections/index.tsx` (`renderSection(section, ctx)`)
- Create: `src/components/storefront/product-card.tsx`

Всички са server components (данните идват като props; featured-products/category-grid получават заредени продукти/категории от страницата). Стил: `--sf-*` променливи, мобилно-first, `next/image`. `renderSection` switch-ва по type; disabled секции се пропускат. `ProductCard` (снимка, име, цена/промо, líне към продукта) се преизползва в каталога.

Спецификата на всяка секция е фиксирана в Zod схемите от Task 1; изпълнението следва данните. FAQ = `<details>` акордеон (без JS). Contact-map: контактите от shop данните + вграден iframe към OpenStreetMap по адрес (безплатно, без ключ) при `showMap`. Testimonials: карти с име+текст. Trust-badges: икони от фиксиран emoji набор.

- [ ] Commit след визуална проверка на dev сървъра със seed настройки.

---

### Task 4: Начална страница + продуктов каталог + продукт

**Files:**
- Create: `/s/[slug]/page.tsx` (начало), `/s/[slug]/products/page.tsx`, `/s/[slug]/p/[productSlug]/page.tsx`
- Create: `src/components/storefront/variant-picker.tsx` (client)

- [ ] **Step 1: Начало**: зарежда settings → collect: продукти за featured секции (по mode), категории за grid → `renderSection` в ред. Празни секции (без данни) се пропускат тихо.

- [ ] **Step 2: Каталог** `/products`: grid от ProductCard, филтър по категория (дърво от линкове/chips), търсене (Input GET форма), пагинация. Само `active` продукти.

- [ ] **Step 3: Продукт** `/p/[slug]`: breadcrumbs (Начало → Категория → Продукт), галерия + VariantPicker (client island): опционните оси като бутони-chips; избор → сменя цена (вариантна или базова), наличност бадж („Изчерпано" при stock 0), показва вариантните снимки първи в галерията. Характеристики като dl таблица. Свързани продукти (същата категория, до 4 ProductCard). Без cart CTA (План 4).

- [ ] **Step 4:** SEO: `generateMetadata` за трите route-а (title/description от данните, OG image = корицата), JSON-LD `Product` (цена, наличност, валута EUR) и `Store` на началото.

- [ ] **Step 5:** Commit.

---

### Task 5: За нас / Контакти / Условия

**Files:**
- Create: `/s/[slug]/about/page.tsx`, `/s/[slug]/contact/page.tsx`, `/s/[slug]/terms/page.tsx`
- Create: `src/lib/legal-template.ts`

(Полетата `aboutText`/`aboutImagePaths` са част от `siteSettingsSchema` — Task 1.)

- [ ] **Step 1: За нас**: aboutText (параграфи) + снимки; празно → fallback към shop.description.
- [ ] **Step 2: Контакти**: карта на контактите (телефон като `tel:` линк, имейл, адрес, работно време formatWorkingHours, соц. линкове) + OpenStreetMap embed. (Контактна форма — в План 4 с rate limiting.)
- [ ] **Step 3: Условия**: шаблонен текст (доставка/връщане/лични данни по ЗЗП) от `src/lib/legal-template.ts` — параметризиран с името/адреса/имейла/методите на магазина; статичен, юридически неутрален, с бележка „Търговецът носи отговорност за съдържанието".
- [ ] **Step 4:** Commit.

---

### Task 6: Таб „Уебсайт" — редакторът

**Files:**
- Create: `/dashboard/website/page.tsx`, `src/components/dashboard/website/{editor.tsx,sections-list.tsx,section-form.tsx,theme-panel.tsx,logo-uploader.tsx}`
- Create: `src/actions/site-settings.ts` (saveSiteSettings, uploadLogo, publishShop, unpublishShop)

- [ ] **Step 1:** `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Editor** (клиентски): state = SiteSettings; ляв панел (на мобилно: цял екран с preview бутон):
  - **Тема**: 3 карти-превюта (цветни мостри) + 2 color инпута (native `<input type="color">` в наш компонент ColorInput) + header layout radio.
  - **Лого**: upload (както продуктовите снимки, но 1 файл, пътека branding/).
  - **Секции**: sortable списък (dnd-kit) — drag дръжка, име+икона, toggle enabled, ✎ отваря SectionForm (Modal), 🗑 маха. „+ Добави секция" → picker с 13-те типа.
  - **SectionForm**: form per type — полетата съответстват 1:1 на Zod схемата (Input/Textarea/ImageUploader/избор на продукти/категории с чекбокс списък). Един generic компонент с switch по type.
  - **За нас**: textarea + снимки (двете нови полета).
- [ ] **Step 3: Save**: `saveSiteSettings(raw)` action — Zod + санитизация на всички текстове + проверка че imagePaths са на магазина → upsert → `revalidatePath("/s/" + slug, "layout")` → toast.
- [ ] **Step 4: Publish**: бутон в editor header-а: draft → „Публикувай" (проверка ≥1 активен продукт; сменя shops.status на published + revalidate); published → „Скрий магазина" (обратно). Показва публичния URL с copy бутон.
- [ ] **Step 5:** Навигацията: добавя се таб „Уебсайт" в `nav.tsx`.
- [ ] **Step 6:** Commit.

---

### Task 7: Live preview (iframe + postMessage)

**Files:**
- Create: `src/components/dashboard/website/preview.tsx`, `src/components/storefront/preview-listener.tsx`

- [ ] **Step 1:** Preview панел: iframe към `/s/{slug}?preview=1`, десктоп/мобилен toggle (width 100% / 390px). При промяна в editor state → debounce 400ms → `iframe.contentWindow.postMessage({ type: "frizmo-preview", settings }, origin)`.
- [ ] **Step 2:** `PreviewListener` (client, рендерира се в storefront layout само за owner при `?preview=1`). Механика (секциите са server components, затова не се re-рендерират клиентски): editor-ът при промяна (debounce 400ms) вика лек action `savePreviewDraft` → пише в `site_settings.draft` → postMessage сигнал към iframe → PreviewListener прави `router.refresh()`; storefront-ът за owner при `?preview=1` чете `draft ?? settings`. Save = промотира draft в `settings` и нулира draft.
- [ ] **Step 3:** Debounce + „Запази промените" sticky bar когато има незапазени промени.
- [ ] **Step 4:** Commit.

---

### Task 8: Ревалидация от съществуващите actions + e2e + гейт

**Files:**
- Modify: `src/actions/{products,categories,shop}.ts` — при мутация: `revalidatePath("/s/" + shop.slug, "layout")`
- Create: `e2e/storefront.spec.ts`

- [ ] **Step 1:** Ревалидациите.
- [ ] **Step 2: e2e**: регистрация → магазин + 2 продукта (единият с вариант) → таб Уебсайт → добави hero заглавие → Запази → Публикувай → **нов incognito context (без сесия)**: отваря `/s/{slug}` → вижда hero заглавието и продуктите → отваря продукта → сменя вариант → цената се сменя → каталог търсене работи. + draft магазин е 404 за анонимен, видим за owner.
- [ ] **Step 3:** `pnpm check` + `pnpm test:e2e` зелени; преглед за hardcoded цветове (изключение: themes.ts); push към dev; Vercel preview проверка; ✅ в roadmap.

---

## Definition of Done (План 3)

- [ ] Търговецът персонализира сайта си (тема, цветове, лого, секции с drag & drop) с live preview и го публикува сам
- [ ] Анонимен купувач разглежда публикувания магазин: начало със секции, каталог с филтри/търсене, продукт с работещ variant picker, За нас/Контакти/Условия
- [ ] Draft магазин: 404 за всички освен собственика
- [ ] SEO: metadata + OG + JSON-LD на всички публични страници
- [ ] Всичките 13 секции рендерират и се редактират
- [ ] `pnpm check` + e2e зелени; preview deploy проверен
