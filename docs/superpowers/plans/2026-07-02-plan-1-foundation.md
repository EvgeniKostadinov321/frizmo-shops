# Plan 1: Фундамент — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Работещ фундамент на Frizmo Shops: Next.js 15 проект с design tokens, UI примитиви, Drizzle + Supabase (profiles/shops), utility слой с тестове и пълен auth поток (регистрация → dashboard), пазен от `pnpm check` гейт.

**Architecture:** Едно Next.js 15 App Router приложение (`src/`), Supabase за Auth/Postgres, Drizzle ORM (`drizzle-kit push` deploy модел), Tailwind 4 с токени в `@theme`. Auth сесията се носи в cookies чрез `@supabase/ssr`; `/dashboard` е защитен от middleware.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind CSS 4, Drizzle ORM + postgres-js, Supabase (Auth/Postgres), Zod, Vitest + Testing Library, Playwright, pnpm.

---

## Предпоставки (ръчни стъпки, преди Task 1)

1. **Supabase проект:** създай проект `frizmo-shops` на supabase.com (region: EU Central). Запиши: Project URL, anon key, DB connection string (Session pooler, порт 5432 за drizzle-kit; Transaction pooler 6543 за приложението).
2. **Изключи email потвърждението за MVP:** Dashboard → Authentication → Sign In / Up → Email → изключи "Confirm email". (Включва се преди launch с настроен SMTP.)
3. Инсталиран `pnpm` (има го от Frizmo).

---

### Task 1: Scaffold на проекта

