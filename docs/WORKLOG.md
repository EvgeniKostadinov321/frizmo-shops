# WORKLOG — Frizmo Shops

> **Живият контекст файл.** Един източник на истината за „докъде сме стигнали", независимо от коя машина работим (личен PC, Mac мини, друга).
>
> **ПРАВИЛО ЗА CLAUDE:** Обновявай този файл в края на всяка работна сесия, в която има смислена промяна (нова функционалност, редизайн на секция, решение, промяна в deploy-а). Слагай нов ред най-отгоре в „Дневник" с дата и кратко резюме + текущия commit. Той се commit-ва заедно с кода → синхронизира се през git между всички машини.

---

## Как да продължа работа на нова машина (напр. Mac мини)

Избран подход: **git clone + пренос само на `.env.local`** (вариант А).

1. **Clone на repo-тата от GitHub** (кодът е там, синхронизиран):
   - Frizmo Shops: `EvgeniKostadinov321/frizmo-shops`
   - Saas (Frizmo booking): второто repo на потребителя
2. **Пренеси `.env.local`** — той НЕ е в git (и не трябва да е). Копирай го сигурно (password manager / rar с парола), не по чист имейл. Сложи го в корена на `frizmo-shop/`.
   Нужни ключове (виж и `CLAUDE.md`): Supabase URL/publishable/secret, `DATABASE_URL` (:6543, transaction pooler) / `DATABASE_URL_MIGRATIONS` (:5432, session pooler), `NEXT_PUBLIC_HERE_API_KEY`, `RESEND_API_KEY`, VAPID двойка + subject, `PLATFORM_ADMIN_EMAILS`.
3. **Инсталирай и стартирай:**
   ```bash
   pnpm install
   pnpm dev        # http://localhost:3000
   ```
4. **НЕ пускай** `pnpm db:push` / seed скриптовете — Supabase базата е **облачна и обща**; от новата машина се свързваш към същата база. Setup-скриптовете (`setup-storage.mjs`, `setup-search.mjs`, `seed-demo-shops.mjs`) са еднократни и вече са изпълнени.
5. **Gate преди всеки commit:** `pnpm check` (lint + unit + build).

**Какво НЕ се пренася в rar/архив:** `node_modules/` (платформено-специфични; идват от `pnpm install`), `.next/` (билд кеш), `.git/` (идва от clone). Единственото ръчно нещо е `.env.local`.

---

## Текущо състояние (към commit `ced7e55`, 2026-07-04)

- **Клонове:** `dev` = preview · `main` = production (двата синхронизирани на `ced7e55`). Push към `main` само при изрична заявка от потребителя.
- **Deploy:** Vercel. ⚠️ В repo-то няма `vercel.json`/линкнат `.vercel` проект — трябва да се потвърди в Vercel dashboard, че production сочи `main`.
- **Планове 1–5 ✅** (MVP: фундамент, магазин/продукти, storefront, количка/поръчки, каталог/landing/блог/SEO).
- **План 6:** Фаза А (платформен /admin) ✅ · Фаза Б (Stripe абонаменти) — **чака старт по изрична заявка**. Дотогава `getShopPlan()` (src/lib/plan.ts) е stub → всички магазини са "pro".

### Post-MVP визуален редизайн (в ход)
Спец: `docs/docs-03-07-2026/2026-07-03-visual-redesign-spec.md` · план: `docs/superpowers/plans/2026-07-03-landing-visual-redesign.md`

Ключови решения:
- **Бранд:** зелено → **теракота** (`brand-*` в `src/styles/tokens.css`). Градиентният акцент (теракота) е само върху акцентната дума в hero H1. Primary бутон = тъмен (`bg-ink-900`).
- **Тема:** публичните страници са **само светли**. Dark е само за `/dashboard` + `/admin` (anti-FOUC скриптът в `layout.tsx` е гейтнат по път; `ForceLightTheme` на marketing). ADR: `docs/decisions/2026-07-03-dark-mode.md`.
- **Цени:** 20 € (Starter) / 35 € (Pro). Trial 30 дни, без grace период. Източник: `src/lib/plans-content.ts`.
- **Асети:** логото (`public/logo-mark.png`) и CTA/OG снимките (`public/cta-workshop.webp`, `public/og-bg.jpg`) са AI-генерирани през Magnific.

Редизайнирани и качени секции:
- **Landing** (`src/app/(marketing)/page.tsx`): hero (профит-first, „Продавай повече."), before/after (болка), step visuals (как работи), feature bento, done-for-you сервиз (тел. +359877167007, имейл supportfrizmo@gmail.com), responsive header с мобилно меню, редизайниран footer (без BG флагове).
- **`/shops`** и **`/products`**: editorial hero зона, cover снимки на картите, сортиране, активни филтър-чипове, скрити тест-магазини (slug `test-`/`тест-`).
- **`/blog`** + статия: editorial списък с акцентна статия, 5 статии с категория/време за четене/TOC (табле със заглавия), поправени остарели цени в старите статии.
- Всичко проверено **responsive на 375px** (0 overflow на трите каталог/блог страници).

---

## Следващо (кандидати — уточни при следваща сесия)

- Продължаване на секция-по-секция редизайн (кои са останали: storefront `/s/{slug}`, dashboard, auth страници?).
- План 6 Фаза Б — Stripe абонаменти (само при изрична заявка).
- Проверка, че Vercel production е вързан към `main`.
- Пренасяне на живата документация и в Saas проекта (по желание).

---

## Работни правила (кратко — пълните са в CLAUDE.md)

- Inline изпълнение, без паралелни субагенти (пази usage лимита).
- UI текст на български, типографски кавички „…“ (прав `"` чупи JS/YAML).
- Валута EUR в integer центове.
- Дизайн токени, без хардкоднати стойности; reusable компоненти в `src/components/ui/`.
- Magnific генериране: единично, с план + одобрение + обосновка на модела преди всяко.
- Потребителят тества визуално сам; Claude прави `pnpm check` + commit.

---

## Дневник (най-новото най-отгоре)

- **2026-07-04 · `ced7e55`** — Създаден `main` production branch (идентичен на `dev`). Обновени CLAUDE.md/roadmap/памет + този WORKLOG. Преди това: редизайн на `/shops`, `/products`, `/blog` (+ 3 нови блог статии), фикс dark mode да е само за dashboard/admin, rich OG image, PWA service worker глобално. Всичко на dev + main.
