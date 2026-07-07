# Изпълнени планове 1–6 — резюме

> Планове 1–5 и План 6 Фаза А са **завършени и в production**. Детайлните стъпкови
> планове бяха свити тук (2026-07-08 разчистване) — кодът е източникът на истина за
> имплементацията; тук пазим само какво беше построено и къде живее.

| План | Обхват | Резултат |
|------|--------|----------|
| **1 · Фундамент** | Next.js 16 + Supabase (auth/Postgres/Storage) + Drizzle + Tailwind 4, схема, auth wrapper-и, RLS, дизайн токени | ✅ done |
| **2 · Магазин и продукти** | Onboarding, dashboard, продукти (варианти/опции/характеристики/промоции), категории, снимки (Storage), fulfillment (доставка/плащане) | ✅ done |
| **3 · Публичен магазин** | Storefront `/s/{slug}`, продуктови страници, теми, SEO/JSON-LD | ✅ done |
| **4 · Количка и поръчки** | localStorage количка, guest checkout, pricing engine, транзакционни поръчки (FOR UPDATE), имейл/push известия | ✅ done |
| **5 · Каталог/Landing/Блог/SEO + визуален pass** | `/shops`, `/products` каталог, landing редизайн, блог, sitemap/robots/OG | ✅ done |
| **6 · Платформен админ + Stripe** | **Фаза А** (админ панел, модерация, GMV) ✅ done · **Фаза Б** (Stripe billing) ⏳ = M2 в post-audit roadmap-а | Фаза А done, Б чака |

**Оригиналните MVP решения:** спец `docs/superpowers/specs/2026-07-02-frizmo-shops-mvp-design.md`.
**Дизайн език:** `docs/superpowers/specs/2026-07-03-pazaren-den-design.md`.
**Какво следва:** `docs/superpowers/plans/2026-07-06-builder-roadmap.md` (builder) +
`docs/superpowers/plans/2026-07-07-post-audit-roadmap.md` (продуктови gap-ове).
