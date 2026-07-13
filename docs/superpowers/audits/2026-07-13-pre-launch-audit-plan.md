# Предстартови одити — план (2026-07-13)

Лека пътна карта за одитите преди финалните тестове/лайв старт. Причина: след
одитите от 2026-07-07 (security/a11y/perf/UX) + production readiness (2026-07-09)
натрупахме значителен нов код, който НЕ е одитиран: глобален купувачески профил,
куриерска интеграция (Еконт/Спиди), онлайн плащане (ePay, marketplace Модел А),
режим на сложност, dashboard табове, InfoHint, storefront конверсионни фийчъри.

**Метод:** inline, последователно, находки за преглед; резултат на всеки одит →
собствен файл `docs/superpowers/audits/2026-07-13-audit-N-<тема>.md`. Всяка находка:
описание · къде (`file:line`) · severity (критична/важна/дребна) · препоръка.

**Препоръчан ред:** #1 → #3 (плащанията са най-новото и най-рисковото — истински пари),
после #2 преди прод старта, после #4 и #5.

---

## Одит 1 — Security (нов код)

**Обхват:** сигурността на кода, писан след 2026-07-07.
- Онлайн плащане: webhook подпис (HMAC verify, timing-safe), идемпотентност
  (`payment_intents.providerRef`), сверка на сумата срещу подправяне, публичен
  endpoint защита (rate limit), INVOICE→магазин резолюция.
- Per-shop ключове (куриери + ePay `credentials` jsonb): никога `NEXT_PUBLIC_`,
  никога логвани, маскирани в UI; `createSupabaseAdmin` само сървърно.
- Marketplace изолация: `payment_intents`/`shop_payment_accounts` tenant-скоуп.
- Cross-tenant (`shopId`) / cross-buyer (`buyerId`) теч в новите заявки/мутации
  (глобален профил, куриери, плащане).
- Санитизация/Zod на новите входове; никакви stack traces към клиента/ePay.

**Защо:** плащания + чужди ключове = най-чувствителната нова повърхност.

---

## Одит 2 — Production readiness (лайв старт)

**Обхват:** готовност за реален продакшън с истински търговци.
- Env/secrets хигиена: dev/prod разделяне ([[prod-environment]]); ротация на
  ключовете, минали през чата (прод DB парола, `SUPABASE_SECRET_KEY`); fail-fast
  (`src/env.ts`) покрива новите критични.
- Error boundaries / graceful degradation на новите пътища (`/account`, checkout
  онлайн, dashboard плащане, webhook/cron routes).
- Cron гардове (`CRON_SECRET`) за abandoned-carts + expire-payments на прод.
- Backup / PITR готовност (Supabase настройка) — отбелязано, не блокер за setup.
- Логове: структурирани, без чувствителни данни; Sentry (предстои) като gap.

**Защо:** прод базата вече е отделена и чиста — тук проверяваме дали е безопасно
да пуснем реални хора върху нея.

---

## Одит 3 — Payments correctness & concurrency

**Обхват:** паричните потоци end-to-end под конкурентност.
- pending → webhook → confirm/cancel: race-ове (двоен webhook, webhook vs cron
  auto-cancel, късен PAID след cancel).
- Наличности при онлайн плащане: резервация при `createOrder`, връщане при
  cancel/expire, симетрия с офлайн пътя; `SELECT ... FOR UPDATE` покритие.
- Идемпотентност под конкурентни нотификации; status guards.
- Пари: integer евроцентове навсякъде, EUR↔ePay AMOUNT конверсия, без float.
- ePay валута (EUR vs BGN — отворен въпрос до жива проверка).

**Защо:** истински пари + конкурентни поръчки/webhook-и = скъпи бъгове, ако сгрешим.

---

## Одит 4 — Data-integrity & migrations

**Обхват:** цялост на данните и безопасност на schema промените.
- Schema дрифт: `db:push` без migration файлове — рискове при бъдещи прод промени.
- FK/индекси/RLS на новите таблици (`payment_intents`, `shop_payment_accounts`,
  `shop_courier_accounts`, `courier_offices`, `buyer_favorite_shops`, `buyerAddresses`).