**Files:**
- Create: целият Next.js scaffold в корена (`package.json`, `src/app/...`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`)
- Create: `.env.example`, `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Създай Next.js проекта в текущата (непразна само с docs/.git) папка**

```powershell
pnpm dlx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir --import-alias "@/*" --use-pnpm
```

При въпрос за Turbopack: **Yes**. Ако откаже заради непразна директория: премести временно `docs/` навън, scaffold-ни, върни `docs/`.

- [ ] **Step 2: Провери, че dev сървърът тръгва**

Run: `pnpm dev`
Expected: `Ready` на `http://localhost:3000`, страницата се отваря. Спри с Ctrl+C.

- [ ] **Step 3: Потвърди strict TypeScript**

Отвори `tsconfig.json` — трябва да съдържа `"strict": true` (default). Добави `"noUncheckedIndexedAccess": true` в `compilerOptions`.

- [ ] **Step 4: Създай `.env.example`**

```bash
# Supabase (Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# Postgres (Session pooler :5432 за drizzle-kit push; Transaction pooler :6543 за приложението)
DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
DATABASE_URL_MIGRATIONS=postgresql://postgres.xxxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

Копирай го като `.env.local` и попълни реалните стойности. Провери, че `.gitignore` съдържа `.env*` (create-next-app го слага; ако не — добави `.env*` и остави `!.env.example`).

- [ ] **Step 5: Създай `README.md`**

```markdown
# Frizmo Shops

SaaS платформа за онлайн магазини (BG). Спецификация: `docs/superpowers/specs/`.

## Команди
- `pnpm dev` — dev сървър
- `pnpm check` — lint + unit тестове + build (гейт преди commit/push)
- `pnpm test` / `pnpm test:e2e` — Vitest / Playwright
- `pnpm db:push` — прилага `src/db/schema.ts` към базата

## Setup
1. `pnpm install`
2. Копирай `.env.example` → `.env.local`, попълни от Supabase.
3. `pnpm db:push`
```

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "chore: scaffold Next.js 15 project with TypeScript strict and Tailwind 4"
```

---

### Task 2: Design tokens

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/app/globals.css` (create-next-app го слага в `src/app/`)
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: Създай `src/styles/tokens.css`**

```css
/* Единственото място за дизайн стойности. Компонентите използват само токени. */
@theme {
  /* Бранд (placeholder палитра — сменя се само тук) */
  --color-brand-50: #eef7f2;
  --color-brand-100: #d6ecdf;
  --color-brand-500: #1f9d61;
  --color-brand-600: #178150;
  --color-brand-700: #116540;

  /* Текст */
  --color-ink-900: #14201a;
  --color-ink-700: #3c4a43;
  --color-ink-500: #6b7a72;

  /* Повърхности */
  --color-surface-0: #ffffff;
  --color-surface-50: #f6f8f7;
  --color-surface-100: #eef1ef;
  --color-surface-200: #e2e7e4;
  --color-surface-300: #cbd3ce;

  /* Семантични */
  --color-danger-600: #d23b3b;
  --color-danger-700: #b02f2f;
  --color-success-600: #1f9d61;
  --color-warning-600: #c98a1b;

  /* Радиуси */
  --radius-control: 0.5rem;   /* бутони, инпути */
  --radius-card: 0.75rem;

  /* Типография */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 2: Импортирай токените в `src/app/globals.css`**

Замени съдържанието с:

```css
@import "tailwindcss";
@import "../styles/tokens.css";

body {
  background: var(--color-surface-50);
  color: var(--color-ink-900);
}
```

- [ ] **Step 3: Шрифт Inter (кирилица) в `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Frizmo Shops",
  description: "Твоят онлайн магазин. Готов днес. Без програмист.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Замени `src/app/page.tsx` с минимална placeholder страница**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-bold text-brand-600">Frizmo Shops</h1>
    </main>
  );
}
```

- [ ] **Step 5: Провери визуално**

Run: `pnpm dev` → на `localhost:3000` заглавието е в бранд зелено на светъл фон. Спри сървъра.

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat: add design token system and base layout"
```

---

### Task 3: Тестова инфраструктура (Vitest + Testing Library)

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Инсталирай зависимостите**

```powershell
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Създай `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Създай `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Добави scripts в `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest",
"check": "pnpm lint && pnpm test && pnpm build"
```

- [ ] **Step 5: Провери, че Vitest тръгва (без тестове засега)**

Run: `pnpm test`
Expected: `No test files found` — exit code 1 е ОК на този етап; следващият task добавя първия тест.

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "chore: add Vitest and Testing Library setup"
```

---

### Task 4: Utility слой — money, slug, sanitize (TDD)

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`
- Create: `src/lib/slug.ts`, `src/lib/slug.test.ts`
- Create: `src/lib/sanitize.ts`, `src/lib/sanitize.test.ts`

- [ ] **Step 1: Напиши падащите тестове за money — `src/lib/money.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { formatPrice, toCents } from "./money";

// Intl слага non-breaking space — нормализираме за четими assertions
const norm = (s: string) => s.replace(/\u00A0/g, " ");

describe("toCents", () => {
  it("парсва цяло число", () => expect(toCents("12")).toBe(1200));
  it("парсва с десетична запетая (БГ вход)", () => expect(toCents("12,50")).toBe(1250));
  it("парсва с десетична точка", () => expect(toCents("12.50")).toBe(1250));
  it("отхвърля отрицателни", () => expect(toCents("-5")).toBeNull());
  it("отхвърля повече от 2 десетични знака", () => expect(toCents("1.999")).toBeNull());
  it("отхвърля текст", () => expect(toCents("abc")).toBeNull());
  it("отхвърля празен низ", () => expect(toCents("")).toBeNull());
  it("няма float грешки", () => expect(toCents("0,29")).toBe(29));
});

describe("formatPrice", () => {
  it("форматира в EUR по бг локал", () => expect(norm(formatPrice(1250))).toBe("12,50 €"));
  it("форматира нула", () => expect(norm(formatPrice(0))).toBe("0,00 €"));
  it("форматира хиляди", () => expect(norm(formatPrice(123456))).toBe("1234,56 €"));
});
```

- [ ] **Step 2: Пусни ги — трябва да падат**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './money'`.

- [ ] **Step 3: Имплементирай `src/lib/money.ts`**

```ts
/** Цените се съхраняват като integer евроцентове. Никога float в бизнес логика. */

export function toCents(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", frac = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
}

const eurFormatter = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  useGrouping: false,
});

