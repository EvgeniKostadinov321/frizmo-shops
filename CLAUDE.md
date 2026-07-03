# CLAUDE.md — Frizmo Shops

SaaS платформа за онлайн магазини (BG пазар, EUR). Едно Next.js 16 приложение: админ панел за търговци + публични магазини `/s/{slug}` + каталог + landing/блог.

**Източник на истината:** `docs/superpowers/specs/2026-07-02-frizmo-shops-mvp-design.md`
**Дизайн език:** `docs/superpowers/specs/2026-07-03-pazaren-den-design.md` („Пазарен ден")
**Ред на работа:** `docs/superpowers/plans/2026-07-02-roadmap.md`

**Статус (2026-07-03):** Планове 1–5 ✅ · План 6: Фаза А (платформен админ) ✅, Фаза Б (Stripe) стартира САМО при изрична заявка от потребителя. До Фаза Б `getShopPlan()` (src/lib/plan.ts) е stub — всички магазини са "pro".

## Задължителен контекст при всяка задача

@CLAUDE-frontend.md
@CLAUDE-backend.md
@AGENTS.md

## Стек

Next.js 16 (App Router) + Vercel · Supabase (Postgres/Auth/Storage) · Drizzle ORM (`drizzle-kit push`, без migration файлове) · Zod · Tailwind CSS 4 · Stripe · Resend · Vitest + Playwright · pnpm

## Команди

```bash
pnpm dev          # dev сървър (localhost:3000)
pnpm check        # lint + unit тестове + build — ГЕЙТ преди всеки commit към dev/main
pnpm test         # Vitest unit
pnpm test:e2e     # Playwright (store-products понякога флейква под пълния suite — препускай изолирано)
pnpm db:push      # прилага src/db/schema.ts към базата (нужен DATABASE_URL_MIGRATIONS)

node scripts/setup-storage.mjs    # bucket shop-media (еднократно)
node scripts/setup-search.mjs     # pg_trgm + GIN индекси (еднократно)
node scripts/seed-demo-shops.mjs  # 3-те демо магазина — landing/каталог/e2e разчитат на тях
node scripts/generate-icons.mjs   # регенерира favicon/PWA/OG асетите от src/app/icon.svg
node scripts/cleanup-e2e.mjs      # чисти e2e акаунтите/магазините от базата
```

## Правила за работа

* **Inline изпълнение** — без паралелни субагенти/workflow-и (пазим usage лимита). Последователно, с checkpoint-и.
* Качество: строг TypeScript (без `as any`), edge cases, performance и security се проверяват при всяко писане на код.
* Git: работа по `dev` → preview; merge към `main` = production. Никога commit на `.env*`. Push само след `pnpm check`.
* Отклонение от спеца → първо се обновява спецификацията (+ ADR в `docs/decisions/`), после кодът.
* UI текстовете са на български; кавичките са типографски „…“ — прав `"` в BG текст чупи JS стрингове/lint. Валутата е EUR.

## Гочи (научени по трудния начин)

* Преди commit: сканирай за невидими контролни символи (`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`) — генерацията понякога ги вкарва в стрингове/hex цветове.
* Windows: PowerShell е основният shell; multiline commit съобщение → временен файл + `git commit -F` (here-string с кавички се чупи).
* Push към `main`/`master` е блокиран за агента — финалния merge прави потребителят.
* E2e: само `@gmail.com` алиас имейли (Supabase отхвърля други); cookie банерът се маркира като видян с `addInitScript` → `localStorage frizmo-cookie-notice=1`.
* `.env.local` ключове: Supabase URL/publishable/secret, `DATABASE_URL` (:6543, transaction pooler) / `DATABASE_URL_MIGRATIONS` (:5432, session), `NEXT_PUBLIC_HERE_API_KEY`, `RESEND_API_KEY`, VAPID двойка + subject, `PLATFORM_ADMIN_EMAILS` (comma-separated; дава достъп до /admin).
