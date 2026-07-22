# Контекстно-базирана роля при вход — дизайн

> Спец от диагностика (2 workflow-а, 7 агента) 2026-07-22. Реши: ролята се определя от
> КОНТЕКСТА/ДЕЙСТВИЕТО, не от акаунта. chosenRole побеждава hasShop.

Имам пълна и точна картина на кода. Сега пиша финалната спецификация.

---

# ФИНАЛНА ПРОЕКТНА СПЕЦИФИКАЦИЯ — Контекстно-базирана роля при вход

**Проект:** Frizmo Shops · **Дата:** 2026-07-22 · **Автор:** архитектура (старши)
**Принцип (решен от потребителя):** Ролята се определя от КОНТЕКСТА/ДЕЙСТВИЕТО, не от кой е акаунтът. Няма памет за „активен режим" — всяко действие носи собственото си намерение (роля + `next`).

---

## 0. Диагноза в едно изречение

**Entry point-овете (линковете) са предимно коректни** — носят правилните `role`/`next`. Счупен е **бекендът по потока**, на 3 огнища, всичките в противоречие с принципа:

| # | Огнище | Файл:ред | Дефект |
|---|--------|----------|--------|
| **A** | `signIn` не чете `role` | `actions/auth.ts:68-72` + `schemas/auth.ts:10-13` | `loginSchema` няма `role`; hidden input (`auth-form.tsx:198`) се игнорира → явният избор „Пазарувам" изчезва при имейл вход. |
| **B** | `resolvePostAuthPath` слага `hasShop` над контекста | `auth-redirect.ts:12` | `if (hasShop \|\| preferredRole==='seller') return '/dashboard'` — ПРЕДИ да погледне `next`. Dual-role собственик с `next=/account` попада в `/dashboard`. |
| **C** | proxy изтрива намерението | `session.ts:38-43` | Логнат на `/auth/login` → безусловно `/dashboard` + `url.search=""` трие `?role` И `?next`. Формата дори не се рендерира. |

Най-видимият за потребителя симптом: **несиметрия OAuth vs имейл** — Google бутонът уважава ролята (`auth-form.tsx:162`: `isBuyer ? (next ?? "/account") : next`), но имейл `signIn` на СЪЩИЯ екран я игнорира → един и същ toggle дава различен резултат според метода.

---

## 1. ПЪЛНА МАТРИЦА на вход-сценариите (26, нито един пропуснат)

Легенда за дестинация: **BUYER** = `/account` (или валиден `next`); **SELLER** = `/dashboard`.

### 1.A — STOREFRONT entry (контекст = купувач винаги, дори собственик)

| # | Entry point | Намерение | Очаквана (принцип) | Сегашна | Бъг? | Причина / фикс |
|---|-------------|-----------|--------------------|---------|------|----------------|
| S1 | `storefront/header/shared.tsx:357` — AccountButton (профил икона) | Купувач → `/account` | BUYER | Гост: `?role=buyer&next=/account` (идеална форма). Dual-role: signIn игнорира role → `resolvePostAuthPath(hasShop=true,…)` → `/dashboard`, `next` изхвърлен | **ДА** | Линкът е коректен. Бекенд: B (+ A). |
| S2 | `storefront/shop-favorite-button.tsx:29` — сърце „любим магазин" (гост) | Купувачко действие → `/account` | BUYER | `router.push("/auth/login?role=buyer&next=/account")` — коректен entry; бекендът троши dual-role | **ДА** | Бекенд A+B. |
| S3 | `storefront/favorite-button.tsx:58` — сърце „любим ПРОДУКТ" (гост) | Гост пази локално | localStorage, без login | Гост → `toggleFavorite` в localStorage (per-магазин), мигрира при вход (`FavoritesMerger`). **Не е login entry.** | НЕ | По дизайн. Отбелязан за контраст с „любим магазин" (той иска акаунт). |

### 1.B — MARKETING / LANDING / CATALOG entry

