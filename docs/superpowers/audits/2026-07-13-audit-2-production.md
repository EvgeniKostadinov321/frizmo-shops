# Одит 2 — Production readiness · 2026-07-13

**Обхват:** готовност за реален продакшън с истински търговци — env/secrets
хигиена и ротация, fail-fast покритие на новите критични ключове, error
boundaries / graceful degradation на новите пътища, cron гардове, backup/PITR,
логове без чувствителни данни. Метод: inline проверка на `env.ts`,
`instrumentation.ts`, `vercel.json`, `.gitignore`, cron routes, error boundaries
по route групи, и логовете в новия payment/courier код.

**Резюме:** Базовата хигиена е добра — `.env*` gitignored (потвърдено с
`git check-ignore`), fail-fast env валидация при startup, cron гардове налице,
никакви creds в логовете. Няколко процесни/оперативни gap-а за затваряне преди
реален старт: **ротация на прод креденшълите (минали през чата)**, `CRON_SECRET`
извън fail-fast warnings, Sentry все още липсва, и решение demo/prod ePay за
първия тест.

Severity: 🔴 критична · 🟠 важна · 🟡 дребна · ⚙️ оперативна (не код)

---

## 🔴 P2-01 ⚙️ — Ротация на прод креденшълите, минали през чата

**Къде:** [[prod-environment]] · `.env.prod.local`

**Проблем:** При setup-а на прод средата database паролата (`DATABASE_URL` /
`DATABASE_URL_MIGRATIONS`) и `SUPABASE_SECRET_KEY` бяха попълнени/обсъдени в чата.
Всичко, минало през чат, трябва да се счита за компрометирано за прод цели.

**Ефект:** Ако тези стойности изтекат, дават пълен достъп до прод базата
(service_role заобикаля RLS). Прод още е чист, така че цената сега е нулева — но
трябва да се ротира **преди** реални търговци/поръчки.

