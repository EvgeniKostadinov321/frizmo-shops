# Frizmo Shops

SaaS платформа за онлайн магазини за българския пазар (EUR): админ панел за търговци, публични магазини на `/s/{slug}`, общ каталог, landing и блог.

* Спецификация: `docs/superpowers/specs/2026-07-02-frizmo-shops-mvp-design.md`
* Дизайн език „Пазарен ден": `docs/superpowers/specs/2026-07-03-pazaren-den-design.md`
* Изпълнени планове (резюме): `docs/superpowers/plans/executed-plans-summary.md`
* Какво следва: `docs/superpowers/plans/2026-07-07-post-audit-roadmap.md`

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
5. По желание: `node scripts/seed-demo-shops.mjs` — сийдва 3-те демо магазина (landing-ът и e2e тестовете ги ползват).

## Деплой

Vercel: `dev` клон → preview, `main` → production. Env променливите от `.env.local` се качват и във Vercel.