export function formatPrice(cents: number): string {
  return eurFormatter.format(cents / 100);
}
```

- [ ] **Step 4: Пусни тестовете — минават**

Run: `pnpm test`
Expected: PASS (11 теста). Ако форматът на `formatPrice` се различава (напр. групиране), коригирай очакването в теста спрямо реалния изход на `bg-BG` локала — важното е символът € и запетаята.

- [ ] **Step 5: Напиши падащите тестове за slug — `src/lib/slug.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("транслитерира кирилица", () => expect(slugify("Ферма Марица")).toBe("ferma-maritsa"));
  it("справя се с щ/ж/ч/ш/ю/я", () => expect(slugify("Ябълки и жито Шумен")).toBe("yabalki-i-zhito-shumen"));
  it("маха специални знаци", () => expect(slugify("Мода & Стил 2026!")).toBe("moda-stil-2026"));
  it("маха водещи/крайни тирета", () => expect(slugify("--тест--")).toBe("test"));
  it("реже до 60 знака", () => expect(slugify("а".repeat(100)).length).toBeLessThanOrEqual(60));
  it("празен вход дава празен изход", () => expect(slugify("!!!")).toBe(""));
});
```

- [ ] **Step 6: Пусни — FAIL (`Cannot find module './slug'`), после имплементирай `src/lib/slug.ts`**

```ts
const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
  т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht",
  ъ: "a", ь: "y", ю: "yu", я: "ya",
};

export function slugify(input: string): string {
  const transliterated = input
    .toLowerCase()
    .split("")
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join("");
  return transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}
```

Run: `pnpm test` → PASS.

- [ ] **Step 7: Напиши падащите тестове за sanitize — `src/lib/sanitize.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { sanitizeMultiline, sanitizeText } from "./sanitize";

describe("sanitizeText", () => {
  it("trim-ва и колабира whitespace", () => expect(sanitizeText("  а   б  ")).toBe("а б"));
  it("маха контролни знаци", () => expect(sanitizeText("а\u0000б\u0007в")).toBe("абв"));
  it("реже до maxLength", () => expect(sanitizeText("абвгд", 3)).toBe("абв"));
});