- Anonymize/orphan логика: изтрит купувач (`buyerId→null`, не delete на поръчки),
  `onDelete` каскади/set null коректни.
- Снапшоти (order_items, courier/payment snapshots) — оцеляват промяна на продукта.
- Безопасен ли е следващ `db:push` на ПРОД (nullable/нови → без загуба).

**Защо:** прод стартира чист, но първите реални данни трябва да са неразрушими.

---

## Одит 5 — UX / a11y регресия (нови повърхности)

**Обхват:** новите UI повърхности спрямо design guide + a11y.
- Глобален профил (`/account`: табло/поръчки/любими/адреси/настройки, sidebar/табове),
  режим на сложност, dashboard табове, InfoHint (hover+клик+клавиатура+SR),
  storefront сърца, checkout онлайн метод + „Запазен адрес" дропдаун.
- Клавиатурна навигация, focus states, ARIA, screen reader обяви.
- Мобилно 375px; loading/empty/error състояние на всяко ново async view.
- Консистентност: токени (без hardcode), BG копи с типографски кавички, dark/light.

**Защо:** много нов UI влезе бързо — регресионна проверка преди реални потребители.

---

## Статус — ✅ ВСИЧКИ ИЗПЪЛНЕНИ (2026-07-13)

- [x] Одит 1 — Security → `2026-07-13-audit-1-security.md` (1🔴 + 3 по-леки)
- [x] Одит 2 — Production readiness → `2026-07-13-audit-2-production.md` (1🔴⚙️ + 2🟠 + 2🟡)
- [x] Одит 3 — Payments correctness & concurrency → `2026-07-13-audit-3-payments.md` (1🔴 + 2🟠 + 2🟡)
- [x] Одит 4 — Data-integrity & migrations → `2026-07-13-audit-4-data-integrity.md` (2🟠 + 2🟡)
- [x] Одит 5 — UX / a11y регресия → `2026-07-13-audit-5-ux-a11y.md` (1🟠 + 3🟡)

### Обобщение — какво ТРЯБВА преди онлайн старт (3 малки поправки + ротация)

**Блокери (малки, локализирани):**
1. **S1-01 🔴** — `payment_intents` unique индекс + `shopId` (иначе 2-ри магазин
   с ePay се чупи). `db:push` — приложи на прод ДОКАТО е чист (**P4-03**).
2. **S1-02 / S3-03 🟠** — ePay `URL_OK` + `?t=<token>` (иначе 404 след плащане,
   дори с 1 магазин).
3. **S3-01 🔴** — ръчен cancel на `pending_payment` да отменя и intent-а (иначе
   late webhook възкресява отменена поръчка).
4. **P2-01 🔴⚙️** — ротирай прод DB парола + `SUPABASE_SECRET_KEY` (минаха през чата).

**Силно препоръчани преди реален обем:**
- **P2-02 🟠** — `CRON_SECRET` в `validateEnv` + провери във Vercel (иначе
  expire-payments cron мълчи → застъпва S3-02).
- **S3-02 🟠** — логвай „paid-after-expire" + cron граница > ePay граница.
- **P4-01 🟠** — `deleteBuyerAccount` в транзакция (GDPR коректност).
- **P4-02 🟠** — реши: изтрит магазин трие ли поръчковата история.
- **P2-03 🟠** — Sentry (чака DSN).
- **P5-01 🟠** — submit не се re-enable-ва при ePay redirect.

**Дребни/по избор:** S1-03, S1-04, S3-04, S3-05, P2-04, P2-05, P4-04, P5-02/03/04.

**Нула критични в стария код** — всички находки са в новия (плащане/куриери/
профил). Основите (webhook подпис, buyer изолация, център-аритметика, RLS,
snapshot оцеляване) са солидни.

Свързано: `docs/superpowers/audits/2026-07-07-*` (предишни одити), [[online-payments-feature]],
[[courier-integration-feature]], [[buyer-account-feature]], [[prod-environment]],
[[production-audit-2026-07-09]], [[audit-cycle-2026-07-07]].
