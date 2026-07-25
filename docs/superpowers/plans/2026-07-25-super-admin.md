# Супер-админ команден център — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (INLINE — правилото на проекта забранява паралелни субагенти/workflow). Steps use checkbox (`- [ ]`).

**Goal:** Разширяваме `/admin` в 5-табов read-only команден център (Общ преглед · Магазини · Монетизация · Потребители · Поръчки), за да вижда супер-админът всичко на платформата.

**Architecture:** Рефакторираме `admin/page.tsx` да ползва `<Tabs>` (`?tab=`). Текущите метрики+магазини се разпределят в табове „Общ преглед"/„Магазини". Три нови таба (Монетизация/Потребители/Поръчки) с нови read-only queries. Потребителите идват от Supabase `auth.admin.listUsers` (server-only). Никакви нови мутации.

**Tech Stack:** Next.js 16 Server Components, Drizzle (rawSql за агрегати), Supabase admin API, Tailwind 4, `ui/Tabs`+`Table`.

## Global Constraints

- **requireAdmin() гард** на страницата (вече има) — всички нови queries след него.
- **Пари = integer евроцентове**; показване през `formatPrice()`.
- **Потребителски списък САМО през `createSupabaseAdmin`** (SUPABASE_SECRET_KEY, server-only, import "server-only") — никога NEXT_PUBLIC.
- **UI текст на български**, типографски кавички „…"; без емоджита (ползвай Badge/Icon).
- **Read-only** — никакви нови мутации; съществуващите действия (AdminShopActions, AdminInvoiceRetry) остават.
- **Gate преди commit:** `pnpm check`. Node: prepend `/c/nvm4w/nodejs` към PATH (Git Bash).
- **Tabs API:** `<Tabs tabs={[{key,label}]} ariaLabel paramName="tab"><TabPanel tabKey="...">`. Мести `?status=`/`?page=` да съжителстват с `?tab=`.
- **Няма push** до изрично разрешение.

---

### Task 1: Нови query функции за монетизация + поръчки

**Files:**
- Modify: `src/db/queries/admin.ts`

**Interfaces:**
- Produces: `getMonetizationStats(): Promise<{ totalChargedCents: number; totalCreditsCents: number; unpaidCount: number; unpaidCents: number }>`.
- Produces: `getFeeInvoicesList(page: number): Promise<{ items: FeeInvoiceRow[]; total: number; page: number; pageSize: number }>` където `FeeInvoiceRow = { id, shopName, periodStart, amountDueCents, invBgStatus, chargesCents, creditsCents }`.
- Produces: `getFeeLedger(limit: number): Promise<FeeLedgerRow[]>` където `FeeLedgerRow = { id, shopName, type, amountCents, baseCents, occurredAt }`.
- Produces: `getPlatformOrders(filters: { page: number; status?: string }): Promise<{ items: PlatformOrderRow[]; total: number; page: number; pageSize: number }>` където `PlatformOrderRow = { id, orderNumber, shopName, totalCents, status, paymentType, createdAt }`.

- [ ] **Step 1: Прочети началото на admin.ts (импорти + стил на съществуващите queries)**

Run: `sed -n '1,15p' src/db/queries/admin.ts`
Виж: ползва ли `rawSql`/`db.execute`, какви типове връща (за консистентност).

- [ ] **Step 2: Добави getMonetizationStats**

```ts
export async function getMonetizationStats() {
  const rows = await db.execute(rawSql`
    select
      (select coalesce(sum(amount_cents),0) from fee_events where type='charge') as total_charged,
      (select coalesce(sum(amount_cents),0) from fee_events where type='credit') as total_credits,
      (select count(*) from fee_invoices where inv_bg_status in ('failed','skipped') or amount_due_cents > 0) as unpaid_count,
      (select coalesce(sum(amount_due_cents),0) from fee_invoices where amount_due_cents > 0) as unpaid_cents
  `);
  const r = (rows as unknown as Record<string, unknown>[])[0] ?? {};
  return {
    totalChargedCents: Number(r.total_charged ?? 0),
    totalCreditsCents: Number(r.total_credits ?? 0),
    unpaidCount: Number(r.unpaid_count ?? 0),
    unpaidCents: Number(r.unpaid_cents ?? 0),
  };
}
```

- [ ] **Step 3: Добави getFeeInvoicesList (пагинация, неплатени първо)**

