# Frontend контекст (зарежда се при всяка задача)

## Дизайн guide — ЗАДЪЛЖИТЕЛНО преди дизайн промени

Преди имплементация на КАКВАТО И ДА Е промяна по дизайна (платформен UI или
storefront) се чете `docs/design-final-guide/` (правило от 2026-07-05):

1. `skill-frontend-design.md` — естетическа посока (Anthropic skill)
2. `skill-ui-ux-pro-max.md` — UX данни/правила (161 палитри, 99 UX правила)
3. `variants-architecture.md` — 3 варианта на секция/елемент (структура + контракт)
4. `theme-signatures.md` — уникалният „подпис" на всяка тема (custom детайли през токени)

Ред: frontend-design задава посоката → ui-ux-pro-max проверява данните →
вариант + темов подпис по guide-а → имплементация само през токени.
Проектните правила побеждават при конфликт.

## Дизайн език „Пазарен ден" — спец: docs/superpowers/specs/2026-07-03-pazaren-den-design.md

Еталонът за качество е www.frizmo.bg; generic Tailwind вид не минава. Стълбове:

* **Хартия, не екран**: топъл лен (`surface-50` = страница, `surface-0` = карти); разделители = hairlines (`border-surface-200`), не борд-карти. Dark mode = „тъмна гора".
* **Типография с глас**: body = Sofia Sans (`--font-sans`); display заглавия = Sofia Sans Condensed през `font-display` + `font-extrabold tracking-tight`. Marketing H1/H2 са СВРЪХ-едри (`text-4xl`–`text-8xl`).
* **Един акцент, един брандов момент**: акцентът е дълбокото зелено; ember градиентът (`from-ember-500 to-ember-600`) се появява САМО върху акцентната дума в hero H1 на landing-а. Никъде другаде.
* **Editorial ритъм**: letterspaced kicker-и (`text-[11px] font-bold uppercase tracking-[0.24em]` + hairline), номерирани стъпки (display цифри), секции с `py-24`.
* **Истинско съдържание в мокъпите**: без празни скелети/емоджита — реални данни (PhoneMockup чете демо магазина от базата).
* **Движение с мярка**: `<Reveal>` (`marketing/reveal.tsx`, IntersectionObserver, уважава reduced-motion); плаващ pill header при скрол.
* Плътни brand повърхности (CTA ленти) = `brand-surface*` токени — ярко зелено никога върху голяма площ.

## Стилизация — две нива, нула хардкоднати стойности

1. **Платформена тема** (landing, каталог, dashboard): всички стойности живеят в `src/styles/tokens.css` (Tailwind 4 `@theme`) — цветове (`brand-*`, `ink-*`, `surface-*`, `ember-*`, `brand-surface*`, `danger/success/warning-*`), радиуси (`radius-control`, `radius-card`), шрифтове (`--font-sans`, `--font-display`), сенки (`shadow-card`, `shadow-float`). Компонентите използват само токен-утилити. Нов цвят/размер = нов токен, никога inline hex/px. **Dark mode = предефинирани токени под `[data-theme="dark"]` в tokens.css — НИКОГА `dark:` варианти в компоненти** (ADR: docs/decisions/2026-07-03-dark-mode.md); нов токен винаги получава и dark стойност.
2. **Тема на магазина** (storefront `/s/{slug}`): персонализацията от `site_settings` се излива като CSS variables на `<html>` на магазина. Storefront компонентите четат **само** тези променливи (`--sf-*`) — един компонент рендерира всички теми (`classic`=Inter, `modern`=Space Grotesk, `warm`=Lora). „Пазарен ден" НЕ важи за storefront.

## Компонентна библиотека — `src/components/ui/`

* Всеки елемент, използван на 2+ места, е компонент тук. Преди да пишеш нов — провери barrel-а (`src/components/ui/index.ts`).
* Страниците НЕ съдържат голи `<button>`/`<input>`/`<select>` с класове — винаги `<Button>`, `<Input>` и т.н.
* Асети: `<Logo />` (SVG store знак + wordmark — единственото лого), `<Icon name />` (вътрешен SVG set, Lucide стил) и `<FlagBg />` — **никакви емоджита в платформения UI** (🇧🇬 се рендерира като „BG" текст на Windows).
* Изисквания към всеки компонент: типизирани props (без `any`), състояния loading/disabled/error, empty states за списъци, ARIA атрибути, touch targets ≥ 44px (`h-11`).
* Организация: `ui/` (примитиви) · `storefront/` (секции на магазина) · `dashboard/` (админ композиции) · `marketing/` (landing: Reveal, PhoneMockup, feature-mockups, ShopCard) · `auth/`.
* Форми в drawer-и (`<Drawer>`, fullscreen на мобилно), не модали; Modal/Drawer НЕ се затварят при клик отвън.

## Next.js App Router конвенции

* `src/app/` съдържа само routing + композиция — бизнес логиката живее в `src/db/` (заявки) и `src/actions/` (мутации).
* Server Components по подразбиране; `"use client"` само при нужда (state, hooks, events). Компонент с hook (вкл. `useId`) е client.
* Route групи: `(marketing)` `(catalog)` `(storefront)/s/[slug]` `(dashboard)` `(auth)` + `admin/`.
* Публични страници: SSR/ISR с кеш + инвалидация (`revalidatePath`/`revalidateTag`). Dashboard/admin: client-rendered, без SEO нужди.
* Мутации от клиента = Server Actions с `useActionState`; формите показват field-level грешки от Zod.
* React гочи: localStorage state → `useSyncExternalStore` с кеширан snapshot; setState синхронно в effect чупи react-compiler lint (→ `queueMicrotask`); нестабилни callback deps → `useLatest` ref (`src/lib/use-latest.ts`); `notFound()` в layout стига до root boundary (глобалният `src/app/not-found.tsx`).

## Задължително за всяка UI задача

* **Mobile-first** — дизайнът се прави първо за 375px; 65%+ от storefront трафика е мобилен.
* Всички снимки през `next/image` (Supabase Storage URL-и през `publicImageUrl()` от `src/lib/storage.ts`). Пагинация на всеки списък.
* UI текстове на български; цени с `formatPrice()` от `src/lib/money.ts` (EUR).
* SEO на публичните страници: Metadata API, OpenGraph, JSON-LD (`Product`/`Store`/`Article`), канонични URL-и.
* Storefront секциите са типизирани компоненти + Zod схема на настройките — никакъв свободен HTML от потребителя.
* Loading/error/empty състояние за всяко асинхронно view (`loading.tsx`, `error.tsx`, `EmptyState`). Внимание: `loading.tsx` remount-ва при `router.refresh()` и затваря отворени drawer-и — не го слагай на CRUD страници с drawer форми.
* Визуална проверка на light + dark + 375px преди commit (dark се форсира с `localStorage frizmo-theme=dark`).
