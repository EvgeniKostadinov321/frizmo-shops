# Social login — спецификация (2026-07-08)

> Одобрено разширение на auth-а след gap одита. Google **задължителен**, останалите
> опционални. Важи за търговци сега (`AuthForm`), и за купувачески акаунт (S3) по-късно.
> Статус: **спец, не имплементиран** (изисква действие на потребителя за credentials).

## Цел
Днес входът/регистрацията е само **имейл + парола** (`src/actions/auth.ts`,
`src/components/auth/auth-form.tsx`). Social login сваля триенето — един клик вместо
форма + потвърждение на имейл.

## Обхват на провайдърите
| Провайдър | Статус | Защо |
|-----------|--------|------|
| **Google** | 🔴 задължителен | Най-широко използван; повечето BG потребители имат Google акаунт. |
| **Facebook** | 🟡 силна опция | Голямо BG проникване; но иска Meta бизнес верификация (по-тежък setup). |
| **Apple** | 🟢 опционален | Нужен само ако някога има iOS native app (App Store изискване). Иначе излишен. |

Препоръка: пусни **Google** в първата итерация; Facebook добави, ако данните покажат
нужда; Apple — само при iOS app.

## Как се прави (Supabase поддържа OAuth нативно)
1. **Google Cloud Console** (действие на ПОТРЕБИТЕЛЯ): създай OAuth 2.0 Client ID,
   redirect URI → `https://<supabase-ref>.supabase.co/auth/v1/callback`. Взима се
   Client ID + Secret.
2. **Supabase Dashboard** → Authentication → Providers → Google: включи + постави
   ID/Secret. (Аналогично за Facebook/Apple.)
3. **Код** (моя работа):
   - Нов action `signInWithProvider(provider)` → `supabase.auth.signInWithOAuth({
     provider, options: { redirectTo: <callback> } })`.
   - **Callback route** `src/app/(auth)/auth/callback/route.ts` → разменя code за
     сесия (`exchangeCodeForSession`), после redirect към `/dashboard` (или
     `?next=`). Trigger-ва `ensureProfile`.
   - **Бутони** в `AuthForm` — „Продължи с Google" (+ др.), с официалните лога
     (SVG, не емоджи — правилото на проекта).
   - `proxy.ts` matcher вече покрива `/auth/:path*` → callback работи.

## Гочи / внимание
- **Профилът**: OAuth дава име/имейл от провайдъра → `ensureProfile` трябва да ги
  запише (днес `fullName` идва от register формата). Уеднакви.
- **Един магазин на потребител** остава (`uniqueIndex shops_owner_idx`) — social
  login не променя онбординга, само входа.
- **Купувачески акаунт (S3)**: когато дойде, същият механизъм се преизползва за
  купувачи (различен redirect + без онбординг на магазин).
- **Redirect URI** трябва да съвпада ТОЧНО (dev localhost + prod Vercel — два записа
  в Google Console).
- Имейл верификацията при OAuth е автоматична (провайдърът я гарантира) — за разлика
  от имейл+парола.

## Какво чака потребителя (преди имплементация)
Google Cloud OAuth credentials + включване в Supabase. Дай ми Client ID/Secret са в
Supabase (не в чата) → аз пиша кода.
