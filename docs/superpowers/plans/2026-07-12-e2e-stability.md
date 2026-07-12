# E2e Stability + Фаза 1/2 Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Стабилизиране на e2e suite-а (прод билд + retries) и привеждането му в съответствие с Фаза 1 (табове) и Фаза 2 (режим на сложност + 4-та wizard стъпка).

**Architecture:** Playwright config сочи към продукшън билд (`pnpm build && pnpm start`) вместо dev сървъра (премахва on-demand компилацията — главната причина за флейк) + `retries: 1`. Тестовите потоци, счупени от новата 4-та wizard стъпка „Сложност" и от табовете в „Плащане и доставка", се обновяват.

**Tech Stack:** Playwright, TypeScript.

## Global Constraints

- Само `@gmail.com` алиас имейли (Supabase отхвърля други).
- Cookie банер маркиран като видян с `addInitScript` → `localStorage frizmo-cookie-notice=1`.
- UI текстове на български; типографски кавички „…".
- Режимът на сложност (Фаза 2): нов магазин от wizard-а получава default `business` (последна стъпка). „Плащане и доставка" е `minMode: 0` (видима във всеки режим), но вътре е разделена на табове (Доставка / Плащане / Поръчки и връщания).
- Wizard-ът вече има 4 стъпки: Основно → Контакти → Работно време → **Сложност** → „Създай магазина".
- Гейт: `pnpm build` минава преди e2e (config билдва). Не commit `.env*`.

## File Structure

- `playwright.config.ts` (MODIFY) — webServer командата + retries.
- `e2e/helpers.ts` (MODIFY) — `createShopViaWizard` +стъпка „Сложност".
- `e2e/store-products.spec.ts` (MODIFY) — локалната `createShopViaWizard` + inline wizard в първия тест.
- `e2e/orders.spec.ts` (MODIFY) — таб взаимодействие в „Плащане и доставка".

---

### Task 1: Playwright config — прод билд + retries

**Files:**
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces: config, който билдва и стартира прод сървъра, с 1 retry.

- [ ] **Step 1: Update config**

