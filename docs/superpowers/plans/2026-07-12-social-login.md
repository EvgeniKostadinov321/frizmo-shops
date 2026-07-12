# Social Login (Google) Implementation Plan

> ✅ **ИЗПЪЛНЕН (2026-07-13):** и петте задачи завършени, `pnpm check` зелен, тествани на
> живо (реален Google вход → профил с име) + push-нати на `dev`. Виж
> `memory/social-login-feature.md` и WORKLOG дневника 2026-07-13.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вход/регистрация с Google през Supabase Auth — един клик вместо форма + имейл потвърждение.

**Architecture:** Нов Server Action `signInWithProvider` стартира OAuth flow → Supabase връща на нов callback route → `exchangeCodeForSession` → `ensureProfile` (разширен да пише OAuth име) → redirect. UI бутон „Продължи с Google" в `AuthForm` (покрива login+register). Параметризиран `next` → преизползваемо за купувачески акаунт (S3) по-късно.

**Tech Stack:** Next.js 16 (App Router, route handlers), Supabase Auth (`@supabase/ssr`), Zod, Vitest, TypeScript.

**Спец:** `docs/superpowers/specs/2026-07-12-social-login-design.md`

## Global Constraints

- UI текст на български, типографски кавички „…“ (прав `"` чупи JS/lint).
- Икони: вътрешен SVG set (`<Icon>`) или официално SVG лого — **никакви емоджита** (правилото на проекта).
- Мутации/actions с потребителски вход: Zod parse + `sanitizeText`. Никакви stack traces към клиента — общи BG съобщения.
- `"use server"` файл експортира САМО async функции; чисти helper-и живеят в неутрални `@/lib/*` модули.
- Строг TypeScript (без `as any`). Гейт преди commit: `pnpm check` (lint + unit + build).
- **Open-redirect гард:** `next` е само относителен път (започва с един `/`, не `//`, не съдържа `:`), иначе fallback `/dashboard`.
- `origin` за `redirectTo` се взима от заявката (dev localhost / prod домейн) — НЕ хардкоднат.
- `proxy.ts` matcher вече покрива `/auth/:path*` — callback route работи без промяна.

---

## File Structure

- `src/lib/safe-redirect.ts` (NEW) — `safeNextPath(next): string` чиста функция (open-redirect гард). Тествана.
- `src/lib/safe-redirect.test.ts` (NEW) — Vitest.
- `src/actions/auth.ts` (MODIFY) — нов `signInWithProvider(next?)`.
- `src/app/(auth)/auth/callback/route.ts` (NEW) — GET route handler: exchange + ensureProfile + redirect.
- `src/lib/auth.ts` (MODIFY) — `ensureProfile` приема опционално име.
- `src/components/ui/icon.tsx` (MODIFY) — нова икона `google` (официално multicolor SVG лого).
- `src/components/auth/auth-form.tsx` (MODIFY) — бутон „Продължи с Google" + „или" divider.

---

### Task 1: `safeNextPath` чиста функция (open-redirect гард)

**Files:**
- Create: `src/lib/safe-redirect.ts`
- Create: `src/lib/safe-redirect.test.ts`

**Interfaces:**
- Produces: `function safeNextPath(next: string | null | undefined): string` — връща `next`, ако е безопасен относителен път; иначе `"/dashboard"`.

- [ ] **Step 1: Write the failing test**

Създай `src/lib/safe-redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("null/undefined/празно → /dashboard", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("валиден относителен път → връща го", () => {
    expect(safeNextPath("/dashboard/orders")).toBe("/dashboard/orders");
    expect(safeNextPath("/s/moya-magazin")).toBe("/s/moya-magazin");
  });

  it("protocol-relative // → /dashboard (open-redirect)", () => {
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
  });

  it("абсолютен URL → /dashboard", () => {
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("http://evil.com")).toBe("/dashboard");
  });

  it("път със схема/двоеточие → /dashboard", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("път без водещ / → /dashboard", () => {
    expect(safeNextPath("dashboard")).toBe("/dashboard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- safe-redirect`
