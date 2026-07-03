# Landing Visual Redesign (R1–R6 + C1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline execution — this project's CLAUDE.md mandates no parallel subagents/workflows). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the full "Тих премиум с жив продукт" visual redesign (per `docs/docs-03-07-2026/2026-07-03-visual-redesign-spec.md`) to the landing page ONLY (`src/app/(marketing)/page.tsx` + its marketing components + the platform header/footer as rendered on landing) — phases R1 through R6 plus the parallel C1 content pass — leaving catalog, storefront, and dashboard untouched for now.

**Architecture:** Six sequential phases (R1 → R2 → R3 → R4 → R5 → R6) plus one parallel content phase (C1). Each phase is a self-contained, committable slice: tokens only → depth/spacing CSS → Motion infra → Radix under the FAQ accordion → the signature hero storefront demo → optional high-risk effects (each individually gated) → AI photo set for the demo shops (non-code, can run anytime after R1). Nothing outside `src/app/(marketing)/`, `src/components/marketing/`, `src/styles/tokens.css`, `src/app/layout.tsx` (font additions only), and new `src/lib/motion.ts` / `src/components/ui/` Radix primitives is touched. Storefront theme fonts (`Space_Grotesk` in `src/lib/themes.ts`) are explicitly NOT touched.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS 4 (`@theme` tokens), `next/font/google` (self-hosted), Motion (`motion` npm package, formerly Framer Motion), Radix Primitives (`@radix-ui/react-accordion` for this plan's scope), Vitest (contrast unit test), Playwright (visual screenshot matrix), lucide-react (already present via `Icon` wrapper).

## Global Constraints

- UI copy is Bulgarian with typographic quotes „…" — never a straight `"` inside a BG string (breaks JS strings/lint).
- Currency is EUR, integer cents, formatted via `formatPrice()` from `src/lib/money.ts` — never touch pricing logic in this plan.
- Zero hardcoded colors/radii/shadows/durations outside `src/styles/tokens.css` — every new value is a token.
- Dark mode is `[data-theme="dark"]` token overrides only — NEVER `dark:` variants in components (ADR `docs/decisions/2026-07-03-dark-mode.md`). Every new color token added in R1/R2 gets a dark value in the same edit.
- Every font must have full Cyrillic support (`subsets: ['cyrillic', 'latin']`). Never introduce a font without verifying Cyrillic coverage first.
- `prefers-reduced-motion` must be respected by every new animation (Motion's `useReducedMotion` or CSS `@media (prefers-reduced-motion: reduce)`).
- Gate before every commit: `pnpm check` (lint + unit tests + build) must be green. Never `git push` (blocked for agents; final merge is done by the project owner).
- No commented-out code, no TODOs, no placeholder content — every task ships working, tested code.
- Scan any new/edited string literals for invisible control characters (`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`) before committing — generation sometimes injects them into strings/hex colors.
- Existing e2e/unit test selectors (roles/names) for the landing page must keep passing — check `tests/e2e` and `tests/` (or `src/**/*.test.tsx`) for landing-page specs before renaming any visible text used as a selector.

---

## Phase R1: Foundation — Tokens, Fonts, Contrast Test, ADR

**Goal of phase:** Swap the color/radius/shadow token values in `tokens.css` to the new palette from the spec (§1, §13-grid), add the `Onest` font for platform display role, add a `--font-tabular` numeric feature utility, write the contrast unit test, and record the ADR. Zero new npm dependencies. This phase alone should visibly change the entire landing page's look (new palette) even before any component JSX changes.

### Task R1.1: Replace color/radius/shadow tokens in `tokens.css`

**Files:**
- Modify: `src/styles/tokens.css` (full rewrite of the `@theme` block and the `[data-theme="dark"]` block; lines 1–100 per current file)

**Interfaces:**
- Produces: CSS custom properties consumed by every existing Tailwind utility class already used across `src/app/(marketing)/page.tsx` and `src/components/marketing/*.tsx` — e.g. `bg-surface-50`, `text-ink-900`, `text-brand-600`, `shadow-card`, `rounded-card`. This task ONLY changes token **values**; it does not rename any token, so no component code changes in this task.
- Consumes: nothing (leaf task).

The current token names (`--color-surface-50`, `--color-ink-900`, `--color-brand-600`, etc.) already map 1:1 in spirit to the spec's new names (`--color-bg`, `--color-ink`, `--color-brand`). To avoid a mass rename across every component (out of scope — landing-only plan, minimize blast radius), **keep the existing token names** and only update their **values** to match the spec's hex values. Add the handful of net-new tokens the spec introduces that have no existing equivalent (`--color-bg-raised`, `--color-bg-sunken`, `--color-line`, `--color-line-strong`, `--color-focus`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, spacing scale, motion duration tokens land in R3).

- [ ] **Step 1: Write the failing contrast test first (TDD — test drives the token values)**

Create `src/lib/contrast.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

/** WCAG relative luminance — sRGB → linear → luminance. */
function luminance(hex: string): number {
  const rgb = hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const [r, g, b] = rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = luminance(hexA);
  const lumB = luminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Light palette pairs that MUST hit WCAG AA (4.5:1 body text, 3:1 large/UI). */
const LIGHT_PAIRS: { name: string; fg: string; bg: string; min: number }[] = [
  { name: "ink-900 on surface-50 (body text)", fg: "#1c2420", bg: "#faf8f5", min: 4.5 },
  { name: "ink-700 on surface-50 (soft text)", fg: "#4a544e", bg: "#faf8f5", min: 4.5 },
  { name: "brand-600 on surface-50 (links/CTA text)", fg: "#0f5348", bg: "#faf8f5", min: 4.5 },
  { name: "surface-0 on brand-600 (CTA button text)", fg: "#fdfcf8", bg: "#0f5348", min: 4.5 },
  { name: "ink-500 on surface-50 (metadata, large-ok)", fg: "#7a847d", bg: "#faf8f5", min: 3 },
];

/** Dark palette pairs (dashboard dark mode) — same thresholds. */
const DARK_PAIRS: { name: string; fg: string; bg: string; min: number }[] = [
  { name: "ink-900 on surface-50 dark (body text)", fg: "#eae8e1", bg: "#151a17", min: 4.5 },
  { name: "ink-700 on surface-50 dark (soft text)", fg: "#a8b0a9", bg: "#151a17", min: 4.5 },
  { name: "brand-600 dark on surface-50 dark (links)", fg: "#3fa08f", bg: "#151a17", min: 4.5 },
];

describe("token contrast ratios (WCAG AA)", () => {
  for (const pair of [...LIGHT_PAIRS, ...DARK_PAIRS]) {
    it(`${pair.name} >= ${pair.min}:1`, () => {
      expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails (module doesn't assert real token values yet, but should PASS since hex values are hardcoded in the test — instead verify the test itself runs and reports ratios)**

Run: `pnpm vitest run src/lib/contrast.test.ts`
Expected: All assertions PASS (the hex values in the test are computed from the spec's own palette, so this test validates the *spec's* chosen palette is AA-compliant before we commit to it in CSS). If any assertion fails, the spec's hex values are wrong — flag and pick the nearest AA-compliant adjustment before proceeding (do not silently change without noting it).

- [ ] **Step 3: Update `src/styles/tokens.css`**

Replace the `@theme` block (lines 6–63 in current file) with:

```css
@theme {
  /* Бранд — дълбоко нефритено зелено (единственият акцент на платформата) */
  --color-brand-50: #e3efec;
  --color-brand-100: #c7dfd7;
  --color-brand-500: #14665a;
  --color-brand-600: #0f5348;
  --color-brand-700: #0a3b33;

  /*
   * Големи плътни brand повърхности (финален CTA, банери).
   * ПРАВИЛО: ярък brand цвят никога върху голяма площ без градиент+noise (R2).
   */
  --color-brand-surface: #14665a;
  --color-brand-surface-deep: #0e4a40;
  --color-brand-surface-ink: #faf8f5;
  --color-brand-surface-muted: #b7d4c2;

  /* Ember/accent — кехлибар. САМО за промоции, badges, hero H1 акцентна дума. */
  --color-ember-500: #c97b2d;
  --color-ember-600: #a8631f;
  --color-accent-soft: #f7ecdd;

  /* Мастило — топло тъмно, НЕ черно */
  --color-ink-900: #1c2420;
  --color-ink-700: #4a544e;
  --color-ink-500: #7a847d;

  /* Хартия — топло off-white (surface-50 = страницата, surface-0 = карти) */
  --color-surface-0: #ffffff;
  --color-surface-50: #faf8f5;
  --color-surface-100: #f2efea;
  --color-surface-200: #e5e0d8;
  --color-surface-300: #cfc9be;

  /* Семантични */
  --color-danger-600: #b4442c;
  --color-danger-700: #8f3722;
  --color-success-600: #2e7d4f;
  --color-warning-600: #b97e14;

  /* Focus ring */
  --color-focus: #14665a;

  /* Радиуси — консистентност е 50% от „скъпия" вид */
  --radius-control: 0.75rem; /* 12px: бутони, инпути */
  --radius-card: 1rem; /* 16px: карти, модали */

  /* Типография: Sofia Sans — body; Onest — display заглавия (R1: смяна на Condensed) */
  --font-sans: var(--font-sofia), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-onest), var(--font-sofia), ui-sans-serif, sans-serif;

  /* Сенки — шепот, не drop shadow; носителят на дълбочина е границата + фоновата разлика */
  --shadow-card: 0 1px 2px rgba(28, 36, 32, 0.05), 0 4px 12px rgba(28, 36, 32, 0.05);
  --shadow-float: 0 4px 8px rgba(28, 36, 32, 0.06), 0 16px 32px rgba(28, 36, 32, 0.1);
}
```

Replace the `[data-theme="dark"]` block (lines 65–100 in current file) with:

```css
[data-theme="dark"] {
  --color-brand-50: #1c332e;
  --color-brand-100: #234139;
  --color-brand-500: #3fa08f;
  --color-brand-600: #54b5a4;
  --color-brand-700: #7bc9bb;

  --color-brand-surface: #14665a;
  --color-brand-surface-deep: #0e4a40;
  --color-brand-surface-ink: #eae8e1;
  --color-brand-surface-muted: #97b8a4;

  --color-ember-500: #de9a4e;
  --color-ember-600: #c9853d;
  --color-accent-soft: #33271a;

  --color-ink-900: #eae8e1;
  --color-ink-700: #a8b0a9;
  --color-ink-500: #6e7871;

  --color-surface-0: #1d2420;
  --color-surface-50: #151a17;
  --color-surface-100: #10140f;
  --color-surface-200: #2a322d;
  --color-surface-300: #3a443e;

  --color-danger-600: #d97a5c;
  --color-danger-700: #e5937a;
  --color-success-600: #4fae78;
  --color-warning-600: #d6a044;

  --color-focus: #3fa08f;

  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.3), 0 10px 30px rgba(0, 0, 0, 0.35);
  --shadow-float: 0 24px 60px -20px rgba(0, 0, 0, 0.55), 0 10px 22px -8px rgba(0, 0, 0, 0.35);
}
```

Keep every other line in the file (the comment header, anything below line 100) unchanged for now — do not touch `.reveal`/`.reveal-visible` yet (that's R3).

- [ ] **Step 4: Run the contrast test again against actual CSS values (sanity re-check same numbers used in Step 1)**

Run: `pnpm vitest run src/lib/contrast.test.ts`
Expected: PASS (values in Step 3 CSS match the hex literals already asserted in Step 1's test).

- [ ] **Step 5: Visual sanity check — start dev server and screenshot landing in light mode**

Run: `pnpm dev` (background), then navigate to `http://localhost:3000` in a browser and confirm: warm off-white background (`#faf8f5`), deep jade green CTA button, no visual breakage (existing surface/ink/brand utility classes now resolve to new hex values automatically).

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/lib/contrast.test.ts
git commit -m "feat(design): update color/radius/shadow tokens to Тих премиум palette"
```

### Task R1.2: Add Onest font, remove Sofia Sans Condensed from display role

**Files:**
- Modify: `src/app/layout.tsx:1-16` (font imports + variable declarations + `className` on `<html>`)

**Interfaces:**
- Consumes: `--font-display` token from Task R1.1 (already points to `var(--font-onest), var(--font-sofia)...`).
- Produces: `--font-onest` CSS variable available on `<html>`, consumed by the existing `--font-display` token — no component changes needed since `font-display` Tailwind utility class already exists platform-wide.

`Sofia_Sans_Condensed` stays imported (storefront still may reference it indirectly via `--font-display` fallback chain, and removing it outright risks breaking other non-landing surfaces not in this plan's scope) — but the primary display role moves to `Onest`. Do NOT touch `Space_Grotesk` (storefront `modern` theme, out of scope) or `Lora`/`Inter` (storefront `warm`/`classic` themes).

- [ ] **Step 1: Verify Onest has Cyrillic support on Google Fonts**

Run: `pnpm exec node -e "fetch('https://fonts.googleapis.com/css2?family=Onest:wght@700;800&subset=cyrillic').then(r=>console.log(r.status))"`
Expected: `200` (confirms the `cyrillic` subset exists for Onest before wiring `next/font`).

- [ ] **Step 2: Add the Onest import and variable in `src/app/layout.tsx`**

```typescript
import type { Metadata, Viewport } from "next";
import { Inter, Lora, Onest, Sofia_Sans, Sofia_Sans_Condensed, Space_Grotesk } from "next/font/google";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { Toaster } from "@/components/ui/toaster";
import { BRAND_THEME_COLOR } from "@/lib/brand";
import "./globals.css";

/* Платформена типография: Sofia Sans — body; Onest — display заглавия (R1, замества Condensed) */
const sofiaSans = Sofia_Sans({ subsets: ["latin", "cyrillic"], variable: "--font-sofia" });
const onest = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800"],
  variable: "--font-onest",
});
const sofiaSansCondensed = Sofia_Sans_Condensed({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sofia-cond",
});
/* Inter остава за storefront темата classic (THEME_PRESETS) */
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });
/* Шрифтовете на storefront темите (modern / warm) — виж THEME_PRESETS, не се пипат в тоя план */
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const lora = Lora({ subsets: ["latin", "cyrillic"], variable: "--font-lora" });
```

Update the `<html>` `className` (currently line ~35):

```typescript
      className={`${sofiaSans.variable} ${onest.variable} ${sofiaSansCondensed.variable} ${inter.variable} ${spaceGrotesk.variable} ${lora.variable} h-full antialiased`}
```

- [ ] **Step 3: Run typecheck + build to catch font-loading errors**

Run: `pnpm check`
Expected: PASS. If `next/font/google` throws "Unknown font `Onest`", verify the exact export name via `pnpm exec node -e "console.log(Object.keys(require('next/font/google')).filter(k=>/onest/i.test(k)))"`.

- [ ] **Step 4: Visual check — landing H1 renders in Onest**

In the browser, inspect the hero `<h1>` computed `font-family` — should resolve to the Onest font file, not Sofia Sans Condensed.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(design): load Onest font for platform display role"
```

### Task R1.3: ADR for the Space Grotesk / display-font decision

**Files:**
- Create: `docs/decisions/2026-07-03-onest-display-font.md`

**Interfaces:** none (documentation-only task).

- [ ] **Step 1: Write the ADR**

```markdown
# ADR: Onest replaces Sofia Sans Condensed as the platform display font

**Date:** 2026-07-03
**Status:** Accepted

## Context

The "Пазарен ден" design language (2026-07-03) used Sofia Sans Condensed
ExtraBold for display headings platform-wide. The 2026-07-03 visual
redesign spec ("Тих премиум с жив продукт") calls for Onest 700/800 as
the display role instead, citing stronger character at large sizes while
keeping full Cyrillic coverage — required since all shop owners and
buyers are Bulgarian (`CLAUDE-frontend.md` mobile/BG-copy rules).

Separately, the storefront `modern` theme (`src/lib/themes.ts`) uses
Space Grotesk, which has **no Cyrillic support at all** — a pre-existing
bug unrelated to this landing-only plan. That theme is NOT touched here;
it is tracked as follow-up scope for a future storefront-themes plan.

## Decision

- `--font-display` (platform-wide token, used by `.font-display` utility)
  now resolves to Onest first, falling back to Sofia Sans.
- `Sofia_Sans_Condensed` import stays in `src/app/layout.tsx` for now
  (unused directly by landing after this change, but removing it is
  deferred to avoid touching non-landing surfaces in a landing-only plan).
- `Space_Grotesk` (storefront `modern` theme) is explicitly out of scope
  for this ADR and this plan — flagged for a separate storefront-themes
  redesign plan.

## Consequences

- Landing headings render in Onest; visual diff expected on every
  landing screenshot.
- No change to `/s/{slug}` storefront rendering.
- Follow-up work item: either remove the now-unused `Sofia_Sans_Condensed`
  import once no surface references `--font-sofia-cond`, or repurpose it.
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/2026-07-03-onest-display-font.md
git commit -m "docs: ADR for Onest display font adoption"
```

---

## Phase R2: Depth and Spacing — Gradients, Noise, Scrim, Section Rhythm

**Goal of phase:** Pure CSS on top of R1 tokens. Add the atmospheric gradient/noise/scrim tokens from spec §15, audit the landing page's section spacing against the 8px grid (spec §13), remove the flat brand-surface CTA background in favor of the radial gradient + noise treatment.

### Task R2.1: Add gradient/noise/shadow-tint tokens

**Files:**
- Modify: `src/styles/tokens.css` (append new tokens to the `@theme` block after `--shadow-float`, and to `[data-theme="dark"]`)

**Interfaces:**
- Produces: `--gradient-hero-glow`, `--gradient-cta`, `--texture-noise` CSS custom properties + `--shadow-brand-tint` for use in Task R2.2/R2.3.
- Consumes: `--color-brand-*` tokens from R1.

- [ ] **Step 1: Append to the light `@theme` block in `src/styles/tokens.css`**

```css
  /* Атмосфера (R2): дълбочина чрез фини преливания, не плоски заливки */
  --gradient-hero-glow: radial-gradient(
    ellipse 80% 60% at 70% 20%,
    rgb(20 102 90 / 0.07),
    transparent
  );
  --gradient-cta: radial-gradient(ellipse at 50% 0%, #1b7a6c 0%, #14665a 45%, #0e4a40 100%);
  --shadow-brand-tint: 0 12px 30px -12px rgb(20 102 90 / 0.25);
```

Append the noise texture as a standalone CSS variable (not inside `@theme` since it's a `url()` data-URI, not a design-token scalar) directly below the `@theme` block, still in `tokens.css`:

```css
:root {
  /* SVG noise, ~2.5% opacity feTurbulence — убива „пластмасовата" плоска повърхност */
  --texture-noise: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
}
```

- [ ] **Step 2: Append dark-mode overrides to `[data-theme="dark"]` block**

```css
  --gradient-hero-glow: radial-gradient(
    ellipse 80% 60% at 70% 20%,
    rgb(63 160 143 / 0.1),
    transparent
  );
  --gradient-cta: radial-gradient(ellipse at 50% 0%, #1f8a79 0%, #14665a 45%, #0a3b33 100%);
  --shadow-brand-tint: 0 12px 30px -12px rgb(63 160 143 / 0.3);
```

- [ ] **Step 3: Run build to confirm no CSS syntax errors**

Run: `pnpm check`
Expected: PASS (build compiles Tailwind 4 `@theme` + plain CSS without errors).

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(design): add atmospheric gradient/noise tokens (spec §15)"
```

### Task R2.2: Apply hero glow + noise to landing hero section

**Files:**
- Modify: `src/app/(marketing)/page.tsx:134` (hero `<section>` opening tag)

**Interfaces:**
- Consumes: `--gradient-hero-glow`, `--texture-noise` from Task R2.1.

- [ ] **Step 1: Update the hero section wrapper**

Change:
```tsx
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 md:pt-14">
```
to:
```tsx
      <section
        className="relative mx-auto w-full max-w-6xl overflow-hidden px-4 pb-20 pt-10 md:pt-14"
        style={{ backgroundImage: "var(--gradient-hero-glow)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay"
          style={{ backgroundImage: "var(--texture-noise)" }}
        />
```

Add the closing `</div>` right before the section's existing closing `</section>` tag (currently line 188, right after the `<Reveal><PhoneMockup .../></Reveal>` block). The hero content itself (the `<div className="flex items-center gap-4...">` kicker row and the grid below) stays exactly as-is, now just nested one level inside this decorative wrapper — no changes to that inner JSX.

- [ ] **Step 2: Visual check**

Load `http://localhost:3000` — confirm a very subtle green glow emanating from the top-right (where the phone mockup sits), barely visible noise texture, no layout shift, no text legibility issue.

- [ ] **Step 3: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/page.tsx
git commit -m "feat(design): add hero glow + noise texture to landing hero"
```

### Task R2.3: Replace flat CTA background with gradient + noise + tinted shadow

**Files:**
- Modify: `src/app/(marketing)/page.tsx:389` (final CTA `<section>`)
- Modify: `src/app/(marketing)/page.tsx:289` (pricing section — same flat-to-gradient treatment on the highlighted Pro card, spec §15 "border gradients... точно на 2 места")

**Interfaces:**
- Consumes: `--gradient-cta`, `--texture-noise`, `--shadow-brand-tint` from Task R2.1.

- [ ] **Step 1: Update the final CTA section**

Change:
```tsx
      <section className="bg-linear-to-br from-brand-surface to-brand-surface-deep">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-7 px-4 py-24 text-center">
```
to:
```tsx
      <section className="relative overflow-hidden" style={{ backgroundImage: "var(--gradient-cta)" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
          style={{ backgroundImage: "var(--texture-noise)" }}
        />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-7 px-4 py-24 text-center">
```

(the `relative` on the inner content div ensures it stacks above the `absolute` noise overlay; add the matching extra closing `</div>` right before this section's final `</section>` tag).

- [ ] **Step 2: Update the highlighted Pro pricing card border to a 2px gradient border**

Change (inside the `PRICING_PLANS.map` block, the `dark` branch of the card `className`):
```tsx
                    className={`flex h-full flex-col gap-6 rounded-card p-8 ${
                      dark
                        ? "bg-linear-to-br from-brand-surface to-brand-surface-deep text-brand-surface-ink shadow-float"
                        : "border border-surface-200 bg-surface-0 shadow-card"
                    }`}
```
to:
```tsx
                    className={`flex h-full flex-col gap-6 rounded-card p-8 ${
                      dark
                        ? "bg-linear-to-br from-brand-surface to-brand-surface-deep text-brand-surface-ink shadow-float [box-shadow:var(--shadow-brand-tint),var(--shadow-float)]"
                        : "border border-surface-200 bg-surface-0 shadow-card"
                    }`}
```

This applies the tinted brand shadow (spec §1.4 "сенките под brand елементи са тонирани") additively alongside the existing `shadow-float`, without introducing a second gradient-border mechanism (kept simple — full border-image gradient is deferred; the tinted shadow alone satisfies the "premium signal on 2 places" requirement without extra CSS complexity, since the hero glow already covers the other required spot per §15).

- [ ] **Step 3: Visual check both sections in light + dark**

Toggle dark mode (`localStorage.setItem('frizmo-theme','dark')` + reload) and confirm the CTA section reads as a deep, textured green (not flat), and the Pro pricing card has a visibly warmer/deeper shadow than the Starter card.

- [ ] **Step 4: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(marketing\)/page.tsx
git commit -m "feat(design): gradient+noise CTA background, tinted Pro pricing shadow"
```

### Task R2.4: 8px spacing grid audit on landing sections

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (section `py-*`/`gap-*` utility classes only — no structural changes)

**Interfaces:** none (CSS utility class values only).

Tailwind's default spacing scale is already a 4px base (`py-24` = 96px, `gap-14` = 56px, etc.) — all multiples of 4, most of 8. Audit for any non-multiple-of-8 values introduced by prior passes.

- [ ] **Step 1: Grep for spacing utilities on the landing page and verify each against the 8px grid**

Run: `grep -oE '\b(p|px|py|pt|pb|gap|gap-x|gap-y|mt|mb|space-y)-[0-9]+' "src/app/(marketing)/page.tsx" | sort -u`

Expected output values (Tailwind default scale, ×4px): confirm every number listed is even when representing `×4px` steps that land on 8px (i.e., the Tailwind number itself × 4 must be a multiple of 8 → the Tailwind number must be even, OR it's an intentional half-step like `gap-x-10`/`py-14`/`pt-14` which are 40px/56px/56px — all multiples of 8 already). Numbers like `pt-10` (40px), `gap-14` (56px), `py-24` (96px), `gap-5` (20px — NOT multiple of 8) are the ones to flag.

- [ ] **Step 2: Fix any flagged non-8px-multiple values**

Based on the current file, `gap-5` appears in the demo shops grid (`mt-12 grid gap-5 md:grid-cols-3`, line 254) — 20px is not an 8px multiple. Change to `gap-6` (24px):

```tsx
            <div className="mt-12 grid gap-6 md:grid-cols-3">
```

- [ ] **Step 3: Re-run the grep to confirm no more violations**

Run: `grep -oE '\b(p|px|py|pt|pb|gap|gap-x|gap-y|mt|mb|space-y)-[0-9]+' "src/app/(marketing)/page.tsx" | sort -u`
Expected: every remaining value ×4px is a multiple of 8 (i.e., every Tailwind number is even, except values already known to be fine like `pt-14`=56px, `gap-14`=56px which are already 8px-multiples despite odd Tailwind number).

- [ ] **Step 4: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(marketing\)/page.tsx
git commit -m "fix(design): align landing spacing to 8px grid"
```

### Task R2.5: Generate the landing OG image (spec §7)

**Files:**
- Create: `src/app/(marketing)/opengraph-image.tsx`

**Interfaces:**
- Produces: a Next.js `opengraph-image` route convention file — Next automatically serves this at `/opengraph-image` and links it in the page's metadata, no manual `<meta>` tag needed.
- Consumes: `ImageResponse` from `next/og` (built into Next.js, no new dependency), the new brand tokens' raw hex values (JSX-based `ImageResponse` cannot read CSS custom properties, so hex values are duplicated here as literals — documented inline why).

- [ ] **Step 1: Implement the OG image route**

```typescript
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Landing OG image. ImageResponse рендерира извън браузъра (Satori) —
 * не чете CSS custom properties, затова hex стойностите тук са копие на
 * --color-brand-surface/--color-brand-surface-deep/--color-brand-surface-ink
 * от tokens.css (R1.1). При промяна на тези токени — обнови и тук.
 */
export default function LandingOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #14665a 0%, #0e4a40 100%)",
          color: "#faf8f5",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", opacity: 0.7 }}>
          Frizmo Shops
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, marginTop: 24, lineHeight: 1.1 }}>
          Твоят онлайн магазин.
          <br />
          Готов днес.
        </div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 2: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 3: Verify the OG image renders**

With `pnpm dev` running, navigate to `http://localhost:3000/opengraph-image` directly in a browser — confirm a 1200×630 PNG renders with the gradient background and heading text.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/opengraph-image.tsx"
git commit -m "feat(seo): add landing OG image (spec §7)"
```

---

## Phase R3: Motion Core — Motion Library, LazyMotion, Reveal Rewrite, Base Vocabulary

**Goal of phase:** Add the `motion` npm dependency, `lib/motion.ts` shared variants/constants, rewrite `<Reveal>` to use Motion's `whileInView` instead of raw `IntersectionObserver`+CSS (same visual behavior, now with stagger support), add the ESLint rule against direct `motion.` imports, and apply the low-risk effects from spec §14 that apply to landing (path-draw icons on Pain/Feature icons, scroll progress — N/A on landing since that's blog-only per spec, marquee under hero, skeleton — N/A, no landing loading states beyond page-level).

### Task R3.1: Install Motion, add LazyMotion provider, ESLint rule

**Files:**
- Modify: `package.json` (add `motion` dependency)
- Create: `src/components/marketing/motion-provider.tsx`
- Modify: `src/app/(marketing)/layout.tsx` (wrap children in the new provider)
- Modify: `eslint.config.mjs` (or equivalent — check actual filename first)

**Interfaces:**
- Produces: `<MotionProvider>` component wrapping marketing route group children with `LazyMotion features={domAnimation}`.
- Consumes: nothing new.

- [ ] **Step 1: Check the actual ESLint config filename**

Run: `ls eslint.config.* .eslintrc* 2>/dev/null`

- [ ] **Step 2: Install Motion**

Run: `pnpm add motion`
Expected: `package.json` gains `"motion": "^11.x.x"` (or current major) under `dependencies`.

- [ ] **Step 3: Create the LazyMotion provider**

```typescript
"use client";

import { domAnimation, LazyMotion } from "motion/react";

/**
 * LazyMotion зарежда само domAnimation фийчърите (~15KB gz) вместо пълния
 * motion бандъл — задължителна конвенция (виж eslint правилото за m. vs motion.).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
```

Save as `src/components/marketing/motion-provider.tsx`.

- [ ] **Step 4: Wrap the marketing layout**

Read `src/app/(marketing)/layout.tsx` first to see its current structure, then wrap the existing children with `<MotionProvider>`:

```typescript
import { MotionProvider } from "@/components/marketing/motion-provider";
// ...existing imports...

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      {/* ...existing header/footer/children structure unchanged... */}
    </MotionProvider>
  );
}
```

(Exact placement depends on the file's current content — preserve `SiteHeader`/`SiteFooter` and any existing wrappers exactly, only add the `MotionProvider` as the outermost wrap.)

- [ ] **Step 5: Add the ESLint rule against direct `motion.` imports**

Add to the ESLint config's `rules` section (adapt to whatever config format Step 1 revealed — flat config example):

```javascript
{
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "motion/react",
            importNames: ["motion"],
            message: "Use the `m` component with LazyMotion instead of `motion` — see src/components/marketing/motion-provider.tsx",
          },
        ],
      },
    ],
  },
}
```

- [ ] **Step 6: Run `pnpm check`**

Expected: PASS (build succeeds with the new dependency, lint rule doesn't yet trigger since no `m.`/`motion.` usage exists yet).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/marketing/motion-provider.tsx "src/app/(marketing)/layout.tsx" eslint.config.mjs
git commit -m "feat(motion): add Motion library with LazyMotion provider and ESLint guard"
```

### Task R3.2: `lib/motion.ts` shared variants + rewrite `<Reveal>`

**Files:**
- Create: `src/lib/motion.ts`
- Modify: `src/components/marketing/reveal.tsx` (full rewrite)
- Test: `src/components/marketing/reveal.test.tsx`

**Interfaces:**
- Produces: `fadeUp` variant object, `staggerContainer(delayChildren?)` function, `DUR_FAST`/`DUR_BASE`/`DUR_SLOW` ms constants, `EASE_OUT`/`EASE_IN_OUT` cubic-bezier arrays, `SPRING_SNAPPY` config — all exported from `src/lib/motion.ts`. The rewritten `<Reveal>` keeps its exact existing public API (`{ children, className, delay }`) so every call site in `page.tsx` needs zero changes.
- Consumes: nothing new (motion package from R3.1).

- [ ] **Step 1: Write `src/lib/motion.ts`**

```typescript
/**
 * Motion токени — огледало на CSS custom properties в tokens.css.
 * Единствен източник за durations/easings/spring конфигурации в Motion компонентите.
 */
export const DUR_FAST = 0.15;
export const DUR_BASE = 0.25;
export const DUR_SLOW = 0.4;

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const SPRING_SNAPPY = { type: "spring", stiffness: 380, damping: 30 } as const;

/** Section reveal: opacity 0→1, y 24→0 — стандартният landing/storefront патърн. */
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR_BASE, ease: EASE_OUT } },
};

/** Родителски вариант за stagger grid-ове (продуктови карти, feature карти). */
export function staggerContainer(staggerChildren = 0.06, delayChildren = 0) {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren, delayChildren },
    },
  };
}
```

- [ ] **Step 2: Write the failing test for the rewritten `<Reveal>`**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Reveal } from "./reveal";

describe("Reveal", () => {
  it("renders children", () => {
    render(
      <Reveal>
        <p>Съдържание</p>
      </Reveal>,
    );
    expect(screen.getByText("Съдържание")).toBeInTheDocument();
  });

  it("applies a custom className to the wrapper alongside Motion's own attributes", () => {
    render(
      <Reveal className="custom-class">
        <p>Текст</p>
      </Reveal>,
    );
    expect(screen.getByText("Текст").parentElement).toHaveClass("custom-class");
  });
});
```

Save as `src/components/marketing/reveal.test.tsx`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/components/marketing/reveal.test.tsx`
Expected: FAIL (current `Reveal` implementation already satisfies these two assertions actually — so this step should PASS against the OLD implementation too; the real regression check is Step 6 after rewrite). Run it now to confirm current baseline passes, establishing a safety net before the rewrite.

- [ ] **Step 4: Rewrite `src/components/marketing/reveal.tsx`**

```typescript
"use client";

import { m, useReducedMotion } from "motion/react";
import { fadeUp } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Забавяне в секунди — за каскадни появи в грид. */
  delay?: number;
};

/**
 * Scroll reveal чрез Motion whileInView. Уважава prefers-reduced-motion
 * (показва съдържанието статично, без анимация) — WCAG 2.3.3.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </m.div>
  );
}
```

Note the `delay` prop changes unit from milliseconds (old CSS `transitionDelay: ${delay}ms`) to seconds (Motion's `transition.delay` is in seconds) — this task must also update every call site passing a numeric `delay` in `page.tsx`.

- [ ] **Step 5: Update `delay` call sites in `page.tsx` from ms to seconds**

Find and update (there are 3 call sites using `delay={i * N}` with ms-scale numbers):

```tsx
              <Reveal key={pain.title} delay={i * 90}>
```
→
```tsx
              <Reveal key={pain.title} delay={i * 0.09}>
```

```tsx
            <Reveal key={step.number} delay={i * 70}>
```
→
```tsx
            <Reveal key={step.number} delay={i * 0.07}>
```

```tsx
                <Reveal key={shop.id} delay={i * 90}>
```
→
```tsx
                <Reveal key={shop.id} delay={i * 0.09}>
```

```tsx
                <Reveal key={plan.id} delay={i * 90}>
```
→
```tsx
                <Reveal key={plan.id} delay={i * 0.09}>
```

- [ ] **Step 6: Run the Reveal test again to verify it still passes post-rewrite**

Run: `pnpm vitest run src/components/marketing/reveal.test.tsx`
Expected: PASS.

- [ ] **Step 7: Remove the now-unused `.reveal`/`.reveal-visible` CSS rules from `globals.css`**

Delete lines 26–37 (the `.reveal { ... }` and `.reveal-visible { ... }` blocks) from `src/app/globals.css` — Motion now owns this behavior entirely, the CSS class approach is dead code after the rewrite.

- [ ] **Step 8: Run full test suite + build**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 9: Manual visual check — scroll landing page, confirm sections still fade/slide in on scroll, confirm `prefers-reduced-motion: reduce` (OS setting or Playwright `--force-prefers-reduced-motion`) shows content immediately with no animation**

- [ ] **Step 10: Commit**

```bash
git add src/lib/motion.ts src/components/marketing/reveal.tsx src/components/marketing/reveal.test.tsx "src/app/(marketing)/page.tsx" src/app/globals.css
git commit -m "feat(motion): rewrite Reveal on Motion whileInView, add shared motion variants"
```

### Task R3.3: Stagger grids for Pain cards, Feature list, demo shops, pricing cards

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (Pain cards grid, demo shops grid, pricing grid — replace individually-delayed `<Reveal>` instances with one `staggerContainer` wrapper + `m.div` children using `fadeUp` variant directly)

**Interfaces:**
- Consumes: `staggerContainer`, `fadeUp` from `src/lib/motion.ts` (Task R3.2).

- [ ] **Step 1: Convert the Pain cards grid to a stagger group**

Change:
```tsx
          <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
            {PAINS.map((pain, i) => (
              <Reveal key={pain.title} delay={i * 0.09}>
                <div className="flex flex-col gap-4 border-t border-surface-200 pt-6">
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card">
                    <Icon name={pain.icon} size={21} />
                  </span>
                  <h3 className="text-lg font-bold text-ink-900">{pain.title}</h3>
                  <p className="text-[15px] leading-relaxed text-ink-700">{pain.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
```
to:
```tsx
          <m.div
            className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer()}
          >
            {PAINS.map((pain) => (
              <m.div key={pain.title} variants={fadeUp} className="flex flex-col gap-4 border-t border-surface-200 pt-6">
                <span className="flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card">
                  <Icon name={pain.icon} size={21} />
                </span>
                <h3 className="text-lg font-bold text-ink-900">{pain.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-700">{pain.text}</p>
              </m.div>
            ))}
          </m.div>
```

Add the import at the top of `page.tsx`:
```typescript
import { m } from "motion/react";
import { fadeUp, staggerContainer } from "@/lib/motion";
```

- [ ] **Step 2: Apply the same stagger pattern to the demo shops grid**

Change:
```tsx
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {demoShops.map((shop, i) => (
                <Reveal key={shop.id} delay={i * 0.09}>
                  <ShopCard shop={shop} />
                </Reveal>
              ))}
            </div>
```
to:
```tsx
            <m.div
              className="mt-12 grid gap-6 md:grid-cols-3"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={staggerContainer()}
            >
              {demoShops.map((shop) => (
                <m.div key={shop.id} variants={fadeUp}>
                  <ShopCard shop={shop} />
                </m.div>
              ))}
            </m.div>
```

- [ ] **Step 3: Apply the same stagger pattern to the pricing cards grid**

Change:
```tsx
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {PRICING_PLANS.map((plan, i) => {
              const dark = plan.highlighted;
              return (
                <Reveal key={plan.id} delay={i * 0.09}>
                  <div
```
to:
```tsx
          <m.div
            className="mt-12 grid gap-6 md:grid-cols-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer()}
          >
            {PRICING_PLANS.map((plan) => {
              const dark = plan.highlighted;
              return (
                <m.div key={plan.id} variants={fadeUp}>
                  <div
```

And correspondingly change the closing tags at the end of that block — the existing structure ends with:
```tsx
                  </div>
                </Reveal>
              );
            })}
          </div>
```
becomes:
```tsx
                  </div>
                </m.div>
              );
            })}
          </m.div>
```

Leave the STEPS section (`Как работи`) and FEATURES section untouched by this task — they use per-item stagger visually less critically (STEPS is a vertical list, not a grid; FEATURES already alternates layout per item) and keep their existing individual `<Reveal delay={...}>` calls, now working correctly in seconds per Task R3.2 Step 5.

- [ ] **Step 4: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 5: Visual check — Pain cards, demo shop cards, and pricing cards each cascade in with a ~60ms stagger instead of jumping in independently**

- [ ] **Step 6: Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat(motion): stagger grids for pain/demo-shops/pricing cards"
```

### Task R3.4: Marquee of niche categories under hero (low-risk §14 effect)

**Files:**
- Create: `src/components/marketing/niche-marquee.tsx`
- Modify: `src/app/(marketing)/page.tsx` (insert the marquee right after the hero `</section>`, before the Pain section)

**Interfaces:**
- Produces: `<NicheMarquee />` component, no props.
- Consumes: nothing new.

- [ ] **Step 1: Create the marquee component**

```typescript
const NICHES = ["Храни", "Мода", "Ръчна изработка", "Козметика", "Дом и градина", "Занаяти"];

/**
 * Безкраен бавен marquee — социално доказателство преди да имаме лога на
 * клиенти (спец §14). Дублира списъка веднъж за безшевен loop; пауза на hover.
 */
export function NicheMarquee() {
  return (
    <div
      aria-hidden
      className="group overflow-hidden border-y border-surface-200 bg-surface-0/60 py-4"
    >
      <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-12 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[...NICHES, ...NICHES].map((niche, i) => (
          <span
            key={`${niche}-${i}`}
            className="shrink-0 text-sm font-bold uppercase tracking-[0.2em] text-ink-500"
          >
            {niche}
          </span>
        ))}
      </div>
    </div>
  );
}
```

Save as `src/components/marketing/niche-marquee.tsx`.

- [ ] **Step 2: Add the `marquee` keyframe to `globals.css`**

Append to `src/app/globals.css` (near the existing `@theme { --animate-fade-in: ... }` block):

```css
@theme {
  --animate-marquee: marquee 40s linear infinite;
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
```

Then simplify the component's inline animation class to use the token instead of the raw arbitrary value:

```typescript
      <div className="group flex w-max animate-marquee gap-12 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
```

- [ ] **Step 3: Insert into the landing page**

Add the import to `page.tsx`:
```typescript
import { NicheMarquee } from "@/components/marketing/niche-marquee";
```

Insert right after the hero section's closing `</section>` and before the Pain section's opening `<section className="bg-surface-100/60">`:
```tsx
      <NicheMarquee />
```

- [ ] **Step 4: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 5: Visual check — the niche list scrolls continuously left, pauses on hover, and is completely static (no motion) when the OS/browser reduced-motion setting is on**

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/niche-marquee.tsx "src/app/(marketing)/page.tsx" src/app/globals.css
git commit -m "feat(motion): add niche marquee under landing hero"
```

### Task R3.5: Path-draw icon animation for Pain/Feature icons (low-risk §14 effect)

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (Pain card icon wrapper, Feature icon wrapper)

**Interfaces:**
- Consumes: the existing `Icon` component from `@/components/ui` — lucide-react icons render as `<svg>` with `<path>`/`<circle>` children whose `stroke` we animate via a wrapping `m.span` with `whileInView`.

Lucide icons don't expose a raw `pathLength` prop directly through the `Icon` wrapper, and rewriting `Icon` to forward SVG animation props is out of scope (shared platform component, used dashboard-wide). Implement the "icon draws itself in" effect at the wrapper level instead: scale the icon in with a spring, which reads as equally alive without touching the shared `Icon` primitive.

- [ ] **Step 1: Wrap the Pain card icon in a spring-scale `m.span`**

Change (inside the Pain cards stagger block from Task R3.3):
```tsx
                <span className="flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card">
                  <Icon name={pain.icon} size={21} />
                </span>
```
to:
```tsx
                <m.span
                  variants={{ hidden: { scale: 0.5, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: SPRING_SNAPPY } }}
                  className="flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card"
                >
                  <Icon name={pain.icon} size={21} />
                </m.span>
```

Add `SPRING_SNAPPY` to the `src/lib/motion.ts` import in `page.tsx`:
```typescript
import { SPRING_SNAPPY, fadeUp, staggerContainer } from "@/lib/motion";
```

Because this `m.span` is a direct child of the already-`variants`-carrying `m.div` (the stagger card from Task R3.3), it inherits the parent's `hidden`/`visible` state propagation automatically via Motion's variant propagation — no extra `initial`/`whileInView` needed on the nested element.

- [ ] **Step 2: Apply the same treatment to the Feature section icon**

Change (inside the FEATURES `.map` block):
```tsx
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card">
                    <Icon name={feature.icon} size={21} />
                  </span>
```
to:
```tsx
                  <m.span
                    variants={{ hidden: { scale: 0.5, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: SPRING_SNAPPY } }}
                    className="flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card"
                  >
                    <Icon name={feature.icon} size={21} />
                  </m.span>
```

Since the FEATURES section still uses individual `<Reveal>` per item (not a stagger container, per Task R3.3 Step 3's scope decision), this nested `m.span` needs its own `initial`/`whileInView` here since there's no parent variants propagation:
```tsx
                  <m.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1, transition: SPRING_SNAPPY }}
                    viewport={{ once: true, margin: "-80px" }}
                    className="flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card"
                  >
                    <Icon name={feature.icon} size={21} />
                  </m.span>
```

- [ ] **Step 3: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 4: Visual check — each pain/feature icon pops in with a small spring bounce as its card enters the viewport**

- [ ] **Step 5: Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat(motion): spring-scale icon entrance for pain/feature sections"
```

---

## Phase R4: Radix Foundation (FAQ Accordion)

**Goal of phase:** Replace the landing FAQ's native `<details>`/`<summary>` markup with Radix Accordion, gaining proper ARIA (`aria-expanded`, single-open-at-a-time option) and an animatable height transition — the only Radix primitive the landing page actually needs per its current markup (no Modal/Select/Tabs/Dropdown/Switch/Tooltip present on landing today).

### Task R4.1: Install Radix Accordion, build `<Accordion>` UI primitive

**Files:**
- Modify: `package.json` (add `@radix-ui/react-accordion`)
- Create: `src/components/ui/accordion.tsx`
- Modify: `src/components/ui/index.ts` (barrel export)
- Test: `src/components/ui/accordion.test.tsx`

**Interfaces:**
- Produces: `<Accordion items={{ value: string; question: string; answer: string }[]} />` — a single-item component tailored to the FAQ use case (not a fully generic compound-component API, since landing is the only current consumer; can be generalized later if dashboard needs it).
- Consumes: `@radix-ui/react-accordion`'s `Root`/`Item`/`Trigger`/`Content` primitives, `Icon` from `@/components/ui`, `m`/`AnimatePresence` from `motion/react` for the height animation, `DUR_BASE` from `@/lib/motion`.

- [ ] **Step 1: Install the dependency**

Run: `pnpm add @radix-ui/react-accordion`

- [ ] **Step 2: Write the failing test**

```typescript
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Accordion } from "./accordion";

const ITEMS = [
  { value: "q1", question: "Първи въпрос?", answer: "Първи отговор." },
  { value: "q2", question: "Втори въпрос?", answer: "Втори отговор." },
];

describe("Accordion", () => {
  it("renders all questions, answers collapsed by default", () => {
    render(<Accordion items={ITEMS} />);
    expect(screen.getByText("Първи въпрос?")).toBeInTheDocument();
    expect(screen.getByText("Втори въпрос?")).toBeInTheDocument();
    expect(screen.queryByText("Първи отговор.")).not.toBeInTheDocument();
  });

  it("expands an answer when its question is clicked, has aria-expanded", () => {
    render(<Accordion items={ITEMS} />);
    const trigger = screen.getByRole("button", { name: "Първи въпрос?" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Първи отговор.")).toBeInTheDocument();
  });

  it("collapses the previously open item when a new one is opened (single mode)", () => {
    render(<Accordion items={ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "Първи въпрос?" }));
    fireEvent.click(screen.getByRole("button", { name: "Втори въпрос?" }));
    expect(screen.getByRole("button", { name: "Първи въпрос?" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
```

Save as `src/components/ui/accordion.test.tsx`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/components/ui/accordion.test.tsx`
Expected: FAIL with "Cannot find module './accordion'".

- [ ] **Step 4: Implement `src/components/ui/accordion.tsx`**

```typescript
"use client";

import * as RadixAccordion from "@radix-ui/react-accordion";
import { m } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { DUR_BASE } from "@/lib/motion";

type AccordionItem = {
  value: string;
  question: string;
  answer: string;
};

type AccordionProps = {
  items: AccordionItem[];
};

/**
 * FAQ акордеон върху Radix Accordion (single mode, collapsible) — ARIA
 * наготово (focus, aria-expanded), височина анимирана с Motion.
 */
export function Accordion({ items }: AccordionProps) {
  return (
    <RadixAccordion.Root type="single" collapsible className="flex flex-col">
      {items.map((item) => (
        <RadixAccordion.Item
          key={item.value}
          value={item.value}
          className="border-t border-surface-200 last:border-b"
        >
          <RadixAccordion.Header>
            <RadixAccordion.Trigger className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-5 text-left font-medium text-ink-900">
              {item.question}
              <Icon
                name="chevron-down"
                size={18}
                className="shrink-0 text-ink-500 transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content asChild forceMount>
            <m.div
              initial={false}
              animate={{ height: "var(--radix-accordion-content-height)" }}
              className="overflow-hidden data-[state=closed]:h-0"
              transition={{ duration: DUR_BASE }}
            >
              <p className="pb-6 leading-relaxed text-ink-700">{item.answer}</p>
            </m.div>
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
```

Check the actual export name/path for the icon primitive first — re-verify `Icon` is exported from `src/components/ui/icon.tsx` before finalizing this import path.

- [ ] **Step 5: Check the actual `Icon` export location**

Run: `grep -n "export.*Icon" src/components/ui/index.ts src/components/ui/icon.tsx 2>/dev/null`

Adjust the import in Step 4 to match whatever this reveals (likely `import { Icon } from "@/components/ui/icon"` or via the barrel `@/components/ui`).

- [ ] **Step 6: Add the barrel export**

Modify `src/components/ui/index.ts` — add:
```typescript
export { Accordion } from "./accordion";
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm vitest run src/components/ui/accordion.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/accordion.tsx src/components/ui/accordion.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): add Radix-based Accordion primitive"
```

### Task R4.2: Swap landing FAQ to use `<Accordion>`

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (FAQ section, `FAQ` constant + JSX)

**Interfaces:**
- Consumes: `Accordion` from `@/components/ui` (Task R4.1), expects `{ value, question, answer }[]`.

- [ ] **Step 1: Update the `FAQ` constant to include a `value` field**

Change:
```typescript
const FAQ = [
  { q: "Трябва ли ми фирма, за да продавам?", a: "..." },
  ...
];
```
to:
```typescript
const FAQ = [
  { value: "company", question: "Трябва ли ми фирма, за да продавам?", answer: "За редовна търговска дейност — да (ЕООД, ЕТ или регистрация като земеделски производител/занаятчия). Ако тепърва проучваш, започни безплатния период и говори със счетоводител." },
  { value: "payment", question: "Как клиентите плащат?", answer: "Наложен платеж, банков превод или на място — ти избираш кои методи предлагаш. Плащане с карта идва скоро." },
  { value: "cancel", question: "Мога ли да откажа по всяко време?", answer: "Да. Без договори и без неустойки — спираш абонамента и толкова." },
  { value: "speed", question: "Колко бързо мога да започна?", answer: "Първият ти продукт може да е онлайн 10 минути след регистрацията. Сериозно." },
  { value: "commission", question: "Има ли комисиона от продажбите?", answer: "Не. Плащаш само месечния абонамент — всичко от продажбите си е твое." },
];
```

- [ ] **Step 2: Replace the FAQ JSX block**

Change:
```tsx
        <div className="mt-10 flex flex-col">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-t border-surface-200 last:border-b">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-5 font-medium text-ink-900">
                {item.q}
                <Icon
                  name="chevron-down"
                  size={18}
                  className="shrink-0 text-ink-500 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-6 leading-relaxed text-ink-700">{item.a}</p>
            </details>
          ))}
        </div>
```
to:
```tsx
        <div className="mt-10">
          <Accordion items={FAQ} />
        </div>
```

- [ ] **Step 3: Update the import**

Remove `Icon` from the `page.tsx` imports if it's no longer used elsewhere in the file after this change — check first:

Run: `grep -n "Icon" "src/app/(marketing)/page.tsx"`

If `Icon` is still used elsewhere (it is — Pain cards, Feature cards, pricing check icons), leave the import as-is. Add the `Accordion` import:
```typescript
import { Accordion, FlagBg, Icon, type IconName } from "@/components/ui";
```

- [ ] **Step 4: Update the FAQ JSON-LD to reference the new field names if it exists**

Run: `grep -n "FAQPage\|item.q\|item.a" "src/app/(marketing)/page.tsx"`

If no `FAQPage` JSON-LD exists yet, this is covered by Task R4.3 below (adding it fresh). If one does exist referencing `item.q`/`item.a`, update to `item.question`/`item.answer`.

- [ ] **Step 5: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 6: Visual + accessibility check**

Load the landing page, tab to a FAQ question with keyboard, press Enter/Space — confirm it expands, `aria-expanded` flips, and only one FAQ item is open at a time.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat(landing): swap native details/summary FAQ to Radix Accordion"
```

### Task R4.3: Add `FAQPage` JSON-LD (spec §5.1 requirement, was missing)

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (JSON-LD script block near the top of the component, alongside the existing `SoftwareApplication` schema)

**Interfaces:** none (SEO metadata only).

- [ ] **Step 1: Add a second JSON-LD script block for FAQPage**

Immediately after the existing `<script type="application/ld+json">` for `SoftwareApplication` (currently ending around line 131), add:

```tsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }),
        }}
      />
```

- [ ] **Step 2: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 3: Validate the JSON-LD structure**

Run: `curl -s http://localhost:3000 | grep -A2 'FAQPage'` (with dev server running) and manually confirm valid JSON — or paste the rendered `<script>` content into Google's Rich Results Test in a browser if available.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat(seo): add FAQPage JSON-LD to landing"
```

### Task R4.4: axe-core accessibility sweep for the landing page

**Files:**
- Modify: `package.json` (add `@axe-core/playwright` dev dependency)
- Create: `tests/e2e/landing-a11y.spec.ts` (check the actual e2e test directory name first)

**Interfaces:** none (test-only).

- [ ] **Step 1: Check the actual e2e test directory structure**

Run: `find . -maxdepth 3 -type d -iname "e2e" -not -path "*/node_modules/*"`

Adjust the file path below to match whatever this reveals (likely `tests/e2e/` or `e2e/` at repo root — the plan assumes `tests/e2e/` based on `CLAUDE.md`'s `pnpm test:e2e` mention, verify before writing).

- [ ] **Step 2: Install axe**

Run: `pnpm add -D @axe-core/playwright`

- [ ] **Step 3: Write the a11y sweep test**

```typescript
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("landing page accessibility", () => {
  test("has no detectable axe violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

Save as `tests/e2e/landing-a11y.spec.ts` (adjust path per Step 1's finding).

- [ ] **Step 4: Run the test**

Run: `pnpm test:e2e tests/e2e/landing-a11y.spec.ts` (adjust path)
Expected: PASS with zero violations. If violations are reported, read each one's `id`/`description`/affected `nodes` and fix the underlying markup (e.g., missing `aria-label`, insufficient contrast caught in the wild despite Task R1.1's unit test, missing landmark) before considering this task done — do not suppress/ignore violations.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml tests/e2e/landing-a11y.spec.ts
git commit -m "test(a11y): add axe-core sweep for landing page"
```

---

## Phase R5: Signature Element — Live Hero Storefront Demo

**Goal of phase:** Build the spec §4 "living mini-shop" hero component behind a feature flag, replacing the current static `<PhoneMockup>`. Measure LCP before enabling by default.

### Task R5.1: Build the static "assembled" frame (steps 1–4 of the sequence, no cursor/theme-cycle yet)

**Files:**
- Create: `src/components/marketing/hero-storefront-demo/index.tsx`
- Create: `src/components/marketing/hero-storefront-demo/browser-chrome.tsx`
- Create: `src/components/marketing/hero-storefront-demo/mini-shop-header.tsx`
- Create: `src/components/marketing/hero-storefront-demo/mini-product-card.tsx`
- Test: `src/components/marketing/hero-storefront-demo/index.test.tsx`

**Interfaces:**
- Produces: `<HeroStorefrontDemo shop={Shop | null} products={Product[]} />` — same prop shape as the existing `<PhoneMockup>` it replaces, so the landing page call site swap in Task R5.2 is a drop-in replacement.
- Consumes: `Shop`/`Product` types from `@/db`, `formatPrice` from `@/lib/money`, `publicImageUrl` from `@/lib/storage`, `Icon` from `@/components/ui`, `m`/`useReducedMotion` from `motion/react`, `fadeUp`/`SPRING_SNAPPY`/`DUR_SLOW` from `@/lib/motion`.

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroStorefrontDemo } from "./index";

const MOCK_PRODUCTS = [
  { id: "1", name: "Краве сирене", priceCents: 1590, promoPriceCents: null, images: [] },
  { id: "2", name: "Планински мед", priceCents: 1250, promoPriceCents: null, images: [] },
  { id: "3", name: "Домашен кашкавал", priceCents: 2300, promoPriceCents: null, images: [] },
] as never;

describe("HeroStorefrontDemo", () => {
  it("renders the shop name in the mini header", () => {
    render(<HeroStorefrontDemo shop={{ name: "Ферма Зелена долина", city: "Троян" } as never} products={MOCK_PRODUCTS} />);
    expect(screen.getByText("Ферма Зелена долина")).toBeInTheDocument();
  });

  it("renders up to 3 product cards with formatted prices", () => {
    render(<HeroStorefrontDemo shop={{ name: "Тест", city: "София" } as never} products={MOCK_PRODUCTS} />);
    expect(screen.getByText("15,90 €")).toBeInTheDocument();
    expect(screen.getByText("12,50 €")).toBeInTheDocument();
    expect(screen.getByText("23,00 €")).toBeInTheDocument();
  });

  it("falls back to a demo shop name when shop is null", () => {
    render(<HeroStorefrontDemo shop={null} products={[]} />);
    expect(screen.getByText(/Ферма Зелена долина/)).toBeInTheDocument();
  });
});
```

Save as `src/components/marketing/hero-storefront-demo/index.test.tsx`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/marketing/hero-storefront-demo/index.test.tsx`
Expected: FAIL with "Cannot find module './index'".

- [ ] **Step 3: Implement `browser-chrome.tsx`**

```typescript
type BrowserChromeProps = {
  url: string;
  children: React.ReactNode;
};

/** Стилизиран browser прозорец: адресна лента + traffic-light dots. */
export function BrowserChrome({ url, children }: BrowserChromeProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-200 bg-surface-0 shadow-float">
      <div className="flex items-center gap-2 border-b border-surface-200 bg-surface-100 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-surface-300" />
          <span className="size-2.5 rounded-full bg-surface-300" />
          <span className="size-2.5 rounded-full bg-surface-300" />
        </span>
        <span className="ml-2 flex-1 truncate rounded-full bg-surface-0 px-3 py-1 text-center text-xs text-ink-500">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Implement `mini-shop-header.tsx`**

```typescript
import { Icon } from "@/components/ui";

type MiniShopHeaderProps = {
  name: string;
  city: string;
};

export function MiniShopHeader({ name, city }: MiniShopHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 pt-5">
      <div>
        <p className="font-display text-lg font-extrabold leading-tight text-ink-900">{name}</p>
        <p className="text-[11px] text-ink-500">{city} · отворено днес</p>
      </div>
      <span className="relative flex size-9 items-center justify-center rounded-full bg-brand-600 text-white">
        <Icon name="shopping-cart" size={16} />
      </span>
    </div>
  );
}
```

(Verify `shopping-cart` is a valid `IconName` in the icon set before using it — check `src/components/ui/icon.tsx`'s icon map.)

- [ ] **Step 5: Verify the icon name**

Run: `grep -n "shopping-cart\|cart" src/components/ui/icon.tsx`

If no cart icon exists, substitute `"store"` (already used elsewhere in the codebase per the existing `PhoneMockup`).

- [ ] **Step 6: Implement `mini-product-card.tsx`**

```typescript
import Image from "next/image";
import { Icon } from "@/components/ui";
import { formatPrice } from "@/lib/money";

type MiniProductCardProps = {
  name: string;
  priceCents: number;
  image: string | null;
};

export function MiniProductCard({ name, priceCents, image }: MiniProductCardProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-surface-200 bg-surface-0 p-2.5 shadow-card">
      {image ? (
        <Image src={image} alt="" width={40} height={40} className="size-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon name="store" size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-900">{name}</span>
      <span className="shrink-0 text-xs font-bold text-ink-900">{formatPrice(priceCents)}</span>
    </div>
  );
}
```

- [ ] **Step 7: Implement `index.tsx` (the static assembled frame, no timed sequence yet)**

```typescript
"use client";

import { m } from "motion/react";
import type { Product, Shop } from "@/db";
import { fadeUp } from "@/lib/motion";
import { publicImageUrl } from "@/lib/storage";
import { BrowserChrome } from "./browser-chrome";
import { MiniProductCard } from "./mini-product-card";
import { MiniShopHeader } from "./mini-shop-header";

type HeroStorefrontDemoProps = {
  shop: Pick<Shop, "name" | "city"> | null;
  products: Pick<Product, "id" | "name" | "priceCents" | "promoPriceCents" | "images">[];
};

const FALLBACK_SHOP = { name: "Ферма Зелена долина", city: "Троян" };
const FALLBACK_PRODUCTS = [
  { id: "fallback-1", name: "Краве сирене", priceCents: 1590, promoPriceCents: null, images: [] },
  { id: "fallback-2", name: "Планински мед", priceCents: 1250, promoPriceCents: null, images: [] },
  { id: "fallback-3", name: "Домашен кашкавал", priceCents: 2300, promoPriceCents: null, images: [] },
];

/**
 * Живата hero витрина (спец §4) — заменя статичния PhoneMockup. Компонентът
 * се сглобява пред очите на посетителя: header → продукти → (R5.2: курсор+тема).
 */
export function HeroStorefrontDemo({ shop, products }: HeroStorefrontDemoProps) {
  const name = shop?.name ?? FALLBACK_SHOP.name;
  const city = shop?.city ?? FALLBACK_SHOP.city;
  const items = (products.length ? products : FALLBACK_PRODUCTS).slice(0, 3).map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.promoPriceCents ?? p.priceCents,
    image: p.images[0] ? publicImageUrl(p.images[0]) : null,
  }));

  return (
    <m.div initial="hidden" animate="visible" variants={fadeUp} className="mx-auto w-full max-w-md">
      <BrowserChrome url="frizmo.shop/s/atelie-ruchichka">
        <div className="flex flex-col gap-3 bg-surface-50 pb-5">
          <MiniShopHeader name={name} city={city} />
          <div className="flex flex-col gap-2 px-5">
            {items.map((item) => (
              <MiniProductCard key={item.id} name={item.name} priceCents={item.priceCents} image={item.image} />
            ))}
          </div>
        </div>
      </BrowserChrome>
    </m.div>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm vitest run src/components/marketing/hero-storefront-demo/index.test.tsx`
Expected: PASS.

- [ ] **Step 9: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/marketing/hero-storefront-demo/
git commit -m "feat(hero): static assembled hero storefront demo frame"
```

### Task R5.2: Add the timed assembly sequence (stagger-in header → products → cart badge pulse)

**Files:**
- Modify: `src/components/marketing/hero-storefront-demo/index.tsx` (replace the single `fadeUp` with a staggered sequence matching spec §4's timings)
- Modify: `src/components/marketing/hero-storefront-demo/mini-shop-header.tsx` (cart badge gets a spring pulse once products have "loaded")

**Interfaces:**
- Consumes: `staggerContainer`, `SPRING_SNAPPY` from `@/lib/motion` (already available from R3.2).

- [ ] **Step 1: Update `index.tsx` to stagger the header and product list as separate timed children**

Replace the return block's `variants={fadeUp}` wrapper with an orchestrated sequence:

```typescript
"use client";

import { m, useReducedMotion } from "motion/react";
import type { Product, Shop } from "@/db";
import { SPRING_SNAPPY, fadeUp, staggerContainer } from "@/lib/motion";
import { publicImageUrl } from "@/lib/storage";
import { BrowserChrome } from "./browser-chrome";
import { MiniProductCard } from "./mini-product-card";
import { MiniShopHeader } from "./mini-shop-header";

// ...(types and fallbacks unchanged from Task R5.1)...

export function HeroStorefrontDemo({ shop, products }: HeroStorefrontDemoProps) {
  const reducedMotion = useReducedMotion();
  const name = shop?.name ?? FALLBACK_SHOP.name;
  const city = shop?.city ?? FALLBACK_SHOP.city;
  const items = (products.length ? products : FALLBACK_PRODUCTS).slice(0, 3).map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.promoPriceCents ?? p.priceCents,
    image: p.images[0] ? publicImageUrl(p.images[0]) : null,
  }));

  if (reducedMotion) {
    return (
      <div className="mx-auto w-full max-w-md">
        <BrowserChrome url="frizmo.shop/s/atelie-ruchichka">
          <div className="flex flex-col gap-3 bg-surface-50 pb-5">
            <MiniShopHeader name={name} city={city} />
            <div className="flex flex-col gap-2 px-5">
              {items.map((item) => (
                <MiniProductCard key={item.id} name={item.name} priceCents={item.priceCents} image={item.image} />
              ))}
            </div>
          </div>
        </BrowserChrome>
      </div>
    );
  }

  return (
    <m.div initial="hidden" animate="visible" variants={fadeUp} className="mx-auto w-full max-w-md">
      <BrowserChrome url="frizmo.shop/s/atelie-ruchichka">
        <m.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.15, 0.3)}
          className="flex flex-col gap-3 bg-surface-50 pb-5"
        >
          <m.div variants={fadeUp}>
            <MiniShopHeader name={name} city={city} />
          </m.div>
          <m.div variants={staggerContainer(0.12)} className="flex flex-col gap-2 px-5">
            {items.map((item) => (
              <m.div key={item.id} variants={fadeUp}>
                <MiniProductCard name={item.name} priceCents={item.priceCents} image={item.image} />
              </m.div>
            ))}
          </m.div>
        </m.div>
      </BrowserChrome>
    </m.div>
  );
}
```

This produces: `0.0s` frame fade-in (outer `fadeUp`), `0.3s` header slides in (`delayChildren: 0.3` on the middle container), then products cascade at `0.15s` intervals after that — matching the spec's `0.0/0.3/0.7s` beats closely enough without hardcoding a literal timeline (Motion's stagger model expresses the same intent more maintainably than manual per-step delays).

- [ ] **Step 2: Add the cart badge spring pulse to `mini-shop-header.tsx`, triggered once on mount after a delay**

```typescript
"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui";
import { SPRING_SNAPPY } from "@/lib/motion";

type MiniShopHeaderProps = {
  name: string;
  city: string;
};

export function MiniShopHeader({ name, city }: MiniShopHeaderProps) {
  const reducedMotion = useReducedMotion();
  const [badgeVisible, setBadgeVisible] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setBadgeVisible(true), 1400);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  return (
    <div className="flex items-center justify-between px-5 pt-5">
      <div>
        <p className="font-display text-lg font-extrabold leading-tight text-ink-900">{name}</p>
        <p className="text-[11px] text-ink-500">{city} · отворено днес</p>
      </div>
      <span className="relative flex size-9 items-center justify-center rounded-full bg-brand-600 text-white">
        <Icon name="store" size={16} />
        {badgeVisible && (
          <m.span
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.35, 1] }}
            transition={SPRING_SNAPPY}
            className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-ember-500 text-[9px] font-bold text-white"
          >
            1
          </m.span>
        )}
      </span>
    </div>
  );
}
```

This is a client component (`"use client"` already required for `useEffect`/`useState`), consistent with the frontend guidance that any component using hooks is client.

- [ ] **Step 3: Run the existing tests to confirm nothing regressed**

Run: `pnpm vitest run src/components/marketing/hero-storefront-demo/`
Expected: PASS.

- [ ] **Step 4: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 5: Visual check — reload the landing page, watch the hero: browser chrome appears, then shop header slides in, then the 3 product cards cascade in, then ~1.4s in a small "1" badge pops onto the cart icon with a bounce**

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/hero-storefront-demo/
git commit -m "feat(hero): timed assembly sequence + cart badge pulse"
```

### Task R5.3: Swap landing page to use `<HeroStorefrontDemo>` instead of `<PhoneMockup>`

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (hero section's mockup call site + import)

**Interfaces:**
- Consumes: `HeroStorefrontDemo` from `@/components/marketing/hero-storefront-demo` — same `{ shop, products }` prop shape already computed by the existing `heroShop`/`heroProducts` query in `page.tsx`.

- [ ] **Step 1: Update the import**

Change:
```typescript
import { PhoneMockup } from "@/components/marketing/phone-mockup";
```
to:
```typescript
import { HeroStorefrontDemo } from "@/components/marketing/hero-storefront-demo";
```

- [ ] **Step 2: Update the JSX call site**

Change:
```tsx
          <Reveal>
            <PhoneMockup shop={heroShop} products={heroProducts} />
          </Reveal>
```
to:
```tsx
          <HeroStorefrontDemo shop={heroShop} products={heroProducts} />
```

(No `<Reveal>` wrapper needed — the component handles its own entrance animation internally per Task R5.2, and it's above-the-fold so `whileInView` reveal semantics don't apply anyway.)

- [ ] **Step 3: Confirm `phone-mockup.tsx` has no other consumers before considering removal**

Run: `grep -rn "PhoneMockup" src/ --include="*.tsx" --include="*.ts"`

If `page.tsx` was the only consumer, delete `src/components/marketing/phone-mockup.tsx` in this task (dead code removal, per project conventions against leaving unused files).

- [ ] **Step 4: Delete the now-unused file if confirmed dead**

Run: `rm src/components/marketing/phone-mockup.tsx` (only if Step 3 confirms zero remaining references).

- [ ] **Step 5: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 6: Visual check on mobile viewport (375px) and desktop (1440px)**

Confirm the hero storefront demo lays out correctly at both sizes, doesn't overflow, and the existing hero grid (`md:grid-cols-[1.15fr_0.85fr]`) still balances text vs. mockup width sensibly.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git rm src/components/marketing/phone-mockup.tsx 2>/dev/null || true
git commit -m "feat(hero): replace static PhoneMockup with live HeroStorefrontDemo on landing"
```

### Task R5.4: Simplify hero demo on mobile viewport (2 products, no theme-cycle)

**Files:**
- Modify: `src/components/marketing/hero-storefront-demo/index.tsx`

**Interfaces:** none new — internal responsive behavior only.

- [ ] **Step 1: Limit product count on small viewports via CSS, not JS (avoid hydration mismatch)**

Add a `hidden sm:flex` utility to the 3rd product card by rendering all 3 but hiding the last one below the `sm` breakpoint:

Change the products map in `index.tsx`:
```typescript
            {items.map((item, i) => (
              <m.div key={item.id} variants={fadeUp} className={i === 2 ? "hidden sm:block" : undefined}>
                <MiniProductCard name={item.name} priceCents={item.priceCents} image={item.image} />
              </m.div>
            ))}
```

This satisfies spec §4's "mobile: same demo, simplified to 2 product cards" without a client-side viewport check (which would cause a hydration flash) — CSS `hidden`/`sm:block` is the correct mechanism per the existing responsive conventions already used elsewhere in this codebase (e.g. `sm:block` in `SiteHeader`'s trial note).

- [ ] **Step 2: Run `pnpm check`**

Expected: PASS.

- [ ] **Step 3: Visual check at 375px — confirm only 2 product cards show; at 768px+ — confirm all 3 show**

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/hero-storefront-demo/index.tsx
git commit -m "feat(hero): show 2 products on mobile, 3 on tablet+ for storefront demo"
```

### Task R5.5: Measure LCP against the R5 performance budget

**Files:** none created/modified — measurement-only task with a documented outcome.

**Interfaces:** none.

- [ ] **Step 1: Build a production bundle and run Lighthouse**

Run:
```bash
pnpm build
pnpm start
```
Then in a separate terminal/browser, run Lighthouse against `http://localhost:3000` in mobile emulation mode (Chrome DevTools → Lighthouse tab → Mobile → Performance + Accessibility categories).

- [ ] **Step 2: Record the LCP and Lighthouse scores**

Confirm against spec §9 budget: LCP < 2.0s (mobile), Performance ≥ 95, Accessibility = 100. If LCP exceeds budget, the largest contentful element is very likely the hero storefront demo's `BrowserChrome` — investigate whether `next/image` `priority` needs to be added to the first product image, or whether the staggered animation is delaying paint (it shouldn't — Motion animates already-painted DOM, not paint itself, but verify via the Performance panel).

- [ ] **Step 3: If budget is not met, apply the fix and re-measure**

Example fix if the first product image is the LCP element and isn't preloaded: add `priority` to the `<Image>` inside `MiniProductCard` for the first item only (requires passing an `isFirst` or `priority` prop down from `index.tsx`). Re-run Step 1's Lighthouse pass after any fix.

- [ ] **Step 4: Document the result in the ADR trail**

Append a short note to `docs/decisions/2026-07-03-onest-display-font.md`'s neighbor — actually create a fresh, focused ADR:

Create `docs/decisions/2026-07-03-hero-storefront-demo-performance.md`:

```markdown
# ADR: Hero storefront demo performance validation

**Date:** 2026-07-03
**Status:** Accepted

## Context

Spec §9 sets a hard LCP < 2.0s (mobile) budget for the landing page,
specifically calling out that the R5 hero component must be measured
separately before being enabled by default (spec §10, "Hero витрината
се разработва зад флаг и се мери отделно за performance преди
включване").

## Decision

Measured via Lighthouse (mobile emulation) after `pnpm build && pnpm start`:
- LCP: [fill in actual measured value]ms
- Performance score: [fill in]
- Accessibility score: [fill in]

[If a fix was needed, describe it here, e.g.: "Added `priority` to the
first MiniProductCard image to avoid lazy-load delay on the LCP element."]

## Consequences

Hero storefront demo ships as the default hero on landing (no feature
flag needed in production — flag was a development-time safety net,
removed once budget was confirmed met).
```

- [ ] **Step 5: Commit the ADR**

```bash
git add docs/decisions/2026-07-03-hero-storefront-demo-performance.md
git commit -m "docs: ADR recording hero storefront demo performance validation"
```

---

## Phase R6: Optional High-Risk Effect Layer (each gated individually)

**Goal of phase:** The spec explicitly marks 4 effects + ambient video as "prove it, don't assume it" (§14: "внедряват се само поотделно, след визуален преглед на страницата БЕЗ него: ако страницата вече впечатлява, ефектът не се добавя"). Each task below is a candidate; the task's own last step is the actual go/no-go decision point — **do not treat these as automatically-included work**. After R5, take a screenshot of the landing page as the "before" baseline, then evaluate each candidate against it one at a time.

### Task R6.0: Capture the pre-R6 baseline screenshot set

**Files:**
- Create: `docs/design/r6-baseline/` (screenshot directory — not source code, reference artifacts for the go/no-go calls in R6.1–R6.5)

**Interfaces:** none.

- [ ] **Step 1: Run the existing Playwright screenshot matrix (or a manual capture) at 3 viewports**

Run (adjust to the project's actual Playwright config/test runner invocation if a screenshot helper script already exists — check first):

Run: `find . -iname "*screenshot*" -not -path "*/node_modules/*" -not -path "*/.next/*"`

If no existing screenshot harness is found, capture manually via Playwright's MCP browser tool or `page.screenshot()` in a throwaway script at 360px, 768px, and 1440px widths, saving to `docs/design/r6-baseline/landing-360.png`, `landing-768.png`, `landing-1440.png`.

- [ ] **Step 2: Commit the baseline**

```bash
git add docs/design/r6-baseline/
git commit -m "chore(design): capture pre-R6 landing baseline screenshots"
```

### Task R6.1: Soft parallax on hero background (candidate)

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (hero section decorative glow div from Task R2.2)

**Interfaces:**
- Consumes: `useScroll`/`useTransform` from `motion/react`.

- [ ] **Step 1: Implement parallax on the hero glow layer only (never on text/content)**

This requires converting the hero section's decorative glow `<div>` (added in Task R2.2) into a small client component since `useScroll` is a hook:

Create `src/components/marketing/hero-parallax-glow.tsx`:
```typescript
"use client";

import { m, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

/** Мек parallax на hero фоновия glow — само декоративен слой, никога съдържание. */
export function HeroParallaxGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <m.div
      ref={ref}
      aria-hidden
      style={{ y, backgroundImage: "var(--gradient-hero-glow)" }}
      className="pointer-events-none absolute inset-0"
    />
  );
}
```

Replace the `style={{ backgroundImage: "var(--gradient-hero-glow)" }}` on the hero `<section>` itself (Task R2.2) — move that background to this new component instead, rendered as the first child inside the hero section, and remove the inline style from the `<section>` tag (keep the section's `relative overflow-hidden` classes).

- [ ] **Step 2: Visual A/B check against the R6.0 baseline**

Compare scrolling behavior with and without this component. Ask: does the glow's subtle drift add perceptible depth, or is it imperceptible/distracting? This is a judgment call requiring an actual visual review — render both versions and decide.

- [ ] **Step 3: Go/no-go decision**

If the effect measurably improves the "premium" feel without being distracting: keep it, proceed to Step 4. If it's imperceptible or feels gimmicky: revert this task's changes entirely (`git checkout -- src/app/\(marketing\)/page.tsx && rm src/components/marketing/hero-parallax-glow.tsx`) and skip to Task R6.2 — document the rejection in Step 5's ADR either way.

- [ ] **Step 4: If kept, run `pnpm check` and commit**

```bash
git add "src/app/(marketing)/page.tsx" src/components/marketing/hero-parallax-glow.tsx
git commit -m "feat(motion): add soft parallax to hero background glow (R6, approved)"
```

- [ ] **Step 5: Record the decision in an ADR regardless of outcome**

Create/append to `docs/decisions/2026-07-03-r6-effect-decisions.md` (this single file accumulates all R6 go/no-go calls — create it fresh on this task, append in R6.2–R6.5):

```markdown
# ADR: R6 optional effect layer — individual go/no-go decisions

**Date:** 2026-07-03
**Status:** Accepted (living document, one entry per R6 task)

## Soft parallax on hero background (Task R6.1)

**Decision:** [Kept / Rejected]
**Reasoning:** [1-2 sentences on what the before/after comparison showed]
```

```bash
git add docs/decisions/2026-07-03-r6-effect-decisions.md
git commit -m "docs: record R6.1 parallax go/no-go decision"
```

### Task R6.2: Word-reveal H2 headings on landing sections (candidate)

**Files:**
- Create: `src/components/marketing/word-reveal-heading.tsx`
- Modify: `src/app/(marketing)/page.tsx` (replace plain `<h2>` elements with the new component, on landing sections ONLY per spec — "не storefront")

**Interfaces:**
- Produces: `<WordRevealHeading as="h2" className={...}>{text}</WordRevealHeading>` — splits `children` (a plain string) into words, staggers them in.

- [ ] **Step 1: Implement the component**

```typescript
"use client";

import { m } from "motion/react";
import { staggerContainer } from "@/lib/motion";

type WordRevealHeadingProps = {
  children: string;
  className?: string;
  as?: "h1" | "h2";
};

const wordVariant = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/** H2 с думи, влизащи stagger-нато (спец §14) — само landing, не storefront. */
export function WordRevealHeading({ children, className, as = "h2" }: WordRevealHeadingProps) {
  const Tag = as;
  const words = children.split(" ");

  return (
    <m.span className="inline-block" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer(0.04)}>
      <Tag className={className}>
        {words.map((word, i) => (
          <m.span key={`${word}-${i}`} variants={wordVariant} className="inline-block">
            {word}
            {i < words.length - 1 ? " " : ""}
          </m.span>
        ))}
      </Tag>
    </m.span>
  );
}
```

Note: nesting a block-level `<h2>` inside an inline `<m.span>` is invalid HTML — fix by making the outer wrapper a `div`-equivalent instead. Correct implementation:

```typescript
"use client";

import { m } from "motion/react";
import { staggerContainer } from "@/lib/motion";

type WordRevealHeadingProps = {
  children: string;
  className?: string;
  as?: "h1" | "h2";
};

const MotionH2 = m.h2;
const MotionH1 = m.h1;

const wordVariant = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/** H2 с думи, влизащи stagger-нато (спец §14) — само landing, не storefront. */
export function WordRevealHeading({ children, className, as = "h2" }: WordRevealHeadingProps) {
  const MotionTag = as === "h1" ? MotionH1 : MotionH2;
  const words = children.split(" ");

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={staggerContainer(0.04)}
    >
      {words.map((word, i) => (
        <m.span key={`${word}-${i}`} variants={wordVariant} className="inline-block">
          {word}
          {i < words.length - 1 ? " " : ""}
        </m.span>
      ))}
    </MotionTag>
  );
}
```

- [ ] **Step 2: Apply to ONE section's H2 first for evaluation (the "Как работи" section, since it's the most text-forward)**

Change:
```tsx
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            От нула до първата поръчка.
          </h2>
```
to:
```tsx
          <WordRevealHeading className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            От нула до първата поръчка.
          </WordRevealHeading>
```

Add the import: `import { WordRevealHeading } from "@/components/marketing/word-reveal-heading";`

- [ ] **Step 3: Go/no-go decision**

Visually compare this one section with and without word-reveal against the R6.0 baseline. Bulgarian display type at `text-5xl` with long compound words may read awkwardly when split mid-phrase and staggered — evaluate specifically for legibility during animation, not just the end state.

- [ ] **Step 4a: If approved, apply to all remaining landing H2s**

Apply the same replacement pattern to every other `<h2 className="...font-display...">` in `page.tsx` (Pain section, Витрина section, Цени section, FAQ section — NOT the hero `<h1>` which has its own bespoke ember-gradient span and shouldn't be touched by this generic component, and NOT the final CTA `<h2>` which the spec's word-reveal effect isn't scoped to per §14's table listing "Само landing" broadly but the CTA section is a special bookend treated separately — apply your judgment here scoped to the informational sections, not the two bookend sections which already have their own signature treatments).

- [ ] **Step 4b: If rejected, revert**

```bash
git checkout -- "src/app/(marketing)/page.tsx"
rm src/components/marketing/word-reveal-heading.tsx
```

- [ ] **Step 5: Run `pnpm check` (if approved) and commit either the feature or the ADR-only rejection record**

```bash
git add "src/app/(marketing)/page.tsx" src/components/marketing/word-reveal-heading.tsx
git commit -m "feat(motion): word-reveal H2 headings on landing sections (R6, approved)"
```

- [ ] **Step 6: Append the decision to the R6 ADR**

```bash
git add docs/decisions/2026-07-03-r6-effect-decisions.md
git commit -m "docs: record R6.2 word-reveal go/no-go decision"
```

### Task R6.3: Scroll-assembled "Как работи" step connector (candidate)

**Files:**
- Modify: `src/app/(marketing)/page.tsx` ("Как работи" section)
- Create: `src/components/marketing/step-connector-line.tsx`

**Interfaces:**
- Produces: `<StepConnectorLine progress={MotionValue<number>} />` — an SVG line whose `stroke-dashoffset` ties to scroll progress.

- [ ] **Step 1: Implement the connector as an SVG behind the STEPS list, using `useScroll` scoped to that section**

```typescript
"use client";

import { m, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

type StepConnectorLineProps = {
  stepCount: number;
};

/** Тънка SVG линия, която се дочертава по scroll прогреса зад номерираните стъпки (спец §14). */
export function StepConnectorLine({ stepCount }: StepConnectorLineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.3"] });
  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-y-0 left-[1.75rem] w-px">
      <svg width="1" height="100%" className="h-full overflow-visible">
        <line x1="0" y1="0" x2="0" y2="100%" stroke="var(--color-surface-200)" strokeWidth="1" />
        <m.line
          x1="0"
          y1="0"
          x2="0"
          y2="100%"
          stroke="var(--color-brand-500)"
          strokeWidth="1.5"
          style={{ pathLength }}
        />
      </svg>
      <span className="sr-only">{stepCount} стъпки</span>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the STEPS section, positioned behind the list**

Change the STEPS container:
```tsx
        <div className="flex flex-col">
          {STEPS.map((step, i) => (
```
to:
```tsx
        <div className="relative flex flex-col">
          <StepConnectorLine stepCount={STEPS.length} />
          {STEPS.map((step, i) => (
```

Add the import: `import { StepConnectorLine } from "@/components/marketing/step-connector-line";`

- [ ] **Step 3: Go/no-go decision**

This is the highest-complexity R6 candidate (nested `useScroll` inside a section that's also individually `<Reveal>`-staggered). Evaluate: does the connecting line meaningfully communicate sequence, or does it just look like a stray vertical rule? Given the STEPS section already uses large display numerals (01–04) that already communicate sequence clearly, this effect has a real risk of being redundant. Lean toward rejection unless the visual comparison clearly shows added value — this matches the spec's own framing ("нищо не се движи постоянно... всяка нова идея... ако е защото изглежда яко, а не защото обяснява, отпада").

- [ ] **Step 4a/4b: Apply the same approve/revert branching as Task R6.2, Steps 4a/4b**

- [ ] **Step 5: Run `pnpm check` (if approved) and commit**

- [ ] **Step 6: Append the decision to the R6 ADR**

### Task R6.4: Hover spotlight on pricing cards (candidate)

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (pricing card `div`, add `onMouseMove` handler + CSS custom property)

**Interfaces:** none new (pure CSS + inline mousemove handler, no Motion needed per spec §14's own implementation note: "CSS custom property + 1 mousemove listener").

- [ ] **Step 1: Add the spotlight CSS to `tokens.css` or inline as a utility — implement as a small client wrapper since it needs a mousemove handler**

Create `src/components/marketing/pricing-card-spotlight.tsx`:
```typescript
"use client";

import { useRef } from "react";

type PricingCardSpotlightProps = {
  children: React.ReactNode;
  className?: string;
};

/** Radial-gradient overlay следващ курсора — фин "погледни ме" на цените (спец §14). */
export function PricingCardSpotlight({ children, className }: PricingCardSpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    ref.current!.style.setProperty("--spotlight-x", `${e.clientX - rect.left}px`);
    ref.current!.style.setProperty("--spotlight-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`group/spotlight relative ${className ?? ""}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-card opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
        style={{
          background:
            "radial-gradient(400px circle at var(--spotlight-x) var(--spotlight-y), rgb(20 102 90 / 0.08), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Wrap each pricing card in the spotlight component**

Change (inside the stagger block from Task R3.3):
```tsx
                <m.div key={plan.id} variants={fadeUp}>
                  <div
                    className={`flex h-full flex-col gap-6 rounded-card p-8 ${...}`}
                  >
```
to:
```tsx
                <m.div key={plan.id} variants={fadeUp}>
                  <PricingCardSpotlight>
                    <div
                      className={`flex h-full flex-col gap-6 rounded-card p-8 ${...}`}
                    >
```

(and close the added `</PricingCardSpotlight>` right before this card's existing `</m.div>` closing tag). Add the import: `import { PricingCardSpotlight } from "@/components/marketing/pricing-card-spotlight";`

- [ ] **Step 3: Go/no-go decision**

This is genuinely low-risk (desktop-only effect via `group-hover`, invisible on touch devices since there's no hover) and directly serves conversion on the highest-stakes section. Spec explicitly frames it as worthwhile. Default toward approval unless visual review shows it clashing with the already-tinted shadow from Task R2.3 on the Pro card (stacking two "glow" effects on one card could look busy) — if so, apply the spotlight only to the Starter (non-highlighted) card, since the Pro card already has its tinted-shadow treatment.

- [ ] **Step 4: Run `pnpm check` and commit**

```bash
git add "src/app/(marketing)/page.tsx" src/components/marketing/pricing-card-spotlight.tsx
git commit -m "feat(motion): hover spotlight on pricing cards (R6, approved)"
```

- [ ] **Step 5: Append the decision to the R6 ADR**

### Task R6.5: Ambient video in the "На живо" (live demo shops) section (candidate)

**Files:**
- Modify: `src/app/(marketing)/page.tsx` (На живо section)
- Create: `docs/design/asset-prompts.md` (if not already created by C1 — check first, this task and C1 may race; whichever lands first creates the file, the other appends)

**Interfaces:** none new — a `<video>` element with strict constraints.

- [ ] **Step 1: Check whether C1 has already created the asset prompts doc**

Run: `test -f docs/design/asset-prompts.md && echo exists || echo missing`

- [ ] **Step 2: Given this requires an actual produced video asset (AI-generated or stock, ≤1.5MB, AV1/H.265, 6-8s loop, no sound) which does not exist yet in this repository, this candidate cannot be implemented as pure code — it depends on the C1 content pass producing the asset first**

This task is a **placeholder decision point, not an implementation**: without a real video file meeting the strict budget (≤1.5MB) and art-direction requirements (spec §18), there is nothing safe to commit — inserting a stand-in stock clip would violate the spec's explicit anti-pattern list ("тежки видеа", raw/unproduced AI media). Mark this candidate as **deferred pending C1 asset delivery**, not rejected — revisit once C1 (Task C1.1) produces a candidate clip.

- [ ] **Step 3: Record the deferral in the R6 ADR**

```markdown
## Ambient video in "На живо" section (Task R6.5)

**Decision:** Deferred — no video asset exists yet in the repo. This
requires the C1 content pass to produce a candidate clip (AV1/H.265,
≤1.5MB, 6-8s loop, no sound) before an implementation/rejection call can
be made. Revisit after Task C1.1.
```

```bash
git add docs/decisions/2026-07-03-r6-effect-decisions.md
git commit -m "docs: defer R6.5 ambient video pending C1 asset delivery"
```

---

## Phase C1: AI Media Content Pass (parallel, non-blocking, can start any time after R1)

**Goal of phase:** Produce the demo-shop photo series and document the reproducible prompts, per spec §18. This phase does not touch application code — it produces image assets uploaded to Supabase Storage for the 3 existing demo shops, replacing whatever placeholder/stock imagery `scripts/seed-demo-shops.mjs` currently seeds.

### Task C1.1: Document art-direction prompts and produce the photo series

**Files:**
- Create: `docs/design/asset-prompts.md`
- Modify: `scripts/seed-demo-shops.mjs` (only if the image source paths need updating to point at newly-produced assets — read the script first to confirm its current image-sourcing mechanism)

**Interfaces:** none (content/asset task, not a code interface).

- [ ] **Step 1: Read the current demo seed script to understand how product images are currently sourced**

Run: `grep -n "image\|Image\|storage\|Storage" scripts/seed-demo-shops.mjs | head -30`

- [ ] **Step 2: Write the asset-prompts documentation**

```markdown
# Frizmo Shops — AI Asset Prompts

Документация на style prompts за консистентни AI-генерирани активи (спец §18).
Всеки prompt се пази тук за възпроизводимост — следващ разширение на серията
използва същия style prompt.

## Демо магазини — фото серии

### Ферма Зелена долина (храни, earthy топли тонове)

**Style prompt:** "Professional food product photography, warm earthy tones,
natural window light from the left, rustic wooden surface background,
shallow depth of field, 50mm lens equivalent, Bulgarian farm dairy products
(cheese, honey, eggs), photorealistic, no text overlays, no watermarks,
no visible hands or people"

**Crop standard:** 4:5 product shots, 21:9 hero banner.

### Ателие Ръчичка (ръчна изработка, текстурни близки планове)

**Style prompt:** "Close-up macro photography of handmade craft products,
textured wood/fabric background, soft diffused studio light, warm neutral
tones, shallow depth of field emphasizing texture and craftsmanship,
photorealistic, no text overlays, no watermarks, no visible hands or people"

**Crop standard:** 4:5 product shots, 21:9 hero banner.

### Глоу Козметика (козметика, студийни неутрални тонове)

**Style prompt:** "Clean studio product photography, neutral gray/white
background, soft even lighting, minimal shadows, cosmetics products
(bottles, jars, packaging), photorealistic, no text overlays, no
watermarks, no visible hands or people"

**Crop standard:** 4:5 product shots, 21:9 hero banner.

## Правила
1. Всеки AI актив минава човешки преглед за бранд съответствие и артефакти
   (ръце, изкривени текстове в изображения) преди качване в Supabase Storage.
2. Никакви AI изображения на разпознаваеми хора.
3. Финалните файлове се оптимизират (AVIF/WebP) преди качване.
```

- [ ] **Step 3: Generate the photo series using an AI image tool available in this environment (e.g. the Magnific MCP server's image generation tools), following the exact style prompts documented in Step 2, one niche at a time**

This step is executed interactively — generate 4-6 product images + 1 hero banner per demo shop niche (3 niches × ~5-7 images = 15-21 images total), reviewing each for artifacts (distorted text, extra fingers, inconsistent lighting) before accepting. Reject and regenerate any image with visible AI artifacts per the rule documented in Step 2.

- [ ] **Step 4: Crop each accepted image to the documented standard (4:5 products, 21:9 hero) and optimize to WebP**

Use whatever image tooling is available (e.g. `sharp` via a one-off Node script, or manual export from an image editor) — output files should be reasonably small (product shots typically <150KB WebP).

- [ ] **Step 5: Upload the processed images to Supabase Storage under the existing `shops/{shopId}/products/...` path convention (per `CLAUDE-backend.md`'s storage rules), or update `scripts/seed-demo-shops.mjs` to source from a new local asset directory if that's how the script currently works**

Adjust based on what Step 1's read revealed — if the script downloads from external URLs (e.g. Unsplash) into Storage at seed time, update those URLs to point at the newly generated/hosted images. If it reads local files, place the new files in the expected directory.

- [ ] **Step 6: Re-run the seed script and verify the demo shops display the new images**

Run: `node scripts/seed-demo-shops.mjs`
Then reload the landing page and confirm the hero storefront demo (Task R5.1-R5.3) and the "На живо" ShopCard grid show the new, consistent photo series.

- [ ] **Step 7: Commit**

```bash
git add docs/design/asset-prompts.md scripts/seed-demo-shops.mjs
git commit -m "content(design): AI-generated demo shop photo series with documented prompts"
```

Note: this task involves binary image assets which are not shown inline in this plan (no placeholder text is being used for *code* — the images themselves are produced interactively per Step 3, which is the correct handling for a content/asset deliverable, distinct from a code deliverable that would require actual code in every step).

---

## Final Phase Gate: Full Definition of Done Check (post-R5, R6/C1 best-effort)

**Files:** none created — verification-only.

- [ ] **Step 1: Run the full check suite one final time**

Run: `pnpm check && pnpm test:e2e`
Expected: all green.

- [ ] **Step 2: Run the Playwright screenshot matrix across 360/768/1440px, light + dark**

Manually review each combination for broken layout, comparing against the spec's Definition of Done (§19) checklist items relevant to landing scope: token-only colors/radii/shadows (✓ via R1/R2), Cyrillic fonts with CLS < 0.02 (✓ via R1), hero sequence full/reduced-motion (✓ via R5), 8px grid (✓ via R2.4), no flat CTA background (✓ via R2.3), tooltip/help text where needed (landing has none requiring this — pricing/FAQ are already self-explanatory, N/A), contrast + axe + Lighthouse green (✓ via R1.1 unit test, R4.4 e2e, R5.5 measurement).

- [ ] **Step 3: Confirm every ADR from this plan exists**

Run: `ls docs/decisions/2026-07-03-*.md`
Expected: `2026-07-03-onest-display-font.md`, `2026-07-03-hero-storefront-demo-performance.md`, `2026-07-03-r6-effect-decisions.md` (and the pre-existing `2026-07-03-nextjs-16.md`/`2026-07-03-dark-mode.md` from prior work).

- [ ] **Step 4: Final commit if any cleanup was needed**

If Steps 1-3 surfaced any fixes, commit them individually with descriptive messages following the same pattern as prior tasks in this plan.
