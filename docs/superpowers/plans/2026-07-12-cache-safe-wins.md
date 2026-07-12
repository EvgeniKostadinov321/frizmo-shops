# Cache Safe Wins Implementation Plan (Пакет B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cookie-guard на `getPublicShop` (спестява Supabase round-trip за анонимен трафик) + кеширане на `terms` — нискорискови performance печалби.

**Architecture:** Чиста тествана функция `hasSupabaseAuthCookie` решава дали има логнат потребител преди `getUser()` round-trip. `getPublicShop` я ползва за guard. `terms` минава на `getPublicShopCached` (не е в owner preview → безопасно). Нулев риск от стара информация.

**Tech Stack:** Next.js 16, Supabase (`@supabase/ssr`), Drizzle, Vitest, TypeScript.

## Global Constraints

- Нулев риск от стара информация — cookie-guard не мени показаните данни (само спестява заявка); terms се инвалидира on-demand (`revalidateTag` мрежа готова).
- Cookie-guard нарочно ШИРОК (fail-safe към „не пропускай round-trip"): име започва с `sb-` И съдържа `auth-token` — за да не счупи owner draft preview дори при грешка.
- Чисти функции до server код → неутрален `@/lib` модул (тестваем).
- Строг TypeScript. Гейт: `pnpm check`. Push към `dev` само с разрешение.

## File Structure

- `src/lib/supabase/auth-cookie.ts` (NEW) — `hasSupabaseAuthCookie()`.
- `src/lib/supabase/auth-cookie.test.ts` (NEW) — Vitest тестове.
- `src/db/queries/storefront.ts` (MODIFY) — cookie-guard в `getPublicShop`.
- `src/app/(storefront)/s/[slug]/terms/page.tsx` (MODIFY) — `getPublicShopCached`.

---

### Task 1: `hasSupabaseAuthCookie` чиста функция

**Files:**
- Create: `src/lib/supabase/auth-cookie.ts`
- Create: `src/lib/supabase/auth-cookie.test.ts`

**Interfaces:**
- Produces: `function hasSupabaseAuthCookie(cookieNames: string[]): boolean` — true ако някое име започва с `sb-` и съдържа `auth-token` (покрива `sb-<ref>-auth-token` + chunk суфикси `.0`/`.1`).

- [ ] **Step 1: Write the failing test**

Създай `src/lib/supabase/auth-cookie.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie } from "./auth-cookie";

describe("hasSupabaseAuthCookie", () => {
  it("празен списък → false", () => {
    expect(hasSupabaseAuthCookie([])).toBe(false);
  });

  it("стандартен auth cookie → true", () => {
    expect(hasSupabaseAuthCookie(["sb-abcdef-auth-token"])).toBe(true);
  });

  it("chunk-нат auth cookie (.0) → true", () => {
    expect(hasSupabaseAuthCookie(["sb-abcdef-auth-token.0"])).toBe(true);
  });

  it("несвързани cookies → false", () => {
    expect(hasSupabaseAuthCookie(["frizmo-cookie-notice", "session-id", "theme"])).toBe(false);
  });

  it("смесен списък с auth cookie → true", () => {
    expect(
      hasSupabaseAuthCookie(["frizmo-theme", "sb-xyz-auth-token", "other"]),
    ).toBe(true);
  });

  it("sb- cookie без auth-token (напр. sb-provider) → false", () => {
    expect(hasSupabaseAuthCookie(["sb-abcdef-provider-token"])).toBe(false);
  });
});
```

Забележка: последният тест приема, че guard-ът иска И `sb-` И `auth-token` — `sb-*-provider-token` (OAuth provider token, не сесия) → false. Ако имплементацията реши да е още по-широка (само `sb-` prefix), този тест ще трябва да се промени; но спецификацията иска `auth-token` съдържание за точност.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- auth-cookie`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

Създай `src/lib/supabase/auth-cookie.ts`:

```ts
/**
 * Има ли Supabase auth сесия сред cookie имената. Ползва се за cookie-guard в
 * `getPublicShop` — анонимен посетител (без auth cookie) пропуска Supabase
 * `getUser()` round-trip. Нарочно широк (fail-safe): при съмнение по-добре да
 * върне true (правим round-trip), отколкото да пропусне логнат owner.
 *
 * Supabase (@supabase/ssr) ползва `sb-<project-ref>-auth-token`, chunk-нат на
 * `.0`/`.1` при големи сесии. Проверяваме `sb-` prefix + `auth-token` съдържание.
 */
export function hasSupabaseAuthCookie(cookieNames: string[]): boolean {
  return cookieNames.some((name) => name.startsWith("sb-") && name.includes("auth-token"));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- auth-cookie`
Expected: PASS (6 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/auth-cookie.ts src/lib/supabase/auth-cookie.test.ts
git commit -F - <<'EOF'
feat(perf): hasSupabaseAuthCookie — детекция на auth сесия за cookie-guard

Чиста функция, TDD. sb- prefix + auth-token съдържание (покрива chunk .0/.1).
Нарочно широка (fail-safe към round-trip).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Cookie-guard в `getPublicShop`

**Files:**
- Modify: `src/db/queries/storefront.ts:60-78`

**Interfaces:**
- Consumes: `hasSupabaseAuthCookie` от `@/lib/supabase/auth-cookie`; `cookies` от `next/headers`.

Текущият `getPublicShop` (ред 60-78) прави `createSupabaseServer()` + `getUser()` безусловно. Добавяме guard: само ако има auth cookie.

- [ ] **Step 1: Add imports**

Провери горната част на `src/db/queries/storefront.ts` за импортите. Добави:
```ts
import { cookies } from "next/headers";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";
```
(`createSupabaseServer` вече е импортиран — ползва се в текущия getPublicShop.)

- [ ] **Step 2: Replace the getUser block with guarded version**

Замени `getPublicShop` (редове 60-78) с:

```ts
export const getPublicShop = cache(async (slug: string) => {
  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, slug) });
  if (!shop) return null;

  /* Cookie-guard: анонимен посетител (без Supabase auth cookie) пропуска
     getUser() round-trip. ~99% от трафика е анонимен → по-бърз SSR. Логиката е
     идентична (анонимен и без това получава viewerIsOwner=false). */
  const cookieNames = (await cookies()).getAll().map((c) => c.name);
  let viewerIsOwner = false;
  if (hasSupabaseAuthCookie(cookieNames)) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerIsOwner = user?.id === shop.ownerId;
  }

  if (shop.status !== "published" && !viewerIsOwner) return null;

  const row = await getSiteSettingsRow(shop.id);
  const useDraft = viewerIsOwner && row?.draft != null;
  const raw = useDraft ? row?.draft : row?.settings;
  const settings = raw != null ? parseSiteSettings(raw, shop.name) : defaultSiteSettings(shop.name);

  return { shop, settings, viewerIsOwner, viewingDraft: useDraft };
});
```

Промяната спрямо сега: `createSupabaseServer()` + `getUser()` са само вътре в `if (hasSupabaseAuthCookie(...))`; `viewerIsOwner` default `false`. Всичко останало (published guard, draft логика, return) е идентично.

- [ ] **Step 3: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. (Провери, че `createSupabaseServer` не е станал unused извън guard-а — той се ползва само тук.)

- [ ] **Step 4: Commit**

```bash
git add src/db/queries/storefront.ts
git commit -F - <<'EOF'
perf(storefront): cookie-guard в getPublicShop — пропуска getUser() за анонимен

