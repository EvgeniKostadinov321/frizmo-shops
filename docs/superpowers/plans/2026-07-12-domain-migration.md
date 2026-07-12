# Domain Migration Implementation Plan (frizmoshops.bg)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Централизиране на публичния домейн в един `siteUrl()` helper и мигриране на всички хардкоднати `frizmo-shops.vercel.app` към `frizmoshops.bg`.

**Architecture:** Нов чист `src/lib/site-url.ts` е единственият източник на базовия URL (env → helper → fallback `frizmoshops.bg`). Всичките 8 места, които днес дублират `BASE_URL`/хардкодват домейн, викат helper-а. Marketing декоративни URL-и се уеднаквяват. Инфраструктурата (Vercel/DNS/Supabase) е чеклист за потребителя, не код.

**Tech Stack:** Next.js 16 App Router, Vitest, TypeScript (строг), pnpm.

## Global Constraints

- Нула хардкоднати домейни извън `site-url.ts`.
- Имейл подателят остава `shops@frizmo.bg` (Resend миграция отложена) — само линковете в имейлите мигрират.
- Строг TypeScript, без `as any`. UI текстове на български.
- Гейт: `pnpm check` (lint + unit + build) зелен преди край.
- **Фаза А (код) се качва, когато DNS е близо готов** — не по-рано (helper връща `frizmoshops.bg` fallback, който още не резолвва към Vercel до DNS setup). Push към `dev` (=prod) само след изрично разрешение.

## File Structure

- `src/lib/site-url.ts` (NEW) — `siteUrl()` helper.
- `src/lib/site-url.test.ts` (NEW) — Vitest тестове.
- `src/actions/billing.ts` (MODIFY) — `BASE_URL = siteUrl()`.
- `src/app/(dashboard)/dashboard/store/page.tsx` (MODIFY) — `BASE_URL = siteUrl()`.
- `src/app/(storefront)/s/[slug]/feed.xml/route.ts` (MODIFY) — `BASE_URL = siteUrl()`.
- `src/lib/email.ts` (MODIFY) — `BASE_URL = siteUrl()` + хардкоднат линк.
- `src/app/layout.tsx` (MODIFY) — `metadataBase: new URL(siteUrl())`.
- `src/app/robots.ts` (MODIFY) — sitemap URL през helper.
- `src/app/sitemap.ts` (MODIFY) — `BASE = siteUrl()`.
- `src/components/marketing/hero-storefront-demo/index.tsx` + `step-card.tsx` (MODIFY) — декоративни URL-и.

---

### Task 1: `siteUrl()` helper

**Files:**
- Create: `src/lib/site-url.ts`
- Create: `src/lib/site-url.test.ts`

**Interfaces:**
- Produces: `function siteUrl(): string` — връща `NEXT_PUBLIC_SITE_URL` (без завършващ `/`), иначе dev→`http://localhost:3000` / prod→`https://frizmoshops.bg`.

- [ ] **Step 1: Write the failing test**

