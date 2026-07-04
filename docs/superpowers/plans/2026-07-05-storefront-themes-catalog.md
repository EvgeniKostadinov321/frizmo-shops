# Storefront теми — разширен каталог (9 теми) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Разширяване на storefront темите от 3 на 9 (вкл. 3 тъмни), всяка с вертикално предназначение, + метаданни за wizard + категория→препоръки мапинг.

**Architecture:** Темите живеят в `src/lib/themes.ts` (`--sf-*` CSS variables). Storefront секциите четат само `--sf-*` → работят с всяка тема без промяна. Тъмните теми = тъмни стойности в токените (не превключвател). Шрифтовете идват от `next/font` (CSS variables на `<html>`), референцирани в `--sf-font-*`.

**Tech Stack:** Next.js 16, TypeScript strict, Zod, Tailwind 4, `next/font/google`, Vitest.

**Спец:** `docs/superpowers/specs/2026-07-05-storefront-themes-catalog-design.md`
**Проучване:** `docs/research/2026-07-05-ecommerce-design-research.md`

## Global Constraints

- 9 теми: `atelie`, `vitrina`, `puls`, `efir`, `oniks`, `signal`, `osnova`, `granit`, `classic`.
- Тъмните: `puls`, `oniks`, `granit` (тъмен фон/светъл текст в самите `--sf-*`).
- Всеки theme id в `THEMES` ИМА запис в `THEME_PRESETS`, `THEME_LABELS`, `THEME_META`.
- Всяка категория (`BUSINESS_CATEGORIES`) има ≥2 препоръки, всички валидни theme id-та.
- Шрифтове с `subsets: ["latin","cyrillic"]` (BG текст). Ако subset липсва → build пада → алтернатива.
- Дизайн токени само; никакви inline hex в компоненти. Темите СА дефиницията на стойностите.
- UI текстове BG, типографски кавички „…". `pnpm check` гейт. PowerShell; multiline commit → `git commit -F`.
- Storefront секциите НЕ се пипат в този план (само теми + panel + мапинги).

---

### Task 1: Разширяване на THEMES enum + толерантен fallback

**Files:**
- Modify: `src/schemas/site-settings.ts` (`THEMES`)
- Test: `src/schemas/site-settings.test.ts` (създай ако липсва)

**Interfaces:**
- Produces: `THEMES` = 9 стойности; `ThemeId` union се разширява автоматично.

- [ ] **Step 1: Провери има ли тест файл.** Ако `src/schemas/site-settings.test.ts`
  не съществува, ще го създадеш в Step 2.

- [ ] **Step 2: Failing тест** — че новите теми parse-ват и старите стойности оцеляват.

