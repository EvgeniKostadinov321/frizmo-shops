# Plan 6: Платформен админ + Stripe абонаменти — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (Inline). Steps use checkbox syntax.
> **Ред по желание на потребителя:** Фаза А (админ) първо; Фаза Б (Stripe) — най-накрая, като финална стъпка преди launch.

**Goal:** Собственикът на платформата управлява магазините (преглед, скриване, блокиране, статистика) от скрит `/admin` панел; накрая Stripe прави абонаментите реални (Starter/Pro, trial lifecycle, истински `checkPlanLimit`).

---

## Ключови решения

1. **Кой е админ**: env `PLATFORM_ADMIN_EMAILS` (comma-separated). `requireAdmin()` проверява имейла на сесията; не-админ получава 404 (панелът не издава съществуването си).
2. **Действия върху магазин**: „Скрий" (→ `suspended`, обратимо с „Възстанови" → `published`) и „Блокирай" (→ `blocked`, обратимо → `draft`, търговецът трябва да публикува наново). Данни не се трият никога.
3. **Имейлите на собствениците** идват от `auth.users` през raw SQL join (Drizzle не декларира auth схемата).
4. **Stripe (Фаза Б)**: Checkout Sessions + customer portal + webhooks (`checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted`); lifecycle `trial → active → grace → suspended`; `getShopPlan()` чете от `subscriptions`; дневен reconciliation през Vercel cron. Trial: 14 дни от създаването на магазина (без Stripe запис до първото плащане).

---

## Фаза А: Платформен админ

### Task A1: Достъп + заявки
- `.env`: `PLATFORM_ADMIN_EMAILS` (локално: имейлите на собственика).
- `src/lib/auth.ts`: `requireAdmin()` — user + имейл в списъка, иначе `notFound()`.
- `src/db/queries/admin.ts`: `getPlatformStats()` (магазини по статус, поръчки, оборот, търговци), `getAdminShops({search, status, page})` — raw SQL с owner email + брой продукти/поръчки.

### Task A2: UI + действия
- `/admin/page.tsx`: статистически карти + таблица магазини (име→линк към сайта, собственик, статус, продукти, поръчки, дата) + търсене/филтър статус + пагинация.
- `src/actions/admin.ts`: `setShopStatus(shopId, action)` с проверка `requireAdmin`, позволени преходи, revalidate на публичните пътища.
- Ред действия: Скрий/Възстанови, Блокирай/Отблокирай (ConfirmDialog за блокиране).
- `loading.tsx` + линк никъде в UI (само директен URL).

### Task A3: e2e + гейт
- e2e: админ имейл вижда `/admin` и скрива магазин → магазинът дава 404 публично → възстановява го; обикновен потребител на `/admin` → 404. (Тестов админ имейл се добавя във `PLATFORM_ADMIN_EMAILS` за dev: e2e акаунтът се създава с фиксиран имейл `frizmo.e2e.admin@gmail.com`.)
- `pnpm check` + suite; push; roadmap бележка „Фаза А ✅".

## Фаза Б: Stripe (изпълнява се последна, при изрично „старт" от потребителя)

### Task B1: Продукти/цени в Stripe + env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs)
### Task B2: `subscriptions` логика — `getShopPlan()` реален: trial 14 дни от `shops.createdAt`; после по subscriptions реда; изтекъл trial без абонамент → starter лимити + банер.
### Task B3: Billing таб: текущ план/статус, Checkout бутони, Customer Portal линк.
### Task B4: Webhook route + lifecycle + `checkPlanLimit` навсякъде (продукти лимит, Pro секции/теми/промоции гейт).
### Task B5: Дневен reconciliation (Vercel cron) + e2e със Stripe test mode + launch checklist по спец §14.

---

## Definition of Done — Фаза А
- [ ] Админът вижда статистика и всички магазини; скрива/блокира/възстановява
- [ ] Не-админ получава 404 на /admin (e2e)
- [ ] Скрит магазин е невидим публично, търговецът вижда банер статуса си
- [ ] Гейт + suite зелени; push