| # | Entry point | Намерение | Очаквана | Сегашна | Бъг? | Причина / фикс |
|---|-------------|-----------|----------|---------|------|----------------|
| M1 | `marketing/site-header.tsx:88` — „Вход" (desktop pill, гост) | Купувачки вход от marketing | BUYER | `/auth/login?role=buyer` — **БЕЗ `next`**. Формата зарежда buyer, но signIn игнорира role → dual-role → `/dashboard` | **ДА** | Козметика: добави `next=/account`. Истински: A+B. |
| M2 | `marketing/site-header.tsx:140` — „Вход" (mobile overlay) | Същото | BUYER | `href={loggedIn ? "/account" : "/auth/login?role=buyer"}` — БЕЗ `next` | **ДА** | Козметика `next=/account` + бекенд A+B. |
| M3 | `marketing/site-header.tsx:95,148` — „Създай магазин" (desktop+mobile) | Продавачки CTA | SELLER | `/auth/register` без `role`/`next` → AuthForm default `seller` → `/dashboard`. Работи чрез default. | НЕ | Препоръка: `?role=seller` за явност. |
| M4 | `marketing/shop-favorite-heart.tsx:34` — сърце „любим магазин" на `/shops` карта (гост) | Каталогово купувачко действие → `/account` | BUYER | `router.push("/auth/login?role=buyer&next=/account")` — идеален entry; бекендът троши dual-role | **ДА** | Бекенд A+B. |
| M5 | `(marketing)/page.tsx:176,372,467` — landing CTA-та „Създай магазина си"/„Започни безплатно" | Продавачки CTA | SELLER | `/auth/register` без `role`/`next` → default seller → `/dashboard`. Работи. | НЕ | Препоръка: `?role=seller`. |
| M6 | `(marketing)/blog/[slug]/page.tsx:118` — блог CTA „Създай магазина си" | Продавачки CTA от блог | SELLER | `/auth/register` без `role` → default seller → `/dashboard`. Работи. | НЕ | Препоръка: `?role=seller`. |

### 1.C — AUTH ФОРМА (login/register page + вътрешни контроли)

| # | Entry point | Намерение | Очаквана | Сегашна | Бъг? | Причина / фикс |
|---|-------------|-----------|----------|---------|------|----------------|
| A1 | `login/page.tsx:14` `?role=buyer` → `<AuthForm role="buyer">`, hidden `role=buyer` (`auth-form.tsx:198`) | „Влизам да пазарувам" → `/account` (или `next`), ДОРИ owner | BUYER | `signIn` парсва само email+password; role игнориран. Dual-role `hasShop=true` → `/dashboard`. Изборът buyer се губи. | **ДА** | Огнище **A+B**. |
| A2 | `login/page.tsx:14` `?role=seller` | „Управлявам магазина" → `/dashboard` | SELLER | Role игнориран; owner → `/dashboard` (случайно вярно). **Seller-избор БЕЗ магазин** (`hasShop=false`, `preferredRole=null`) → пропада в `next/account` клона → **НЕ** `/dashboard`. | **ДА** | Огнище A+B: `chosenRole=seller` → `/dashboard` явно. |
| A3 | `register/page.tsx:12` `?role=buyer`, hidden `role=buyer` | Нов купувач → `/account` | BUYER | `signUp` ЧЕТЕ role (`registerSchema.role`), пише `preferredRole=buyer`, `resolvePostAuthPath(false,'buyer')` → `/account`. Работи. | НЕ | Register вече уважава ролята. |
| A4 | `register/page.tsx:12` `?role=seller` | Нов продавач → `/dashboard` | SELLER | `preferredRole=seller` → `resolvePostAuthPath(false,'seller')` → `/dashboard`. Работи. | НЕ | — |
| A5 | `auth-form.tsx:139-154` — role toggle „Пазарувам"/„Продавам" | Явен избор — ТЕЖИ (принцип №2) | Уважен и в login | Сменя `?role` в URL + copy + hidden input. Но при имейл `signIn` изборът е чисто визуален за dual-role. | **ДА** | Огнище A+B (login страната). |
| A6 | `auth-form.tsx:236,246` — вътр. линкове „Влез"/„Регистрирай се" | Запази role+next при login↔register | role+next се пренасят | `href` носи `role=${activeRole}` + `next` (ако има). Коректно. | НЕ | — |
| A7 | `auth-form.tsx:162` — OAuth бутон (buyer клон) | Купувач през Google → `/account` | BUYER | `bind(null, isBuyer ? (next ?? "/account") : next)` → callback `next=/account` → `/account`. Работи. `preferredRole` не се персистира (`ensureProfile` не приема role). | НЕ | Функционално ОК. Опция: персистиране на role. |
| A8 | `auth-form.tsx:162` — OAuth бутон (seller клон) | Продавач през Google → `/dashboard` | SELLER | `bind(null, …, next)`; при липсващ next → `signInWithProvider(undefined)` → `safeNextPath(undefined)="/dashboard"`. Работи, но **крехко** (разчита fallback == `/dashboard`). | НЕ | Работи чрез съвпадение. Явен `/dashboard` за seller би бил по-стабилен. |