```ts
import { describe, expect, it } from "vitest";
import { siteSettingsSchema, THEMES } from "./site-settings";

describe("THEMES", () => {
  it("съдържа 9 теми вкл. тъмните", () => {
    expect(THEMES).toEqual([
      "classic", "atelie", "vitrina", "puls", "efir", "oniks", "signal", "osnova", "granit",
    ]);
  });
  it("parse-ва валидна нова тема", () => {
    const r = siteSettingsSchema.safeParse({ theme: "oniks", primaryColor: "#c9a25a", accentColor: "#c9a25a" });
    expect(r.success).toBe(true);
  });
  it("невалидна тема → грешка (толерантният parse в queries я хваща отделно)", () => {
    const r = siteSettingsSchema.safeParse({ theme: "не-съществува" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run** — `pnpm test src/schemas/site-settings.test.ts` → FAIL (THEMES има 3).

- [ ] **Step 4: Разшири `THEMES`:**

```ts
export const THEMES = [
  "classic", "atelie", "vitrina", "puls", "efir", "oniks", "signal", "osnova", "granit",
] as const;
```

- [ ] **Step 5: Run** → PASS.

- [ ] **Step 6:** (Опростяване) `defaultSiteSettings` default темата остава `classic`
  (в `siteSettingsSchema` `theme` default). Без промяна тук.

- [ ] **Step 7: Commit** — „feat(themes): разшири THEMES enum на 9".

---

### Task 2: Нови шрифтове (display сериф + кондензиран)

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: CSS variables `--font-playfair`, `--font-condensed` на `<html>`.

- [ ] **Step 1: Импортирай в layout.tsx** (към съществуващия `next/font/google` import):

```ts
import { Inter, Lora, Onest, Oswald, Playfair_Display, Sofia_Sans, Sofia_Sans_Condensed, Space_Grotesk } from "next/font/google";
```

- [ ] **Step 2: Дефинирай шрифтовете** (след `lora`):

```ts
/* Display сериф за Оникс (premium, висок контраст) */
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], variable: "--font-playfair" });
/* Кондензиран за Основа/Гранит (индустриални) */
const oswald = Oswald({ subsets: ["latin", "cyrillic"], variable: "--font-condensed" });
```

- [ ] **Step 3: Закачи variables на `<html>`** (добави в className стринга след `lora.variable`):

```
${playfair.variable} ${oswald.variable}
```

- [ ] **Step 4: Run** — `pnpm build`.
  Expected: build минава. **Ако падне с грешка за subset „cyrillic" на Oswald** →
  смени на `PT_Sans_Narrow` (има cyrillic): `import { PT_Sans_Narrow }`, `weight: ["400","700"]`,
  `variable: "--font-condensed"`. Playfair има cyrillic (потвърдено) — не пада.

- [ ] **Step 5: Commit** — „feat(themes): +Playfair +кондензиран шрифт за новите теми".

---

### Task 3: THEME_PRESETS — 6 нови теми (пълни ThemeVars)

**Files:**
- Modify: `src/lib/themes.ts` (`THEME_PRESETS`, `THEME_LABELS`)
- Test: `src/lib/themes.test.ts` (създай ако липсва)

**Interfaces:**
- Consumes: `ThemeVars` (съществуващ тип, 9 полета), `--font-*` от Task 2.
- Produces: `THEME_PRESETS` с 9 записа; `THEME_LABELS` с 9.

- [ ] **Step 1: Failing тест** — всеки theme id има пълен preset + label.

```ts
import { describe, expect, it } from "vitest";
import { THEMES } from "@/schemas/site-settings";
import { THEME_LABELS, THEME_PRESETS } from "./themes";

const REQUIRED_VARS = [
  "--sf-bg","--sf-surface","--sf-text","--sf-muted","--sf-border",
  "--sf-radius","--sf-heading-weight","--sf-font-heading","--sf-font-body",
] as const;

