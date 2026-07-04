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
   **По желание — само ако ще пипаш маскот видеата:** `brew install ffmpeg` (не идва с
   `pnpm install`; нужен за обработка на пчела видеата — виж `docs/design/mascot-progress.md`).
   Готовите видео асети (`public/bee-wave.webm/.mp4`) са в git — ffmpeg трябва само за нови.
4. **НЕ пускай** `pnpm db:push` / seed скриптовете — Supabase базата е **облачна и обща**; от новата машина се свързваш към същата база. Setup-скриптовете (`setup-storage.mjs`, `setup-search.mjs`, `seed-demo-shops.mjs`) са еднократни и вече са изпълнени.
5. **Gate преди всеки commit:** `pnpm check` (lint + unit + build).

**Какво НЕ се пренася в rar/архив:** `node_modules/` (платформено-специфични; идват от `pnpm install`), `.next/` (билд кеш), `.git/` (идва от clone). Единственото ръчно нещо е `.env.local`.

---

## Текущо състояние (към commit `ced7e55`, 2026-07-04)

- **Клонове:** `dev` = preview · `main` = production (двата синхронизирани на `ced7e55`). Push към `main` само при изрична заявка от потребителя.
- **Deploy:** Vercel. ⚠️ В repo-то няма `vercel.json`/линкнат `.vercel` проект — трябва да се потвърди в Vercel dashboard, че production сочи `main`.
- **Планове 1–5 ✅** (MVP: фундамент, магазин/продукти, storefront, количка/поръчки, каталог/landing/блог/SEO).
- **План 6:** Фаза А (платформен /admin) ✅ · Фаза Б (Stripe абонаменти) — **чака старт по изрична заявка**. Дотогава `getShopPlan()` (src/lib/plan.ts) е stub → всички магазини са "pro".

### Брандов маскот (нов, 2026-07-04)
Clay пчела, заключена като Magnific character асет (id 2001559). Първо приложение:
auth редизайн. Жив прогрес: `docs/design/mascot-progress.md`. Пости за нови пози
(onboarding празник, empty states, 404) — по желание при следваща сесия.

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

