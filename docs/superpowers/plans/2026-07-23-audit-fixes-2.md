# Одитни поправки #2 (2026-07-23) — план

**Goal:** 11 одобрени находки от одит #2 (`docs/superpowers/audits/2026-07-23-audit-cycle-2.md`):
CONC-01, CACHE-01, CACHE-02, VAL-01, CACHE-03, CONC-02 + A11Y-01..05.

**Изпълнение:** inline, TDD където има логика, `pnpm check`. Push с разрешение.
**Global constraints:** integer центове; типографски BG кавички; строг TS; тестове до кода (реални v4 UUID); токени в tokens.css (без inline hex); dark токен не се пипа където е ОК.

---

## Задача 1 — CONC-01: CAS guard в expire-payments cron
**Файл:** `src/app/api/cron/expire-payments/route.ts:33`
- [ ] orders UPDATE → `.where(and(eq(id,orderId), eq(status,'pending_payment'))).returning({id})`; ако 0 → `return` от callback БЕЗ intent-expire/restoreStock (webhook вече е потвърдил).
- [ ] Импортирай `and`. Тест няма (cron, external) — verify с коментар защо CAS затваря race-а.

## Задача 2 — CONC-02: CAS в confirmNewsletter
**Файл:** `src/actions/newsletter.ts:155-161`
- [ ] Замени read-guard + update с атомарен CAS: `update(subscribers).set({status:'confirmed',confirmedAt,updatedAt}).where(and(eq(id,row.id), ne(status,'confirmed'))).returning({id})`. Ако 0 → `return {result:'already'}` (загубил конкурента). Купоните се издават само след успешен CAS.
- [ ] Импортирай `ne`. Тест: два паралелни confirm → само единият издава (mock update returning []).

## Задача 3 — CACHE-01: ePay поръчка инвалидира feed
**Файл:** `src/actions/orders.ts:474`
- [ ] Преди `return ok({...epay})` на ред 475 добави `revalidateTag(shopCacheTag(shop.slug), "max")` (симетрично на COD:511). shopCacheTag вече импортнат.

## Задача 4 — CACHE-02: ePay webhook + cron връщат склад → инвалидират feed
**Файлове:** `src/actions/payment-confirm.ts` (denied/expired клон), `src/app/api/cron/expire-payments/route.ts`
- [ ] payment-confirm: след транзакцията (denied/expired), резолвни slug (`shops.findFirst by intent.shopId, columns:{slug}`) → `revalidateTag(shopCacheTag(slug),"max")`. Импортирай revalidateTag + shopCacheTag.
- [ ] cron: след цикъла събери уникалните slug-ове на отменените → `revalidateTag` веднъж на slug (дедуп).

## Задача 5 — VAL-01: protocol-safe URL валидация
**Файлове:** `src/schemas/shop.ts` (social), `src/schemas/site-settings.ts` (ctaHref/announcement/promo/navLinks), нов `src/lib/safe-url.ts`
- [ ] Нов `src/lib/safe-url.ts`: `isSafeHref(s)` — позволява само leading '/', http(s)://, mailto:, tel:; отхвърля javascript:/data:/vbscript:/scheme-relative. + `safeHref(s)` render helper (връща '#' или '' за опасни).
- [ ] shop.ts social: `z.url()` → `z.url({protocol:/^https?$/})` (или refine с isSafeHref). Тест: javascript: се отхвърля.
- [ ] site-settings.ts href полета: добави `.refine(isSafeHref)` към ctaHref/announcement.href/promo ctaHref/navLinks.href.
- [ ] Belt-and-suspenders: render helper `safeHref` в socials.tsx/footer.tsx/announcement.tsx/hero shared.tsx/promo-banner.tsx (неутрализира легаси стойности без миграция).
- [ ] Тест: `isSafeHref` unit (javascript:/data: → false; /path, https://, mailto: → true).

## Задача 6 — CACHE-03: siteUrl() helper за metadataBase+sitemap
**Файлове:** нов helper (или в съществуващ lib), `src/app/layout.tsx:34`, `src/app/sitemap.ts:6`
- [ ] `siteUrl()` = `process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://frizmo-shops.vercel.app"` (без trailing /). Ползвай в layout metadataBase + sitemap BASE (както feed.xml/email вече правят).
- [ ] Провери дали има вече такъв helper (email.ts/feed.xml) → реюз ако да.

## Задача 7 — A11Y-01: warning-600 контраст (light)
**Файл:** `src/styles/tokens.css:48`
- [ ] Затъмни light `--color-warning-600` до ≥4.5:1 върху surface-0 И surface-100 (напр. #8a5d0c). НЕ пипай dark override. Провери billing-panel + badge употребите.

## Задача 8 — A11Y-04: success-600 контраст (light)
**Файл:** `src/styles/tokens.css:47`
- [ ] Затъмни light `--color-success-600` от #2e7d4f до ~#2b7549 (≥4.5:1 върху brand-50). НЕ пипай dark.

## Задача 9 — A11Y-02: купон input достъпно име
**Файл:** `src/components/storefront/checkout-form.tsx:703`
- [ ] Добави `aria-label="Промо код"` на input-а.

## Задача 10 — A11Y-03: role=alert на грешки
**Файлове:** `review-form.tsx:116`, `question-form.tsx:67`, `stock-alert-form.tsx:69`, `ui/input.tsx:75`, `ui/textarea.tsx:54`
- [ ] Добави `role="alert"` на error `<p>` в петте файла.

## Задача 11 — A11Y-05: focus trap в Drawer + Modal
**Файлове:** `src/components/ui/drawer.tsx`, `src/components/ui/modal.tsx`, опц. нов `src/lib/use-focus-trap.ts`
- [ ] Tab focus trap по образеца на cart-drawer.tsx:87-102 (querySelectorAll focusable + wrap first/last при Tab/Shift+Tab). Идеално споделен хук `useFocusTrap(panelRef)`.

## Финал
- [ ] `pnpm check` зелен.
- [ ] Обнови audit доклад (поправени) + WORKLOG + памет.
- [ ] Питай за push.