Анонимен посетител (без Supabase auth cookie) не прави Supabase round-trip.
~99% от трафика. Идентична логика (viewerIsOwner=false и без това). Нулев риск.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Terms → `getPublicShopCached` + финален гейт

**Files:**
- Modify: `src/app/(storefront)/s/[slug]/terms/page.tsx:4,13,28`

**Interfaces:**
- Consumes: `getPublicShopCached` от `@/db/queries/storefront`.

`terms` не е в owner preview iframe-а и не ползва `viewerIsOwner`/`viewingDraft` (потвърдено — само `shop` + `settings.legalOverrides`, прави `notFound()` при `null`).

- [ ] **Step 1: Swap import**

В `src/app/(storefront)/s/[slug]/terms/page.tsx`, ред 4:
```ts
// СЕГА:
import { getPublicShop } from "@/db/queries/storefront";
// СЛЕД:
import { getPublicShopCached } from "@/db/queries/storefront";
```

- [ ] **Step 2: Swap both call sites**

Замени двете `getPublicShop(slug)` извиквания (ред 13 в `generateMetadata`, ред 28 в компонента) с `getPublicShopCached(slug)`:
```ts
// и на двете места:
const result = await getPublicShopCached(slug);
```
`getPublicShopCached` връща `{ shop, settings } | null` — terms ползва само `result.shop` + `result.settings`, тъй че замяната е чиста. `if (!result) notFound()` остава.

- [ ] **Step 3: Verify no viewerIsOwner usage**

Run: `grep -n "viewerIsOwner\|viewingDraft" "src/app/(storefront)/s/[slug]/terms/page.tsx"`
Expected: **празно** (terms не ги ползва). Ако има попадение → спри, върни към getPublicShop, докладвай (страницата зависи от owner preview).

- [ ] **Step 4: Full gate**

Run: `pnpm check`
Expected: PASS (lint + unit вкл. auth-cookie тестове + build).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(storefront)/s/[slug]/terms/page.tsx"
git commit -F - <<'EOF'
perf(storefront): terms → getPublicShopCached (ISR, не dynamic)

Terms не е в owner preview iframe → безопасно кеширане. legalOverrides се
инвалидират on-demand (revalidateTag). Нула SSR/DB за анонимен.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

- [ ] **Step 6: Валидация (потребител)**

Съобщи на потребителя:
- Анонимен посетител → магазин/страници работят (по-бърз SSR, нищо визуално различно).
- Owner в редактора → draft preview на about/contact още работи (guard-ът не го чупи — owner има cookie).
- Terms зарежда правилно; промяна на правен текст → инвалидира се.

Push към `dev` (=prod) само след разрешение.

---

## Notes for the implementer

- Cookie-guard е нарочно широк — при съмнение прави round-trip (не пропуска логнат owner).
- Не пипай about/contact — те са в owner preview (draft конфликт), остават dynamic.
- Не пипай магазин/продукт — dynamic заради свежи цени/наличност.
- Terms замяната е чиста САМО защото terms не ползва viewerIsOwner/viewingDraft (Step 3 го гарантира).
