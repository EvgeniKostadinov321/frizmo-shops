# Dashboard Tabs Implementation Plan (Фаза 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Разделяме 5 претрупани dashboard страници на табове по образеца на `/dashboard/website`, чрез един нов reusable `Tabs` примитив.

**Architecture:** Нов презентационен client компонент `ui/Tabs` + `ui/TabPanel` синхронизира активния таб с URL query param (`?tab=`) чрез плитка навигация (`history.replaceState`, без re-fetch). Всички панели са монтирани наведнъж (неактивните скрити с CSS `hidden`), така form/drawer/dirty state оцелява при смяна. Страниците остават server components; клиентският wrapper е `Tabs`. Нула нова бизнес логика.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4 (само токени), Vitest, TypeScript (строг).

## Global Constraints

- UI текстове на български; типографски кавички „…“ (прав `"` чупи стрингове/lint).
- Само дизайн токени (`brand-*`, `ink-*`, `surface-*`, `danger-*`) — никакви inline hex/px, никакви `dark:` варианти (тъмната тема идва от предефинирани токени).
- Touch targets ≥ 44px (`h-11`).
- Строг TypeScript, без `as any`.
- Всеки компонент с hook (вкл. `useId`, `useState`) е `"use client"`.
- ARIA: `role="tablist"`/`"tab"`/`"tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`, клавиатура ←/→/Home/End.
- Плитка навигация: `window.history.replaceState`, НЕ `router.push` (без re-fetch → drawer-ите оцеляват).
- Всички панели монтирани наведнъж; неактивните с `hidden` (CSS), не conditional unmount.
- Гейт: `pnpm check` (lint + unit + build) зелен преди финал. Не commit-вай `.env*`.
- Push към `dev` (=prod) само след изрично разрешение от потребителя.

## File Structure

- `src/components/ui/tabs.tsx` (NEW) — `Tabs` + `TabPanel` презентационен примитив.
- `src/components/ui/tabs.test.tsx` (NEW) — Vitest тестове за примитива.
- `src/components/ui/index.ts` (MODIFY) — barrel export.
- `src/app/(dashboard)/dashboard/fulfillment/page.tsx` (MODIFY) — 3 таба.
- `src/app/(dashboard)/dashboard/subscribers/page.tsx` (MODIFY) — 3 таба.
- `src/app/(dashboard)/dashboard/analytics/page.tsx` (MODIFY) — 3 таба (период над табовете).
- `src/components/dashboard/shop-form.tsx` (MODIFY) — 3 таба, marker при грешка, общ „Запази“ под табовете.
- `src/components/dashboard/product-form.tsx` (MODIFY) — 4 таба в „Детайлно“, marker.
- `src/db/queries/onboarding-status.ts` (MODIFY) — deep-link `?tab=` за релевантните стъпки.

---

### Task 1: `Tabs` + `TabPanel` примитив

**Files:**
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/tabs.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces:
  - `interface TabItem { key: string; label: string; marker?: boolean }`
  - `interface TabsProps { tabs: TabItem[]; children: React.ReactNode; paramName?: string; ariaLabel: string }`
  - `function Tabs(props: TabsProps): React.JSX.Element`
  - `interface TabPanelProps { tabKey: string; children: React.ReactNode }`
  - `function TabPanel(props: TabPanelProps): React.JSX.Element`
  - `Tabs` чете активния таб от `?<paramName>=`; при липсващ/невалиден → `tabs[0].key`. Клик → `history.replaceState` (плитко). Панелите се филтрират по `tabKey` съвпадение с активния; всички са в DOM, неактивните `hidden`.

- [ ] **Step 1: Write the failing test**

Създай `src/components/ui/tabs.test.tsx`. Проектът ползва Vitest + Testing Library. Провери съществуващ тест pattern първо (напр. има ли `@testing-library/react` — виж `package.json` devDeps и друг `*.test.tsx`). Ако Testing Library НЕ е налична, спри и попитай (не добавяй нова зависимост без разрешение).

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { Tabs, TabPanel } from "./tabs";

function setup() {
  return render(
    <Tabs
      ariaLabel="Тест"
      tabs={[
        { key: "a", label: "Първи" },
        { key: "b", label: "Втори", marker: true },
      ]}
    >
      <TabPanel tabKey="a">Съдържание A</TabPanel>
      <TabPanel tabKey="b">Съдържание B</TabPanel>
    </Tabs>,
  );
}