describe("sanitizeMultiline", () => {
  it("пази новите редове", () => expect(sanitizeMultiline("ред1\nред2")).toBe("ред1\nред2"));
  it("маха контролни знаци, но не \\n", () => expect(sanitizeMultiline("а\u0000\nб")).toBe("а\nб"));
  it("ограничава последователни празни редове до 2", () =>
    expect(sanitizeMultiline("а\n\n\n\n\nб")).toBe("а\n\nб"));
});
```

- [ ] **Step 8: Пусни — FAIL, после имплементирай `src/lib/sanitize.ts`**

```ts
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Едноредов текст: имена, заглавия, телефони. */
export function sanitizeText(input: string, maxLength = 500): string {
  return input.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Многоредов текст: описания. Пази \n, маха останалите контролни знаци. */
export function sanitizeMultiline(input: string, maxLength = 10_000): string {
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}
```

Run: `pnpm test` → PASS (всички).

- [ ] **Step 9: Commit**

```powershell
git add -A; git commit -m "feat: add money, slug and sanitize utilities with unit tests"
```

---

### Task 5: UI примитиви — Button, Spinner, Input, Card, Badge

**Files:**
- Create: `src/components/ui/spinner.tsx`
- Create: `src/components/ui/button.tsx`, `src/components/ui/button.test.tsx`
- Create: `src/components/ui/input.tsx`, `src/components/ui/input.test.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/index.ts`

Правило от спеца §7: страниците не съдържат голи `<button>`/`<input>`; всички стойности идват от токени.

- [ ] **Step 1: Напиши падащия тест за Button — `src/components/ui/button.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("рендерира текста", () => {
    render(<Button>Запази</Button>);
    expect(screen.getByRole("button", { name: "Запази" })).toBeInTheDocument();
  });
  it("loading блокира бутона и показва spinner", () => {
    render(<Button loading>Запази</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.querySelector("[data-slot=spinner]")).not.toBeNull();
  });
  it("подава native props", () => {
    render(<Button type="submit">Изпрати</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
```

- [ ] **Step 2: Пусни — FAIL. Създай `src/components/ui/spinner.tsx`**

```tsx
const sizes = { sm: "size-4", md: "size-6", lg: "size-8" } as const;

export function Spinner({ size = "md" }: { size?: keyof typeof sizes }) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label="Зарежда се"
      className={`${sizes[size]} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`}
    />
  );
}
```

- [ ] **Step 3: Създай `src/components/ui/button.tsx`**

```tsx
import { type ButtonHTMLAttributes } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-surface-300 bg-surface-0 text-ink-900 hover:bg-surface-100",
  ghost: "text-ink-700 hover:bg-surface-100",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
};

/* md = 44px — минимален touch target по спец §7 */
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
```

Run: `pnpm test` → Button тестовете PASS.

- [ ] **Step 4: Напиши падащия тест за Input — `src/components/ui/input.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("свързва label с полето", () => {
    render(<Input label="Имейл" name="email" />);
    expect(screen.getByLabelText("Имейл")).toBeInTheDocument();
  });
  it("показва грешка с aria-invalid", () => {
    render(<Input label="Имейл" name="email" error="Невалиден имейл" />);
    expect(screen.getByLabelText("Имейл")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Невалиден имейл")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Пусни — FAIL. Създай `src/components/ui/input.tsx`**

```tsx
"use client"; // useId е hook — компонентът трябва да е client

import { useId, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = "", id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={
          "h-11 rounded-control border bg-surface-0 px-3 text-ink-900 transition-colors " +
          "placeholder:text-ink-500 focus:outline-2 focus:outline-offset-1 " +
          (error
            ? "border-danger-600 focus:outline-danger-600 "
            : "border-surface-300 focus:outline-brand-600 ") +
          className
        }
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-ink-500">{hint}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger-600">{error}</p>
      )}
    </div>
  );
}
```

Run: `pnpm test` → PASS.

- [ ] **Step 6: Създай `src/components/ui/card.tsx` и `src/components/ui/badge.tsx`**

`card.tsx`:

```tsx
import { type HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-surface-200 bg-surface-0 p-6 ${className}`}
      {...props}
    />
  );
}
```

`badge.tsx`:

```tsx
import { type HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-100 text-ink-700",
  success: "bg-brand-50 text-success-600",
  warning: "bg-surface-100 text-warning-600",
  danger: "bg-surface-100 text-danger-600",
  brand: "bg-brand-100 text-brand-700",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 7: Създай barrel файла `src/components/ui/index.ts`**

```ts
export { Badge } from "./badge";
export { Button } from "./button";
export { Card } from "./card";
export { Input } from "./input";
export { Spinner } from "./spinner";
```

- [ ] **Step 8: Пусни всички тестове**

Run: `pnpm test`
Expected: PASS — money, slug, sanitize, Button, Input.

- [ ] **Step 9: Commit**

```powershell
git add -A; git commit -m "feat: add UI primitives (Button, Input, Spinner, Card, Badge)"
```

---

### Task 6: База данни — Drizzle + схема profiles/shops

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema.ts`, `src/db/index.ts`
- Modify: `package.json` (script `db:push`)

- [ ] **Step 1: Инсталирай зависимостите**

```powershell
pnpm add drizzle-orm postgres; pnpm add -D drizzle-kit
```

- [ ] **Step 2: Създай `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Session pooler (:5432) — drizzle-kit не работи през transaction pooler
    url: process.env.DATABASE_URL_MIGRATIONS!,
  },
});
```

- [ ] **Step 3: Създай `src/db/schema.ts`**

```ts
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const shopStatusEnum = pgEnum("shop_status", [
  "draft",
  "published",
  "suspended",
  "blocked",
]);

