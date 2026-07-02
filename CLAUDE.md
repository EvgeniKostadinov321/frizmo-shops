# CLAUDE.md — Frizmo Shops

SaaS платформа за онлайн магазини (BG пазар, EUR). Едно Next.js 16 приложение: админ панел за търговци + публични магазини `/s/{slug}` + каталог + landing/блог.

**Източник на истината:** `docs/superpowers/specs/2026-07-02-frizmo-shops-mvp-design.md`
**Ред на работа:** `docs/superpowers/plans/2026-07-02-roadmap.md` (6 плана, изпълняват се последователно, всеки до пълна готовност — без TODO/coming soon)

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
pnpm test:e2e     # Playwright
pnpm db:push      # прилага src/db/schema.ts към базата (нужен DATABASE_URL_MIGRATIONS)
```

## Правила за работа

* **Inline изпълнение** — без паралелни субагенти/workflow-и (пазим usage лимита). Последователно, с checkpoint-и.
* Качество: строг TypeScript (без `as any`), edge cases, performance и security се проверяват при всяко писане на код.
* Git: работа по `dev` → preview; merge към `main` = production. Никога commit на `.env*`. Push само след `pnpm check`.
* Отклонение от спеца → първо се обновява спецификацията (+ ADR в `docs/decisions/`), после кодът.
* UI текстовете са на български. Валутата е EUR.
