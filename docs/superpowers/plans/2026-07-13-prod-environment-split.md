# Отделяне на production среда — runbook план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax. **Това е ИНФРАСТРУКТУРЕН runbook, не приложен код** — задачите редуват стъпки на ПОТРЕБИТЕЛЯ (UI/акаунти) и на АГЕНТА (команди/валидации). Всяка задача завършва с health-check.

**Goal:** Отделна чиста production Supabase база + Vercel Production env (сочи прод базата) + домейн `frizmoshops.bg`, за да тества потребителят целия поток от 0 като реален търговец.

**Architecture:** Нов Supabase проект (прод), празен (само schema + storage bucket + search индекси; БЕЗ демо). Vercel „Production" env scope носи прод ключовете; `dev` branch остава Production deploy; `.env.local` (локално) остава dev базата. База първо → домейн паралелно (не чакаме DNS).

**Tech Stack:** Supabase (Postgres/Auth/Storage), Drizzle (`db:push`, без migration файлове), Vercel, SuperHosting DNS, Resend.

## Global Constraints

- Спец: `docs/superpowers/specs/2026-07-13-prod-environment-split-design.md` (одобрен 2026-07-13).
- **Прод базата тръгва ЧИСТА, БЕЗ демо магазини** — само schema + storage bucket + search индекси. НЕ `seed-demo-shops.mjs`.
- **4 критични env vars (fail-fast, `src/env.ts`)** — прод build пада без тях: `DATABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Прод ключове само във Vercel **„Production" env scope**; `.env.local` (локално) НИКОГА не съдържа прод ключове; прод connection strings → `.env.prod.local` (gitignored — `.env*` в `.gitignore`, потвърдено с `git check-ignore`).
- `SUPABASE_SECRET_KEY` / `service_role` никога `NEXT_PUBLIC_`, никога в git, никога в лог.
- При добавяне/промяна на env var във Vercel → задължителен **Redeploy** (не се прилага към стар билд).
- `db:push`: `node --env-file=.env.prod.local ./node_modules/drizzle-kit/bin.cjs push` (drizzle-kit чете `DATABASE_URL_MIGRATIONS`).
- App connection = transaction pooler `:6543` (`prepare:false`); drizzle-kit/скриптове = session pooler `:5432` (`DATABASE_URL_MIGRATIONS`).
- Домейн: `frizmoshops.bg` (заложен в кода 13×; fallback `frizmo-shops.vercel.app` остава за preview).
- **Никога не push-вай/деплойвай без изрично разрешение** (правило на проекта). Онлайн плащането (ePay) е локално commit-нато, НЕ push-нато — влиза на прод при първия деплой към новата среда.
- Валидиращ health-check след всяка фаза: коя база сочи прод (по `shops` count / project ref) — предпазка срещу „прод сочи dev база".

## Файлова структура

**Създаваме (локално, gitignored):**
- `.env.prod.local` — прод connection strings + ключове за локалните агентски команди (db:push, setup скриптове). НЕ се commit-ва.

**Създаваме (в repo):**
- `scripts/health-check-db.mjs` — валидираща заявка (project ref + `shops`/`orders` count) срещу подадена база; за да потвърдим коя база е коя преди/след всяка стъпка.

**Модифицираме (docs — commit-ват се):**
- `docs/WORKLOG.md` — Дневник запис + текущ статус
- Паметта: `env-vars-reference.md` (dev vs prod разделяне) + нова `prod-environment.md` + ред в `MEMORY.md`

**Скриптове, ползвани както са (без промяна):**
- `scripts/setup-storage.mjs` (иска `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY`)
- `scripts/setup-search.mjs` (иска `DATABASE_URL_MIGRATIONS`)

---

### Task 1: Health-check скрипт (валидатор коя база)

**Files:**
- Create: `scripts/health-check-db.mjs`

**Роля:** АГЕНТ (пише скрипта). Ползва се във всяка следваща фаза, за да докаже коя база сочим (предпазка срещу объркване dev/prod).

- [ ] **Step 1: Създай скрипта**

`scripts/health-check-db.mjs`:
```js
/**
 * Health-check: показва към КОЯ база сочи подаденият env + бройки редове.
 * Пуска се: node --env-file=<файл> scripts/health-check-db.mjs
 * Ползва DATABASE_URL_MIGRATIONS (session pooler). Предпазка срещу
 * „прод сочи dev база" — проверяваме project ref + дали е празна.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL_MIGRATIONS;
if (!url) {
  console.error("Липсва DATABASE_URL_MIGRATIONS — подай --env-file.");
  process.exit(1);
}
/* Project ref е поддомейнът в connection string-а (…@db.<ref>.supabase.co или
   aws-…pooler…?…). Показваме хоста, за да се вижда коя база. */
