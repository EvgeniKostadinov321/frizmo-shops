# Frontend контекст (зарежда се при всяка задача)

## Стилизация — две нива, нула хардкоднати стойности

1. **Платформена тема** (landing, каталог, dashboard): всички стойности живеят в `src/styles/tokens.css` (Tailwind 4 `@theme`) — цветове (`brand-*`, `ink-*`, `surface-*`, `danger/success/warning-*`), радиуси (`radius-control`, `radius-card`), шрифт (`--font-inter`). Компонентите използват само токен-утилити (`bg-brand-600`, `rounded-card`). Нов цвят/размер = нов токен, никога inline hex/px.
2. **Тема на магазина** (storefront `/s/{slug}`): персонализацията от `site_settings` се излива като CSS variables на `<html>` на магазина. Storefront компонентите четат **само** тези променливи — един компонент рендерира всички теми (`classic`, `modern`, `warm`).

## Компонентна библиотека — `src/components/ui/`

* Всеки елемент, използван на 2+ места, е компонент тук. Преди да пишеш нов — провери дали вече съществува (barrel: `src/components/ui/index.ts`).
* Страниците НЕ съдържат голи `<button>`/`<input>`/`<select>` с класове — винаги `<Button>`, `<Input>` и т.н.
* Изисквания към всеки компонент: типизирани props (без `any`), състояния loading/disabled/error, empty states за списъци, ARIA атрибути, touch targets ≥ 44px (`h-11`).
* Организация: `ui/` (примитиви) · `storefront/` (секции на магазина) · `dashboard/` (админ композиции) · `marketing/` (landing) · `auth/`.

## Next.js App Router конвенции

* `src/app/` съдържа само routing + композиция — бизнес логиката живее в `src/db/` (заявки) и `src/actions/` (мутации).
* Server Components по подразбиране; `"use client"` само при нужда (state, hooks, events). Компонент с hook (вкл. `useId`) е client.
* Route групи: `(marketing)` `(catalog)` `(storefront)/s/[slug]` `(dashboard)` `(auth)` + `admin/`.
* Публични страници: SSR/ISR с кеш + инвалидация при промяна на данни (`revalidatePath`/`revalidateTag`). Dashboard/admin: client-rendered, без SEO нужди.
* Мутации от клиента = Server Actions с `useActionState`; формите показват field-level грешки от Zod.

## Задължително за всяка UI задача

* **Mobile-first** — дизайнът се прави първо за 375px; 65%+ от storefront трафика е мобилен.
* Всички снимки през `next/image` (автоматичен WebP/размери). Пагинация на всеки списък.
* UI текстове на български; цени с `formatPrice()` от `src/lib/money.ts` (EUR).
* SEO на публичните страници: Metadata API (title/description), OpenGraph, JSON-LD (`Product`/`Store`/`Article`), канонични URL-и.
* Storefront секциите са типизирани компоненти + Zod схема на настройките — никакъв свободен HTML от потребителя.
* Loading/error/empty състояние за всяко асинхронно view (`loading.tsx`, `error.tsx`, `EmptyState`).