Създай `src/lib/site-url.test.ts`. Тестът манипулира `process.env` → ползвай `vi.stubEnv` (Vitest) за да е чисто и да се възстановява.

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("уважава NEXT_PUBLIC_SITE_URL когато е зададен", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://frizmoshops.bg");
    expect(siteUrl()).toBe("https://frizmoshops.bg");
  });

  it("маха завършващ слаш", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://frizmoshops.bg/");
    expect(siteUrl()).toBe("https://frizmoshops.bg");
  });

  it("prod fallback е frizmoshops.bg (не vercel.app)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(siteUrl()).toBe("https://frizmoshops.bg");
  });

  it("dev fallback е localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- site-url`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

Създай `src/lib/site-url.ts`:

```ts
/**
 * Единственият източник на публичния базов URL. Нула хардкоднати домейни другаде.
 * env (без завършващ /) → dev localhost / prod frizmoshops.bg.
 */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return process.env.NODE_ENV !== "production"
    ? "http://localhost:3000"
    : "https://frizmoshops.bg";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- site-url`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-url.ts src/lib/site-url.test.ts
git commit -F - <<'EOF'
feat(domain): siteUrl() helper — единствен източник на публичния URL

env (без завършващ /) → dev localhost / prod frizmoshops.bg. TDD.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Замяна на функционалните места

**Files:**
- Modify: `src/actions/billing.ts:11`
- Modify: `src/app/(dashboard)/dashboard/store/page.tsx:11`
- Modify: `src/app/(storefront)/s/[slug]/feed.xml/route.ts:8`
- Modify: `src/lib/email.ts:15-19` + `:108`
- Modify: `src/app/layout.tsx:34`
- Modify: `src/app/robots.ts:10`
- Modify: `src/app/sitemap.ts:6`

**Interfaces:**
- Consumes: `siteUrl` от `@/lib/site-url`.

- [ ] **Step 1: billing.ts**

Замени ред 11:
```ts
// СЕГА:
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://frizmo-shops.vercel.app";
// СЛЕД:
const BASE_URL = siteUrl();
```
Добави импорт най-горе: `import { siteUrl } from "@/lib/site-url";`

- [ ] **Step 2: store/page.tsx**

Същата замяна на ред 11 (`const BASE_URL = siteUrl();`) + импорт `import { siteUrl } from "@/lib/site-url";`.

- [ ] **Step 3: feed.xml/route.ts**

Същата замяна на ред 8 (`const BASE_URL = siteUrl();`) + импорт.

- [ ] **Step 4: email.ts (BASE_URL + хардкоднат линк)**

Замени редове 13-19:
```ts
// СЕГА:
const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV !== "production"
    ? "http://localhost:3000"
    : "https://frizmo-shops.vercel.app");
// СЛЕД:
const BASE_URL = siteUrl();
```
Добави импорт: `import { siteUrl } from "@/lib/site-url";`

Замени ред 108 (хардкоднат линк в имейл body). Потвърдено: редът е ВЪТРЕ в template
literal (`${esc(...)}` наоколо, затварящ backtick на ред 108), затова `${BASE_URL}` работи
директно:
```ts
// СЕГА:
          <p><a href="https://frizmo-shops.vercel.app/dashboard/orders">Виж в панела →</a></p>`,
// СЛЕД:
          <p><a href="${BASE_URL}/dashboard/orders">Виж в панела →</a></p>`,
```

Забележка: `FROM = "Frizmo Shops <shops@frizmo.bg>"` (ред 11) НЕ се пипа (решено — остава frizmo.bg).

- [ ] **Step 5: layout.tsx metadataBase**

Замени ред 34:
```ts
// СЕГА:
metadataBase: new URL("https://frizmo-shops.vercel.app"),
// СЛЕД:
metadataBase: new URL(siteUrl()),
```
Добави импорт: `import { siteUrl } from "@/lib/site-url";`

- [ ] **Step 6: robots.ts**

Замени ред 10:
```ts
// СЕГА:
sitemap: "https://frizmo-shops.vercel.app/sitemap.xml",
// СЛЕД:
sitemap: `${siteUrl()}/sitemap.xml`,
```
Добави импорт: `import { siteUrl } from "@/lib/site-url";`

- [ ] **Step 7: sitemap.ts**

Замени ред 6:
```ts
// СЕГА:
const BASE = "https://frizmo-shops.vercel.app";
// СЛЕД:
const BASE = siteUrl();
```
Добави импорт: `import { siteUrl } from "@/lib/site-url";`

- [ ] **Step 8: Verify no hardcoded vercel.app remains**

Run: `grep -rn "frizmo-shops.vercel.app" src`
Expected: **празно** (0 попадения) — всичко минава през helper-а.
Ако остане нещо → замени го също.

- [ ] **Step 9: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/actions/billing.ts "src/app/(dashboard)/dashboard/store/page.tsx" "src/app/(storefront)/s/[slug]/feed.xml/route.ts" src/lib/email.ts src/app/layout.tsx src/app/robots.ts src/app/sitemap.ts
git commit -F - <<'EOF'
feat(domain): всички функционални URL-и минават през siteUrl()

billing/store/feed/email/metadataBase/robots/sitemap → siteUrl(). Нула
хардкоднати vercel.app. Имейл подателят остава frizmo.bg.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Marketing декоративни URL-и + финален гейт

**Files:**
- Modify: `src/components/marketing/hero-storefront-demo/index.tsx:75`
- Modify: `src/components/marketing/step-card.tsx:78`

**Interfaces:**
- Consumes: нищо (декоративен текст).

- [ ] **Step 1: hero-storefront-demo**

Замени ред 75:
```tsx
// СЕГА:
<BrowserChrome url="frizmo.shop/s/atelie-rachichka">
// СЛЕД:
<BrowserChrome url="frizmoshops.bg/s/atelie-rachichka">
```

- [ ] **Step 2: step-card**

Замени ред 78:
```tsx
// СЕГА:
<span className="truncate">frizmo.shop/s/atelie-rachichka</span>
// СЛЕД:
<span className="truncate">frizmoshops.bg/s/atelie-rachichka</span>
```

- [ ] **Step 3: Verify no stray frizmo.shop remains**

Run: `grep -rn "frizmo.shop" src`
Expected: празно (0 попадения). Ако остане → замени.

- [ ] **Step 4: Full gate**

Run: `pnpm check`
Expected: PASS (lint + unit вкл. новите site-url тестове + build).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/hero-storefront-demo/index.tsx src/components/marketing/step-card.tsx
git commit -F - <<'EOF'
feat(domain): marketing демо URL-и уеднаквени на frizmoshops.bg

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Фаза Б — Инфраструктурен чеклист (потребител + агент, когато DNS е готов)

Това НЕ е код — стъпки за изпълнение, когато SuperHosting настрои домейна. Агентът помага,
но реалните действия (Vercel dashboard, DNS при регистратора, Supabase dashboard) са на
потребителя (изискват логин).

- [ ] **1. Vercel: добави домейна**
  Vercel проект → Settings → Domains → Add `frizmoshops.bg` (+ `www.frizmoshops.bg` ако искаш).
  Vercel дава DNS записи (A запис към Vercel IP / CNAME, ИЛИ nameservers).

- [ ] **2. SuperHosting: DNS записи**
  Влез в SuperHosting контролния панел → DNS зона на `frizmoshops.bg` → сложи записите от Vercel.
  Изчакай разпространение (до 24-48ч за `.bg`, обикновено по-бързо).

- [ ] **3. Vercel: SSL**
  Автоматично (Let's Encrypt) щом DNS резолвва. Провери зелен catлинк в Vercel Domains.

- [ ] **4. Vercel: env var**
  Settings → Environment Variables → `NEXT_PUBLIC_SITE_URL` = `https://frizmoshops.bg` (Production).
  **Redeploy** (env vars не се прилагат към стар билд).

- [ ] **5. Push Фаза А код** (ако още не е) → прод сочи новия домейн.

- [ ] **6. Supabase: auth redirect allowlist**
  Supabase dashboard → Authentication → URL Configuration → Redirect URLs → добави
  `https://frizmoshops.bg/**`. (Нужно за бъдещ Google login / magic links към новия домейн.)
  Провери и Site URL полето.

- [ ] **7. Проверка на живо (потребител):**
  - `https://frizmoshops.bg` зарежда, SSL валиден
  - Магазин `frizmoshops.bg/s/{slug}` работи
  - OG preview (сподели линк в чат/Facebook) → новият домейн
  - `frizmoshops.bg/sitemap.xml` + `/robots.txt` → новият домейн вътре
  - Имейл при тестова поръчка → линковете сочат `frizmoshops.bg` (подателят е `frizmo.bg` — очаквано)
  - `frizmo-shops.vercel.app` → редирект към новия (Vercel авто при primary domain)

---

## Notes for the implementer

- Единственият хардкоднат домейн след Task 1 е ВЪТРЕ в `site-url.ts` (fallback) — навсякъде другаде helper.
- `FROM` в email.ts НЕ се пипа (остава `shops@frizmo.bg`).
- `grep` проверките (Task 2 Step 8, Task 3 Step 3) са гейтове — трябва да са празни.
- Фаза Б не се изпълнява сега — документирана е за момента, когато DNS е готов.