describe("Tabs", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("показва първия таб по подразбиране при липсващ ?tab", () => {
    setup();
    expect(screen.getByRole("tab", { name: "Първи" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("aria-selected", "false");
  });

  it("уважава валиден ?tab от URL", () => {
    window.history.replaceState(null, "", "/?tab=b");
    setup();
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("aria-selected", "true");
  });

  it("пада на първия таб при невалиден ?tab", () => {
    window.history.replaceState(null, "", "/?tab=zzz");
    setup();
    expect(screen.getByRole("tab", { name: "Първи" })).toHaveAttribute("aria-selected", "true");
  });

  it("клик сменя активния таб и обновява URL плитко", () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: /Втори/ }));
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("aria-selected", "true");
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("b");
  });

  it("стрелка надясно мести активния таб", () => {
    setup();
    const first = screen.getByRole("tab", { name: "Първи" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("aria-selected", "true");
  });

  it("рендерира всички панели (неактивните са hidden)", () => {
    setup();
    const panelB = screen.getByText("Съдържание B").closest("[role=tabpanel]");
    expect(panelB).toHaveAttribute("hidden");
    const panelA = screen.getByText("Съдържание A").closest("[role=tabpanel]");
    expect(panelA).not.toHaveAttribute("hidden");
  });

  it("показва marker на таб с marker:true", () => {
    setup();
    // marker е <span aria-hidden> точка; проверяваме data атрибут за стабилност
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("data-marker", "true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tabs`
Expected: FAIL — `Tabs`/`TabPanel` не съществуват (module not found).

- [ ] **Step 3: Write the implementation**

Създай `src/components/ui/tabs.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Children, isValidElement } from "react";

export interface TabItem {
  key: string;
  label: string;
  /** Показва точка на таба (напр. валидационна грешка в скрит таб). */
  marker?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  children: React.ReactNode;
  /** Име на query param, default "tab". */
  paramName?: string;
  ariaLabel: string;
}

export interface TabPanelProps {
  /** Трябва да съвпада с TabItem.key. */
  tabKey: string;
  children: React.ReactNode;
}

/** Панел на един таб. Рендерира се от Tabs (клонира се с активност). */
export function TabPanel({ children }: TabPanelProps) {
  return <>{children}</>;
}

function readParam(paramName: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(paramName);
}

export function Tabs({ tabs, children, paramName = "tab", ariaLabel }: TabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  /* Активният таб: от URL при mount; fallback първия. SSR рендерира първия
     (readParam връща null на сървъра) → клиентът синхронизира в effect. */
  const validKeys = tabs.map((t) => t.key);
  const [active, setActive] = useState<string>(tabs[0]?.key ?? "");

  useEffect(() => {
    const fromUrl = readParam(paramName);
    if (fromUrl && validKeys.includes(fromUrl)) setActive(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramName]);

  const select = useCallback(
    (key: string) => {
      setActive(key);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set(paramName, key);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [paramName],
  );

  /* Активният таб се скролва в изглед на мобилно (лентата е overflow-x-auto). */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-key="${active}"]`);
    el?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = validKeys.indexOf(active);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const nextKey = tabs[next]!.key;
    select(nextKey);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-key="${nextKey}"]`)
      ?.focus();
  }

  const panels = Children.toArray(children).filter(isValidElement) as React.ReactElement<TabPanelProps>[];

  return (
    <div className="flex flex-col gap-5">
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-surface-200 scrollbar-none"
      >
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.key}`}
              data-key={t.key}
              data-marker={t.marker ? "true" : undefined}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.key)}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${
                selected
                  ? "border-brand-600 text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-700"
              }`}
            >
              {t.label}
              {t.marker && (
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-danger-500" />
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t, i) => {
        const selected = t.key === active;
        const panel = panels[i];
        return (
          <div
            key={t.key}
            role="tabpanel"
            id={`${baseId}-panel-${t.key}`}
            aria-labelledby={`${baseId}-tab-${t.key}`}
            hidden={!selected}
          >
            {panel}
          </div>
        );
      })}
    </div>
  );
}
```

Забележка: панелите се съпоставят по **позиция** (ред на `tabs` = ред на `<TabPanel>` децата). Това е достатъчно и просто; консуматорите винаги подават панелите в реда на `tabs`.

- [ ] **Step 4: Add barrel export**

Modify `src/components/ui/index.ts` — добави ред (по азбучен ред, след `Table`):

```ts
export { Tabs, TabPanel, type TabItem } from "./tabs";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- tabs`
Expected: PASS (всичките 7 теста).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/tabs.tsx src/components/ui/tabs.test.tsx src/components/ui/index.ts
git commit -F - <<'EOF'
feat(ui): Tabs примитив с URL ?tab= синхронизация

