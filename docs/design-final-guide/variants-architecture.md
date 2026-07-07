# Архитектура на вариантите — 3 композиции на секция/елемент

Цел: всяка секция и всеки структурен елемент (header, footer) да има **3
варианта** — различни композиции, които споделят един и същ props контракт и
четат едни и същи `--sf-*` токени. Търговецът избира варианта в builder-а;
темата облича варианта с гласа си.

## Принципи (неотменими)

1. **Вариант ≠ тема.** Вариантът е композиция; темата е глас. Никакъв
   theme-specific `if` в компонент — темовите разлики минават САМО през токени.
2. **Общ контракт.** Трите варианта на една секция получават идентични props
   (`data`, `ctx`, `tone`) и връщат пълноценна секция. Смяната на вариант никога
   не губи данни.
3. **Всеки вариант е всесъдържателен**: работи с min и max съдържание (1 или
   100 продукта, празно подзаглавие, дълго заглавие, липсваща снимка),
   mobile-first на 375px, reduced-motion.
4. **Adaptive-by-count остава вътре във варианта** (напр. featured-products
   вариант 1 сам решава spotlight/асиметрия/карусел по броя).
5. Вариант 1 = сегашната имплементация (нищо не се пренаписва на ход).

## Файлова структура

Секциите с варианти стават папки:

```
src/components/storefront/sections/hero/
  index.tsx        ← dispatcher: чете data.variant → рендерира варианта
  shared.tsx       ← общи под-компоненти (Kicker, Cta, Watermark…)
  variant-1-split.tsx      → export HeroVariant1
  variant-2-full.tsx       → export HeroVariant2
  variant-3-editorial.tsx  → export HeroVariant3
```

Конвенция за име: `variant-{n}-{semantic}.tsx`, експорт `<Section>Variant{n}`.
Header/Footer аналогично: `src/components/storefront/header/variant-1-inline.tsx`…

## Схема и данни

- В Zod схемата на всяка секция: `variant: z.union([z.literal(1), z.literal(2),
  z.literal(3)]).default(1)` — старите записи без поле → вариант 1 (обратна
  съвместимост, без миграция).
- Изключение hero: то ВЕЧЕ има 3 композиции през `layout`
  (`split | full | slideshow`) — `layout` Е неговото variant поле; не се дублира.
- Header/Footer вариантът живее в `site_settings` на кореново ниво
  (`headerVariant`, `footerVariant`); сегашният `headerLayout: logo-center` се
  поглъща от вариантната система при имплементация.

## Рендериране

`renderSection` (sections/index.tsx) не се разраства със switch-ове по вариант —
всяка секция-папка сама диспечира в своя `index.tsx`:

```
const VARIANTS = { 1: HeroVariant1, 2: HeroVariant2, 3: HeroVariant3 } as const;
export function HeroSection({ data, ctx }) {
  const V = VARIANTS[data.variant]; return <V data={data} ctx={ctx} />;
}
```

## Builder UI

- В section-form: **визуален избор** — 3 мини-превюта (стилизирани SVG/CSS
  скици, не снимки), не dropdown с имена.
- Смяната е мигновена в live preview (draft механизмът вече работи).
- Подпис под всяко превю: 2–4 думи какво прави варианта различен.

## Инвентар: ИМПЛЕМЕНТИРАНИТЕ варианти (2026-07-06, ВСИЧКИ ✅ — 32 композиции)