```ts
const ADMIN_INV_PAGE_SIZE = 20;
export async function getFeeInvoicesList(page = 1) {
  const offset = (Math.max(1, page) - 1) * ADMIN_INV_PAGE_SIZE;
  const rows = await db.execute(rawSql`
    select fi.id, s.name as shop_name, fi.period_start, fi.amount_due_cents,
           fi.inv_bg_status, fi.charges_cents, fi.credits_cents
    from fee_invoices fi left join shops s on s.id = fi.shop_id
    order by (fi.amount_due_cents > 0) desc, fi.period_start desc
    limit ${ADMIN_INV_PAGE_SIZE} offset ${offset}
  `);
  const [{ total }] = (await db.execute(rawSql`select count(*)::int as total from fee_invoices`)) as unknown as { total: number }[];
  const items = (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), shopName: (r.shop_name as string) ?? "—",
    periodStart: new Date(r.period_start as string),
    amountDueCents: Number(r.amount_due_cents), invBgStatus: (r.inv_bg_status as string) ?? null,
    chargesCents: Number(r.charges_cents), creditsCents: Number(r.credits_cents),
  }));
  return { items, total: Number(total ?? 0), page: Math.max(1, page), pageSize: ADMIN_INV_PAGE_SIZE };
}
```

- [ ] **Step 4: Добави getFeeLedger**

```ts
export async function getFeeLedger(limit = 30) {
  const rows = await db.execute(rawSql`
    select fe.id, s.name as shop_name, fe.type, fe.amount_cents, fe.base_cents, fe.created_at
    from fee_events fe left join shops s on s.id = fe.shop_id
    order by fe.created_at desc limit ${limit}
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), shopName: (r.shop_name as string) ?? "—",
    type: r.type as "charge" | "credit", amountCents: Number(r.amount_cents),
    baseCents: Number(r.base_cents), occurredAt: new Date(r.created_at as string),
  }));
}
```

- [ ] **Step 5: Добави getPlatformOrders (филтър по статус + пагинация)**

```ts
const ADMIN_ORDER_PAGE_SIZE = 25;
export async function getPlatformOrders(filters: { page?: number; status?: string }) {
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * ADMIN_ORDER_PAGE_SIZE;
  const statusOk = ["new","confirmed","shipped","completed","cancelled","pending_payment"].includes(filters.status ?? "");
  const whereClause = statusOk ? rawSql`where o.status = ${filters.status}` : rawSql``;
  const rows = await db.execute(rawSql`
    select o.id, o.order_number, s.name as shop_name, o.total_cents, o.status, o.payment_type, o.created_at
    from orders o left join shops s on s.id = o.shop_id
    ${whereClause}
    order by o.created_at desc limit ${ADMIN_ORDER_PAGE_SIZE} offset ${offset}
  `);
  const countRows = await db.execute(rawSql`select count(*)::int as total from orders o ${whereClause}`);
  const total = Number((countRows as unknown as { total: number }[])[0]?.total ?? 0);
  const items = (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), orderNumber: Number(r.order_number), shopName: (r.shop_name as string) ?? "—",
    totalCents: Number(r.total_cents), status: r.status as string,
    paymentType: r.payment_type as string, createdAt: new Date(r.created_at as string),
  }));
  return { items, total, page, pageSize: ADMIN_ORDER_PAGE_SIZE };
}
```

- [ ] **Step 6: Провери типове**

Run: `export PATH="/c/nvm4w/nodejs:$PATH" && npx tsc --noEmit 2>&1 | grep admin.ts || echo clean`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/db/queries/admin.ts
git commit -m "feat(admin): queries за монетизация + fee ledger + платформени поръчки"
```

---

### Task 2: Потребителски списък (Supabase admin API)

**Files:**
- Create: `src/db/queries/admin-users.ts`

**Interfaces:**
- Produces: `getAdminUsers(page: number): Promise<{ items: AdminUserRow[]; total: number; page: number; pageSize: number }>` където `AdminUserRow = { id, email, provider, confirmed: boolean, lastSignInAt: Date | null, createdAt: Date, fullName: string | null, role: string | null, shopCount: number }`.

- [ ] **Step 1: Създай файла**

