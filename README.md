# Frizmo Shops

SaaS платформа за онлайн магазини (BG). Спецификация: `docs/superpowers/specs/`.

## Команди

- `pnpm dev` — dev сървър
- `pnpm check` — lint + unit тестове + build (гейт преди commit/push)
- `pnpm test` / `pnpm test:e2e` — Vitest / Playwright
- `pnpm db:push` — прилага `src/db/schema.ts` към базата

## Setup

1. `pnpm install`
2. Копирай `.env.example` → `.env.local`, попълни от Supabase.
3. `pnpm db:push`
