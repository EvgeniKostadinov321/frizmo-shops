# CLAUDE.md — Frizmo Shops

SaaS платформа за онлайн магазини (BG пазар, EUR). Едно Next.js 16 приложение: админ панел за търговци + публични магазини `/s/{slug}` + каталог + landing/блог.

**Източник на истината:** `docs/superpowers/specs/2026-07-02-frizmo-shops-mvp-design.md`
**Дизайн език:** `docs/superpowers/specs/2026-07-03-pazaren-den-design.md` („Пазарен ден")
**Изпълнени планове 1–6 (резюме):** `docs/superpowers/plans/executed-plans-summary.md`
**Какво следва:** `docs/superpowers/plans/2026-07-07-post-audit-roadmap.md`
**Website builder пътна карта (2026-07-06, в ход):** `docs/superpowers/plans/2026-07-06-builder-roadmap.md` — 4 вълни функционални фийчъра след одита; всяка вълна получава собствен спец преди имплементация.
**Жив контекст (докъде сме + setup на нова машина):** `docs/WORKLOG.md` — ЗАДЪЛЖИТЕЛНО го обновявай в края на всяка сесия със смислена промяна (нов ред в „Дневник" + текущ commit). Чете се пръв при продължаване от друга машина (напр. Mac).

**Статус (2026-07-04):** Планове 1–5 ✅ · План 6: Фаза А (платформен админ) ✅, Фаза Б (Stripe) стартира САМО при изрична заявка от потребителя. До Фаза Б `getShopPlan()` (src/lib/plan.ts) е stub — всички магазини са "pro".

**Визуален редизайн (завършен):** брандът е **теракота** (`brand-*` в tokens.css); публичните страници са **само светли** (dark е само за /dashboard + /admin — anti-FOUC скриптът в layout.tsx е гейтнат по път, `ForceLightTheme` на marketing); primary бутон = тъмен (`bg-ink-900`); цени 10/20 € (Starter/Pro), trial 30 дни без grace. Landing/`/shops`/`/products`/`/blog` редизайнирани и проверени на 375px. Логото и CTA/OG снимките са AI-генерирани (Magnific) в `public/`.

**PWA (2026-07-04):** manifest `standalone` + splash/welcome анимация при студен старт на инсталираното PWA (`src/components/pwa-splash.tsx`, монтиран в root layout + инстант splash-shell скрипт срещу мигане на landing-а). Показва се САМО в standalone (не в браузър таб); маскот видео в работилница + брандов lockup (лого + „Frizmo Shops") + „Старт" бутон; tap-to-skip; звук тих на 1-во отваряне; **reduced-motion → статичен постер** (уважава се). Асети: `public/splash-bee.{mp4,webm}` + `splash-bee-poster.jpg` + `splash-welcome.mp3`. Генерационен пайплайн и iOS faststart урокът: `docs/design/mascot-progress.md`.

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
* Git: **`dev` е PRODUCTION branch-ът във Vercel** (потвърдено 2026-07-08 от Vercel Deployments таба: `dev` носи Production badge, `main` прави само Preview). Работим и качваме САМО на `dev` — той е едновременно работен и production. **`main` НЕ се ползва вече** (не merge-ваме там; „main=prod" беше стара грешна презумпция). Никога commit на `.env*`. Push само след `pnpm check`. **Push към `dev` (= prod): агентът ПИТА преди качване и качва САМО при изрично разрешение** — не е блокиран, но не се прави без питане.
* Отклонение от спеца → първо се обновява спецификацията (+ ADR в `docs/decisions/`), после кодът.
* UI текстовете са на български; кавичките са типографски „…“ — прав `"` в BG текст чупи JS стрингове/lint. Валутата е EUR. **Преди писане/редакция на потребителски текст чети `docs/bulgarian-lang-guide.md`** (числово съгласуване, членуване, мъжка бройна форма, тон „на ти", без англицизми). Числово съгласуване през `src/lib/plural.ts` (`count(n, NOUNS.x)`); при причастие+число (напр. „премахната 1 / премахнати 3") съгласувай и причастието ИЛИ сложи числото ПРЕДИ думата, за да го избегнеш.

## Гочи (научени по трудния начин)

* Преди commit: сканирай за невидими контролни символи (`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`) — генерацията понякога ги вкарва в стрингове/hex цветове.
* Блог frontmatter (YAML): типографската двойка „…“ вътре в `"..."` стойност е ОК, но „…" (с прав закриващ `"`) чупи YAML-а (прав `"` затваря стринга рано → билдът гърми с YAMLException). В BG текст в YAML използвай пълната двойка „…“ или преформулирай без кавички.
* Windows: PowerShell е основният shell; multiline commit съобщение → временен файл + `git commit -F` (here-string с кавички се чупи).
* PWA видео на iOS: генерираните видеа (Seedance/Magnific) имат `moov` atom в КРАЯ → iOS standalone PWA показва само първия кадър (статично). Фикс: ffmpeg `-movflags +faststart` (moov отпред). Провери с `moov` позицията спрямо `mdat` — работещият `bee-wave.mp4` има moov отпред. Ръчен Node faststart чупи decode-а; ползвай ffmpeg. На тази Windows машина няма ffmpeg — свали `ffmpeg-static` временно (binary в pnpm store), ползвай, после `pnpm remove`.
* Push към `main`/`master` (prod): агентът пита за разрешение и качва при „да" — не е блокиран, но не се прави без изрично разрешение.
* E2e: само `@gmail.com` алиас имейли (Supabase отхвърля други); cookie банерът се маркира като видян с `addInitScript` → `localStorage frizmo-cookie-notice=1`.
* `.env.local` ключове: Supabase URL/publishable/secret, `DATABASE_URL` (:6543, transaction pooler) / `DATABASE_URL_MIGRATIONS` (:5432, session), `NEXT_PUBLIC_HERE_API_KEY`, `RESEND_API_KEY`, VAPID двойка (`VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) + `VAPID_SUBJECT`, `NEXT_PUBLIC_SITE_URL` (базов URL за имейл линкове; fallback е `frizmo-shops.vercel.app`), `PLATFORM_ADMIN_EMAILS` (comma-separated; дава достъп до /admin).
* **Vercel prod env vars:** същите ОСВЕН `DATABASE_URL_MIGRATIONS` (само за локални `db:push`/seed скриптове — НЕ в Vercel). Проверка на пълния ползван списък: `grep -rhoE "process\.env\.[A-Z_]+" src scripts`. При добавяне на env var във Vercel → задължителен **Redeploy** (не се прилага към стар билд). Одит 2026-07-07: на prod липсваха `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (push) и `NEXT_PUBLIC_SITE_URL`.