/** 1:1 със Supabase auth.users (id = auth user id). */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull().default(""),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    businessCategory: text("business_category").notNull(),
    logoPath: text("logo_path"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    workingHours: jsonb("working_hours"),
    socialLinks: jsonb("social_links"),
    status: shopStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shops_owner_idx").on(t.ownerId), index("shops_status_idx").on(t.status)],
);

export type Profile = typeof profiles.$inferSelect;
export type Shop = typeof shops.$inferSelect;
```

- [ ] **Step 4: Създай `src/db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/* prepare:false — задължително за Supabase transaction pooler (:6543) */
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });
export * from "./schema";
```

- [ ] **Step 5: Добави script и пусни push**

В `package.json`:

```json
"db:push": "drizzle-kit push"
```

Run (PowerShell зарежда `.env.local` ръчно):

```powershell
Get-Content .env.local | ForEach-Object { if ($_ -match '^([^#][^=]*)=(.*)$') { Set-Item "env:$($Matches[1])" $Matches[2] } }; pnpm db:push
```

Expected: `Changes applied` — таблиците `profiles`, `shops` и enum `shop_status` са създадени. Провери в Supabase Dashboard → Table Editor.

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat: add Drizzle schema for profiles and shops"
```

---

### Task 7: Supabase Auth инфраструктура

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Инсталирай**

```powershell
pnpm add @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Създай `src/lib/supabase/server.ts`** (за Server Components / Actions)

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Component — middleware опреснява сесията */
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Създай `src/lib/supabase/client.ts`** (за Client Components)

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: Създай `src/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/admin");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/auth/login" || path === "/auth/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 5: Създай `src/middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/auth/:path*"],
};
```

- [ ] **Step 6: Провери, че билдва**

Run: `pnpm build`
Expected: успешен build без грешки.

- [ ] **Step 7: Commit**

```powershell
git add -A; git commit -m "feat: add Supabase auth infrastructure and route protection middleware"
```

---

### Task 8: Auth страници — регистрация, вход, изход

**Files:**
- Create: `src/schemas/auth.ts`
- Create: `src/actions/auth.ts`
- Create: `src/app/(auth)/auth/login/page.tsx`
- Create: `src/app/(auth)/auth/register/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/components/auth/auth-form.tsx`

- [ ] **Step 1: Инсталирай Zod и създай `src/schemas/auth.ts`**

```powershell
pnpm add zod
```

```ts
import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Въведи име").max(100),
  email: z.string().trim().email("Невалиден имейл"),
  password: z.string().min(8, "Паролата трябва да е поне 8 знака").max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Невалиден имейл"),
  password: z.string().min(1, "Въведи парола"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 2: Създай `src/actions/auth.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { db, profiles } from "@/db";
import { sanitizeText } from "@/lib/sanitize";
import { createSupabaseServer } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/schemas/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function fieldErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "Регистрацията не бе успешна. Имейлът може вече да е зает." };
  }

  await db
    .insert(profiles)
    .values({ id: data.user.id, fullName: sanitizeText(parsed.data.fullName, 100) })
    .onConflictDoNothing();

  redirect("/dashboard");
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: "Грешен имейл или парола." };

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
```

- [ ] **Step 3: Създай споделената форма `src/components/auth/auth-form.tsx`** (client component)

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, Input } from "@/components/ui";
import type { AuthFormState } from "@/actions/auth";

interface AuthFormProps {
  mode: "login" | "register";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isRegister = mode === "register";

  return (
    <Card className="w-full max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-ink-900">
        {isRegister ? "Създай профил" : "Вход"}
      </h1>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {isRegister && (
          <Input
            label="Име и фамилия"
            name="fullName"
            autoComplete="name"
            error={state.fieldErrors?.fullName}
          />
        )}
        <Input
          label="Имейл"
          name="email"
          type="email"
          autoComplete="email"
          error={state.fieldErrors?.email}
        />
        <Input
          label="Парола"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          error={state.fieldErrors?.password}
        />
        {state.error && <p className="text-sm text-danger-600">{state.error}</p>}
        <Button type="submit" loading={pending}>
          {isRegister ? "Регистрирай се" : "Влез"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink-500">
        {isRegister ? (
          <>Имаш профил? <Link className="text-brand-600 hover:underline" href="/auth/login">Влез</Link></>
        ) : (
          <>Нямаш профил? <Link className="text-brand-600 hover:underline" href="/auth/register">Регистрирай се</Link></>
        )}
      </p>
    </Card>
  );
}
```

- [ ] **Step 4: Създай layout и страниците**

`src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">{children}</main>
  );
}
```

`src/app/(auth)/auth/login/page.tsx`:

```tsx
import { AuthForm } from "@/components/auth/auth-form";
import { signIn } from "@/actions/auth";

