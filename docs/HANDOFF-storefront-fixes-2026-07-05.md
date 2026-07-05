# HAND-OFF: Поправки на storefront темите (2026-07-05)

> **За следваща сесия.** Тази сесия имаше повтарящ се проблем с форматирането на
> някои Edit tool calls (изтичаха като текст вместо да се изпълнят). Затова работата
> е недовършена. Този документ описва точно докъде сме, какво остава и с готов код.

## Контекст — какво правим

Прегледахме визуално 9-те нови storefront теми с Playwright (`/s/{slug}` — виж
`docs/demo-shops-links.md`). Пълните находки: `docs/review-2026-07-05-storefront-themes.md`.
Screenshot-ите: `review-0*.jpeg` в корена (може да се трият след прегледа).

**Изводът от прегледа:** всичките 9 теми са естетически успешни (тъмните
Пулс/Оникс/Гранит работят перфектно). Проблемите са СПОДЕЛЕНИ код-проблеми в
storefront секциите, не в самите теми. Тази задача ги поправя.

## Намерените проблеми (по важност)

1. 🔴 **Емоджи в trust-badges** (🚚🛡️↩️📞🌿⭐) — всяка тема.
2. 🔴 **Емоджи в contact-map** (📍📞✉️) — всяка тема.
3. 🔴 **Announcement нечетим** при светъл primary (Пулс = неоново жълто + бял текст).
4. 🟡 **Placeholder за липсваща продуктова снимка** = 📦 емоджи `text-4xl`, изглежда
   счупен (малка кутия центрирана).
5. 🟡 **Още емоджи** из storefront: socials (📘📸), cart-button (🛒), cart-view
   (🛒📦🏷✕), variant-picker (📦🏷).

## СТАТУС — какво Е приложено (проверено с git/grep) ✅

Тези файлове са **вече модифицирани и коректни** (не ги пипай пак):

- **`src/components/ui/icon.tsx`** — добавени 5 нови икони: `truck`, `return`, `leaf`,
  `facebook`, `instagram`. (Проверено: редове 215–235.)
- **`src/components/storefront/sections/trust-badges.tsx`** — ГОТОВ. Емоджи ICONS map
  → `IconName` map; рендерира `<Icon name={...} className="text-(--sf-primary)" />`.
- **`src/components/storefront/sections/contact-map.tsx`** — ГОТОВ. 📍📞✉️ →
  `<Icon name="map-pin/phone/mail" />` с `flex items-center gap-2`.
- **`src/components/storefront/sections/announcement.tsx`** — ГОТОВ. Фонът вече е
  `bg-(--sf-text) text-(--sf-bg)` (гарантиран контраст на всяка тема, вместо
  `bg-(--sf-primary) text-white` което беше нечетимо при светъл primary).
- **`src/components/storefront/sections/socials.tsx`** — ГОТОВ. 📘📸 →
  `<Icon name="facebook/instagram" />`.
- **`src/components/storefront/product-card.tsx`** — ГОТОВ. 📦 placeholder →
  `<Icon name="image" size={40} className="text-(--sf-muted) opacity-40" />` върху
  `bg-(--sf-surface)`. Import добавен (ред 3).
- **`src/components/storefront/variant-picker.tsx`** — ЧАСТИЧНО. Само import добавен
  (`import { Icon } from "@/components/ui";` ред 16). Двата емоджи ОЩЕ НЕ са сменени.

## ОСТАВА да се направи (с готов код)

### A. variant-picker.tsx — 2 емоджи (import вече е там)

**A1. Placeholder 📦 (ред ~106).** Замени:
```tsx
            <span className="flex size-full items-center justify-center text-6xl" aria-hidden>
              📦
            </span>
```
с:
```tsx
            <span className="flex size-full items-center justify-center bg-(--sf-surface)" aria-hidden>
              <Icon name="image" size={56} className="text-(--sf-muted) opacity-40" />
            </span>
```