Презентационен client компонент: активният таб в URL query param, плитка
навигация (history.replaceState, без re-fetch), всички панели монтирани
(неактивните hidden), a11y (tablist/tab/tabpanel, клавиатура), marker точка.
Хоризонтален скрол на лентата на мобилно. Само токени.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Fulfillment — 3 таба

**Files:**
- Modify: `src/app/(dashboard)/dashboard/fulfillment/page.tsx`

**Interfaces:**
- Consumes: `Tabs`, `TabPanel` от `@/components/ui`.

Тази страница е server component с множество независими manager-и → без общ бутон. Просто обвиваме съществуващите компоненти в панели.

- [ ] **Step 1: Rewrite the page with tabs**

Замени тялото на `fulfillment/page.tsx` (запази импортите + data fetch; добави `Tabs`/`TabPanel` импорт). `FulfillmentManager` съдържа И доставка И плащане — трябва да го разделим. Прочети `src/components/dashboard/fulfillment-manager.tsx`: ако рендерира двете секции в един компонент, раздели го на две props-контролирани части ИЛИ (по-просто) добави props `only?: "shipping" | "payment"` към `FulfillmentManager`, за да рендерира само едната секция. Провери структурата преди да решиш. Ако разделянето е сложно, остави shipping+payment заедно в първи таб и питай потребителя — но целта е раздел.

Целеви резултат (при добавен `only` prop на FulfillmentManager):

```tsx
import { FulfillmentManager } from "@/components/dashboard/fulfillment-manager";
import { OrderSettings } from "@/components/dashboard/order-settings";
import { Tabs, TabPanel } from "@/components/ui";
import {
  ensureDefaultMethods,
  getPaymentMethods,
  getShippingMethods,
} from "@/db/queries/fulfillment";
import { getZonesForShop } from "@/db/queries/shipping-zones";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Плащане и доставка — Frizmo Shops" };

export default async function FulfillmentPage() {
  const { shop } = await requireShop();
  await ensureDefaultMethods(shop.id);

  const [shipping, payment, zones] = await Promise.all([
    getShippingMethods(shop.id),
    getPaymentMethods(shop.id),
    getZonesForShop(shop.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink-900">Плащане и доставка</h1>
      <Tabs
        ariaLabel="Плащане и доставка"
        tabs={[
          { key: "shipping", label: "Доставка" },
          { key: "payment", label: "Плащане" },
          { key: "orders", label: "Поръчки и връщания" },
        ]}
      >
        <TabPanel tabKey="shipping">
          <FulfillmentManager only="shipping" shipping={shipping} payment={payment} zones={zones} />
        </TabPanel>
        <TabPanel tabKey="payment">
          <FulfillmentManager only="payment" shipping={shipping} payment={payment} zones={zones} />
        </TabPanel>
        <TabPanel tabKey="orders">
          <OrderSettings
            giftWrapEnabled={shop.giftWrapEnabled}
            giftWrapFeeCents={shop.giftWrapFeeCents}
            giftCardEnabled={shop.giftCardEnabled}
            returnWindowDays={shop.returnWindowDays}
          />
        </TabPanel>
      </Tabs>
    </div>
  );
}
```

За `only` prop в `FulfillmentManager`: добави optional `only?: "shipping" | "payment"` към props-а; когато е зададен, рендерирай само съответната секция (обвий двете секции в `{(!only || only === "shipping") && <секцията доставка>}` и аналогично за плащане). Ако `only` е undefined → рендерирай и двете (обратна съвместимост). **Внимавай:** ако при смяна на таб има отворен drawer в `FulfillmentManager`, той е в отделна инстанция per панел (shipping инстанция ≠ payment инстанция) → drawer от скрит таб не виси, защото е в скрития (hidden) DOM. Достатъчно.

- [ ] **Step 2: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. (Ако `FulfillmentManager` промените чупят типове — оправи.)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/fulfillment/page.tsx src/components/dashboard/fulfillment-manager.tsx
git commit -F - <<'EOF'
feat(dashboard): табове на „Плащане и доставка"

Доставка / Плащане / Поръчки и връщания. FulfillmentManager получава
optional only prop за рендер само на едната секция.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Subscribers — 3 таба

**Files:**
- Modify: `src/app/(dashboard)/dashboard/subscribers/page.tsx`

**Interfaces:**
- Consumes: `Tabs`, `TabPanel`.

Server component, множество независими секции. Пренареждаме съществуващите блокове в 3 панела. Заглавието + експорт остават над табовете.

- [ ] **Step 1: Rewrite with tabs**

