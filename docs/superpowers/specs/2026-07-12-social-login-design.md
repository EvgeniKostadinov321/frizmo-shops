# Дизайн: Social login (Google) — 2026-07-12

**Статус:** одобрен дизайн, чака ревю на спеца
**Обхват:** вход/регистрация с Google през Supabase Auth. Само Google в първата
итерация. Проектиран да се преизползва за купувачески акаунт (S3) по-късно.
**Заменя:** ревизира по-стария `docs/2026-07-08-social-login/spec.md` (валиден, но
непълен) — този е каноничният.

## Контекст и цел

Днес входът/регистрацията е само **имейл + парола** (`src/actions/auth.ts`,
`src/components/auth/auth-form.tsx`). Social login сваля триенето — един клик вместо
форма + потвърждение на имейл. Имейл верификацията при OAuth е автоматична (провайдърът
я гарантира).

Кодовата карта (разузнаване 2026-07-12) потвърди: няма OAuth в кода днес; `proxy.ts`
matcher вече покрива `/auth/:path*`; `profiles` редът се създава експлицитно в кода (без
DB тригер) — през `signUp` action + `ensureProfile` safety net.

## Решения (заключени с потребителя)

- **Само Google** в първата итерация. Facebook (иска Meta бизнес верификация) и Apple
  (нужен само при iOS native app) — по-късно, ако данните покажат нужда. YAGNI.
- **Проектиран за двете роли отсега:** `signInWithProvider` приема `next` параметър →
  носи дестинацията/ролята. Търговец → `/dashboard`; бъдещ купувач (S3) → различен
  redirect без онбординг на магазин. Механизмът се преизползва, не се преправя.

## Архитектура (4 промени)

### 1. Нов action `signInWithProvider(provider, next?)`
`src/actions/auth.ts` (`"use server"`). Извиква:
```ts
supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next ?? "/dashboard")}` },
})
```
Връща `{ url }` за клиентско пренасочване (или прави redirect). `origin` се взима от
заявката (dev localhost / prod домейн).

### 2. Callback route `src/app/(auth)/auth/callback/route.ts`
Route handler (GET):
- Взима `code` от query → `supabase.auth.exchangeCodeForSession(code)`.
- Успех → `ensureProfile(user)` (виж #3) → `redirect(next ?? "/dashboard")` (валидиран
  `next` — само относителни пътища, за да не стане open-redirect).
- **Error branch:** липсващ `code` / OAuth denial (`error` в query) / exchange грешка →
  `redirect("/auth/login?error=oauth")` с общо BG съобщение. Технически детайл само в
  server лог (структуриран JSON), никога към клиента.

`proxy.ts` matcher вече покрива `/auth/*` → route работи без промяна на matcher-а.
`updateSession` redirect-away логиката керва по точни пътища `login`/`register` → не
интерферира с `/auth/callback`.

### 3. `ensureProfile` разширен
`src/lib/auth.ts` (днес редове 17-19: idempotent `insert...onConflictDoNothing` с празен
профил). Разширява се да приема име/имейл от OAuth метаданните:
`user.user_metadata.full_name` (Google го дава) → записва се в `profiles.fullName` при
insert. Уеднаквява с register формата (днес `fullName` идва само оттам). Остава
идемпотентен (повторно влизане не презаписва).

### 4. UI бутон в `AuthForm`
`src/components/auth/auth-form.tsx` (client, mode-driven — един компонент за login+register).
- „Продължи с Google" — full-width secondary бутон с **официалното Google SVG лого**
  (нова икона; правилото на проекта: SVG, не емоджи).
- Разположение: над имейл формата, с „или" divider отдолу.
- Отделен контрол от имейл/парола формата (която ползва `useActionState` + един Server
  Action) — Google бутонът вика `signInWithProvider` (client handler или собствен
  `formAction`).
- Понеже компонентът обслужва и двата екрана (mode), добавянето веднъж покрива login+register.

## Гочи / внимание

- **Redirect URI ТОЧНО съвпадение** в Google Console — 2 записа: dev `localhost:3000` +
  prod домейн. **Prod URI чака домейна `frizmoshops.bg`** (за да заковем финалния URL;
  дотогава може с `frizmo-shops.vercel.app`).
- **Open-redirect гард:** `next` се валидира да е относителен път (започва с `/`, не
  `//` или `http`), иначе fallback към `/dashboard`.
- **Един магазин на потребител** остава непроменен (`uniqueIndex shops_owner_idx`) —
  social login променя само входа, не онбординга.
- Supabase callback URL (`https://<ref>.supabase.co/auth/v1/callback`) е този, който се
  дава на Google Console; нашият `/auth/callback` е където Supabase връща след това.

## Тестване

- **Unit:** `signInWithProvider` конструира правилен `redirectTo` с encode-нат `next`;
  `next` валидацията (относителен път → пропуска, абсолютен/protocol → fallback).
- **Callback error branches:** липсващ code / error query → redirect към login с `error=oauth`.
- **Без нов e2e** (иска реални Google credentials) — ръчна проверка на живо след setup.
- `pnpm check` гейт зелен.

## Какво чака потребителя (преди имплементация)

1. Google Cloud Console → OAuth 2.0 Client ID (redirect URI = Supabase callback URL).
2. Supabase Dashboard → Authentication → Providers → Google: включи + постави Client
   ID/Secret (в Supabase, **не в чата**).
3. Дай знак → пиша кода. Ръчен тест на живо след това.

## Извън обхвата

- **Facebook / Apple** — по-късно, при нужда (различен външен setup).
- **Купувачески акаунт (S3)** — отделен голям проект; този спец само подготвя механизма
  (параметризиран redirect), не го строи.