Expected: FAIL (модулът липсва).

- [ ] **Step 3: Write the implementation**

Създай `src/lib/safe-redirect.ts`:

```ts
/**
 * Валидира `next` redirect параметър срещу open-redirect. Безопасен = относителен
 * път (един водещ `/`, не `//`, без схема/двоеточие). Иначе fallback `/dashboard`.
 * Ползва се от OAuth callback-а и signInWithProvider.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//")) return "/dashboard";
  if (next.includes(":")) return "/dashboard";
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- safe-redirect`
Expected: PASS (6 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/safe-redirect.ts src/lib/safe-redirect.test.ts
git commit -F - <<'EOF'
feat(auth): safeNextPath — open-redirect гард за OAuth next параметър

Чиста функция, TDD. Безопасен = относителен път (един /, без // или схема).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: `ensureProfile` приема OAuth име

**Files:**
- Modify: `src/lib/auth.ts:17-19`

**Interfaces:**
- Consumes: `db`, `profiles`, `sanitizeText`.
- Produces: `ensureProfile(userId: string, fullName?: string): Promise<void>` — при insert записва `fullName` (санитизиран, макс 100), ако е подаден; иначе празен (както сега). Остава идемпотентен (`onConflictDoNothing`).

Днес (редове 17-19) `ensureProfile` вкарва празен профил. OAuth дава име от провайдъра → трябва да се запише при първото влизане.

- [ ] **Step 1: Add import + extend the function**

В `src/lib/auth.ts`, добави импорта за `sanitizeText` (най-горе, при другите импорти):
```ts
import { sanitizeText } from "@/lib/sanitize";
```

Замени `ensureProfile` (редове 17-19) с:
```ts
/**
 * Идемпотентно гарантира ред в profiles (предпазна мрежа при прекъснат signup +
 * OAuth първо влизане). При OAuth подаваме името от провайдъра → записва се при
 * insert; повторно влизане не презаписва (onConflictDoNothing).
 */
export async function ensureProfile(userId: string, fullName?: string) {
  await db
    .insert(profiles)
    .values({ id: userId, fullName: fullName ? sanitizeText(fullName, 100) : "" })
    .onConflictDoNothing();
}
```

Забележка: `profiles.fullName` е `NOT NULL DEFAULT ''` → подаваме `""` при липса, за да е експлицитно (schema.ts).

- [ ] **Step 2: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. (`ensureProfile` без втори аргумент още работи — параметърът е опционален; съществуващите извиквания не се чупят.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -F - <<'EOF'
feat(auth): ensureProfile приема опционално име (за OAuth провайдър)

OAuth дава име от провайдъра → записва се при първо влизане. Идемпотентен;
съществуващите извиквания без име работят непроменени.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: `signInWithProvider` action

**Files:**
- Modify: `src/actions/auth.ts` (добавя нов export накрая)

**Interfaces:**
- Consumes: `createSupabaseServer`, `safeNextPath` (Task 1), `headers` от `next/headers`.
- Produces: `signInWithProvider(next?: string): Promise<void>` — стартира Google OAuth, redirect към върнатия от Supabase URL.

Спецът: `signInWithOAuth({ provider: "google", options: { redirectTo } })`. `redirectTo` сочи нашия callback с валидиран `next`. `origin` от `Host` хедъра (не хардкоднат).

- [ ] **Step 1: Add imports**

В `src/actions/auth.ts`, най-горе (при съществуващите импорти), добави:
```ts
import { headers } from "next/headers";
import { safeNextPath } from "@/lib/safe-redirect";
```

- [ ] **Step 2: Append the action**

В края на `src/actions/auth.ts`, добави:
```ts
/**
 * Стартира OAuth flow (засега само Google). `next` носи дестинацията след вход —
 * търговец → /dashboard; купувачески акаунт (S3) → друг път по-късно. redirectTo
 * сочи нашия callback (виж app/(auth)/auth/callback/route.ts). base URL от заявката,
 * за да работи и на localhost, и на прод домейна.
 */