describe("THEME_PRESETS", () => {
  it("има запис за всяка тема с всички --sf-* полета", () => {
    for (const t of THEMES) {
      const p = THEME_PRESETS[t];
      expect(p, `липсва preset за ${t}`).toBeDefined();
      for (const v of REQUIRED_VARS) expect(p[v], `${t} липсва ${v}`).toBeTruthy();
    }
  });
  it("има label за всяка тема", () => {
    for (const t of THEMES) expect(THEME_LABELS[t], `липсва label за ${t}`).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run** → FAIL (само 3 presets).

- [ ] **Step 3: Добави 6-те нови записа в `THEME_PRESETS`** (стойности от спеца/mockup-ите;
  калибрирай визуално после). Пример за `oniks` и `osnova` — попълни всичките 6 (atelie
  наследява warm-стил стойности, vitrina — modern-стил, puls/efir/signal/granit по спеца):

```ts
  atelie: {
    "--sf-bg": "#faf5ec", "--sf-surface": "#fffdf8", "--sf-text": "#33271a",
    "--sf-muted": "#80705c", "--sf-border": "#e9ddc9", "--sf-radius": "0.625rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-lora), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  vitrina: {
    "--sf-bg": "#ffffff", "--sf-surface": "#fafafa", "--sf-text": "#111111",
    "--sf-muted": "#5b5b5b", "--sf-border": "#ececec", "--sf-radius": "0.125rem",
    "--sf-heading-weight": "800",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  puls: {
    "--sf-bg": "#111111", "--sf-surface": "#1a1a1a", "--sf-text": "#fafafa",
    "--sf-muted": "#a3a3a3", "--sf-border": "#2e2e2e", "--sf-radius": "0.25rem",
    "--sf-heading-weight": "800",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  efir: {
    "--sf-bg": "#fdf1ef", "--sf-surface": "#fffafb", "--sf-text": "#5a3d47",
    "--sf-muted": "#9b7d86", "--sf-border": "#f0dfe4", "--sf-radius": "0.75rem",
    "--sf-heading-weight": "600",
    "--sf-font-heading": "var(--font-lora), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  oniks: {
    "--sf-bg": "#14100c", "--sf-surface": "#1c1610", "--sf-text": "#f3ead9",
    "--sf-muted": "#9a8b72", "--sf-border": "#2e2519", "--sf-radius": "0.25rem",
    "--sf-heading-weight": "600",
    "--sf-font-heading": "var(--font-playfair), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  signal: {
    "--sf-bg": "#f4f6f8", "--sf-surface": "#ffffff", "--sf-text": "#0f1b2a",
    "--sf-muted": "#5a6b7a", "--sf-border": "#dbe2e8", "--sf-radius": "0.375rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  osnova: {
    "--sf-bg": "#f5f2ee", "--sf-surface": "#ffffff", "--sf-text": "#211d18",
    "--sf-muted": "#6e665c", "--sf-border": "#e2ddd5", "--sf-radius": "0.1875rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-condensed), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  granit: {
    "--sf-bg": "#1c1e21", "--sf-surface": "#2a2d31", "--sf-text": "#eef0f2",
    "--sf-muted": "#a2a8af", "--sf-border": "#3a3e43", "--sf-radius": "0.1875rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-condensed), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
```

- [ ] **Step 4: Добави 6-те label-а в `THEME_LABELS`:**

```ts
  atelie: "Ателие", vitrina: "Витрина", puls: "Пулс", efir: "Ефир",
  oniks: "Оникс", signal: "Сигнал", osnova: "Основа", granit: "Гранит",
```

- [ ] **Step 5: Run** → PASS.

- [ ] **Step 6: Визуален pass** — пусни dev, отвори storefront на нов магазин, смени
  темата (или ръчно през редактора) за поне 3 нови теми (1 светла, 1 тъмна, 1 индустриална).
  Провери четимост + че тъмните са наистина тъмни.

- [ ] **Step 7: Commit** — „feat(themes): 6 нови storefront теми (Ателие, Витрина, Пулс, Ефир, Оникс, Сигнал, Основа, Гранит)".

---

### Task 4: THEME_META (метаданни за wizard preview)

**Files:**
- Modify: `src/lib/themes.ts` (нов export `THEME_META`)
- Test: `src/lib/themes.test.ts`

**Interfaces:**
- Produces: `THEME_META: Record<ThemeId, { tagline: string; bestFor: string; isDark: boolean }>`.

- [ ] **Step 1: Failing тест:**

```ts
import { THEME_META } from "./themes";
// ...добави в themes.test.ts
describe("THEME_META", () => {
  it("има метаданни за всяка тема", () => {
    for (const t of THEMES) {
      expect(THEME_META[t], `липсва meta за ${t}`).toBeDefined();
      expect(THEME_META[t].tagline).toBeTruthy();
      expect(THEME_META[t].bestFor).toBeTruthy();
    }
  });
  it("маркира тъмните теми", () => {
    expect(THEME_META.oniks.isDark).toBe(true);
    expect(THEME_META.puls.isDark).toBe(true);
    expect(THEME_META.granit.isDark).toBe(true);
    expect(THEME_META.atelie.isDark).toBe(false);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Добави типа + export в themes.ts:**

```ts
export interface ThemeMeta {
  /** Кратко усещане — за preview картата в wizard-а. */
  tagline: string;
  /** За кои магазини е подходяща. */
  bestFor: string;
  isDark: boolean;
}

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  classic: { tagline: "Изчистена и безвремева — за всеки бизнес.", bestFor: "Универсална", isDark: false },
  atelie: { tagline: "Топла и автентична — усеща се ръчният труд.", bestFor: "Ръчна изработка, храни, за дома", isDark: false },
  vitrina: { tagline: "Минимал, който оставя снимките да говорят.", bestFor: "Мода, обувки", isDark: false },
  puls: { tagline: "Смела и енергична — за младежки брандове.", bestFor: "Streetwear, аксесоари", isDark: true },
  efir: { tagline: "Нежна и чиста — wellness усещане.", bestFor: "Козметика, натурална грижа", isDark: false },
  oniks: { tagline: "Тъмен лукс със златен акцент.", bestFor: "Луксозна козметика, бижута", isDark: true },
  signal: { tagline: "Ясна и надеждна — фокус върху доверие.", bestFor: "Електроника, техника", isDark: false },
  osnova: { tagline: "Здрава и практична — за материали и инструменти.", bestFor: "Строителни, за дома", isDark: false },
  granit: { tagline: "Тъмна индустриална — професионално усещане.", bestFor: "Строителни, инструменти", isDark: true },
};
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** — „feat(themes): THEME_META (усещане/за кого/тъмна) за wizard".

---

### Task 5: Категория → препоръчани теми мапинг

**Files:**
- Modify: `src/lib/themes.ts` (нов export `CATEGORY_THEME_RECOMMENDATIONS`)
- Test: `src/lib/themes.test.ts`

**Interfaces:**
- Consumes: `BUSINESS_CATEGORIES` (`@/schemas/shop`), `ThemeId`.
- Produces: `CATEGORY_THEME_RECOMMENDATIONS: Record<BusinessCategory, ThemeId[]>` +
  helper `recommendedThemesFor(category): ThemeId[]`.

- [ ] **Step 1: Failing тест:**

```ts
import { BUSINESS_CATEGORIES } from "@/schemas/shop";
import { CATEGORY_THEME_RECOMMENDATIONS, recommendedThemesFor, THEME_PRESETS } from "./themes";

describe("CATEGORY_THEME_RECOMMENDATIONS", () => {
  it("всяка категория има ≥2 препоръки, всички валидни теми", () => {
    for (const c of BUSINESS_CATEGORIES) {
      const recs = CATEGORY_THEME_RECOMMENDATIONS[c];
      expect(recs, `липсва мапинг за ${c}`).toBeDefined();
      expect(recs.length).toBeGreaterThanOrEqual(2);
      for (const t of recs) expect(THEME_PRESETS[t], `${c} → невалидна тема ${t}`).toBeDefined();
    }
  });
  it("recommendedThemesFor връща fallback за непозната категория", () => {
    expect(recommendedThemesFor("несъществуваща" as never).length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Добави в themes.ts** (внимавай: `BUSINESS_CATEGORIES` са BG стрингове):

```ts
import { BUSINESS_CATEGORIES, type BusinessCategory } from "@/schemas/shop";

export const CATEGORY_THEME_RECOMMENDATIONS: Record<BusinessCategory, ThemeId[]> = {
  "Дрехи и мода": ["vitrina", "puls", "oniks"],
  "Обувки": ["vitrina", "puls"],
  "Храни и напитки": ["atelie", "efir"],
  "Козметика": ["efir", "oniks"],
  "Ръчна изработка": ["atelie", "vitrina"],
  "Електроника": ["signal", "vitrina"],
  "Строителни материали": ["osnova", "granit"],
  "За дома": ["atelie", "osnova", "vitrina"],
  "Друго": ["classic", "vitrina"],
};

export function recommendedThemesFor(category: string): ThemeId[] {
  return (CATEGORY_THEME_RECOMMENDATIONS as Record<string, ThemeId[]>)[category] ?? ["classic", "vitrina"];
}
```

- [ ] **Step 4:** Провери, че `BusinessCategory` тип съществува в `@/schemas/shop`. Ако
  не → добави там: `export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];`
  (малка промяна в schemas/shop.ts; commit-ва се тук).

- [ ] **Step 5: Run** → PASS.

- [ ] **Step 6: Commit** — „feat(themes): категория→препоръчани теми мапинг".

---

### Task 6: ThemePanel показва 9 теми (групирани светли/тъмни)

**Files:**
- Modify: `src/components/dashboard/website/theme-panel.tsx`

**Interfaces:**
- Consumes: `THEMES`, `THEME_PRESETS`, `THEME_LABELS`, `THEME_META`.

- [ ] **Step 1:** Днешният panel рендерира `THEMES.map(...)` в грид с preview swatch.
  С 9 теми това работи, но добави **групиране светли/тъмни** за яснота. Раздели:

```tsx
const lightThemes = THEMES.filter((t) => !THEME_META[t].isDark);
const darkThemes = THEMES.filter((t) => THEME_META[t].isDark);
```

- [ ] **Step 2:** Рендерирай два блока („Светли" / „Тъмни") със същия swatch бутон,
  но добави и `THEME_META[t].tagline` като малък текст под името (title атрибут или
  под label-а). Всеки бутон остава `aria-pressed`, токен-стилизиран (без inline hex —
  swatch-ът чете `THEME_PRESETS[t]["--sf-bg"]` inline, което е позволено, понеже
  темите СА дефиницията на стойностите — както е и днес).

- [ ] **Step 3: Визуален pass** — отвори редактора, провери че 9-те теми се виждат
  групирани, swatch-овете отразяват реалните фонове (тъмните са тъмни), tagline се чете
  в light + dark на dashboard-а.

- [ ] **Step 4: Commit** — „feat(website): ThemePanel показва 9 теми, групирани светли/тъмни".

---

### Task 7: Пълен check + WORKLOG

**Files:**
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Пълен гейт** — `pnpm check`. Expected: зелено (lint + unit + build).

- [ ] **Step 2:** Ако `pnpm test:e2e` покрива storefront темите — пусни релевантния
  e2e (по избор; store-products флейква под пълен suite → изолирано).

- [ ] **Step 3: WORKLOG ред** (най-отгоре в „Дневник"): 9 storefront теми (вкл. 3 тъмни),
  метаданни + категория мапинг, ThemePanel групиран. Текущ commit.

- [ ] **Step 4: Commit** — „docs(worklog): 9 storefront теми".

---

## Self-Review

- **Spec coverage:** THEMES enum (T1), шрифтове (T2), 6 presets (T3), метаданни (T4),
  категория мапинг (T5), panel UI (T6), check+worklog (T7). ✅ Storefront секциите не
  се пипат (спецът го казва). ✅
- **Placeholders:** T3 дава пълните стойности за всичките 6 теми (не „подобно на"). ✅
- **Type consistency:** `ThemeId` идва от `THEMES`; `THEME_PRESETS`/`THEME_LABELS`/
  `THEME_META`/`CATEGORY_THEME_RECOMMENDATIONS` всички ключирани по `ThemeId`/
  `BusinessCategory`. `recommendedThemesFor` fallback → валиден. ✅
- **Cyrillic риск:** T2 Step 4 дава явна алтернатива (PT_Sans_Narrow) ако Oswald няма
  cyrillic subset. Playfair потвърдено има. ✅
- **Стари данни:** базата е празна (изтрита) — няма миграционен риск; толерантният parse
  в queries пази бъдещи невалидни theme id-та. ✅