const host = url.replace(/^.*@/, "").replace(/[/?].*$/, "");
const sql = postgres(url, { prepare: false });
/** Брои редове, но връща null ако таблицата още не съществува (преди db:push). */
async function safeCount(table) {
  try {
    const [{ n }] = await sql`select count(*)::int as n from ${sql(table)}`;
    return n;
  } catch {
    return null; // relation does not exist
  }
}
try {
  const [{ n: publicTables }] =
    await sql`select count(*)::int as n from information_schema.tables where table_schema='public'`;
  const shops = await safeCount("shops");
  const orders = await safeCount("orders");
  console.log(JSON.stringify({ host, publicTables, shops, orders }, null, 2));
} catch (e) {
  console.error("Health-check грешка (връзка?):", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
```

- [ ] **Step 2: Провери срещу ТЕКУЩАТА (dev) база**

Run: `node --env-file=.env.local scripts/health-check-db.mjs`
Expected: JSON с текущия dev хост + `shops` > 0 (демо магазините са там). Това е dev — запомни хоста за контраст.

- [ ] **Step 3: Commit**

```bash
git add scripts/health-check-db.mjs
git commit -m "chore(prod): health-check скрипт (валидатор коя база сочим)"
```

---

### Task 2: Създаване на прод Supabase проект (ПОТРЕБИТЕЛ)

**Роля:** ПОТРЕБИТЕЛ (Supabase UI — агентът НЕ може). Агентът чака и подготвя `.env.prod.local`.

- [ ] **Step 1: (потребител) Създай Supabase проект**

В https://supabase.com → New project:
- Име: `frizmo-shops-prod` (или подобно)
- Region: **EU (Frankfurt / eu-central-1)** — БГ латентност
- Запиши **паролата на базата** (трябва за connection strings)

- [ ] **Step 2: (потребител) Събери ключовете/connection strings**

От Project Settings:
- **API:** Project URL, `anon`/publishable key, `service_role`/secret key
- **Database → Connection string:**
  - Transaction pooler (`:6543`) → за `DATABASE_URL` (добави `?prepare=false` ако липсва; кодът ползва `prepare:false`)
  - Session pooler (`:5432`) → за `DATABASE_URL_MIGRATIONS`

- [ ] **Step 3: (агент, с данни от потребителя) Създай `.env.prod.local`**

Агентът създава `.env.prod.local` (gitignored) с ПРОД стойностите:
```
NEXT_PUBLIC_SUPABASE_URL="https://<prod-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<prod anon>"
SUPABASE_SECRET_KEY="<prod service_role>"
DATABASE_URL="postgresql://…:6543/postgres?prepare=false"        # transaction pooler
DATABASE_URL_MIGRATIONS="postgresql://…:5432/postgres"           # session pooler
```
(Стойностите идват от потребителя в чата; агентът само ги записва във файла.)

- [ ] **Step 4: Потвърди, че файлът е gitignored**

Run: `git check-ignore .env.prod.local`
Expected: извежда `.env.prod.local` (значи се игнорира). Ако НЕ → СПРИ, не продължавай (риск от commit на прод ключове).

---

### Task 3: Schema + setup срещу прод базата (АГЕНТ)

**Роля:** АГЕНТ. Прилага schema-та + storage + search към ПРАЗНАТА прод база.

**Interfaces:**
- Consumes: `.env.prod.local` (Task 2).

- [ ] **Step 1: Двойна проверка — `.env.prod.local` сочи ПРОД (не dev)**

Run: `node --env-file=.env.prod.local scripts/health-check-db.mjs`
Expected: JSON с **прод** хоста + `publicTables: 0` + `shops: null` + `orders: null` (таблиците още не са създадени — скриптът връща null, не гърми). Ако хостът е dev-ският от Task 1 Step 2 → СПРИ (грешен файл — сочиш dev база).

- [ ] **Step 2: `db:push` — schema към прод**

Run: `node --env-file=.env.prod.local ./node_modules/drizzle-kit/bin.cjs push`
Expected: „Changes applied" — всички таблици/enum-и/индекси/RLS влизат в прод базата.

- [ ] **Step 3: Storage bucket срещу прод**

Run: `node --env-file=.env.prod.local scripts/setup-storage.mjs`
Expected: bucket `shop-media` създаден (или „вече съществува").

- [ ] **Step 4: Search индекси срещу прод**

Run: `node --env-file=.env.prod.local scripts/setup-search.mjs`
Expected: pg_trgm extension + GIN индекси създадени.

- [ ] **Step 5: Health-check — прод е ГОТОВА и ПРАЗНА**

Run: `node --env-file=.env.prod.local scripts/health-check-db.mjs`
Expected: JSON с прод хоста + `publicTables` > 20 (всички таблици) + `shops: 0` + `orders: 0`. Чиста прод база с приложена schema. ✅

- [ ] **Step 6: (без commit — няма repo промяна)**

`.env.prod.local` е gitignored; skript-ите не са пипани. Нищо за commit тук.

---

### Task 4: Vercel Production env + първи прод деплой (ПОТРЕБИТЕЛ, с помощ от агента)

**Роля:** ПОТРЕБИТЕЛ (Vercel UI). Агентът дава точния списък + проверява резултата.

- [ ] **Step 1: (агент) Дай точния env списък за Vercel Production**

Агентът извежда за потребителя списъка (стойности от `.env.prod.local` + споделените). **Production scope**, критичните ПЪРВО:
```
# КРИТИЧНИ (fail-fast — без тях прод build пада):
NEXT_PUBLIC_SUPABASE_URL      = <prod URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <prod anon>
SUPABASE_SECRET_KEY           = <prod service_role>
DATABASE_URL                  = <prod transaction pooler :6543 ?prepare=false>
# ПРЕПОРЪЧАНИ (копирай СЪЩИТЕ стойности от dev Vercel env):
NEXT_PUBLIC_SITE_URL          = https://frizmo-shops.vercel.app   # временно; сменя се на домейна в Task 6
NEXT_PUBLIC_HERE_API_KEY      = <същия>
RESEND_API_KEY                = <същия>
PLATFORM_ADMIN_EMAILS         = <същия>
NEXT_PUBLIC_VAPID_PUBLIC_KEY  = <същия>
VAPID_PRIVATE_KEY             = <същия>
VAPID_SUBJECT                 = <същия>
CRON_SECRET                   = <същия или нов таен низ>
ECONT_API_BASE                = https://demo.econt.com/ee/services
EPAY_API_BASE                 = https://demo.epay.bg
# НЕ добавяй DATABASE_URL_MIGRATIONS във Vercel (само локално).
# Stripe (STRIPE_*) — остави за live активиране (билингът е „спящ").
```

- [ ] **Step 2: (потребител) Въведи env vars във Vercel → Production scope**

Vercel → Project → Settings → Environment Variables → за всяка: стойност + отметни само **Production**. (Внимавай `SUPABASE_SECRET_KEY` да НЕ е с `NEXT_PUBLIC_` префикс.)

- [ ] **Step 3: (потребител) Push на кода + Redeploy Production**

Това е ПЪРВИЯТ деплой към новата среда — носи и онлайн плащането (ePay). **Изисква изрично разрешение за push** (правило на проекта). При „да":
```bash
git push origin dev
```
После във Vercel → Deployments → Redeploy последния Production деплой (за да прочете новите env). (Push-ът обикновено сам тригва деплой; Redeploy гарантира новите env.)

- [ ] **Step 4: (потребител → агент) Health-check прод сайта**

- Отвори `https://frizmo-shops.vercel.app` → зарежда без грешки; **каталогът е ПРАЗЕН** (чиста база — 0 магазина). Това е правилно.
- Регистрирай тест търговец на прод (нов имейл) → влиза; онбордингът тръгва.
- (агент) За да потвърди, че прод сайтът пише в ПРОД базата: `node --env-file=.env.prod.local scripts/health-check-db.mjs` → `shops`/профили отразяват твоята регистрация (не dev данните).

---

### Task 5: Пълен поток на прод (ПОТРЕБИТЕЛ тества от 0)

**Роля:** ПОТРЕБИТЕЛ. Целта на цялата миграция — тест от нула на реалната среда.

- [ ] **Step 1: (потребител) Търговски поток**

На `frizmo-shops.vercel.app` (или домейна, ако Task 6 е готов):
- Регистрация като търговец → създай магазин → добави продукт (със снимка → проверява storage) → публикувай.
- Магазинът се вижда на `/s/{slug}`; каталогът вече показва твоя магазин.

- [ ] **Step 2: (потребител) Купувачески + плащане поток**

- Свържи ePay в dashboard (реален demo merchant KIN/secret — виж [[online-payments-feature]]).
- В ePay demo регистрацията сложи **URL for receiving notifications** = `https://frizmo-shops.vercel.app/api/payments/epay/notify` (или домейна) — сега е публичен → webhook-ът ще работи.
- Купувач: добави продукт → checkout → „Карта (ePay)" → плати с ePay demo customer.
- ✅ Webhook потвърждава → поръчката става „Приета"; наличността намаля. **Пълен цикъл от 0.**

- [ ] **Step 2 бележка:** ако нещо гръмне — това е реален тест, не блокер за плана; докладвай на агента за диагноза.

---

### Task 6: Домейн `frizmoshops.bg` (ПОТРЕБИТЕЛ, паралелно/после)

**Роля:** ПОТРЕБИТЕЛ (Vercel Domains + SuperHosting DNS + Resend). Не блокира Task 4/5.

- [ ] **Step 1: (потребител) Добави домейна във Vercel**

Vercel → Settings → Domains → Add `frizmoshops.bg` (реши `www` → apex redirect или обратно). Vercel показва нужните DNS записи (A за apex / CNAME за www).

- [ ] **Step 2: (потребител) Въведи DNS записите в SuperHosting**

В SuperHosting DNS панела → добави записите от Vercel. Изчакай propagation + Vercel авто-SSL (Let's Encrypt).

- [ ] **Step 3: (потребител) Провери, че домейнът зарежда**

`https://frizmoshops.bg` → прод сайтът (същият като `.vercel.app`), валиден SSL.

- [ ] **Step 4: (потребител) Смени `NEXT_PUBLIC_SITE_URL` → домейна**

Vercel Production env: `NEXT_PUBLIC_SITE_URL = https://frizmoshops.bg` → **Redeploy**.

- [ ] **Step 5: (потребител) Resend домейн верификация**

Resend → Domains → добави `frizmoshops.bg` → сложи DKIM/SPF/TXT записите в SuperHosting DNS → верифицирай. После имейлите тръгват от `shops@frizmoshops.bg` (сега е `frizmo.bg`).

- [ ] **Step 6: (потребител) Обнови ePay/webhook URL-и към домейна**

В ePay настройките → URL за нотификации = `https://frizmoshops.bg/api/payments/epay/notify`. (Аналогично при Stripe live по-късно: `…/api/webhooks/stripe`.)

- [ ] **Step 7: (агент) Провери линкове/OG/canonical/sitemap**

Run: `curl -s https://frizmoshops.bg/sitemap.xml | head -5` и провери OG/canonical на 1-2 страници → сочат `frizmoshops.bg` (кодът ползва `NEXT_PUBLIC_SITE_URL`). Docs проверка, не код.

---

### Task 7: Документация + памет (АГЕНТ)

**Роля:** АГЕНТ. Записва новата двусредова реалност.

- [ ] **Step 1: Обнови `env-vars-reference` паметта**

Отрази dev vs prod: една база вече НЕ е вярно; прод ключове във Vercel Production scope; `.env.prod.local` (локално, gitignored) за агентски команди; `DATABASE_URL_MIGRATIONS` не във Vercel.

- [ ] **Step 2: Създай `prod-environment` памет + ред в `MEMORY.md`**

Нов файл: прод Supabase project ref (без ключове!), домейн статус, Vercel Production scope модел, health-check скриптът, „прод чист — тества се от 0". Линкове към [[online-payments-feature]], [[stripe-billing-status]], [[env-vars-reference]].

- [ ] **Step 3: Обнови `docs/WORKLOG.md`**

Нов Дневник ред: prod среда отделена (чиста база + Vercel Production env + домейн), текущ commit. + текущо състояние блок.

- [ ] **Step 4: Commit**

```bash
git add docs/WORKLOG.md
git commit -m "docs: production среда отделена (prod Supabase + Vercel + домейн) — WORKLOG"
```
(Паметта е извън repo-то — не се commit-ва.)

---

## Финал (след всички задачи)

- [ ] Прод базата е чиста + със schema (`health-check-db.mjs` → `shops: 0`, `publicTables` > 20).
- [ ] Прод сайтът (`.vercel.app` и/или домейн) зарежда, пише в ПРОД базата, каталогът празен до реален търговец.
- [ ] Потребителят е минал целия поток от 0 (магазин → продукт → ePay → плащане → поръчка) на прод.
- [ ] Домейн + Resend + ePay webhook URL сочат `frizmoshops.bg` (ако DNS е готов; иначе `.vercel.app` временно).
- [ ] `.env.local` НЕ съдържа прод ключове; `.env.prod.local` gitignored; `SUPABASE_SECRET_KEY` не е `NEXT_PUBLIC_`.
- [ ] Docs/памет обновени.
- [ ] Докладвай: коя фаза е готова, какво чака (DNS / външни ключове).

## Отбелязани отклонения / за преглед при изпълнение

- **Формат:** това е runbook (инфра), не TDD код — затова „тестовете" са health-check заявки, а „кодът" са команди/UI стъпки. Стъпките с роля ПОТРЕБИТЕЛ агентът НЕ ги изпълнява — изчаква и дава точни инструкции.
- **Push разрешение (Task 4 Step 3):** ПЪРВИЯТ прод деплой носи и всичкия неpush-нат код (ePay + профил полиране). Агентът пита изрично преди push.
- **Prod connection string формат:** Supabase понякога дава pooler URL с `?pgbouncer=true` / различен потребител (`postgres.<ref>`). Копирай ТОЧНО от Supabase UI; агентът само записва. Ако `db:push` гръмне за връзка → сверявай session pooler (:5432) за миграции.
- **Region заключване:** Supabase region се избира при създаване и НЕ се сменя после — EU Frankfurt е решено.
- **Backup/PITR:** извън обхвата тук; отбелязано за скоро след първия реален търговец ([[production-audit-2026-07-09]]).