Замени `playwright.config.ts` изцяло:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  /* 1 retry — поглъща редки timing флейкове без да маскира истински провали
     (истинският бъг пада и на retry-я). trace на retry за диагноза. */
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  /* Тестваме срещу ПРОД билд (не dev): dev компилира routes on-demand при първо
     посещение → непредсказуеми забавяния = флейк. Прод билдът е предкомпилиран. */
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
```

Промени спрямо сега: `retries: 0 → 1`; `command: "pnpm dev" → "pnpm build && pnpm start"`; `reuseExistingServer: true → !process.env.CI` (локално преизползва вече пуснат сървър; CI винаги билдва чисто); `timeout: 120_000 → 240_000` (билдът иска време).

- [ ] **Step 2: Verify config parses**

Run: `pnpm exec playwright test --list 2>&1 | head -20`
Expected: изброява тестовете без config грешка (не ги пуска, само парсва).

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -F - <<'EOF'
test(e2e): прод билд + retries за стабилност

webServer → pnpm build && pnpm start (без on-demand dev компилация = по-малко
флейк); retries:1 (поглъща редки timing флейкове, не маскира истински бъгове).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: helpers.ts — wizard +стъпка „Сложност"

**Files:**
- Modify: `e2e/helpers.ts:24-40`

**Interfaces:**
- Consumes: нищо ново.
- Produces: `createShopViaWizard` минава и 4-тата стъпка „Сложност".

Сега helper-ът натиска „Създай магазина" след „Работно време" (стъпка 3). Но сега стъпка 3 е „Работно време" с бутон „Напред" (не „Създай магазина"), а стъпка 4 „Сложност" носи „Създай магазина". Трябва +1 „Напред" + чакане индикатора „Сложност".

- [ ] **Step 1: Update createShopViaWizard**

Замени тялото на `createShopViaWizard` (`e2e/helpers.ts`, редове 24-40):

```ts
export async function createShopViaWizard(page: Page, name: string, category: string) {
  await page.getByRole("link", { name: "Създай магазин" }).click();
  await page.getByLabel("Име на магазина").fill(name);
  await selectOption(page, "Категория на бизнеса", category);
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Контакти" })).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Работно време" })).toHaveAttribute(
    "data-active",
    "true",
  );
  /* Ф2: 4-та стъпка „Сложност" (default „Малък бизнес" е предизбран) → продължаваме. */
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Сложност" })).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByRole("button", { name: "Създай магазина" }).click();
  await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();
}
```

Обнови и докстринга (ред 20): „Основно → Контакти → Работно време → Сложност".

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers.ts
git commit -F - <<'EOF'
test(e2e): helpers wizard минава 4-тата стъпка „Сложност" (Ф2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: store-products.spec.ts — wizard (локален helper + inline)

**Files:**
- Modify: `e2e/store-products.spec.ts:17-37` (локална `createShopViaWizard`)
- Modify: `e2e/store-products.spec.ts:44-64` (inline wizard в първия тест)

**Interfaces:**
- Consumes: нищо ново.

Този файл има ДВЕ копия на wizard потока: локална `createShopViaWizard` (17-37) и inline в първия тест (44-64). И двете спират на 3 стъпки.

- [ ] **Step 1: Fix local createShopViaWizard**

В `e2e/store-products.spec.ts`, локалната `createShopViaWizard` (редове 30-36) — след „Работно време" блока добави стъпка „Сложност" преди „Създай магазина":

```ts
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Работно време" })).toHaveAttribute(
    "data-active",
    "true",
  );
  /* Ф2: 4-та стъпка „Сложност" */
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Сложност" })).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByRole("button", { name: "Създай магазина" }).click();
  await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();
