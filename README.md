# Frizmo Shops

SaaS платформа за онлайн магазини за българския пазар (EUR): админ панел за търговци, публични магазини на `/s/{slug}`, общ каталог, landing и блог.

* Спецификация: `docs/superpowers/specs/2026-07-02-frizmo-shops-mvp-design.md`
* Дизайн език „Пазарен ден": `docs/superpowers/specs/2026-07-03-pazaren-den-design.md`
* Изпълнени планове (резюме): `docs/superpowers/plans/executed-plans-summary.md`
* Какво следва: `docs/remaining-roadmap.md` (актуалната пътна карта)

## Стек

Next.js 16 (App Router) · Supabase (Postgres/Auth/Storage) · Drizzle ORM · Tailwind CSS 4 · Zod · Resend · Web Push · Vitest + Playwright · pnpm · Vercel

## Команди

```bash
pnpm dev          # dev сървър (localhost:3000)
pnpm check        # lint + unit тестове + build — гейт преди commit/push
pnpm test         # Vitest unit
pnpm test:e2e     # Playwright e2e
pnpm db:push      # прилага src/db/schema.ts към базата
```

## Setup

1. `pnpm install`
2. Копирай `.env.example` → `.env.local` и попълни ключовете (Supabase, HERE, Resend, VAPID, `PLATFORM_ADMIN_EMAILS`).
3. `pnpm db:push`
4. Еднократно: `node scripts/setup-storage.mjs` и `node scripts/setup-search.mjs`
5. По желание: `node scripts/seed-demo-shops.mjs` — сийдва демо магазините (по 1 за всяка storefront тема; landing-ът, каталогът и e2e тестовете ги ползват). Линкове: `docs/demo-shops-links.md`.

## Деплой

Vercel: **`dev` е production branch-ът** (носи Production badge). Работим и качваме САМО на `dev`; `main` НЕ се ползва. Push към `dev` (= prod) става само след изрично разрешение. Env променливите от `.env.local` се качват и във Vercel (всички освен `DATABASE_URL_MIGRATIONS`, който е само за локални `db:push`/seed).
