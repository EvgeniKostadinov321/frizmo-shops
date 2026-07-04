# Демо магазини — линкове за тестване

9 демо магазина, по 1 за всяка storefront тема, всеки с **всичките 13 секции**
попълнени. Създадени от `node --env-file=.env.local scripts/seed-demo-shops.mjs`.

**Локално (dev):** префикс `http://localhost:3000`
**Прод (Vercel):** префикс `https://frizmo-shops.vercel.app` (след deploy)

| Тема | Тип | Магазин | Път |
|---|---|---|---|
| **Ателие** | топла светла | Ателие Глина | `/s/atelie-glina` |
| **Витрина** | изчистена светла | VITRINA | `/s/vitrina-moda` |
| **Пулс** | ТЪМНА смела | PULS | `/s/puls-streetwear` |
| **Ефир** | светла wellness | Ефир | `/s/efir-kozmetika` |
| **Оникс** | ТЪМНА premium | MAISON ONYX | `/s/oniks-luks` |
| **Сигнал** | студена структурирана | Сигнал Техника | `/s/signal-tehnika` |
| **Основа** | светла индустриална | ОСНОВА | `/s/osnova-stroiteli` |
| **Гранит** | ТЪМНА индустриална | ГРАНИТ | `/s/granit-instrumenti` |
| **Класик** | неутрална | Дом и Уют | `/s/klasik-za-doma` |

## Бързи локални линкове (за копиране)

- Ателие (топла): http://localhost:3000/s/atelie-glina
- Витрина (изчистена): http://localhost:3000/s/vitrina-moda
- Пулс (тъмна смела): http://localhost:3000/s/puls-streetwear
- Ефир (wellness): http://localhost:3000/s/efir-kozmetika
- Оникс (тъмна premium): http://localhost:3000/s/oniks-luks
- Сигнал (техника): http://localhost:3000/s/signal-tehnika
- Основа (индустриална): http://localhost:3000/s/osnova-stroiteli
- Гранит (тъмна индустриална): http://localhost:3000/s/granit-instrumenti
- Класик (неутрална): http://localhost:3000/s/klasik-za-doma

## Каталог (всички наведнъж)

- Магазини: http://localhost:3000/shops
- Продукти: http://localhost:3000/products

## Всеки магазин показва (за пълен визуален тест)

Начало (`/s/{slug}`): announcement · hero (split) · trust-badges · featured-products
(newest) · category-grid · promo-banner · image-text · featured-products (manual) ·
rich-text · gallery · testimonials · faq · contact-map · socials.

Други страници: `/s/{slug}/products` · `/s/{slug}/about` · `/s/{slug}/contact` ·
продукт `/s/{slug}/p/{product-slug}`.

## Бележки

- Няколко снимки в Основа/Гранит/Класик липсват (Unsplash rate-limit при seed) →
  показват placeholder. Пусни seed-а пак по-късно за да се допълнят (идемпотентен —
  трий засегнатия магазин първо, ако искаш нов опит).
- Демо акаунтите: `demo+{ниша}@frizmoshops.bg` (random парола, не за логин).