```

- [ ] **Step 2: Fix inline wizard in first test**

В първия тест (`onboarding → категории...`), inline wizard-ът (редове 57-61). След блока за „Работно време" индикатора (редове 57-60) добави стъпка „Сложност" преди „Създай магазина" (ред 61):

```ts
    await page.getByRole("button", { name: "Напред" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Работно време" }),
    ).toHaveAttribute("data-active", "true");
    /* Ф2: 4-та стъпка „Сложност" */
    await page.getByRole("button", { name: "Напред" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Сложност" }),
    ).toHaveAttribute("data-active", "true");
    await page.getByRole("button", { name: "Създай магазина" }).click();
```

- [ ] **Step 3: Verify product form fields still reachable**

Първият тест ползва продуктовата форма (име/категория/цена/снимка/опция — редове 92-108). В business режим (default от wizard-а) „Опции и варианти" картата е `minMode: 2` (full) → **НЕ е видима в business**! Тестът кликва „+ Добави опция" (ред 99) → ще счупи в business режим.

Фикс: тестът трябва да сложи режима на „Пълна настройка" преди да ползва варианти. Най-чисто — в inline wizard-а избери „Пълна настройка" на стъпка „Сложност" вместо default. Замени стъпка „Сложност" в ПЪРВИЯ тест (от Step 2) да избере „Пълна настройка":

```ts
    /* Ф2: 4-та стъпка „Сложност" — избираме „Пълна настройка" (тестът ползва
       варианти, които са само в пълен режим). */
    await page.getByRole("button", { name: "Напред" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Сложност" }),
    ).toHaveAttribute("data-active", "true");
    await page.getByRole("button", { name: /Пълна настройка/ }).click();
    await page.getByRole("button", { name: "Създай магазина" }).click();
```

(Стъпка „Сложност" панелът рендерира MODE_META като бутони с `aria-pressed`; „Пълна настройка" е третият. Клик по име го избира.)

- [ ] **Step 4: Commit**

```bash
git add e2e/store-products.spec.ts
git commit -F - <<'EOF'
test(e2e): store-products wizard 4-та стъпка + пълен режим за варианти

Локалният helper + inline wizard минават стъпка „Сложност". Първият тест
избира „Пълна настройка" (варианти са само в пълен режим — Ф2).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: orders.spec.ts — табове в „Плащане и доставка"

**Files:**
- Modify: `e2e/orders.spec.ts:40-43`

**Interfaces:**
- Consumes: `createShopViaWizard` (вече фикснат в Task 2).

Тестът очаква „Куриер до адрес" (доставка) И „Наложен платеж" (плащане) видими едновременно (редове 41-43). Но Фаза 1 ги раздели на табове: „Куриер до адрес" е на таб „Доставка" (default), „Наложен платеж" е на таб „Плащане" (скрит). Трябва да превключи таба, за да види плащането.

Забележка: `createShopViaWizard` (Task 2) сега прави магазина в default business режим. „Плащане и доставка" е `minMode: 0` → видима в business. ОК.

- [ ] **Step 1: Update tab interaction**

Замени редове 40-43 в `orders.spec.ts`:

```ts
  /* Отваряме таб „Плащане и доставка" (сийдва дефолтите) и публикуваме.
     Ф1: секцията е разделена на табове — доставката е на таб „Доставка"
     (default), плащането на таб „Плащане". */
  await page.getByRole("link", { name: "Плащане и доставка" }).click();
  await expect(page.getByText("Куриер до адрес")).toBeVisible();
  /* Превключваме на таб „Плащане" за да видим наложения платеж. */
  await page.getByRole("tab", { name: "Плащане" }).click();
  await expect(page.getByText("Наложен платеж")).toBeVisible();
```

- [ ] **Step 2: Commit**

```bash
git add e2e/orders.spec.ts
git commit -F - <<'EOF'
test(e2e): orders — превключва таб „Плащане" за наложения платеж (Ф1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Пускане на suite-а за потвърждение

**Files:** няма (валидация).

- [ ] **Step 1: Run affected specs isolated**

Пусни засегнатите поотделно (изолирано е по-стабилно от пълния suite — проектна практика):

```bash
pnpm exec playwright test e2e/store-products.spec.ts
```
Expected: PASS (2 теста). Ако падне — прочети trace-а, оправи, повтори.

```bash
pnpm exec playwright test e2e/orders.spec.ts
```
Expected: PASS (1 тест).

- [ ] **Step 2: Run remaining specs**

```bash
pnpm exec playwright test e2e/auth.spec.ts e2e/catalog.spec.ts e2e/storefront.spec.ts e2e/admin.spec.ts e2e/landing-a11y.spec.ts
```
Expected: PASS. (Тези не минават wizard-а през helper-а — виж диагнозата — но потвърждаваме, че прод билдът не ги е счупил.)

- [ ] **Step 3: Report to user**

Съобщи на потребителя резултата: кои specs минават, времето, дали прод билдът е стабилен. Ако нещо остане флейк дори на прод билд + retry → докладвай конкретния тест + trace, не го маскирай.

- [ ] **Step 4: Final gate (unit + build still green)**

Run: `pnpm check`
Expected: PASS (e2e промените не пипат src, но потвърждаваме).

Push към `dev` (=prod) само след разрешение от потребителя.

---

## Notes for the implementer

- Прод билдът в webServer означава първото пускане чака `pnpm build` (~30-60с) — нормално.
- Ако локално вече върви `pnpm dev` на 3000, `reuseExistingServer` ще го преизползва — но тогава тестваш срещу dev (флейк). За чист резултат спри dev първо.
- store-products първият тест ИЗИСКВА „Пълна настройка" режим (варианти). Другите тестове (orders, локален helper) са ок в default business.
- Не пипай src — това е чисто e2e работа. Ако тест падне заради реален продуктов бъг (не изместен селектор) → спри и докладвай, не заобикаляй.
