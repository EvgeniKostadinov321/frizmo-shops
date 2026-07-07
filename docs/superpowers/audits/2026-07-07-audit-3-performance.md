# Одит 3 — Performance & Core Web Vitals

> Прочети първо `README.md` в тази папка. Само откриване, без поправки. Стой в
> scope-а. Купувачите бягат при бавно — фокус върху публичните страници.

## Мисия

Да докажеш, че **публичните страници се зареждат бързо и стабилно**: без layout
shift (CLS), оптимизирани снимки, правилно кеширане/ISR с инвалидация, без
ненужен client JS, пагинация на списъците. Фокус: `(marketing)`, `(catalog)`,
`(storefront)`. Dashboard/admin са client-rendered без SEO — само груби CRIT.

## Контекст, който ТРЯБВА да прочетеш
- `CLAUDE-frontend.md` — раздел „Next.js App Router конвенции" + „Задължително за
  всяка UI задача" (next/image, пагинация, ISR/`revalidate*`).
- `AGENTS.md` — Next.js 16 разлики (това НЕ е Next.js от training data; чети
  `node_modules/next/dist/docs/` при съмнение за API).

## Задължителни точки

### А. Изображения (най-честият source на бавно + CLS)
- ВСЯКА снимка през `next/image`? Grep за голи `<img `. Storefront: hero варианти,
  `product-card.tsx`, gallery, `image-text`, `category-grid`, `promo-banner`.
- `width`/`height` или `aspect-ratio` зададени (иначе CLS)? `sizes` за
  responsive? `priority` само на hero (LCP), не навсякъде? `loading="lazy"` под
  прегъвката (next/image по подразбиране — потвърди, че hero не е lazy)?
- Supabase URL-и през `publicImageUrl()` — да, но проверявай `quality`/формат.

### Б. Кеширане / ISR / инвалидация
- Публичните route-ове (`(marketing)`, `(catalog)`, `(storefront)/s/[slug]` и
  под-страниците) — SSR/ISR с кеш? Има ли `revalidate` или са `force-dynamic`
  без причина (би убило кеша)?
- Мутациите извикват ли `revalidatePath`/`revalidateTag` за засегнатите публични
  страници? (напр. промяна на продукт/сайт настройки → инвалидира магазина).
  Grep `revalidatePath|revalidateTag` в `src/actions` спрямо кои страници пипат.
- Preview draft потокът (`savePreviewDraft` → postMessage) не бива да прави
  публичните страници динамични.

### В. Client JS бюджет
- `"use client"` само където има state/hooks/events? Grep броя `"use client"` в
  storefront секциите — секция, която е чисто презентационна, но е client, влачи
  ненужен JS към купувача.
- Тежки библиотеки (@dnd-kit, lightbox, carousel) — заредени ли са само където
  трябва (dynamic import / само в builder), не в публичния bundle?
- `recently-viewed.tsx`, `preview-listener.tsx` — client, но да не блокират.

### Г. Списъци и заявки
- Пагинация на всеки публичен списък (`(catalog)/shops`, `/products`, storefront
  `/products`, `/s/[slug]`)? Липсва → зарежда цялата таблица = HIGH.
- N+1 заявки в query функциите (цикъл, който прави заявка на итерация)?
- Търсенето (`pg_trgm` ILIKE) с индекс, не seq scan?

### Д. Шрифтове и critical path
- Шрифтовете (`next/font` — Sofia Sans + font-pairs) с `display: swap`? Само
  критичните preload-нати, не всяка вариация?
- `loading.tsx` покритие за async views (има за dashboard — публичните?). Но НЕ
  на CRUD страници с drawer (документиран гоч).

## Полезни grep-ове
- `<img ` → голи img извън next/image.
- `"use client"` в `src/components/storefront` → кои секции ненужно са client.
- `force-dynamic|revalidate` → кеш стратегия по route.
- `revalidatePath|revalidateTag` → покритие спрямо мутациите.

## Извън обхват (1 ред)
Security, a11y (освен CLS), SEO съдържание (метадата → одит 4/SEO), естетика.
Реални мрежови измервания (няма как без браузър — съди от кода: LCP кандидат,
CLS риск, bundle тежест).

## Изход
Обобщение по тежест → таблица (най-тежкото първо) → чеклист А–Д. Отбележи явно
кои са „потенциални" (без измерване) vs сигурни от кода.