**A2. Deal badge 🏷 (ред ~185).** Замени:
```tsx
            🏷 Купи {deal.quantity} бр за общо {formatPrice(deal.totalPriceCents)}
```
с (махни само емоджито — иконата тук е по избор, най-просто е само текст):
```tsx
            Купи {deal.quantity} бр за общо {formatPrice(deal.totalPriceCents)}
```

### B. cart-view.tsx — 4 емоджи (🛒📦🏷✕)

Първо добави import (ако липсва — провери с `grep 'Icon' cart-view.tsx`):
```tsx
import { Icon } from "@/components/ui";
```

**B1. ред ~70 `🛒`** (празна количка, hero икона). Замени `🛒` с:
```tsx
<Icon name="store" size={40} className="text-(--sf-muted) opacity-50" />
```
(или подходяща — няма „cart" икона в set-а; `store` е близка. Алтернативно добави
нова „shopping-cart" икона в icon.tsx.)

**B2. ред ~120 `📦`** (line item placeholder). Замени `📦` с:
```tsx
<Icon name="image" size={24} className="text-(--sf-muted) opacity-40" />
```

**B3. ред ~133 `🏷`** (deal етикет). Махни емоджито:
```tsx
<p className="text-xs font-medium text-(--sf-accent)">{line.appliedDeal}</p>
```

**B4. ред ~175 `✕`** (премахни ред). Замени `✕` с:
```tsx
<Icon name="x" size={16} />
```

### C. cart-button.tsx — 1 емоджи (🛒 ред ~21)

Добави import `import { Icon } from "@/components/ui";`, замени `🛒` с:
```tsx
<Icon name="store" size={22} />
```
(или нова „shopping-cart" икона — виж по-долу.)

### D. (по избор, препоръчано) Нова икона „shopping-cart"

cart-button + cart-view празна количка биха изглеждали по-добре с истинска количка,
не `store`. Добави в `icon.tsx` ICON_PATHS (Lucide cart):
```tsx
  /* Пазарска количка */
  "shopping-cart": [
    "M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    "M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
  ],
```
После в B1/C ползвай `name="shopping-cart"`.

## СЛЕД поправките

1. Спри dev сървъра (той удря базата при build): намери PID на порт 3000, Stop-Process.
   (Гоча: dev натрупва DB конекции → build гърми с EMAXCONN ако не го спреш.)
2. `pnpm check` — трябва зелено (lint + 128 unit теста + build).
3. Провери визуално с Playwright че емоджитата ги няма (метод: navigate →
   scroll през цялата страница за lazy изображения → fullPage screenshot). Тъмната
   тема Пулс е добър тест за announcement контраста (`/s/puls-streetwear`).
4. Commit. Предложение за съобщение:
   ```
   fix(storefront): икони вместо емоджи в секциите + контраст на announcement

   Прегледът на 9-те теми (Playwright) намери споделени код-проблеми:
   - trust-badges/contact-map/socials/product-card/variant-picker/cart: емоджи → <Icon>
   - announcement: bg-(--sf-text) text-(--sf-bg) вместо bg-primary+бяло (нечетимо
     при светъл primary напр. неоновото жълто на Пулс)
   - product/variant placeholder: чист Icon fallback вместо счупена 📦 кутия
   +5 нови икони (truck, return, leaf, facebook, instagram) [+shopping-cart]
   ```

## ОСТАНАЛИ находки от прегледа (не в тази задача)

- 🟡 **Google Maps карта** изглеждаше празна в Playwright — вероятно бавно зареждане,
  провери в реален браузър дали работи (`src` е валиден Google embed).
- 🟢 **seed 404 снимки** — 5 снимки в Основа/Гранит/Класик са мъртви Unsplash id-та.
  Placeholder-ът вече е оправен (D по-горе), но за да са пълни: смени id-тата в
  `scripts/seed-demo-shops.mjs` и re-seed засегнатите (трий магазина първо).

## Възможна причина за Edit проблема

Edit-овете, които изтичаха, съдържаха JSX с емоджи + много специални символи
(`{`, `}`, `<`, `>`, `(--sf-*)`). Ако се повтори в новата сесия: прави Edit-овете
с по-малки/по-уникални `old_string` (по един ред), или чети файла и ползвай Write за
целия файл.
