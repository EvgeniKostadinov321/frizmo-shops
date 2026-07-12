# Дизайн: Домейн миграция към frizmoshops.bg

**Дата:** 2026-07-12
**Статус:** одобрен дизайн, чака ревю на спеца
**Обхват:** мигриране на публичния домейн от `frizmo-shops.vercel.app` (fallback) към
`frizmoshops.bg`. Кодова част (централизиране на домейна) + инфраструктура (Vercel/DNS/Supabase).

## Контекст и цел

Домейнът `frizmoshops.bg` е поръчан (SuperHosting, ~24ч setup). Днес публичният URL е
разпръснат хардкоднат из кода: `BASE_URL` дублиран на 6 места (всяко с fallback
`https://frizmo-shops.vercel.app`), `metadataBase`/`robots`/`sitemap` хардкоднати, линк в
имейл body хардкоднат, marketing демо URL-и неконсистентни (`frizmoshops.bg` vs `frizmo.shop`).

Цел: **единен източник на домейна (нула хардкоднати)** + инфраструктурен setup, за да работи
`frizmoshops.bg`. Смяна на домейн занапред = едно място.

## Ключови решения (взети с потребителя)

1. **Имейл подателят остава `shops@frizmo.bg` засега.** Той е верифициран в Resend (работи).
   Миграция към `shops@frizmoshops.bg` иска нова Resend DNS верификация — отложена (не блокира;
   брандът „Frizmo" е общ). Само линковете В имейлите мигрират към новия домейн.
2. **Централизиране през `siteUrl()` helper** (не просто смяна на fallback стринга) — елиминира
   дублирането завинаги.
3. **Marketing декоративни URL-и уеднаквени на `frizmoshops.bg`** (сега смес).
4. **Ред:** код първо (готово за деплой), инфраструктура когато DNS е готов. Sentry идва СЛЕД
   тази миграция.

## Архитектура

### Нов helper `src/lib/site-url.ts` (чист, тестван)

```ts
/** Единственият източник на публичния базов URL. Нула хардкоднати домейни другаде. */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, ""); // маха завършващ /
  return process.env.NODE_ENV !== "production"
    ? "http://localhost:3000"
    : "https://frizmoshops.bg"; // prod fallback (новият домейн)
}
```

Нормализира завършващия `/` (иначе `${siteUrl()}/path` → `//path`). Пази съществуващото
dev→localhost поведение (email.ts вече го има — консолидира се тук).

Unit тестове (Vitest, TDD): env стойност се уважава · завършващ `/` се маха · prod fallback =
`https://frizmoshops.bg` · dev fallback = `http://localhost:3000`.

### Места, които викат helper-а

| Файл | Сега | След |
|---|---|---|
| `src/actions/billing.ts:11` | `BASE_URL = env \|\| "…vercel.app"` | `BASE_URL = siteUrl()` |
| `src/app/(dashboard)/dashboard/store/page.tsx:11` | същото | `siteUrl()` |
| `src/app/(storefront)/s/[slug]/feed.xml/route.ts:8` | същото | `siteUrl()` |
| `src/lib/email.ts:15-19` | env \|\| dev\|\|vercel.app | `siteUrl()` |
| `src/lib/email.ts:108` | хардкоднат `https://frizmo-shops.vercel.app/dashboard/orders` | `${siteUrl()}/dashboard/orders` |
| `src/app/layout.tsx:34` | `metadataBase: new URL("…vercel.app")` | `new URL(siteUrl())` |
| `src/app/robots.ts:10` | `sitemap: "…vercel.app/sitemap.xml"` | `` `${siteUrl()}/sitemap.xml` `` |
| `src/app/sitemap.ts:6` | `BASE = "…vercel.app"` | `siteUrl()` |

### Marketing декоративни URL-и (уеднаквяване)

Декоративен текст в мокъпи (не функционални линкове) — уеднаквяват се на `frizmoshops.bg`:
- `src/components/marketing/hero-storefront-demo/index.tsx:75` — `frizmo.shop/s/atelie-rachichka` → `frizmoshops.bg/s/atelie-rachichka`
- `src/components/marketing/step-card.tsx:78` — същото
- `src/components/marketing/feature-mockups.tsx:87` — вече `frizmoshops.bg` (провери, остави)

`src/app/(marketing)/page.tsx:234` вече казва „frizmoshops.bg" (текст) — ок.

## Ред на изпълнение

**Фаза А — Код (готово за деплой; качва се когато DNS е близо/заедно с env):**
1. `siteUrl()` helper + тестове
2. Замяна на 8-те места + email линк
3. Marketing декоративни URL-и
4. `pnpm check` + commit

Забележка: докато `NEXT_PUBLIC_SITE_URL` не е зададен на прод, helper-ът връща
`frizmoshops.bg` fallback — но домейнът още не резолвва към Vercel. Затова Фаза А се качва,
когато DNS-ът е близо готов (или заедно със смяната на env).

**Фаза Б — Инфраструктура (когато SuperHosting е готов — потребител + агент):**
5. Vercel: добави `frizmoshops.bg` → DNS записи при SuperHosting → SSL авто (Let's Encrypt)
6. Vercel env: `NEXT_PUBLIC_SITE_URL=https://frizmoshops.bg` + **Redeploy**
7. Supabase: добави `https://frizmoshops.bg/**` в Auth → URL Configuration (redirect allowlist)
   — иначе бъдещ Google login / magic link към новия домейн ще се отхвърли
8. Push на Фаза А (ако не е вече) → прод сочи новия домейн

## Проверка на живо (потребител)

- `https://frizmoshops.bg` зарежда, SSL валиден
- Магазин `frizmoshops.bg/s/{slug}` работи
- OG preview (сподели линк) → новият домейн
- `frizmoshops.bg/sitemap.xml` + `/robots.txt` → новият домейн
- Имейл при поръчка → линковете сочат `frizmoshops.bg` (подателят остава `frizmo.bg` — очаквано)
- `frizmo-shops.vercel.app` → редирект към новия (Vercel авто при primary domain — потвърди)

## Извън обхвата

- Имейл подател (Resend миграция към `shops@frizmoshops.bg`) — отложено.
- Sentry — след тази миграция.
- Redirect от vercel.app — Vercel го управлява автоматично.

## Тестване

- `siteUrl()` unit тестове (Vitest) — виж по-горе.
- `pnpm check` гейт зелен преди край.
- Без нови e2e. Потребителят прави проверката на живо.