| Секция/елемент | Вариант 1 | Вариант 2 | Вариант 3 |
|---|---|---|---|
| **Header** ✅ | inline: лого ляво, nav дясно, прозрачен→плаващ | split bar: лого център, nav симетрично отдвете | минимал: лого + бургер и на десктоп → страничен drawer с анимация |
| **Hero** ✅ | split 7/5: текст·арков прозорец + темова рамка (еталон Пулс) | poster: текст долу-ляво върху цяла снимка, двоен scrim, header overlay | statement: surface блок, накривена снимка-картичка с primary офсет, тонални кръгове, marquee |
| **Featured products** ✅ | адаптивен grid (spotlight/асиметрия 5/карусел 7+) | editorial: голяма снимка + номерирани hover редове; мобилно = swipe слайдър ⭐еталон | (идея: голям карусел с прогрес — вероятно ненужен) |
| **Category grid** ✅ | full-bleed мозайка по брой | номериран списък-меню + плаваща снимка (височина следва редовете) | — |
| **Promo banner** ✅ | „купон-билет": kicker + огромно заглавие + dashed билет с кода; диагонален scrim | (идея: marquee лента) | — |
| **Image-text** ✅ | разделени колони, снимка-картичка с темов подпис | застъпване: голяма снимка + текст-карта (grid overlap, НЕ absolute) | — |
| **Rich text** ✅ | центриран + drop cap (display буква в primary) | асиметричен spread: заглавие вляво (sticky), текст вдясно | — |
| **Trust badges** ✅ | плочки с икона в кръгче (+ surface wash) | тиха hairline лента: един ред, точки-разделители | — |
| **Gallery** ✅ | адаптивна мозайка (дует/masonry) + lightbox | филмова лента (ръчен swipe) | движеща се стена: 2 marquee реда в противоположни посоки, безшевен loop, hover пауза |
| **FAQ** ✅ | центриран акордеон с карти | spread: заглавие вляво (sticky), hairline редове с „+"→„×" | — |
| **Contact + map** ✅ | иконки-редове + карта + „Виж маршрут ↗" | панел върху картата (grid overlap) | визитка: огромен tel/mail, карта в свиваем блок |
| **Socials** ✅ | пилюли с име + kicker | плътна primary CTA лента | editorial hairline редове със стрелки |
| **Footer** ✅ | богат тъмен (колони + мета kicker + година) | минимален центриран (име, 1 nav ред, hairline) | — |

Announcement няма варианти (utility лента). Общо: **32 композиции**. Всички са
с „Изглед" Select (или visual picker за header/footer) в builder-а и `variant`
поле в схемата (default 1, старите записи без миграция).

## Статус и научени уроци (2026-07-05)

- ✅ **Header**: папка `header/` (shared + 3 варианта + dispatcher);
  `headerVariant: 1|2|3` в site_settings (поглъща стария `headerLayout` през
  preprocess); визуален picker с мини-скици в theme панела. Мобилното меню е
  страничен drawer през ПОРТАЛ в собствен body-контейнер (научено: fixed
  вътре в sticky+backdrop-blur header чупи позиционирането; overflow:hidden
  на <html> чупи sticky-то → скролът се заключва на ниво портал + компенсиран
  скролбар).
- ✅ **Hero**: `layout: split|poster|statement`, legacy стойности
  (full/slideshow/duo/frame) → preprocess, без миграция. Височина: layout-ът
  смята `--sf-chrome` (topbar + header само когато НЕ е overlay) →
  `min-h-[calc(100dvh-var(--sf-chrome))]` = точно един екран при всяка
  комбинация. Научено: подравняващият px-calc padding НИКОГА вътре в max-w
  кутия (изяжда я и текстът колабира дума по дума).
- ✅ **Всички секции** (вкл. trust badges, 2026-07-06): папка+dispatcher за големите
  (featured-products, category-grid, image-text, rich-text, testimonials, faq,
  contact-map), един файл с клонове за малките (gallery, socials, footer —
  споделено състояние/размер не оправдава папка).
- **Mobile принципът (⭐)**: интеракция, зависеща от hover/ширина, се
  ПРЕВЪПЛЪЩАВА на телефон (editorial → swipe слайдър), не се осакатява.
- **Плаващи панели = grid overlap** (`row-start-1` споделен ред), никога
  absolute — редът расте с по-високия елемент (responsive одит R3).
- **Двете featured секции на една страница** (демо) са в различни варианти
  (1-вата grid, 2-рата editorial) — без визуално повторение.
- Всяка нова композиция минава работния ред от README.md (skills → токени →
  9 теми/375px → `pnpm check`).