Преработи `subscribers/page.tsx`. Запази data fetch (`rows`, `campaignHistory`, `referralsList`) и `dateFormat`. Структурирай в:
- Заглавие „Абонати за бюлетина“ + брой + `SubscribersExport` (над табовете).
- `Tabs`:
  - **Абонати** (`subscribers`): таблица абонати (или empty state) + таблица реферали (условна).
  - **Кампании** (`campaigns`): `CampaignComposer` (ако `rows.length>0`, иначе empty hint) + история.
  - **Купони за растеж** (`growth`): `GrowthSettingsForm`.

```tsx
import { CampaignComposer } from "@/components/dashboard/campaign-composer";
import { GrowthSettingsForm } from "@/components/dashboard/growth-settings-form";
import { SubscribersExport } from "@/components/dashboard/subscribers-export";
import { Card, EmptyState, Table, TBody, TCell, TH, THead, TRow, Tabs, TabPanel } from "@/components/ui";
import { getCampaigns, getConfirmedSubscribers } from "@/db/queries/subscribers";
import { getShopReferrals } from "@/db/queries/referrals";
import { requireShop } from "@/lib/auth";
import { count, NOUNS } from "@/lib/plural";

export const metadata = { title: "Абонати — Frizmo Shops" };

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function SubscribersPage() {
  const { shop } = await requireShop();
  const [rows, campaignHistory, referralsList] = await Promise.all([
    getConfirmedSubscribers(shop.id),
    getCampaigns(shop.id),
    getShopReferrals(shop.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Абонати за бюлетина</h1>
          <p className="mt-1 text-sm text-ink-500">
            {rows.length === 1 ? "1 потвърден абонат" : `${rows.length} потвърдени абонати`}
          </p>
        </div>
        {rows.length > 0 && <SubscribersExport />}
      </div>

      <Tabs
        ariaLabel="Абонати"
        tabs={[
          { key: "subscribers", label: "Абонати" },
          { key: "campaigns", label: "Кампании" },
          { key: "growth", label: "Купони за растеж" },
        ]}
      >
        <TabPanel tabKey="subscribers">
          <div className="flex flex-col gap-4">
            {referralsList.length > 0 && (
              <Card>
                <div className="border-b border-surface-200 px-5 py-4">
                  <h2 className="font-display text-lg font-bold text-ink-900">Реферали</h2>
                  <p className="mt-0.5 text-sm text-ink-500">
                    Абонати с личен реферален код и брой доведени поръчки.
                  </p>
                </div>
                <Table>
                  <THead>
                    <TH>Абонат</TH>
                    <TH>Код</TH>
                    <TH>Доведени</TH>
                  </THead>
                  <TBody>
                    {referralsList.map((r) => (
                      <TRow key={r.code}>
                        <TCell className="font-medium text-ink-900">{r.email}</TCell>
                        <TCell className="font-mono text-ink-700">{r.code}</TCell>
                        <TCell className="tabular-nums text-ink-500">
                          {count(r.referredCount, NOUNS.order)}
                        </TCell>
                      </TRow>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
            {rows.length === 0 ? (
              <Card>
                <EmptyState
                  icon="megaphone"
                  title="Още няма абонати"
                  description="Добави секция „Бюлетин“ на сайта си (таб Уебсайт → Секции), за да събираш имейли. Абонатите се появяват тук, след като потвърдят по имейл."
                />
              </Card>
            ) : (
              <Card>
                <Table>
                  <THead>
                    <TH>Имейл</TH>
                    <TH>Потвърден на</TH>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <TRow key={r.email}>
                        <TCell className="font-medium text-ink-900">{r.email}</TCell>
                        <TCell className="text-ink-500">
                          {r.confirmedAt ? dateFormat.format(r.confirmedAt) : "—"}
                        </TCell>
                      </TRow>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
          </div>
        </TabPanel>

        <TabPanel tabKey="campaigns">
          <div className="flex flex-col gap-4">
            {rows.length > 0 ? (
              <CampaignComposer recipientCount={rows.length} />
            ) : (
              <Card>
                <EmptyState
                  icon="megaphone"
                  title="Няма на кого да пратиш"
                  description="Кампаниите се пращат до потвърдените абонати. Първо събери абонати през секция „Бюлетин“ на сайта."
                />
              </Card>
            )}
            {campaignHistory.length > 0 && (
              <Card>
                <div className="border-b border-surface-200 px-5 py-4">
                  <h2 className="font-display text-lg font-bold text-ink-900">Изпратени кампании</h2>
                </div>
                <ul className="divide-y divide-surface-100">
                  {campaignHistory.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                        {c.subject}
                      </span>
                      <span className="text-sm text-ink-500">{dateFormat.format(c.createdAt)}</span>
                      <span className="text-sm tabular-nums text-ink-500">
                        {c.recipientCount} {c.recipientCount === 1 ? "получател" : "получатели"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </TabPanel>

        <TabPanel tabKey="growth">
          <GrowthSettingsForm shop={shop} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/subscribers/page.tsx
git commit -F - <<'EOF'
feat(dashboard): табове на „Абонати"

Абонати / Кампании / Купони за растеж. Празни състояния за кампании без абонати.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Analytics — 3 таба

**Files:**
- Modify: `src/app/(dashboard)/dashboard/analytics/page.tsx`

**Interfaces:**
- Consumes: `Tabs`, `TabPanel`.

Server component. Период selector-ът остава НАД табовете (общ). `MetricCard`/`MiniStat`/`delta` helper-ите остават непроменени. Групираме съществуващите `<section>` блокове в 3 панела.

- [ ] **Step 1: Wrap sections in tabs**

Запази целия файл (импорти, `delta`, `MetricCard`, `MiniStat`, data fetch, период-selector header). Промяната е само в JSX-а СЛЕД период-selector-а: обвий блоковете в `<Tabs>`:
- **Общ преглед** (`overview`): 4-те `MetricCard` (grid) + „Приходи по дни“ section + „Топ продукти“ section.
- **Разрези** (`breakdowns`): „Източници на поръчки“ section + „Топ категории“ section.
- **Клиенти** (`customers`): „От абонати към клиенти“ section + „Повторни клиенти“ section.

Добави `Tabs, TabPanel` към импорта от `@/components/ui`:
```ts
import { Icon, TransitionLink, Tabs, TabPanel } from "@/components/ui";
```

Структурата на return (само скелет — вътрешностите на section-ите се преместват както са, дословно):
```tsx
  return (
    <div className="flex flex-col gap-5">
      {/* header + период selector — БЕЗ промяна, както е сега (редове 80-103) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* ... непроменено ... */}
      </div>

      <Tabs
        ariaLabel="Аналитика"
        tabs={[
          { key: "overview", label: "Общ преглед" },
          { key: "breakdowns", label: "Разрези" },
          { key: "customers", label: "Клиенти" },
        ]}
      >
        <TabPanel tabKey="overview">
          <div className="flex flex-col gap-5">
            {/* Метрики grid (редове 106-131) + Приходи по дни (134-143) + Топ продукти (146-173) */}
          </div>
        </TabPanel>
        <TabPanel tabKey="breakdowns">
          <div className="flex flex-col gap-5">
            {/* Източници на поръчки (176-198) + Топ категории (247-252) */}
          </div>
        </TabPanel>
        <TabPanel tabKey="customers">
          <div className="flex flex-col gap-5">
            {/* От абонати към клиенти (201-218) + Повторни клиенти (221-244) */}
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
```

**Важно:** не променяй съдържанието на section-ите — само ги премести в правилния панел. Всички данни (`current`, `breakdowns`, `topProducts`) вече са заредени.

- [ ] **Step 2: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/analytics/page.tsx
git commit -F - <<'EOF'
feat(dashboard): табове на „Аналитика"

Общ преглед / Разрези / Клиенти. Период selector остава над табовете.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: ShopForm — 3 таба (един form, marker, общ Запази)

**Files:**
- Modify: `src/components/dashboard/shop-form.tsx`

**Interfaces:**
- Consumes: `Tabs`, `TabPanel`, `TabItem`.

Това е един `<form>` с dirty-guard и `state.fieldErrors`. Табовете групират полетата ВЪТРЕ във формата. Бутонът „Запази“ остава под табовете (общ). При валидационна грешка в скрит таб → marker.

Ключово: `Tabs` рендерира всички панели винаги (hidden), затова полетата остават в DOM и `FormData` събира всичките при submit — marker е чисто визуален, не влияе на данните. Dirty-guard (native onInput на form) също работи, защото form-ът обвива Tabs.

- [ ] **Step 1: Derive tab error markers**

Добави преди `return` във `ShopForm` (след `detailFields` дефиницията):

```tsx
  /* Кой таб съдържа поле с грешка → marker. Мап поле→таб. */
  const e = state.fieldErrors ?? {};
  const tabItems: TabItem[] = [
    {
      key: "basic",
      label: "Основни",
      marker: !!(e.name || e.businessCategory || e.description),
    },
    {
      key: "contacts",
      label: "Контакти",
      marker: !!(e.address || e.city || e.phone || e.email),
    },
    {
      key: "social",
      label: "Социални",
      marker: !!(e.facebook || e.instagram || e.tiktok || e.youtube || e.viber),
    },
  ];
```

Добави `Tabs, TabPanel, type TabItem` към импорта:
```ts
import { Button, Card, Input, Select, Textarea, Tabs, TabPanel, type TabItem } from "@/components/ui";
```

- [ ] **Step 2: Restructure the form body into tab panels**

Замени тялото на `<form>` (между `<input type="hidden" ...>` + slug блока и бутона „Запази“). Разпредели полетата:
- **basic**: „Име на магазина“, „Категория на бизнеса“, „Описание“.
- **contacts**: `AddressAutocomplete` (адрес), „Град“, „Телефон“ + „Имейл“ grid, `WorkingHoursEditor`.
- **social**: 5-те социални Input-а (grid).

Целевата структура на return:

```tsx
  return (
    <Card>
      <form
        action={formAction}
        onInput={() => setDirty(true)}
        onChange={() => setDirty(true)}
        className="flex flex-col gap-4"
        noValidate
      >
        <input type="hidden" name="workingHours" value={JSON.stringify({ days })} />
        {slug && (
          <div className="rounded-control border border-surface-200 bg-surface-50 px-3 py-2.5">
            <p className="text-xs font-medium text-ink-500">Адрес на магазина</p>
            <p className="mt-0.5 text-sm font-medium text-ink-900">/s/{slug}</p>
            <p className="mt-1 text-xs text-ink-500">
              Адресът е постоянен и не се променя при смяна на името.
            </p>
          </div>
        )}

        <Tabs ariaLabel="Настройки на магазина" tabs={tabItems}>
          <TabPanel tabKey="basic">
            <div className="flex flex-col gap-4">
              <Input
                label="Име на магазина"
                name="name"
                required
                defaultValue={initial.name}
                error={state.fieldErrors?.name}
              />
              <Select
                label="Категория на бизнеса"
                name="businessCategory"
                required
                options={categoryOptions}
                placeholder="Избери категория"
                defaultValue={initial.businessCategory ?? ""}
                error={state.fieldErrors?.businessCategory}
              />
              <Textarea
                label="Описание"
                name="description"
                placeholder="С какво се занимава твоят бизнес?"
                defaultValue={initial.description}
                error={state.fieldErrors?.description}
              />
            </div>
          </TabPanel>

          <TabPanel tabKey="contacts">
            <div className="flex flex-col gap-4">
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={(result) => {
                  setAddress(result.fullAddress);
                  if (result.city) setCity(result.city);
                }}
                error={state.fieldErrors?.address}
              />
              <Input
                label="Град"
                name="city"
                value={city}
                onChange={(ev) => setCity(ev.target.value)}
                hint="Попълва се автоматично при избор на адрес."
                error={state.fieldErrors?.city}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Телефон"
                  name="phone"
                  type="tel"
                  placeholder="0888 123 456"
                  defaultValue={initial.phone}
                  error={state.fieldErrors?.phone}
                />
                <Input
                  label="Имейл за връзка"
                  name="email"
                  type="email"
                  defaultValue={initial.email}
                  error={state.fieldErrors?.email}
                />
              </div>
              <WorkingHoursEditor value={days} onChange={setDays} />
            </div>
          </TabPanel>

          <TabPanel tabKey="social">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Facebook" name="facebook" placeholder="https://facebook.com/..." defaultValue={initial.facebook} error={state.fieldErrors?.facebook} />
              <Input label="Instagram" name="instagram" placeholder="https://instagram.com/..." defaultValue={initial.instagram} error={state.fieldErrors?.instagram} />
              <Input label="TikTok" name="tiktok" placeholder="https://tiktok.com/@..." defaultValue={initial.tiktok} error={state.fieldErrors?.tiktok} />
              <Input label="YouTube" name="youtube" placeholder="https://youtube.com/@..." defaultValue={initial.youtube} error={state.fieldErrors?.youtube} />
              <Input label="Viber" name="viber" placeholder="Телефон или линк за Viber" defaultValue={initial.viber} error={state.fieldErrors?.viber} hint="Номер (напр. +359…) или линк viber://" />
            </div>
          </TabPanel>
        </Tabs>

        <div>
          <Button type="submit" loading={pending} disabled={!dirty}>
            Запази промените
          </Button>
        </div>
      </form>
    </Card>
  );
```

Премахни старата `detailFields` променлива (полетата вече са inline в панелите). Внимавай да НЕ дублираш `city` `onChange` името (`ev` вместо `e`, за да не се сблъска с `const e = state.fieldErrors`).

- [ ] **Step 3: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. Провери, че няма неизползвана `detailFields` или `e` конфликт.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/shop-form.tsx
git commit -F - <<'EOF'
feat(dashboard): табове на „Магазин" (ShopForm)

Основни / Контакти / Социални в един form. Общ „Запази" под табовете;
marker точка на таб с валидационна грешка (панелите остават монтирани,
FormData събира всички полета).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: ProductForm — 4 таба само в „Детайлно"

**Files:**
- Modify: `src/components/dashboard/product-form.tsx`

**Interfaces:**
- Consumes: `Tabs`, `TabPanel`, `TabItem`.

„Бързо“ режим остава непокътнат (3 карти). Само когато `showDetailed` е true → 9-те карти се групират в 4 таба. `fieldErrors` е локален `Record<string,string>` → marker.

**Ключово решение за групиране:** В „Детайлно“ ВСИЧКИ карти (вкл. трите „винаги видими“) отиват в таба „Основно“, за да не се разкъсва формата на „над табовете“ + „в табовете“. Тоест: в детайлно режим табовете обгръщат целия набор карти; в бърз режим се показват само първите 3 без табове.

Групиране в детайлно:
- **main**: Основни, Цена и наличност, Снимки, Характеристики.
- **logistics**: Тегло и размер, Таблица с размери. (Количеството е в „Тегло и размер“ картата.)
- **codes**: Продуктови кодове, SEO.
- **variants**: Опции и варианти, Промоция „купи повече“.

- [ ] **Step 1: Extract cards into named fragments**

Прочети текущия `product-form.tsx` (редове ~272-593). Всяка `<Card>` там е една логическа карта. Извлечи всяка като локална `const` (JSX фрагмент) вътре в компонента, ПРЕДИ `return`, като **изрежеш точно съществуващия JSX на съответната карта и го поставиш дословно** в променливата (copy-paste от текущия файл — НЕ пренаписвай/съкращавай съдържанието). Съответствие карта → променлива → текущи редове в файла:

| Променлива | Карта (h2 заглавие) | Текущи редове |
|---|---|---|
| `cardBasics` | „Основни“ | 272-320 |
| `cardPricing` | „Цена и наличност“ | 322-350 |
| `cardImages` | „Снимки“ | 352-357 |
| `cardWeight` | „Тегло и размер“ (вкл. количество) | 361-449 |
| `cardCodes` | „Продуктови кодове“ | 451-484 |
| `cardSizeGuide` | „Таблица с размери“ | 486-525 |
| `cardSeo` | „SEO“ | 527-548 |
| `cardDeal` | „Промоция „купи повече““ | 550-577 |
| `cardAttributes` | „Характеристики“ | 579-582 |
| `cardVariants` | „Опции и варианти“ | 584-593 |

Всяка променлива изглежда:
```tsx
  const cardBasics = (
    <Card className="flex flex-col gap-4">
      {/* … изрязаният дословно JSX от съответните редове … */}
    </Card>
  );
```

**Не променяй съдържанието на картите** — само ги извади в променливи (същия JSX, същите state връзки). След извличането старите inline карти и целият `{showDetailed && (<>…</>)}` блок (редове 359-595) вече не се рендерират директно — заместват се от Step 3.

- [ ] **Step 2: Build tab items with markers**

Добави преди return:

```tsx
  const fe = fieldErrors;
  const productTabs: TabItem[] = [
    {
      key: "main",
      label: "Основно",
      marker: !!(fe.name || fe.categoryId || fe.description || fe.price || fe.promoPrice || fe.stock || fe.images),
    },
    { key: "logistics", label: "Логистика", marker: !!(fe.weight || fe.length || fe.width || fe.height) },
    {
      key: "codes",
      label: "Кодове и SEO",
      marker: !!(fe.sku || fe.gtin || fe.brand || fe.cost || fe.seoTitle || fe.seoDescription),
    },
    { key: "variants", label: "Варианти", marker: !!fe.deal },
  ];
```

Добави импорт:
```ts
import { /* ...съществуващите... */, Tabs, TabPanel, type TabItem } from "@/components/ui";
```

- [ ] **Step 3: Render — quick vs detailed**

Замени секцията между тогъла и футера. В „Бързо“ (или simple) → трите карти в колона (както сега). В „Детайлно“ → `Tabs`:

```tsx
      {!showDetailed ? (
        <>
          {cardBasics}
          {cardPricing}
          {cardImages}
        </>
      ) : (
        <Tabs ariaLabel="Продукт" tabs={productTabs}>
          <TabPanel tabKey="main">
            <div className="flex flex-col gap-4">
              {cardBasics}
              {cardPricing}
              {cardImages}
              {cardAttributes}
            </div>
          </TabPanel>
          <TabPanel tabKey="logistics">
            <div className="flex flex-col gap-4">
              {cardWeight}
              {cardSizeGuide}
            </div>
          </TabPanel>
          <TabPanel tabKey="codes">
            <div className="flex flex-col gap-4">
              {cardCodes}
              {cardSeo}
            </div>
          </TabPanel>
          <TabPanel tabKey="variants">
            <div className="flex flex-col gap-4">
              {cardVariants}
              {cardDeal}
            </div>
          </TabPanel>
        </Tabs>
      )}
```

Забележка: `simple` режим (onboarding) — `showDetailed` вече е `false` при `simple` (`const showDetailed = !simple && mode === "detailed"`), значи onboarding винаги пада в „Бързо“ клона. Правилно.

- [ ] **Step 4: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. Провери, че всяка карта се рендерира точно веднъж (няма дублиране/липса) и че старият `{showDetailed && (<>...</>)}` блок е премахнат.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/product-form.tsx
git commit -F - <<'EOF'
feat(dashboard): табове на продуктовата форма в „Детайлно"

Основно / Логистика / Кодове и SEO / Варианти — само в детайлен режим.
„Бързо" остава 3 карти в колона. Marker на таб с валидационна грешка.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Онбординг deep-link + финален гейт

**Files:**
- Modify: `src/db/queries/onboarding-status.ts`

**Interfaces:**
- Consumes: нищо ново.

Онбординг стъпките сочат към страници, които вече имат табове. Добавяме `?tab=` към релевантните, за да отвеждат директно към правилния таб.

- [ ] **Step 1: Add ?tab= to relevant steps**

В `computeChecklist` (`onboarding-status.ts`), обнови `href`-овете:
- `contacts` стъпка: `href: "/dashboard/store?tab=contacts"`
- `shipping` стъпка: `href: "/dashboard/fulfillment?tab=shipping"`
- `payment` стъпка: `href: "/dashboard/fulfillment?tab=payment"`

Останалите (`shop`, `product`, `publish`) остават без `?tab=`.

```ts
  const steps: ChecklistStep[] = [
    { key: "shop", label: "Магазинът е създаден", done: true, href: "/dashboard/store", cta: "Провери" },
    { key: "product", label: "Добави първи продукт", done: f.hasProduct, href: "/dashboard/products/new", cta: "Добави" },
    { key: "contacts", label: "Попълни контакти и адрес", done: f.hasContacts, href: "/dashboard/store?tab=contacts", cta: "Попълни" },
    { key: "shipping", label: "Добави метод на доставка", done: f.hasShipping, href: "/dashboard/fulfillment?tab=shipping", cta: "Добави" },
    { key: "payment", label: "Добави метод на плащане", done: f.hasPayment, href: "/dashboard/fulfillment?tab=payment", cta: "Добави" },
    { key: "publish", label: "Публикувай магазина", done: f.published, href: "/dashboard/website", cta: "Публикувай" },
  ];
```

- [ ] **Step 2: Full gate**

Run: `pnpm check`
Expected: PASS (lint + всички unit тестове вкл. новите tabs тестове + build). Ако нещо гърми — оправи преди commit.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries/onboarding-status.ts
git commit -F - <<'EOF'
feat(dashboard): онбординг чеклист deep-link към таб

Контакти → store?tab=contacts; доставка/плащане → fulfillment?tab=shipping|payment.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

- [ ] **Step 4: Ръчна визуална проверка (потребител)**

Съобщи на потребителя да провери на живо (`pnpm dev`), за всяка от 5-те страници, в 3 състояния:
- Light + Dark (`localStorage frizmo-theme=dark`) + 375px.
- Табовете се сменят мигновено (без мигане/re-fetch), URL се обновява (`?tab=`).
- Refresh на таб → същият таб остава.
- Онбординг чеклист „Попълни контакти“ → отваря `store` директно на таб „Контакти“.
- Отвори drawer (напр. метод за доставка) → смени таб → drawer поведението е чисто (drawer от скрит таб не виси видимо).
- Валидационна грешка в скрит таб (напр. изчисти името в „Основно“, иди на „Социални“, запази) → marker точка на таб „Основни“.

Push към `dev` (=prod) само след разрешение от потребителя.

---

## Notes for the implementer

- `Tabs` съпоставя панели по **позиция** — винаги подавай `<TabPanel>` децата в реда на `tabs`.
- Не добавяй `loading.tsx` на тези страници (drawer-remount капан от CLAUDE-frontend.md).
- Всичко през токени; тъмната тема идва автоматично.
- Ако Testing Library липсва (Task 1) → спри и попитай, не добавяй зависимост.
- Fulfillment `only` prop е единствената промяна в компонент отвъд обвиване; всичко останало е пренареждане.
