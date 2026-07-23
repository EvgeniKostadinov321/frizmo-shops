# Одитни поправки #4 (2026-07-24) — план

**Goal:** 10 находки от одит #4 (всички). Inline, `pnpm check`.

## Домейн клъстер (довърши CACHE-03 — 3 сестри на vercel.app хардкод)
1. **SEO-01** `robots.ts:10` → `sitemap: \`${siteUrl()}/sitemap.xml\``.
2. **EMAIL-01** `email.ts:108` → `${BASE_URL}/dashboard/orders`. + уеднакви email BASE_URL с siteUrl() (prod fallback да не е vercel.app директно — ползвай siteUrl()).
3. **SEO-04** `feed.xml/route.ts:8` → `siteUrl()` вместо ръчен env||fallback.

## Security headers
4. **SEC-HDR-01** `next.config.ts` → добави `async headers()`: X-Frame-Options DENY, CSP frame-ancestors 'none', X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, HSTS. (БЕЗ пълна script CSP — има inline anti-FOUC скриптове.)

## SEO
5. **SEO-02** `(marketing)/page.tsx:120` → махни `offers` (или price "0") от JSON-LD (безплатен модел).
6. **SEO-03** `(catalog)/products/page.tsx` + `shops/page.tsx` → `alternates: { canonical: "/products" }` / "/shops".

## Storage
7. **STG-02** `uploads.ts` → rate-limit на requestImageUpload (минимум; server size enforcement е по-голямо — rate-limit покрива abuse-а).
8. **STG-01** `products.ts` saveProduct update + `site-settings.ts` setShopLogo → best-effort изтриване на отпадналите файлове (diff стари−нови по shops/{id}/ префикс). Свържи или премахни dead `deleteProductImage`.
9. **STG-03** `site-settings.ts:40` findForeignImagePath → allowlist (path полета трябва да startsWith `shops/${shopId}/`).

## Cron
10. **SEC-HDR-02** нова `assertCronAuth(req)` helper с `crypto.timingSafeEqual` → 4-те cron route-а.

## Финал
- [ ] `pnpm check` зелен. Документация + push.
