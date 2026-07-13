# Отделяне на production среда (prod Supabase + Vercel + домейн) — дизайн

**Дата:** 2026-07-13
**Статус:** одобрен от потребителя (брейнсторм)
**Тип:** ИНФРАСТРУКТУРНА миграция / runbook — предимно ръчни стъпки (Supabase/Vercel/DNS UI),
не писане на приложен код. Свързано: [[env-vars-reference]], [[stripe-billing-status]],
[[online-payments-feature]], [[external-work-scope]], `docs/remaining-roadmap.md`.

## Проблем и цел

Днес има **една** Supabase база (`pkojwqgmsxlikjfcyrhw`) — тя е и dev, и „prod"; един Vercel
проект деплойва `dev` branch на Production (`frizmo-shops.vercel.app`). Реален лайв старт с
истински търговци не бива да споделя база с dev експериментите.

**Цел:** отделна **prod Supabase база** (чиста, без демо/тест данни) + prod домейн
`frizmoshops.bg` (SuperHosting, пълен достъп е наличен) + Vercel Production env, сочещ prod
базата. Локалната разработка остава на текущата база (dev пясъчник).

## Одобрени решения (от брейнсторма)

1. **Отделна prod Supabase база** (пълно разделяне). Текущата база → dev/локална пясъчница.
2. **Prod базата тръгва ЧИСТА, БЕЗ демо магазини** — само schema (`db:push`) + еднократните
   setup скриптове (storage bucket, pg_trgm/GIN индекси). Landing/каталог празни, докато не
   се регистрират реални търговци. (e2e тестовете разчитат на демо магазина `atelie-glina`, но
   се пускат ЛОКАЛНО срещу dev базата — прод остава чист.)
3. **Vercel: Production env scope = prod база.** Същият Vercel проект. Prod Supabase ключове →
   само в „Production" env scope (домейнът ги чете). `dev` branch остава Production deploy.
   `.env.local` (локално) остава dev базата. Без нов Vercel проект.
4. **Последователност: базата първо, домейнът паралелно.** Създаваме prod Supabase + Vercel
   Production env СЕГА (прод работи временно на `.vercel.app`). Домейнът се закача паралелно;
   като DNS стане активен → добавяме домейна във Vercel + сменяме `NEXT_PUBLIC_SITE_URL` +
   Resend верификация. Не чакаме DNS.
5. **Домейн:** `frizmoshops.bg` (вече заложен в кода 13×). Само основния домейн засега.

## Роли: кой какво прави

**Само потребителят може (UI/акаунти — аз НЕ мога):**
- Създаване на нов Supabase проект (region, парола на базата)
- Копиране на Supabase ключове/connection strings
- Въвеждане на env vars във Vercel dashboard (Production scope)
- Добавяне на домейн във Vercel + въвеждане на DNS записи в SuperHosting
- Resend domain верификация (DNS записи)
- Регистрация/ключове за външни услуги (ePay demo, Stripe live и т.н.)

**Агентът може (код/скриптове/проверка/документация):**
- `db:push` към prod базата (с prod `DATABASE_URL_MIGRATIONS`, подаден локално еднократно)
- Пускане на setup скриптове (`setup-storage.mjs`, `setup-search.mjs`) срещу prod
- Сверка на env var списъка (кое трябва във Vercel Production)
- Обновяване на скриптове/документация (`env-vars-reference`, WORKLOG, `.env.example`)
- Валидиращи проверки (health-check заявки, че prod сочи правилната база)

## Env vars — какво мигрира във Vercel Production scope

Пълен списък (от `grep -rhoE "process\.env\.[A-Z_]+" src scripts`), 22 променливи:

**Ключови за prod (различни стойности от dev):**
- `NEXT_PUBLIC_SUPABASE_URL` — **prod** Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **prod** publishable key
- `SUPABASE_SECRET_KEY` — **prod** secret (никога NEXT_PUBLIC_)
- `DATABASE_URL` — **prod** transaction pooler (:6543, `prepare:false`)
- `NEXT_PUBLIC_SITE_URL` — `https://frizmo-shops.vercel.app` временно → `https://frizmoshops.bg`
  като домейнът стане жив (fallback в кода е `frizmo-shops.vercel.app`)

**Същите стойности като dev (копират се):**
- `NEXT_PUBLIC_HERE_API_KEY`, `RESEND_API_KEY`, `PLATFORM_ADMIN_EMAILS`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `CRON_SECRET` (таен низ; за abandoned-carts + expire-payments cron)
- `ECONT_API_BASE` (`https://demo.econt.com/ee/services` — DEV fallback докато няма реален Еконт prod)
- `EPAY_API_BASE` (`https://demo.epay.bg` докато няма реален ePay merchant; после `https://www.epay.bg`)
- `SPEEDY_API_BASE` (когато има ключове)

**НЕ във Vercel (само локално за db:push/seed):**
- `DATABASE_URL_MIGRATIONS` — session pooler :5432; само за локални `db:push`/скриптове.