export async function signInWithProvider(next?: string): Promise<void> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${h.get("host")}`;
  const safeNext = safeNextPath(next);

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error || !data.url) redirect("/auth/login?error=oauth");
  redirect(data.url);
}
```

- [ ] **Step 3: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/actions/auth.ts
git commit -F - <<'EOF'
feat(auth): signInWithProvider — стартира Google OAuth flow

redirectTo сочи /auth/callback с валидиран next; origin от заявката (localhost/прод).
Грешка → /auth/login?error=oauth (общо съобщение).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: OAuth callback route

**Files:**
- Create: `src/app/(auth)/auth/callback/route.ts`

**Interfaces:**
- Consumes: `createSupabaseServer`, `ensureProfile` (Task 2), `safeNextPath` (Task 1), `NextRequest`/`NextResponse`.

Route handler (GET): Supabase връща тук с `?code=...&next=...`. Разменя code за сесия, гарантира профил (с OAuth име), redirect към `next`.

- [ ] **Step 1: Create the route**

Създай `src/app/(auth)/auth/callback/route.ts`:
```ts
import { type NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * OAuth callback — Supabase връща тук след Google. Разменя `code` за сесия,
 * гарантира profiles ред (с името от провайдъра), пренасочва към валидиран `next`.
 * При липсващ code / OAuth denial / exchange грешка → login с общо съобщение.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`);
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error(JSON.stringify({ scope: "oauth-callback", error: error?.message }));
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`);
  }

  /* Google дава името в user_metadata (full_name или name). */
  const meta = data.user.user_metadata as { full_name?: string; name?: string };
  await ensureProfile(data.user.id, meta.full_name ?? meta.name);

  return NextResponse.redirect(`${origin}${next}`);
}
```

- [ ] **Step 2: Verify build + lint**

Run: `pnpm lint && pnpm build`
Expected: PASS. Билдът трябва да покаже `/auth/callback` като route (`ƒ` dynamic).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/auth/callback/route.ts"
git commit -F - <<'EOF'
feat(auth): OAuth callback route — exchange + ensureProfile + redirect

Supabase връща тук; разменя code за сесия, пише profiles (OAuth име), redirect към
валидиран next. Липсващ code/грешка → login?error=oauth (детайл само в server лог).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Google икона + бутон в `AuthForm` + грешка

**Files:**
- Modify: `src/components/ui/icon.tsx` (нова икона `google`)
- Modify: `src/components/auth/auth-form.tsx`

**Interfaces:**
- Consumes: `signInWithProvider` (Task 3), `<Icon name="google" />`.

Google изисква официалното multicolor „G" лого (не монохромна икона). Понеже `<Icon>` set-ът е монохромен (currentColor), логото се слага като inline SVG директно в бутона (не в icon.tsx) — по-чисто. Ревизия на плана: **пропусни icon.tsx промяната**, сложи Google „G" SVG inline в auth-form.

- [ ] **Step 1: Add the Google button below the form**

Прочети текущия `src/components/auth/auth-form.tsx`. Формата свършва на ред 134 (`</form>`). Добави Google бутона + divider ПРЕДИ формата (над имейл полетата), както спецът иска („над формата, с „или" divider отдолу").

Първо, добави импорта за action-а (при съществуващия `import type { AuthFormState }`):
```ts
import { signInWithProvider } from "@/actions/auth";
```