export const metadata = { title: "Вход — Frizmo Shops" };

export default function LoginPage() {
  return <AuthForm mode="login" action={signIn} />;
}
```

`src/app/(auth)/auth/register/page.tsx`:

```tsx
import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/actions/auth";

export const metadata = { title: "Регистрация — Frizmo Shops" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={signUp} />;
}
```

- [ ] **Step 5: Ръчна проверка**

Run: `pnpm dev` → отвори `/auth/register`, регистрирай тестов акаунт (напр. `test+1@example.com` / парола 8+ знака).
Expected: пренасочване към `/dashboard` (404 засега — Task 9 я създава). Провери в Supabase → Authentication → Users, че потребителят съществува, и в Table Editor, че има ред в `profiles`.

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat: add register, login and logout with Zod validation"
```

---

### Task 9: Dashboard shell

**Files:**
- Create: `src/app/(dashboard)/dashboard/layout.tsx`
- Create: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/lib/auth.ts`
- Create: `src/components/dashboard/sign-out-button.tsx`

- [ ] **Step 1: Създай `src/lib/auth.ts`** — текущ потребител + гаранция за профил

```ts
import { redirect } from "next/navigation";
import { db, profiles } from "@/db";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Връща auth потребителя или пренасочва към login. За Server Components/Actions. */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return user;
}

/** Идемпотентно гарантира ред в profiles (предпазна мрежа при прекъснат signup). */
export async function ensureProfile(userId: string) {
  await db.insert(profiles).values({ id: userId }).onConflictDoNothing();
}
```

- [ ] **Step 2: Създай `src/components/dashboard/sign-out-button.tsx`**

```tsx
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button variant="ghost" size="sm" type="submit">
        Изход
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Създай `src/app/(dashboard)/dashboard/layout.tsx`**

```tsx
import Link from "next/link";
import { ensureProfile, requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  await ensureProfile(user.id);

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-surface-200 bg-surface-0 px-4 md:px-6">
        <Link href="/dashboard" className="text-lg font-bold text-brand-600">
          Frizmo Shops
        </Link>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-5xl p-4 md:p-6">{children}</main>
    </div>
  );
}
```

(Страничната навигация с табовете Store/Products/Orders… се добавя в План 2, когато съществуват страниците — без мъртви линкове.)

- [ ] **Step 4: Създай `src/app/(dashboard)/dashboard/page.tsx`**

```tsx
import { Card } from "@/components/ui";

export const metadata = { title: "Табло — Frizmo Shops" };

export default function DashboardPage() {
  return (
    <Card>
      <h1 className="text-2xl font-bold text-ink-900">Добре дошъл!</h1>
      <p className="mt-2 text-ink-700">
        Тук ще създадеш своя онлайн магазин. Следващата стъпка от изграждането на
        платформата: създаване на магазин (План 2).
      </p>
    </Card>
  );
}
```

- [ ] **Step 5: Ръчна проверка на целия поток**

Run: `pnpm dev`
- `/dashboard` без сесия → redirect към `/auth/login`.
- Вход с акаунта от Task 8 → виждаш „Добре дошъл!".
- „Изход" → връща на `/auth/login`; `/dashboard` пак е недостъпен.

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat: add protected dashboard shell with profile bootstrap"
```

---

### Task 10: E2E тестове (Playwright)

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/auth.spec.ts`
- Modify: `package.json` (script `test:e2e`)

- [ ] **Step 1: Инсталирай**