**Препоръка (преди Task 5 „тест от 0"):**
1. Supabase → Settings → Database → **Reset database password** → обнови
   `.env.prod.local` (`DATABASE_URL` + `DATABASE_URL_MIGRATIONS`) + Vercel
   `DATABASE_URL`.
2. Ротирай `SUPABASE_SECRET_KEY` (Supabase → Settings → API) → обнови Vercel +
   `.env.prod.local`.
3. Redeploy на Vercel (env промяна не се прилага към стар билд).
Отбелязано вече в [[prod-environment]] като TODO — тук се вдига до блокер за
прод старта.

---

## 🟠 P2-02 — `CRON_SECRET` не е в fail-fast/warning списъка → cron тихо връща 401 при липса — ✅ ПОПРАВЕНО (код)

**Къде:**
- `src/env.ts:44-58` — warnings списъкът (RESEND/VAPID/SITE_URL/ADMIN/STRIPE) — **няма CRON_SECRET**
- `src/app/api/cron/expire-payments/route.ts:17-19` + `abandoned-carts/route.ts:13` — `if (!secret || auth !== Bearer) 401`

**Проблем:** Ако `CRON_SECRET` липсва на прод, cron гардът връща 401 на всяко
изпълнение — тихо. Нито билдът пада (не е критичен), нито `validateEnv` предупреждава.
Резултат: **expire-payments не се пуска** (pending поръчки не се auto-cancel-ват,
наличности заседват) и abandoned-carts не праща напомняния — без никакъв сигнал.

**Ефект:** Пряко застъпва Одит #3 (S3-02): без работещ expire-payments cron,
неплатените онлайн поръчки никога не се отменят и наличността им не се връща.

**Препоръка:** Добави в `validateEnv` warnings:
`if (!process.env.CRON_SECRET) warnings.push("CRON_SECRET — Vercel Cron ще връща 401 (expire-payments/abandoned-carts няма да работят).")`.
Провери изрично, че `CRON_SECRET` е зададен във Vercel Production scope при Task 4.

---

## 🟠 P2-03 — Sentry (error tracking) все още липсва

**Къде:** `package.json` (няма `@sentry/*`) · [[production-audit-2026-07-09]] (чака DSN)

**Проблем:** Няма централизирано error tracking. Всички грешки отиват в
`console.error` → Vercel logs, които са ефимерни и без alerting. Критичните нови
пътища (webhook несъответствия — S3-02, waybill грешки, ePay build fail) логват
структурирано, но никой не бива уведомен активно.

**Ефект:** На прод с реални пари (ePay) „тихите" находки от Одити #1/#3
(paid-after-expire, amount-mismatch) ще се логват, но няма да предизвикат alert →
търговецът/операторът може да не научи за проблемен платежен случай навреме.

**Препоръка:** Не е блокер за setup-а, но е **силно препоръчан преди реален обем**.
Изисква Sentry проект + DSN (решение на потребителя — [[external-work-scope]]).
Минимум: закачи Sentry за `console.error` със `scope`-овете, които вече слагаме
(`epay-*`, `generate-waybill`, `expire_payment_failed`) → готови за alert правила.

---

## 🟡 P2-04 — `/account` пътищата разчитат на наследения `(catalog)/error.tsx` (нямат собствен boundary)

**Къде:** `src/app/(catalog)/error.tsx` (съществува) · `/account/*` е под `(catalog)` групата · няма `/account/error.tsx` или `loading.tsx`

**Наблюдение:** Глобалният профил (`/account`, `/account/orders|favorites|addresses|settings`)
живее в `(catalog)` route групата, така че при грешка ще хване `(catalog)/error.tsx`
— т.е. НЕ остава без boundary. Но няма профил-специфичен error/loading UI, а
страниците правят по няколко DB заявки (`getBuyerOrdersGlobal` и т.н.).

**Ефект:** Нисък — има покриващ boundary. Само UX нюанс (генеричен catalog error
екран вместо профил-контекстен; без skeleton при бавна заявка).

**Препоръка:** По избор. Ако профилът се разраства, добави `/account/loading.tsx`
(skeleton) за възприемана скорост. Не блокер. (Пресича се с Одит #5 — loading/empty
състояния на новите view-та.)

---

## 🟡 P2-05 ⚙️ — Решение demo vs prod ePay за първия „тест от 0"

**Къде:** `src/actions/orders.ts:423` — `EPAY_API_BASE ?? "https://www.epay.bg"` (**production** default)

**Проблем:** Fallback-ът сочи production ePay. За реалния старт това е правилно.
Но потребителят иска да тества целия поток от 0 на прод средата (Task 5) — с
production ePay това означава реални плащания (или регистриран demo профил в
demo.epay.bg, който изисква `EPAY_API_BASE=https://demo.epay.bg` + demo креденшъли).

**Ефект:** Ако прод env-ът няма `EPAY_API_BASE` и се ползват demo креденшъли →
подписът няма да съвпадне (различни secret-и demo vs prod) → плащането гърми.

**Препоръка (решение за Task 5):**
- (a) Тествай онлайн плащането на прод с **demo ePay**: сложи
  `EPAY_API_BASE=https://demo.epay.bg` във Vercel Production + demo креденшъли в
  магазина. Пълният цикъл (redirect + webhook) работи, без реални пари.
- (b) За реален старт после: махни `EPAY_API_BASE` (или го сложи на prod) +
  реалните ePay креденшъли на търговеца.
Реши това изрично при Task 4/5, за да не се обърка demo/prod подписът.

---

## ✅ Проверено и чисто

- **`.env*` gitignored:** `.gitignore:34` `.env*` (+ `!.env.example`); потвърдено
  с `git check-ignore .env.prod.local` → IGNORED. Никакви секрети в git.
- **Fail-fast env:** `validateEnv()` се вика при startup през
  `instrumentation.ts` (`register()`, само Node runtime); 4-те критични
  (`DATABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`)
  хвърлят при липса → деплой пада с четим списък вместо тих провал.
- **Cron гардове:** и двата cron-а (`abandoned-carts`, `expire-payments`) са с
  `CRON_SECRET` Bearer гард; дефинирани в `vercel.json` crons (0 * * * * и
  */15 * * * *). ⚠️ виж P2-02 за липсата в warnings.
- **Логове без creds:** payment/courier логовете слагат само `scope` + `String(err)`
  + идентификатори (orderId/invoice) — НЕ `credentials`. ePay secret / courier
  парола никога не влизат в лог (`payment-confirm.ts:44`, `couriers.ts:74,155,202`,
  `waybills.ts:93`). Basic auth за Еконт е в header, не в URL → не изтича през err.
- **Error boundaries:** всяка route група има `error.tsx`
  (`(catalog)/(storefront)/(dashboard)/(marketing)/(auth)/(builder)/admin`) +
  `global-error.tsx`; storefront има и `loading.tsx`. Новите пътища са покрити.
- **Webhook не сваля сървъра:** `epay/notify/route.ts` е в try/catch → връща 500
  „ERR" при неочаквана грешка вместо да хвърли; ePay ще ретрайва.
- **Graceful degradation:** опционалните ключове (RESEND/VAPID/SITE_URL/STRIPE)
  само предупреждават; куриер/ePay API base-овете имат fallback-и; известията са
  `Promise.allSettled` (не блокират отговора към купувача).
- **Прод база готовност:** отделна чиста прод Supabase (Frankfurt), schema +
  bucket + search приложени и потвърдени с health-check ([[prod-environment]]).

---

## Статус на находките

- [ ] P2-01 🔴⚙️ — ротирай прод DB парола + `SUPABASE_SECRET_KEY` преди Task 5
- [x] P2-02 🟠 — добави `CRON_SECRET` в `validateEnv` warnings ✅ (код: `src/env.ts`) · остава: провери/добави във Vercel prod + Redeploy (операционно)
- [ ] P2-03 🟠 — Sentry (чака DSN; препоръчан преди реален обем)
- [ ] P2-04 🟡 — по избор: `/account/loading.tsx` skeleton
- [ ] P2-05 🟡⚙️ — реши demo vs prod ePay за Task 5 (`EPAY_API_BASE`)

**Backup/PITR:** Supabase дневен backup е наличен по подразбиране; PITR е платена
опция — отбелязан, не блокер за setup (прод стартира чист). Реши при реален обем.

Свързано: [[prod-environment]], [[env-vars-reference]], [[production-audit-2026-07-09]],
[[external-work-scope]] (Sentry/домейн), `2026-07-13-audit-3-payments.md` (S3-02 —
зависи от работещ expire-payments cron → P2-02).
