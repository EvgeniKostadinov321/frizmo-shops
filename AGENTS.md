<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Known Next.js 16 differences already hit in this repo (ADR: `docs/decisions/2026-07-02-nextjs-16.md`):

* `middleware.ts` is deprecated → this project uses `src/proxy.ts` exporting `proxy()`.
* Tailwind 4 canonical classes: `bg-linear-to-br` (not `bg-gradient-to-br`); numeric spacing utilities like `h-13`/`border-10` work natively.
* Stale `.next/` types after deleting routes → `Remove-Item .next -Recurse -Force`.

# Quick agent facts

* Package manager: **pnpm**. Gate before any commit: `pnpm check` (lint + unit + build); e2e: `pnpm test:e2e`.
* Project instructions live in `CLAUDE.md` (+ `CLAUDE-frontend.md`, `CLAUDE-backend.md`) — read them; they define the design language, tenant-isolation rules, and money handling.
* UI copy is Bulgarian with typographic quotes „…“; currency is EUR stored as integer cents.
* Never commit `.env*`. Work on `dev`; `main` is production and is merged by the owner.