- Продължаване на секция-по-секция редизайн — **остана storefront `/s/{slug}`** (публичният магазин; той има собствена `--sf-*` тема, „Пазарен ден" НЕ важи там). Dashboard/onboarding/auth вече редизайнирани.
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

- **2026-07-04 · `9d8b8d4`** — **PWA splash / welcome анимация** (финализиран след
  тест на телефон: landing-мигане, статично видео на iOS, изрязване, lockup). Финалният
  вид: маскот видео в работилница + лого + „Frizmo **Shops**" (ember акцент) + „Старт"
  бутон; tap-to-skip; reduced-motion → статичен постер; iOS faststart фикс. Пълните
  детайли в записа по-долу + `docs/design/mascot-progress.md`.

- **2026-07-04** — **PWA splash / welcome анимация.** Нов `PwaSplash` компонент
  (`src/components/pwa-splash.tsx`), монтиран в root layout. Показва се САМО в standalone
  PWA (не в браузър таб — `display-mode: standalone` / iOS `navigator.standalone`), при
  всеки студен старт; **tap-to-skip** (клик затваря веднага), auto-dismiss при край на
  видеото или `MAX_MS=3.6s` предпазен таймер. Видео loop на маскота (Seedance 2.0, старт
  frame = одобрена работилница-сцена) + анимиран CSS wordmark „Frizmo Shops" (rise+fade)
  върху празното горе. **Звук:** тих по подразбиране (autoplay policy), пуска мелодийката
  на СЛЕДВАЩИЯ старт след първо взаимодействие (`localStorage frizmo-audio-ok`); fade-out
  при излизане. Reduced-motion → статичен постер вместо видео. iOS native splash преди
  React през `appleWebApp.startupImage`. Нови keyframes в globals.css (`splash-word`,
  `splash-out`). **Асети (Magnific, ~1.7MB общо в public/):** `splash-bee.mp4` (видео,
  1.4MB), `splash-bee-poster.jpg` (80KB, компресиран от 4.6MB PNG през headless Chromium
  — няма ffmpeg на тази машина), `splash-welcome.mp3` (240KB, ElevenLabs music v2, топла
  marimba). Сцена/постер = Nano Banana Pro 9:16 с `bee-wave.png` като референция (пчела-
  майстор в престилка). `pnpm check` зелен. Само dev (main по заявка).

- **2026-07-04** — **Мобилен UX за редактор на продукт (телефон тест 3).** `7d816ef`.
  ImageUploader: контролите триене/пренареждане винаги видими на тъч (не само hover),
  SVG икони; VariantsTable: mobile карти под md (таблицата не се събираше на 375px);
  OptionsEditor: SVG `x` вместо емоджи; ProductForm: футер бутоните в отделна карта.
  dev + main.

- **2026-07-04** — **Loading states + dashboard фиксове (телефон тест 2).** (1) Таблото:
  редът „последни поръчки" се чупеше на телефон (badge+сума извън контейнера) → преработен
  на 2-редов stack (номер+име горе, badge+дата долу, сума фиксирана вдясно `shrink-0`);
  `Badge` получи `shrink-0 whitespace-nowrap`. (2) Категории „премести нагоре/надолу"
  всъщност работеше (потвърдено в базата) — липсваше визуален feedback → сега spinner на
  бутона. (3+общо) **Loading states** навсякъде: `Button loading` вече замества съдържанието
  само със spinner (важи и за icon-only); per-item pending state в `categories-manager`
  (move), `fulfillment-manager` (eye toggle, `run(id, action)`), `product-list` (status
  toggle → opacity+disabled). (4) Навигация към страници без индикатор → добавени
  `loading.tsx` skeleton-и за **orders, orders/[id], categories, fulfillment**. `pnpm check`
  зелен (106 теста). Уебсайт билдър НЕ пипан.

- **2026-07-04** — **Dashboard мобилен UX пакет (6 проблема от тест на телефон).**
  (1) Мобилна навигация: `DashboardNav` → бутон „☰ текуща страница" отваря **fullscreen
  меню** (< md); десктоп = вертикална навигация. (2) Продукти/поръчки: **карти на
  мобилно** (`md:hidden`), таблица на десктоп (`hidden md:block`; `Table` вече приема
  className). (3+общо) **`ui/select.tsx` пренаписан като брандов custom dropdown**
  (панел като TimeSelect, затваря отвън/Escape, клавиатура, достъпен) — заменя грозния
  native select навсякъде вкл. iPhone. ⚠️ Запазен **event-съвместим API**
  (`onChange` подава `{target:{value}}`) → нито един от 11-те callers не се пипа;
  поддържа и controlled (dashboard) и uncontrolled `defaultValue`+`name` (каталог форми).
  6-те e2e `.selectOption()` мигрирани през нов `e2e/helpers.ts` (`selectOption` кликва
  тригер+опция). (4) Поръчки: pill филтри → dropdown (`OrderStatusFilter`); **6 фалшиви
  поръчки** (всички статуси) чрез `scripts/seed-my-orders.mjs`. (5+6) **Всички емоджи
  икони → SVG** (pencil/trash/arrow-up/down/eye/eye-off/image/receipt/palette в icon.tsx);
  `EmptyState.icon` вече е `IconName`, не емоджи. Стрелките в категории = „премести
  нагоре/надолу". `pnpm check` зелен (106 теста). Уебсайт билдър НЕ пипан (по заявка).

- **2026-07-04** — **Dashboard/onboarding UX пакет + slug втвърдяване + responsive фикс.**
  (1) Theme toggle: емоджи ☀️/🌙 → SVG икони (sun/moon в icon.tsx) с morph преход.
  (2) Onboarding: create вече е **3-стъпков wizard** (`shop-wizard.tsx`: Основно* →
  Контакти → Работно време; само стъпка 1 задължителна). Външният индикатор стана
  **progress лента** (`onboarding-progress.tsx`), вътрешен 3-точков в wizard-а.
  ⚠️ e2e/React гоча: клик на „Напред" насред re-render задействаше нативен submit →
  фикс с `onSubmit` guard (`if(!isLast) preventDefault`) + различни `key` на бутоните.
  (3) Работно време: опростено (Пон–Пет един ред + Съб + Нед) с toggle „Различно време
  по дни"; часовете са **24ч custom `<TimeSelect>`** (`ui/time-select.tsx`) вместо
  native `<input type=time>` (показваше AM/PM по локал). (4) Slug/URL: retry при
  UNIQUE race (`insertShopWithUniqueSlug`, Postgres 23505) + live preview на адреса на
  blur в onboarding + замразен URL показан read-only в edit. (5) Onboarding продуктова
  форма (simple): скрита „Категория" (още няма категории). (6) **Табло редизайн**:
  компактни `<StatTile>` KPI + „Последни поръчки" + „Следващи стъпки"; dashboard
  контейнер `max-w-6xl` → `max-w-7xl`. (7) Responsive одит на всички 8 dashboard
  страници на 375px (влязъл в реален магазин) → всички чисти, **освен таб „Уебсайт"**
  (грид не се свиваше) → фикс с `min-w-0` + theme picker `grid-cols-2 sm:grid-cols-3`.
  `pnpm check` зелен (105 теста), store-products e2e 2/2. Seed скрипт за личния магазин:
  `scripts/seed-my-shop.mjs` (таргет по slug + owner email проверка; НЕ пипа site_settings).

- **2026-07-04** — **Dashboard welcome + видео пчела + onboarding редизайн** (продължение
  на маскота). Празното табло → „момент на посрещане" (пчела + 3-стъпкова карта + CTA).
  Пчелата е видео loop в кръгъл медальон (Kling image→video, обработено с ffmpeg до
  ~90–150KB WebM/MP4). Onboarding редизайниран (маскот-водач + editorial progress).
  Всичко в light+dark, e2e селектори пазени. **Изисква ffmpeg** (инсталиран локално през
  brew — нужен и за бъдещи маскот видеа). Детайли: `docs/design/mascot-progress.md`.
  ⚠️ Ново решение: маскот видео пайплайн (Kling → ffmpeg изрязване → нативен loop);
  frame-by-frame и crossfade подходите отхвърлени. **НЕ commit-нато още.**

- **2026-07-04** — **Брандов маскот + auth редизайн.** Създаден маскот: clay пчела
  (идея „работлив като пчела" + занаятчийско ателие), теракота палитра, за системна
  употреба (auth, onboarding, empty states, грешки, имейли). **Заключен като Magnific
  character асет `frizmo-bee-mascot`, id 2001559** — консистентност през character
  референция вместо пресъздаване. Две пози в UI (`public/bee-wave.png` маха,
  `public/bee-peek.png` закрива очи). **Auth (login/register) цялостно редизайниран:**
  split екран (форма + брандов теракота панел с маскота), editorial типография,
  glow+noise; интеракция — фокус в паролата → пчелата закрива очи. e2e селектори
  запазени. `pnpm check` зелен (99/99 теста). Жив прогрес файл на маскота:
  **`docs/design/mascot-progress.md`** (чети него при продължаване). Style prompt:
  `docs/design/asset-prompts.md`; 2k оригинали: `docs/design/mascot-source/`.
  ⚠️ `mascot-refs/` (в корена на монорепото, извън frizmo-shops) е локална папка с
  изходните ChatGPT PNG-та — извън git. Пчелата е в Magnific акаунта (id 2001559),
  достъпна от всяка машина без локалния файл.

- **2026-07-04 · `ced7e55`** — Създаден `main` production branch (идентичен на `dev`). Обновени CLAUDE.md/roadmap/памет + този WORKLOG. Преди това: редизайн на `/shops`, `/products`, `/blog` (+ 3 нови блог статии), фикс dark mode да е само за dashboard/admin, rich OG image, PWA service worker глобално. Всичко на dev + main.