**Отложени / „спящи" (когато се активират):**
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO`
  — Stripe billing е „спящ" ([[stripe-billing-status]]); попълват се при live активиране.

**Автоматични (Vercel/Next ги дава):** `NODE_ENV`, `NEXT_RUNTIME` — не се въвеждат ръчно.

> **Правило:** при добавяне/промяна на env var във Vercel → задължителен **Redeploy** (не се
> прилага към стар билд). Виж [[env-vars-reference]].

## Процедура (runbook — фази)

### Фаза 1 — Prod Supabase база (чиста)
1. **(потребител)** Създай нов Supabase проект „frizmo-shops-prod" (или подобно); запиши region
   + парола на базата.
2. **(потребител)** Вземи: Project URL, `anon`/publishable key, `service_role`/secret key,
   connection strings (transaction pooler :6543 + session pooler :5432).
3. **(потребител → агент)** Подай на агента prod `DATABASE_URL_MIGRATIONS` (:5432) ЛОКАЛНО (напр.
   в отделен `.env.prod.local` — НЕ се commit-ва; в `.gitignore`).
4. **(агент)** `db:push` към prod: `node --env-file=.env.prod.local ./node_modules/drizzle-kit/bin.cjs push`
   → schema-та влиза в прод базата (всички таблици, enum-и, индекси, RLS).
5. **(агент)** Пусни setup скриптовете срещу prod (с prod `DATABASE_URL`/`SUPABASE_*` env):
   - `node scripts/setup-storage.mjs` (bucket `shop-media`)
   - `node scripts/setup-search.mjs` (pg_trgm + GIN индекси)
   - **НЕ** пускай `seed-demo-shops.mjs` (прод остава без демо).
6. **(агент)** Валидираща проверка: заявка към прод базата → таблиците съществуват, `shops`
   е празна (0 реда). Health-check.

### Фаза 2 — Vercel Production env
7. **(потребител)** Във Vercel → Settings → Environment Variables: въведи всички prod стойности
   в **Production** scope (виж списъка горе). `NEXT_PUBLIC_SITE_URL` = `https://frizmo-shops.vercel.app`
   засега.
8. **(потребител)** **Redeploy** Production (за да прочете новите env).
9. **(потребител → агент)** Проверка: прод сайтът зарежда, каталогът е ПРАЗЕН (чиста база), няма
   грешки. Регистрация на тест търговец на прод работи (пише в прод базата).

### Фаза 3 — Домейн `frizmoshops.bg` (паралелно, като DNS е готов)
10. **(потребител)** Във Vercel → Domains: добави `frizmoshops.bg` (+ `www` redirect по избор).
11. **(потребител)** Вземи DNS записите от Vercel (A/CNAME) → въведи ги в SuperHosting DNS.
12. **(изчакване)** DNS propagation + Vercel SSL (Let's Encrypt авто).
13. **(потребител)** Смени `NEXT_PUBLIC_SITE_URL` → `https://frizmoshops.bg` (Vercel Production) →
    **Redeploy**.
14. **(потребител)** Resend: верифицирай домейна за имейли от `shops@frizmoshops.bg` (DNS TXT/DKIM
    записи в SuperHosting). Сега имейлите тръгват от `frizmo.bg` — сменя се на `frizmoshops.bg`.
15. **(агент)** Провери линкове/OG/canonical/sitemap — да сочат `frizmoshops.bg` (кодът вече ползва
    `NEXT_PUBLIC_SITE_URL`; fallback `frizmo-shops.vercel.app` остава за preview).

### Фаза 4 — Свързване на външните услуги към прод (следващи сесии, отделно)
16. ePay: реален/demo merchant → webhook URL `https://frizmoshops.bg/api/payments/epay/notify`
    → KIN/secret в dashboard на прод магазин. [[online-payments-feature]]
17. Stripe live: live ключове + webhook `https://frizmoshops.bg/api/webhooks/stripe` →
    Vercel Production env → Redeploy. [[stripe-billing-status]]
18. Куриери (реален Еконт prod / Спиди ключове), Sentry (DSN), inv.bg — по отделните им планове.

## Рискове и предпазни мерки

- **Грешен env → прод сочи dev база (или обратно).** Предпазка: prod ключовете само в „Production"
  scope; `.env.local` НИКОГА не съдържа prod ключове; валидиращ health-check след всяка фаза
  (коя база сочи прод — по `shops` count / project ref).
- **Изтекли/объркани ключове.** `service_role`/secret никога NEXT_PUBLIC_/в git/в лог. Prod
  connection strings в `.env.prod.local` (gitignored), не в `.env.local`.
- **db:push срещу грешна база.** Изрично `--env-file=.env.prod.local`; двойна проверка на URL-а
  преди push; push-ва се към ПРАЗНА прод база (без риск от data loss — няма данни).
- **DNS/SSL забавяне.** Домейн фазата е независима; прод работи на `.vercel.app` междувременно.
- **Cron на прод.** `CRON_SECRET` във Vercel Production (за abandoned-carts + expire-payments);
  без него cron-овете връщат 401.
- **Данни на прод при първи реален търговец.** Backup/PITR (Supabase настройка) — отбелязано за
  скоро след лайв (не блокер за setup-а). [[production-audit-2026-07-09]].

## Извън обхвата

- Миграция на данни от dev към prod (прод е чист — решение на потребителя).
- Backup/PITR настройка (отделно, скоро след лайв).
- Активиране на Stripe live / ePay merchant / куриери / Sentry (отделни планове; тук само се
  подготвя средата да ги приеме).
- Multi-region / read replicas / скалиране (преждевременно).

## Отворени въпроси (за момента на изпълнение)

1. Supabase region за прод (EU — Frankfurt, за БГ латентност). Потвърждава се при създаване.
2. Точните DNS записи (A vs CNAME) — Vercel ги дава при добавяне на домейна.
3. `www.frizmoshops.bg` redirect към apex или обратно — избор при домейн фазата.