### 1.D — PROXY (логнат вече отваря auth страница) — трите под-сценария

| # | Entry point | Намерение | Очаквана | Сегашна | Бъг? | Причина / фикс |
|---|-------------|-----------|----------|---------|------|----------------|
| P1 | `session.ts:38-43` — логнат dual-role отваря `/auth/login?role=buyer&next=/account` | „Виж поръчките си" → `/account` | BUYER | Безусловно `/dashboard`; `url.search=""` трие `?role`+`?next`. Формата не се рендерира. | **ДА** | Огнище **C**. |
| P2 | `session.ts:41` (`url.search=""`) — логнат отваря `/auth/login?next=/s/shop/checkout` | Върни в checkout | `next` (checkout) | `url.search=""` трие `next` → `/dashboard`. Двойна грешка (грешна дестинация + загубен контекст). | **ДА** | Огнище C: не трий search; пусни формата или redirect към `safeNextPath(next)`. |
| P3 | `session.ts:38-43` срещу `auth.ts:98` (signIn) и `callback:32` — конфликтен redirect | Само ЕДИН слой решава дестинацията | Формата/action-ът е единствен авторитет | За НЕлогнат няма конфликт (proxy пуска). За логнат: proxy отменя `role/next` линка, построен от `auth-form.tsx:236,246`. Двойният-redirect капан. | **ДА** | Огнище C: proxy да не се меси при наличен `role`/`next`. |

### 1.E — OAuth инфраструктура (callback + matcher) — три под-сценария

| # | Entry point | Намерение | Очаквана | Сегашна | Бъг? | Причина / фикс |
|---|-------------|-----------|----------|---------|------|----------------|
| O1 | `callback/route.ts:11-32` + `actions/auth.ts:119-135` — OAuth callback | Ролята да преживее redirect към Google и обратно | buyer→`/account`, seller→`/dashboard` | Ролята кодирана САМО косвено в `next`. Callback чете само `next` и redirect-ва. Купувач винаги подава ненулев buyer-next (`next ?? "/account"`). Функционален бъг НЯМА, но инвариантът е недокументиран/крехък. | НЕ | Устойчиво direй buyer-клона (вече прави); документирай инварианта. Опция: изключи callback от proxy-guard. |
| O2 | `proxy.ts:10` matcher (`/auth/:path*`) покрива и `/auth/callback` | Callback GET да не бъде прихванат от логнат-guard | Callback се пуска | При callback GET сесията тепърва се създава (`exchangeCodeForSession`) → `getUser()` в proxy връща `user=null` → пуска. Функционално ОК днес. | НЕ | Днес безопасно. За устойчивост: guard-ът да таргетира само точно `/auth/login`\|`/auth/register` (вече прави с `===`). |
| O3 | `proxy.ts:10` matcher НЕ покрива `/s/` и `/account` | Storefront + `/account` да имат прясна сесия | Layout-ите валидират сесията | matcher = `/dashboard,/admin,/auth`. `/s/` и `/account` минават през layout-ите (`getUser`/`requireBuyer`, dynamic заради `cookies()`). Auth изолацията е на layout ниво — коректен модел. | НЕ | Остави извън matcher. |