```ts
import "server-only";
import { inArray } from "drizzle-orm";
import { db, profiles, shops } from "@/db";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_USERS_PAGE_SIZE = 30;

export interface AdminUserRow {
  id: string; email: string; provider: string | null;
  confirmed: boolean; lastSignInAt: Date | null; createdAt: Date;
  fullName: string | null; role: string | null; shopCount: number;
}

export async function getAdminUsers(page = 1) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page: Math.max(1, page), perPage: ADMIN_USERS_PAGE_SIZE });
  if (error || !data) return { items: [], total: 0, page, pageSize: ADMIN_USERS_PAGE_SIZE };

  const ids = data.users.map((u) => u.id);
  const profRows = ids.length
    ? await db.select({ id: profiles.id, fullName: profiles.fullName, preferredRole: profiles.preferredRole }).from(profiles).where(inArray(profiles.id, ids))
    : [];
  const shopRows = ids.length
    ? await db.select({ ownerId: shops.ownerId }).from(shops).where(inArray(shops.ownerId, ids))
    : [];
  const profMap = new Map(profRows.map((p) => [p.id, p]));
  const shopCount = new Map<string, number>();
  for (const s of shopRows) shopCount.set(s.ownerId, (shopCount.get(s.ownerId) ?? 0) + 1);

  const items: AdminUserRow[] = data.users.map((u) => ({
    id: u.id, email: u.email ?? "—",
    provider: (u.app_metadata?.provider as string) ?? null,
    confirmed: Boolean(u.email_confirmed_at),
    lastSignInAt: u.last_sign_in_at ? new Date(u.last_sign_in_at) : null,
    createdAt: new Date(u.created_at),
    fullName: profMap.get(u.id)?.fullName ?? null,
    role: (profMap.get(u.id)?.preferredRole as string) ?? null,
    shopCount: shopCount.get(u.id) ?? 0,
  }));
  return { items, total: data.total ?? items.length, page: Math.max(1, page), pageSize: ADMIN_USERS_PAGE_SIZE };
}
```

- [ ] **Step 2: Провери типове (profiles.preferredRole/fullName + shops.ownerId съществуват)**

Run: `export PATH="/c/nvm4w/nodejs:$PATH" && npx tsc --noEmit 2>&1 | grep admin-users || echo clean`
Expected: clean. Ако `data.total` не съществува в типа → ползвай `items.length` fallback (вече е така).

- [ ] **Step 3: Commit**

```bash
git add src/db/queries/admin-users.ts
git commit -m "feat(admin): потребителски списък от Supabase admin API + profiles/shops join"
```

---

### Task 3: Read-only компоненти за трите нови таба

**Files:**
- Create: `src/components/dashboard/admin-monetization.tsx`
- Create: `src/components/dashboard/admin-users-table.tsx`
- Create: `src/components/dashboard/admin-orders-table.tsx`

**Interfaces:**
- Consumes: типовете от Task 1/2 (FeeInvoiceRow, FeeLedgerRow, AdminUserRow, PlatformOrderRow, MonetizationStats).
- Produces: 3 презентационни Server Component-а (props → таблици). Без "use client" (само показват данни).

- [ ] **Step 1: admin-monetization.tsx (метрики карти + фактури таблица + ledger таблица)**

Props: `{ stats, invoices, ledger, invoiceActions? }`. Метрики: общо начислени, кредити, неплатени (брой+сума). Таблица фактури: магазин/период/дължимо/inv.bg статус (+ AdminInvoiceRetry за failed). Таблица ledger: магазин/тип(Badge charge=success/credit=warning)/сума/база/дата. Ползвай `Table/THead/TRow/TH/TBody/TCell/Card/Badge` + `formatPrice`. Дати през `Intl.DateTimeFormat("bg-BG")`.

- [ ] **Step 2: admin-users-table.tsx**

Props: `{ users: AdminUserRow[] }`. Колони: имейл, роля(Badge), провайдър, потвърден(Badge success/warning), последен вход, регистриран, магазини. Празен state ако няма.

- [ ] **Step 3: admin-orders-table.tsx**

Props: `{ orders: PlatformOrderRow[] }`. Колони: №, магазин, сума(formatPrice), статус(Badge по статуса), плащане, дата. Празен state.

- [ ] **Step 4: Провери типове + control chars**

