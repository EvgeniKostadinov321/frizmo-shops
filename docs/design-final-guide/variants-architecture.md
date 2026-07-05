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

## Инвентар: посоки за вариант 2 и 3 (идеи, уточняват се при имплементация)

| Секция/елемент | Вариант 1 (сега) | Вариант 2 (идея) | Вариант 3 (идея) |
|---|---|---|---|
| **Header** ✅ | inline: лого ляво, nav дясно, прозрачен→плаващ | split bar: лого център, nav разделен симетрично отдвете (бутиков, един ред) | минимал: лого + бургер и на десктоп → страничен drawer (портал, не пипа header-а) |
| **Hero** ✅ | split 7/5: текст·арков прозорец + темова рамка (еталон Пулс) | poster: текст долу-ляво върху цяла снимка, двоен scrim, header overlay | statement: спокоен surface блок, накривена снимка-картичка с primary офсетна сянка, тонални кръгове, marquee лента |
| Featured products | адаптивен grid (spotlight/асиметрия/карусел) | editorial: 1 голям + списък с редове (име·цена) | пълен карусел с едри карти + прогрес |
| Category grid | full-bleed мозайка по брой | вертикални ленти (колони с hover разширяване) | номериран списък-меню (01 Керамика…, editorial) |
| Promo banner | плътен цвят/снимка + купон | тесен „лента" стил с маркe (текст в движение, motion-safe) | split: текст + продуктова снимка |
| Image-text | 50/50 ред | застъпени карти (снимка зад текст-карта) | пълна снимка + текст в плаващ панел |
| Rich text | една колона проза | две колони с инициал (drop cap) | тясна editorial колона + pull-quote |
| Testimonials | тъмна инверсия, grid с разделители | един голям цитат + карусел точки | карти върху surface с аватари/инициали |
| Trust badges | ред икони | тънка hairline лента (текст-only, letterspaced) | 2×2 карти с кратък текст |
| Gallery | masonry/duo + lightbox | филмова лента (хоризонтален скрол) | голяма снимка + тъмбнейл ред |
| FAQ | акордеон една колона | две колони (въпроси/отговори разгънати) | категоризиран акордеон с котви |
| Contact + map | info редове + карта 2/3 | карта full-bleed + плаващ инфо панел | само редове, карта в свиваем блок |
| Socials | ред икони с етикети | голям CTA блок „Последвай ни" | вертикална лента до footer-а |
| **Footer** | тъмна инверсия 4 колони | минимален: 1 ред, hairline, центриран | mega: колони + newsletter поле |

Announcement няма варианти (utility лента).

## Статус на имплементацията (2026-07-05)

- ✅ **Header**: папка `header/` (shared + 3 варианта + dispatcher);
  `headerVariant: 1|2|3` в site_settings (поглъща стария `headerLayout` през
  preprocess); визуален picker с мини-скици в theme панела. Мобилното меню е
  страничен drawer през ПОРТАЛ в собствен body-контейнер (научено: fixed
  вътре в sticky+backdrop-blur header чупи позиционирането; overflow:hidden
  на <html> чупи sticky-то → скролът се заключва на ниво портал + компенсиран
  скролбар).
- ✅ **Hero**: папка `sections/hero/` (shared + 3 варианта + dispatcher);
  `layout: split|poster|statement`, legacy стойности (full/slideshow/duo/frame)
  се пренасочват през preprocess — без миграция. Височина: layout-ът смята
  `--sf-chrome` (topbar 2.25rem + header 4.75rem само когато НЕ е overlay —
  header вариант 2 никога не е overlay) и вариантите ползват
  `min-h-[calc(100dvh-var(--sf-chrome))]` → точно един екран при всяка
  комбинация. Научено: подравняващият px-calc padding НИКОГА вътре в max-w
  кутия (на широк екран я изяжда и текстът колабира дума по дума).
- ⏭ Следващи: Featured products → Category grid → останалите от таблицата.
- Всяка нова композиция минава работния ред от README.md (skills → токени →
  9 теми/375px → `pnpm check`).