**Обобщение:** 26 сценария → **13 бъга**, всичките сводими до **3 огнища (A, B, C)** + 4 козметични подобрения (M1/M2 `next=/account`; M3/M5/M6 `?role=seller`). Register потокът и OAuth са коректни (последният крехко-коректен).

---

## 2. ЕДИННИЯТ МЕХАНИЗЪМ — как намерението тече чисто

Инвариант: **намерението = `{ role, next }`** пътува непроменено от entry point до финалната дестинация; единственият авторитет, който изчислява дестинацията, е `resolvePostAuthPath` (за форма/action) и `callback` (за OAuth). Proxy НЕ решава дестинации.

**Приоритет на дестинацията (нова йерархия):**
```
1. chosenRole === "seller"  → /dashboard            (явно; преди next-клона)
2. chosenRole === "buyer"   → safeNextPath(next) | /account   (context wins; ИГНОРИРА hasShop)
3. (няма явна роля) → hasShop || preferredRole==="seller" → /dashboard
4. (fallback) → safeNextPath(next) | /account
```
Ключова инверсия спрямо днес: **`chosenRole` побеждава `hasShop`** (днес е обратното).

**Поток по слоеве:**

1. **Entry point** кодира намерението в URL: `/auth/{login|register}?role={buyer|seller}&next={relative-path}`.
   - Купувачки контекст: `role=buyer` + `next` към купувачки път (`/account` или конкретен checkout).
   - Продавачки контекст: `role=seller` (без задължителен `next`).
   - Стандарт: `role` е задължителен за нехомогенните entry points; `next` — когато има смислен произход.

2. **Формата** (`login/page.tsx`, `register/page.tsx`, `auth-form.tsx`) чете `role`+`next`, рендерира съответния copy/toggle и **подава ги при submit**: hidden `role` (вече го прави, ред 198) + hidden `next` (ред 199). OAuth бутонът кодира ролята в `next` (buyer → `next ?? "/account"`, seller → `next` или празно).

3. **`signIn`/`signUp`** четат `role` от `formData`, подават го като `chosenRole` на `resolvePostAuthPath`. `signUp` допълнително персистира `preferredRole` (вече прави).

4. **`resolvePostAuthPath`** прилага новата йерархия (горе). `chosenRole` е с най-висок приоритет.