После, ВЕДНАГА след затварящия таг на desktop заглавния блок (ред 103, `</div>`) и ПРЕДИ `<form action={formAction}...>` (ред 105), вмъкни:
```tsx
          {/* Social login — над имейл формата, с „или" divider. Отделен контрол от
              useActionState формата: собствен form с action-а. Google „G" лого inline
              (multicolor, не се вписва в монохромния Icon set). */}
          <form action={signInWithProvider.bind(null, undefined)}>
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="w-full gap-3"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
                />
              </svg>
              Продължи с Google
            </Button>
          </form>

          {/* „или" divider */}
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-px flex-1 bg-surface-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
              или
            </span>
            <span aria-hidden className="h-px flex-1 bg-surface-200" />
          </div>
```

Забележка: провери, че `Button` поддържа `variant="secondary"` и деца до текст (икона + текст). Ако `variant` името е различно (напр. `outline`), ползвай съществуващия вторичен вариант от `src/components/ui/button.tsx`.

- [ ] **Step 2: Show OAuth error (от ?error=oauth)**

Callback-ът/action-ът пренасочват към `/auth/login?error=oauth` при провал. Login страницата трябва да покаже съобщение. Прочети `src/app/(auth)/auth/login/page.tsx`. Тя рендерира `<AuthForm mode="login" action={signIn} />`. Добави четене на `searchParams.error` и подай съобщение.

В `src/app/(auth)/auth/login/page.tsx`, направи компонента да чете searchParams (Next 16 — `searchParams` е Promise):
```tsx
interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const oauthError = error === "oauth" ? "Входът с Google не бе успешен. Опитай пак." : undefined;
  return <AuthForm mode="login" action={signIn} oauthError={oauthError} />;
}
```
(Ако login page-ът има друга сигнатура — адаптирай; ключово е да подаде `oauthError` към `AuthForm`.)

В `AuthForm` props (ред 9-12), добави:
```ts
interface AuthFormProps {
  mode: "login" | "register";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  oauthError?: string;
}
```
И в деструктурирането (ред 21): `export function AuthForm({ mode, action, oauthError }: AuthFormProps) {`.

Покажи `oauthError` над Google бутона (или под него):
```tsx
{oauthError && <p className="text-sm text-danger-600">{oauthError}</p>}
```

- [ ] **Step 3: Verify gate**

Run: `pnpm check`
Expected: PASS (lint + unit вкл. safe-redirect тестове + build).

- [ ] **Step 4: Commit**

```bash
git add "src/components/auth/auth-form.tsx" "src/app/(auth)/auth/login/page.tsx"
git commit -F - <<'EOF'
feat(auth): бутон „Продължи с Google" в AuthForm + OAuth грешка

Google „G" лого (multicolor SVG inline), „или" divider, над имейл формата. Покрива
login+register. Login показва общо съобщение при ?error=oauth.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

- [ ] **Step 5: Валидация (потребител — след Google credentials)**

Съобщи на потребителя, че кодът е готов и чака:
1. Google Cloud Console → OAuth 2.0 Client ID (redirect URI = `https://<supabase-ref>.supabase.co/auth/v1/callback`).
2. Supabase Dashboard → Authentication → Providers → Google: включи + Client ID/Secret.
3. Prod redirect: чака домейна `frizmoshops.bg` (или временно `frizmo-shops.vercel.app`).

Ръчен тест на живо: „Продължи с Google" на login + register → Google consent → връща в `/dashboard`; нов потребител → профил с име; отказ на consent → `/auth/login` с общо съобщение. Push към `dev` само след разрешение.

---

## Notes for the implementer

- `signInWithProvider` и callback-ът НЕ ползват `useActionState` — Google бутонът е отделен `<form>` със свой action (`.bind(null, undefined)` за търговски вход; купувачески S3 по-късно ще подаде друг `next`).
- Не пипай `signIn`/`signUp`/`signOut` — те остават непроменени.
- `ensureProfile` вторият параметър е опционален → съществуващите извиквания (ако има) не се чупят.
- Google „G" SVG е официалното лого — не го променяй визуално (бранд гайдлайн на Google).