```powershell
pnpm add -D @playwright/test; pnpm exec playwright install chromium
```

- [ ] **Step 2: Създай `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Създай `e2e/auth.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test.describe("Auth поток", () => {
  test("регистрация → dashboard → изход → защитата пази", async ({ page }) => {
    const email = `e2e+${Date.now()}@frizmoshops.test`;

    await page.goto("/auth/register");
    await page.getByLabel("Име и фамилия").fill("Е2Е Тест");
    await page.getByLabel("Имейл").fill(email);
    await page.getByLabel("Парола").fill("parola123!");
    await page.getByRole("button", { name: "Регистрирай се" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Добре дошъл!" })).toBeVisible();

    await page.getByRole("button", { name: "Изход" }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("невалидни данни показват грешки без заявка", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "Влез" }).click();
    await expect(page.getByText("Невалиден имейл")).toBeVisible();
  });

  test("грешна парола показва общо съобщение", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Имейл").fill("nyama.takav@frizmoshops.test");
    await page.getByLabel("Парола").fill("greshna-parola");
    await page.getByRole("button", { name: "Влез" }).click();
    await expect(page.getByText("Грешен имейл или парола.")).toBeVisible();
  });
});
```

- [ ] **Step 4: Добави script и пусни**

В `package.json`: `"test:e2e": "playwright test"`.

Run: `pnpm test:e2e`
Expected: 3 passed. (Тестът създава реален потребител в Supabase — тестовите акаунти са с домейн `@frizmoshops.test` и се чистят периодично от Supabase Dashboard.)

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "test: add Playwright e2e coverage for auth flow"
```

---

### Task 11: Финален гейт

- [ ] **Step 1: Пусни пълния гейт**

Run: `pnpm check`
Expected: lint PASS, unit тестове PASS, build успешен.

- [ ] **Step 2: Пусни e2e още веднъж на чисто**

Run: `pnpm test:e2e`
Expected: 3 passed.

- [ ] **Step 3: Финален commit (ако има останали промени) и маркирай плана**

```powershell
git add -A; git commit -m "chore: complete Plan 1 (foundation)"
```

Отбележи в `docs/superpowers/plans/2026-07-02-roadmap.md`, че План 1 е завършен (добави ✅ в реда на План 1), commit-ни.

---

### Task 12: Deploy на Vercel (production pipeline от ден 1)

**Files:** няма нови файлове — конфигурация в GitHub/Vercel.

- [ ] **Step 1: Създай GitHub repo и push-ни**

```powershell
gh repo create frizmo-shop --private --source . --push
```

(Ако `gh` не е логнат: `gh auth login`.)

- [ ] **Step 2: Импортирай проекта във Vercel**

Vercel Dashboard → Add New → Project → избери `frizmo-shop` от GitHub. Framework: Next.js (автоматично). Преди първия deploy добави env променливите от `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (transaction pooler :6543). `DATABASE_URL_MIGRATIONS` НЕ се добавя — миграциите се пускат само локално.

- [ ] **Step 3: Провери production deploy-а**

Отвори Vercel URL-а на проекта → началната страница се зарежда; `/auth/register` → регистрирай тестов акаунт → `/dashboard` работи.
Expected: пълният auth поток работи на production URL.

- [ ] **Step 4: Настрой branch модела**

```powershell
git checkout -b dev; git push -u origin dev
```

Vercel: `main` → Production, всичко останало (вкл. `dev`) → Preview. Оттук нататък: работа по `dev`, merge към `main` = production deploy (след `pnpm check`).

---

## Definition of Done (План 1)

- [ ] `pnpm check` минава (lint + unit + build)
- [ ] `pnpm test:e2e` минава (auth поток end-to-end)
- [ ] Регистрация → dashboard → изход работи ръчно
- [ ] Таблиците `profiles`/`shops` съществуват в Supabase
- [ ] Никакви хардкоднати цветове/размери извън `tokens.css`
- [ ] Проектът е deploy-нат на Vercel; auth потокът работи на production URL
- [ ] Всички стъпки комитнати и push-нати
