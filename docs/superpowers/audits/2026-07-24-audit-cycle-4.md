# Одитен цикъл #4 — 2026-07-24

Четвърти одит (нови измерения: Storage/файлове, Email/push, SEO/structured data, Config/security-headers).
Процес: субагенти (workflow, 14 агента, 0 грешки) → моя вторична проверка. База: `b2eabfd`.
Подадени находките от #1/#2/#3 → 0 повторения. **10 уникални находки, всичките нови.**
✅ Агентите НЕ пипнаха файлове. Сверих лично: SEC-HDR-01 (next.config), SEO-01 (robots.ts), STG-02 (uploads.ts). 0 халюцинации.

**Паттерн:** одит #2 CACHE-03 поправи sitemap/metadataBase, но 3 СЕСТРИНСКИ места останаха хардкоднати
на vercel.app (robots.ts, email.ts:108, feed.xml) — „довърши CACHE-03" клъстер.

---

## ✅ ПОПРАВЕНИ ВСИЧКИ 10 (план `docs/superpowers/plans/2026-07-24-audit-fixes-4.md`, `pnpm check` = 498 теста)
Домейн клъстер (robots/email/feed → siteUrl), security headers (next.config), JSON-LD цена→0, каталог
canonical, upload rate-limit, orphan cleanup (product+logo), path allowlist+, cron constant-time auth. Долу детайли.

## 🔴 За поправка (реални)

| # | Находка | Файл:ред | Severity |
|---|---|---|---|
| **SEC-HDR-01** | Пълна липса на HTTP security headers → clickjacking на /dashboard, /admin, checkout (няма X-Frame-Options/CSP frame-ancestors/HSTS/Referrer-Policy/nosniff). Стандартна production база липсва. | `next.config.ts:17` | **high** |
| **SEO-01** | `robots.txt` хардкодва sitemap на `vercel.app` (sitemap.ts е поправен, robots пропуснат) → cross-host sitemap се игнорира от Google → целият каталог рискува да не се индексира на прод домейна. | `app/robots.ts:10` | **high** |
| **EMAIL-01** | Линк „Виж в панела" в имейла за нова поръчка (най-честият) хардкодва `vercel.app` (всички други линкове ползват BASE_URL). Env промяна не го оправя. | `lib/email.ts:108` | medium |
| **SEO-02** | Marketing JSON-LD рекламира несъществуваща цена 10 EUR (монетизацията сменена на безплатно). Google Rich Results показва грешна цена → penalty риск. | `(marketing)/page.tsx:120` | medium |
| **STG-01** | Orphan файлове: при редакция (смяна снимки/лого/hero видео 15MB) старите файлове НЕ се трият от Storage → неограничен ръст на bucket-а. deleteProductImage е dead code. | `actions/products.ts:180` + site-settings | medium |
| **STG-02** | 5MB лимит за снимки САМО клиентски — requestImageUpload не проверява размер → търговец качва до 15MB (bucket лимит) заобикаляйки UI. НЕ cross-tenant (scope по shop.id). | `actions/uploads.ts:30` | medium |

## 🟡 Дребни (реални, ниско въздействие)

| # | Находка | Файл:ред | Severity |
|---|---|---|---|
| **SEO-03** | Каталожните /products и /shops нямат canonical въпреки filter/sort/page (storefront ги има) → дублирано съдържание. | `(catalog)/products/page.tsx:9` + shops | low |
| **SEO-04** | feed.xml строи BASE_URL от env директно, не през siteUrl() → двоен слаш ако env има trailing /. | `feed.xml/route.ts:8` | low |
| **STG-03** | site-settings path валидация е blocklist (не allowlist) → non-shops/ пътища минават. НЕ изтичане (bucket публичен, префикс фиксиран), но инвариант нарушен. | `site-settings.ts:40` | low |
| **SEC-HDR-02** | Cron Bearer сравнение не е constant-time (timing). Практически неексплоатируемо (мрежов jitter), но тривиален fix + пази финансов cron. | `bill-fees/route.ts:26` +3 | low |

---

**Основите солидни:** signed URLs, jsonLdHtml екраниране, tenant path scope (products/logo с allowlist), push
404/410 cleanup. Находките са конкретни пропуски: security headers (никога не добавени), 3 сестри на CACHE-03,
orphan storage, клиентска-само валидация. Нула критични.