5. **Proxy** спира да отменя намерението: логнат на `/auth/login|register` **с** `role` или `next` → **пуска формата** (`return response`), не редиректва. Без `role`/`next` → безопасен redirect към `/dashboard` (default за „гол" login на логнат), но **без** `url.search=""` като операция върху намерение (тук няма намерение за пазене).

6. **OAuth** носи ролята през redirect чрез `next` (Supabase не връща произволен state): buyer винаги кодира buyer-дестинация в `next`; callback уважава `next` както е. Инвариантът се документира.

---

## 3. ТОЧНИ ПРОМЕНИ по файл (в ред на имплементация)

### Стъпка 1 — `src/schemas/auth.ts`
Добави `role` към `loginSchema` (по модел на `registerSchema:7`):
```ts
export const loginSchema = z.object({
  email: z.email("Невалиден имейл"),
  password: z.string().min(1, "Въведи парола"),
  role: z.enum(["buyer", "seller"]).optional(),
});
```
Забележка: `role` е optional — стар линк без role пада в fallback клоновете (не чупи нищо).

### Стъпка 2 — `src/lib/auth-redirect.ts`
Нова сигнатура с `chosenRole` (най-висок приоритет). `hasShop`/`preferredRole` стават fallback само при липса на явна роля:
```ts
export function resolvePostAuthPath(
  hasShop: boolean,
  preferredRole: "buyer" | "seller" | null,
  next?: string,
  chosenRole?: "buyer" | "seller",   // ← ново: явната роля на ТЕКУЩОТО действие
): string {
  const buyerDest = () => {
    const safe = safeNextPath(next);
    return safe !== "/dashboard" ? safe : "/account";
  };
  // 1) Явната роля побеждава — контекстът определя ролята.
  if (chosenRole === "seller") return "/dashboard";
  if (chosenRole === "buyer") return buyerDest();
  // 2) Няма явна роля → падаме на акаунта (register стар път, „гол" login).
  if (hasShop || preferredRole === "seller") return "/dashboard";
  return buyerDest();
}
```
Ключово: `chosenRole==="buyer"` **игнорира `hasShop`** — dual-role owner в купувачки контекст → `/account`. Съществуващите извиквания (без 4-ти арг) работят непроменени.

### Стъпка 3 — `src/actions/auth.ts`

**3a. `signIn`** (ред 68-72 + 98) — парсвай и подавай `role`:
```ts
const parsed = loginSchema.safeParse({
  email: formData.get("email"),
  password: formData.get("password"),
  role: formData.get("role") ?? undefined,   // ← ново
});
```
…и на редовете 98:
```ts
redirect(resolvePostAuthPath(hasShop, preferredRole, next, parsed.data.role));
```

**3b. `signUp`** (ред 61) — подай `role` явно като `chosenRole` (по-стабилно от подразбирането през `preferredRole`; при `role=undefined` поведението е идентично):
```ts
redirect(resolvePostAuthPath(false, role, next, role ?? undefined));
```
Забележка: `signUp` в момента не чете `next` — добави и `next` (виж 3c) за консистентност (нов купувач от checkout → обратно в checkout).

**3c. `signUp` — прочети `next`** (ново, за паритет с `signIn`): добави `const next = (formData.get("next") as string | null) ?? undefined;` преди redirect-а (формата вече подава hidden `next`, ред 199).

### Стъпка 4 — `src/lib/safe-redirect.ts`
**Без функционална промяна.** `safeNextPath` остава open-redirect гардът. Единствена препоръка: fallback остава `/dashboard` (използва се от seller OAuth клона A8). Ако някога се смени, seller OAuth трябва да получи явен `/dashboard` (виж Стъпка 6, опция). Документирай зависимостта с коментар.

### Стъпка 5 — `src/lib/supabase/session.ts` (ОГНИЩЕ C — най-важната промяна)
Замени логнат-guard-а (38-43). Правило: **не се меси в намерение, кодирано в `role`/`next`.**
```ts
if (user && (path === "/auth/login" || path === "/auth/register")) {
  const sp = request.nextUrl.searchParams;
  // Има явно намерение (роля или произход) → пусни формата да реши.
  // Тя носи role+next към action-а; resolvePostAuthPath прилага правилото.
  if (sp.has("role") || sp.has("next")) {
    return response;
  }
  // „Гол" login/register за вече логнат → безопасен изход към dashboard.
  // (Edge proxy няма DB достъп за hasShop/preferredRole; dashboard е неутрален
  //  landing, купувачът стига /account през своя AccountButton.)
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";            // тук няма намерение за пазене — безопасно
  return NextResponse.redirect(url);
}
```
Резултат: P1, P2, P3 се решават — формата става единственият авторитет, когато има намерение. `isProtected && !user` клонът (29-36) остава непокътнат.

### Стъпка 6 — `src/components/auth/auth-form.tsx`
**Функционална промяна не е нужна** — формата вече подава hidden `role` (198) и `next` (199), а OAuth клонът (162) вече кодира buyer коректно.
Препоръка (устойчивост, не бъг) за A8: направи seller OAuth клона явен, за да не зависи от `safeNextPath` fallback:
```tsx
<form action={signInWithProvider.bind(null, isBuyer ? (next ?? "/account") : (next ?? "/dashboard"))}>
```

### Стъпка 7 — `src/app/(auth)/auth/callback/route.ts`
**Без промяна.** Уважава `next` коректно. (Опционална документация: коментар че buyer-намерението пристига кодирано в `next`; инвариантът се пази в `auth-form.tsx:162`.)

### Стъпка 8 — Entry points (козметика/консистентност, не блокиращи бъгове)

- **M1** `marketing/site-header.tsx:88`: `href="/auth/login?role=buyer"` → `"/auth/login?role=buyer&next=/account"`.
- **M2** `marketing/site-header.tsx:140`: логнатият клон остава `/account`; гост клонът `"/auth/login?role=buyer"` → `"/auth/login?role=buyer&next=/account"`.
- **M3** `site-header.tsx:95,148`: `"/auth/register"` → `"/auth/register?role=seller"`.
- **M5** `(marketing)/page.tsx:176,372,467`: `"/auth/register"` → `"/auth/register?role=seller"`.
- **M6** `blog/[slug]/page.tsx:118`: `"/auth/register"` → `"/auth/register?role=seller"`.

(S1, S2, S4/M4 вече носят идеалната форма `role=buyer&next=/account` — без промяна.)

### Стъпка 9 — Опционално (персистиране на роля при OAuth, A7)
`ensureProfile` (`lib/auth.ts:22`) да приема `role?: "buyer"|"seller"` и да го пише при insert (`onConflictDoNothing` → не презаписва при повторно влизане). Изисква callback да знае ролята — днес я няма (само `next`). Отложи като NICE: не е блокер, `next`-механизмът покрива дестинацията.

**Ред на имплементация:** 1 → 2 → 3 → 5 (ядро на бъга) → 6/8 (устойчивост/козметика) → 4/7/9 (документация/опция).

---

## 4. КРАЙНИ СЛУЧАИ — да не се счупят

1. **Обикновен продавач БЕЗ магазин (онбординг):**
   - Register `role=seller`: `resolvePostAuthPath(false,'seller',_, 'seller')` → `/dashboard` ✓ (онбордингът живее под `/dashboard`).
   - Login `role=seller`, `hasShop=false`, `preferredRole=null`: **днес бъг A2** (пропада в account клон) → **след фикса** `chosenRole='seller'` → `/dashboard` ✓.

2. **Гост → checkout → login → връщане:**
   - Entry `/auth/login?role=buyer&next=/s/shop/checkout`. НЕлогнат → proxy пуска → submit → `signIn` → `resolvePostAuthPath(hasShop, _, "/s/shop/checkout", "buyer")` → `safeNextPath("/s/shop/checkout")` → **обратно в checkout** ✓. (Днес: dual-role owner би паднал в `/dashboard`.)
   - OAuth същия сценарий: buyer клон подава `next ?? "/account"` = конкретния checkout → callback → checkout ✓.

3. **Вече логнат отваря login:**
   - С `role`/`next` (P1/P2/P3): proxy пуска формата → тя решава → правилна дестинация ✓.
   - „Гол" `/auth/login` за логнат: → `/dashboard` (неутрален); dual-role купувач стига `/account` през своя AccountButton. Приемливо (edge proxy няма DB за по-умна преценка).
   - Внимание: **не бива** новата логика да създаде loop — след успешен `signIn`/OAuth дестинацията е `/account` или `/dashboard` (не `/auth/*`), значи няма повторно влизане в guard-а ✓.

4. **OAuth denial / грешка:**
   - Google denial → callback без `code` → `/auth/login?error=oauth` (`callback:16-17`). Този redirect носи `?error` но НЕ `role`/`next` → proxy (за НЕлогнат) пуска; формата показва грешката. ✓
   - `?error=oauth` е трети searchParam: guard-ът реагира на `role`/`next`, не на `error` → логнат-с-error едва ли се случва (denial значи няма сесия), но дори да се случи, липсата на `role`/`next` → `/dashboard`, error се губи — приемливо (edge случай на edge случай).

5. **Стар линк без `role` (обратна съвместимост):** `loginSchema.role` е optional; `resolvePostAuthPath` без `chosenRole` пада на fallback (`hasShop`/`preferredRole`) — идентично с днешното поведение за не-role потоци ✓.

6. **Open-redirect:** всеки `next` минава през `safeNextPath` (относителен, без `//`, без `:`) — непроменено ✓.

---

## 5. Role switcher — нужен ли е ИЗОБЩО?

**Извод: НЕ е нужен постоянен role switcher за MVP.** При чисто контекстна роля почти всеки път носи еднозначно намерение:

- Storefront/каталог купувачки действия → `/account` (контекстът стига).
- Marketing „Създай магазин" / dashboard → `/dashboard` (контекстът стига).
- В самата auth форма вече ИМА toggle „Пазарувам/Продавам" (`auth-form.tsx:139-154`) — това е достатъчният „switcher" в единствения момент, в който намерението е двусмислено (директно посещение на `/auth/login` без произход).

**Единственият сценарий, при който контекстът НЕ стига** (и къде е реалната граница):

> **Dual-role потребител, ВЕЧЕ логнат и активно в `/dashboard`, иска да отиде като КУПУВАЧ до `/account`** (или обратно — от `/account` към управление на магазина), **без да минава през storefront/marketing entry point.**

Тук няма „действие", което да носи роля — потребителят е статично в един контекст и иска да смени. Решението обаче **не е** класически persistent switcher (той връща идеята за „активен режим", която потребителят отхвърли). Достатъчна е **навигационна връзка между двата контекста**, а не превключвател на състояние:

- В **dashboard хедъра** (за owner): дискретна връзка „Моят профил / Пазарувам" → `/account`.
- В **`/account` хедъра** (за owner): връзка „Табло на магазина" → `/dashboard`.

Това са контекстни линкове (всеки носи своята дестинация), а не памет за режим — напълно съвместимо с принципа. **Препоръка:** добави тези две реципрочни връзки (owner-only, видими само когато `hasShop`) като лек follow-up; отложи всякакъв stateful switcher като ненужен.

---

## Файлове за промяна (обобщение)

| Ред | Файл | Промяна |
|-----|------|---------|
| 1 | `src/schemas/auth.ts` | `+ role` в `loginSchema` |
| 2 | `src/lib/auth-redirect.ts` | `+ chosenRole` параметър, нова йерархия (chosenRole > hasShop) |
| 3 | `src/actions/auth.ts` | `signIn` чете+подава role; `signUp` подава role като chosenRole + чете next |
| 4 | `src/lib/safe-redirect.ts` | без промяна (само коментар за fallback зависимостта) |
| 5 | `src/lib/supabase/session.ts` | proxy: не редиректвай логнат при `role`/`next`; спри `url.search=""` над намерение |
| 6 | `src/components/auth/auth-form.tsx` | опция: явен `/dashboard` за seller OAuth клон |
| 7 | `src/app/(auth)/auth/callback/route.ts` | без промяна (само документация на инварианта) |
| 8 | `site-header.tsx`, `(marketing)/page.tsx`, `blog/[slug]/page.tsx` | козметика: `next=/account` (M1/M2), `?role=seller` (M3/M5/M6) |
| 9 | `src/lib/auth.ts` (`ensureProfile`) | ОПЦИЯ/NICE: приеми `role` за персистиране при OAuth |

**Ядрото на всички 13 бъга е в стъпки 2, 3 и 5.** Стъпки 1 e предусловие; 6-9 са устойчивост/козметика. Register потокът (A3/A4) и OAuth (A7/O1-O3) остават коректни. След фикса единственият авторитет за дестинация е `resolvePostAuthPath` (форма/action) + `callback` (OAuth), а proxy пази само НЕлогнати от защитени пътища — точно исканият модел „контекстът определя ролята".