# Visual Pass 2 — премиум бранд, лого, икони, dark mode без неон

**Дата:** 2026-07-03 · **Статус:** одобрен от потребителя (обхват: цялостен visual pass; асети: SVG в кода + UI мокъпи; бранд: зелено, преработено)

## Проблем

1. **Dark mode неон** — `brand-600` в dark е ярко `#33c684` и се ползва за големи плътни повърхности (финален CTA), което изглежда неоново и непрофесионално.
2. **Емоджита като асети** — PAINS/FEATURES/BrowserMockup ползват емоджита; 🇧🇬 се рендерира като „BG" текст на Windows. FEATURES панелите са празни градиенти с гигантско емоджи.
3. **Лого „FS"** — placeholder квадрат в header + генерирани PWA икони.

## Решение

### 1. Палитра (tokens.css)
* Light: по-дълбоко „горско" зелено (`brand-600 → #0c6b41`), останалите стъпала съответно.
* Dark: изцяло нови стойности — приглушено, десатурирано зелено; без неон.
* Нови токени `--color-brand-surface` / `--color-brand-surface-ink` / `--color-brand-surface-muted` за големи плътни brand секции (CTA): плътно тъмнозелено в light, дълбоко тъмнозелено (не ярко) в dark. **Правило: ярък brand цвят никога върху голяма повърхност.**
* `src/lib/brand.ts` се синхронизира.

### 2. Лого
* `<Logo />` в `components/ui/logo.tsx`: SVG „store" знак (Lucide-стил, stroke 2) в закръглен brand квадрат + wordmark „Frizmo **Shops**". Props: `size`, `withWordmark`.
* Нов `src/app/icon.svg` (favicon) + регенерирани `public/icons/icon-192/512.png` от същия знак (Playwright screenshot на SVG).

### 3. Икони
* `<Icon name />` в `components/ui/icon.tsx` — вътрешен SVG set (Lucide paths): message-circle, camera, search, palette, bell, trending-up, check, chevron-down, store и др. Заменя всички емоджита в платформения UI (marketing, dashboard банери, not-found). Емоджитата в SECTION_DEFS picker-а остават (вътрешен избор на секции).
* 🇧🇬 → мини SVG знаме (три ленти) — рендерира се еднакво на всички OS.

### 4. Landing
* PAINS: SVG икони в тониран кръг.
* FEATURES: празните градиент панели стават мини UI мокъпи от продукта (тема редактор със swatch-ове; push „Нова поръчка" карта; каталожна карта) — HTML/SVG с токени, работят в light+dark.
* BrowserMockup: емоджи продуктите → SVG image placeholder-и.
* Финален CTA: `bg-brand-surface` + `text-brand-surface-ink`.

### 5. Консистентност
* `<Logo />` в marketing header/footer, dashboard header, auth страници.
* Преглед на всички платформени страници в light + dark.

## Гейт
`pnpm check` + пълен Playwright suite остават зелени (UI селектори не се пипат — само визуални класове и асети).