Run: `grep -nP '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' src/components/dashboard/admin-monetization.tsx src/components/dashboard/admin-users-table.tsx src/components/dashboard/admin-orders-table.tsx && echo CTRL || echo clean`
Run: `export PATH="/c/nvm4w/nodejs:$PATH" && npx tsc --noEmit 2>&1 | grep "admin-" || echo clean`
Expected: clean + clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/admin-monetization.tsx src/components/dashboard/admin-users-table.tsx src/components/dashboard/admin-orders-table.tsx
git commit -m "feat(admin): read-only компоненти за монетизация/потребители/поръчки"
```

---

### Task 4: Рефакторинг на admin/page.tsx в 5-табов

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: всички queries (T1/T2) + компоненти (T3) + съществуващите (getPlatformStats, getAdminShops, getProblemInvBgInvoices, AdminShopActions, AdminInvoiceRetry).

- [ ] **Step 1: Разшири searchParams типа + зареди всички данни**

`searchParams`: `{ tab?, search?, status?, page?, orderStatus?, invPage?, userPage?, orderPage? }`. Зареди в `Promise.all`: stats, adminShops, problemInvoices (има) + monetizationStats, feeInvoices, feeLedger, adminUsers, platformOrders (нови). Обемът е малък (1 админ) → зареждаме всичко.

- [ ] **Step 2: Обвий в `<Tabs>` с 5 таба**

```tsx
<Tabs ariaLabel="Админ панел" tabs={[
  { key: "overview", label: "Общ преглед" },
  { key: "shops", label: "Магазини" },
  { key: "monetization", label: "Монетизация" },
  { key: "users", label: "Потребители" },
  { key: "orders", label: "Поръчки" },
]}>
  <TabPanel tabKey="overview">{/* 5 метрики карти + монетизационни акценти + проблемни inv.bg */}</TabPanel>
  <TabPanel tabKey="shops">{/* текущият списък + филтри + пагинация — местят се тук */}</TabPanel>
  <TabPanel tabKey="monetization"><AdminMonetization .../></TabPanel>
  <TabPanel tabKey="users"><AdminUsersTable users={adminUsers.items} /></TabPanel>
  <TabPanel tabKey="orders"><AdminOrdersTable orders={platformOrders.items} /></TabPanel>
</Tabs>
```
⚠️ Съществуващите магазин филтри ползват `?status=`/`?page=`. Понеже Tabs ползва `?tab=`, те съжителстват — при клик на статус филтър добави `&tab=shops` към линка, за да остане на таба. Същото за пагинацията.

- [ ] **Step 3: pnpm check**

Run: `export PATH="/c/nvm4w/nodejs:$PATH" && pnpm check 2>&1 | grep -iE "Tests |error|Compiled|Failed"`
Expected: тестове минават, build OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): 5-табов команден център (преглед/магазини/монетизация/потребители/поръчки)"
```

---

### Task 5: Активиране на супер-админа + жив тест

**Files:** (без код — конфиг + Playwright)

- [ ] **Step 1: Добави админ имейл локално (dev тест)**

Провери `.env.local` дали `PLATFORM_ADMIN_EMAILS` съдържа `e.s.kostadinov34@gmail.com` (акаунтът, с който тестваме). Ако не — добави го (само локално, за теста). Run: `grep PLATFORM_ADMIN_EMAILS .env.local`.

- [ ] **Step 2: Playwright жив тест**

Влез като продавач (сесията вече е) → навигирай `/admin` → провери всеки таб зарежда: Общ преглед (метрики), Магазини (списък), Монетизация (фактури/ledger), Потребители (акаунти), Поръчки (списък). Не-админ → 404 (провери с друг акаунт или без имейла в env).

- [ ] **Step 3: Финален gate + push (след разрешение)**

Run: `export PATH="/c/nvm4w/nodejs:$PATH" && pnpm check`
После: питай за push → `git push origin dev` + `git push origin dev:main`.

- [ ] **Step 4: Прод активиране (ръчно, потребителят)**

Добави `supportfrizmo@gmail.com` (или e.s.kostadinov34) в `PLATFORM_ADMIN_EMAILS` във **Vercel Production** → Redeploy. Инструктирай потребителя.

---

## Self-Review бележки
- **Spec coverage:** Таб 1 Общ преглед (T4) ✓; Таб 2 Магазини (T4, местене) ✓; Таб 3 Монетизация (T1 queries + T3 компонент) ✓; Таб 4 Потребители (T2 + T3) ✓; Таб 5 Поръчки (T1 + T3) ✓; активиране (T5) ✓.
- **Сигурност:** requireAdmin вече на page; потребители само през createSupabaseAdmin (server-only). Read-only.
- **Гоча:** Tabs `?tab=` + магазин `?status=/?page=` съжителстват — линковете добавят `&tab=shops`.
- **Няма нови мутации** → няма нужда от нови тестове освен ръчния/Playwright; query-тата са SQL (проверени на живо в T5).
