# Одит 2 — Accessibility (a11y)

> Прочети първо `README.md` в тази папка. Само откриване, без поправки. Стой в
> scope-а. 65%+ от storefront трафика е мобилен — реални купувачи.

## Мисия

Да докажеш, че **публичните магазини и формите им са използваеми за всеки** —
клавиатура, screen reader, достатъчен контраст на всичките 9 теми (вкл. тъмните),
touch targets ≥44px. Фокусът е storefront + checkout/contact/newsletter форми +
builder-ът като инструмент. Референции: `ui-ux-pro-max` (99 UX правила, приоритет
1 Accessibility) + `CLAUDE-frontend.md`.

## Контекст, който ТРЯБВА да прочетеш
- `CLAUDE-frontend.md` — токен система, компонентна библиотека, mobile-first.
- `src/styles/tokens.css` — цветовите токени + `[data-theme="dark"]`. Темите на
  storefront-а идват през `--sf-*` (виж `themeStyle()` / `src/lib/theme.ts` или
  подобен). Контрастът се съди по двойки токени, не по компонент.

## Задължителни точки (по приоритет 1→2→6 на ui-ux-pro-max)

### А. Форми (най-важно — тук се губят клиенти и се чупи SR)
`src/components/storefront/checkout-form.tsx`, `contact-form.tsx`,
`sections/newsletter.tsx`. За всяка:
- Видим `<label>` за всеки вход (не само placeholder)? `htmlFor`/`id` двойка?
- Грешките: до полето, с `role="alert"` / `aria-live`? Фокус върху първото
  невалидно поле след submit?
- Правилен `type`/`inputMode` (email/tel/number) за мобилна клавиатура?
- `autoComplete` + `name` за autofill (беше поправено — потвърди, че е навсякъде)?
- Required индикатори? Disabled/loading състояние на submit бутона?
- Honeypot полето скрито ли е достъпно (`aria-hidden` + off-screen, не само
  `display:none` ако разчита на tab)?

### Б. Клавиатура и фокус
- Интерактивни елементи достижими с Tab, видим focus ring (не премахнат)?
- `src/components/storefront/cart-drawer.tsx`, `gallery-lightbox.tsx`,
  `header/nav-overflow.tsx`, `variant-picker.tsx`, `carousel.tsx` — focus trap в
  drawer/lightbox? Escape затваря? Връща ли фокуса при затваряне?
- Клик-само елементи (div с onClick) без роля/tabindex/клавиш? = HIGH.

### В. Семантика и SR
- Icon-only бутони (`cart-button.tsx`, header навигация, close бутони) с
  `aria-label`? (Проектът ползва `<Icon>` не емоджи — потвърди.)
- Heading йерархия по страниците storefront (h1→h2, без прескачане)?
- Alt текст на снимки: `product-card.tsx`, hero варианти, gallery, `image-text` —
  смислен alt или `alt=""` за декоративни?
- Announcement/countdown: `aria-live` за динамична промяна?

### Г. Контраст на 9-те теми (обективно, по токени)
Провери двойките в `tokens.css` + `--sf-*` дефолти за всяка тема
(`classic, atelie, vitrina, puls, efir, oniks, signal, osnova, granit`):
- Текст върху фон ≥ 4.5:1 (голям текст ≥3:1)? Особено `puls` (беше неон-жълт
  проблем) и тъмните теми (`oniks`, `granit`?).
- Primary бутон текст върху primary фон?
- Плейсхолдъри/muted текст — не сиво-на-сиво под 4.5:1?
Не рендирай — сметни контраста от hex стойностите на токените.

### Д. Touch & motion
- Touch targets ≥44px (`h-11`) по бутони/линкове в storefront (mobile-first)?
- `prefers-reduced-motion` уважен там, където има движение (hero video,
  countdown, carousel, `Reveal`)? Video hero → постер (документирано, потвърди).

## Полезни grep-ове
- `onClick` върху `div`/`span` без `role` → клик-само елементи.
- `aria-label` покритие спрямо icon бутоните.
- `placeholder=` без съседен `<label>`.
- `motion-reduce:` / `prefers-reduced-motion` покритие.

## Извън обхват (1 ред)
Security, производителност (освен CLS ако се засече), SEO, естетическа преценка
(потребителят я прави сам). Dashboard/admin a11y — вторичен (не публичен), спомени
само CRIT.

## Изход
Обобщение по тежест → таблица (най-тежкото първо) → чеклист А–Д + таблица контраст
по 9-те теми (тема · двойка · съотношение · pass/fail).
