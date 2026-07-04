# PWA Install секция + инструкции — дизайн

**Дата:** 2026-07-04
**Статус:** одобрен, готов за план

## Цел

Помогни на посетителите на landing-а да инсталират Frizmo Shops като PWA на телефона си, с **точни per-платформа/браузър инструкции**. Реализира се като **секция в landing-а** (продава ползите) + **цялоекранен modal** с конкретните стъпки (не натрапчив банер — избягва overlap с cookie банера).

## Защо секция, не банер

Cookie банерът вече е `fixed bottom-0 z-50` (глобален). Втори долен банер би се сблъскал. Секция в landing-а: винаги видима, има място да изглежда добре, не прекъсва, нула overlap. Бутон „Как да инсталирам" отваря modal с детайлите.

## Ключово техническо решение: точност чрез детекция на браузър

Инструкциите за инсталиране се различават **по браузър**, не по версия на OS:

- iOS позволява install **само през Safari** (други браузъри на iOS не могат).
- Android има различни стъпки за Chrome / Samsung Internet / Firefox.
- Desktop Chrome/Edge инсталират през икона в адресната лента.

Версията на OS почти никога не мени стъпките, а `userAgent` версиите са ненадеждни (iOS крие версията). Затова детектираме **платформа + браузър**, не версия. Плюс **ръчен превключвател** в modal-а — ако детекцията сгреши, юзърът избира устройство сам.

## Архитектура (4 единици)

### 1. `src/lib/pwa-platform.ts` — детекция + инструкции (чист, тестван)

```
type OS = "ios" | "android" | "desktop";
type Browser = "safari" | "chrome" | "samsung" | "firefox" | "edge" | "other";
type Platform = { os: OS; browser: Browser; isStandalone: boolean };

detectPlatform(userAgent?: string): Platform
  // userAgent по подразбиране navigator.userAgent; параметърът е за тестове.
  // isStandalone: display-mode standalone ИЛИ navigator.standalone.

type InstallStep = { text: string; icon?: IconName };
type InstallGuide = { deviceLabel: string; canInstall: "prompt" | "manual" | "wrong-browser"; steps: InstallStep[]; note?: string };

getInstallInstructions(os: OS, browser: Browser): InstallGuide
  // Връща подходящите стъпки. Чиста функция (os+browser вход, без глобали).
```

Детекция (userAgent regex + feature detection):
- **iOS:** `/iphone|ipad|ipod/i`. Браузър: ако НЕ съдържа `crios|fxios|edgios` и е `safari` → Safari; иначе не-Safari (wrong-browser).
- **Android:** `/android/i`. Браузър: `samsungbrowser` → samsung; `firefox` → firefox; иначе chrome.
- **Desktop:** останалото. Браузър: `edg/` → edge; `firefox` → firefox; иначе chrome.

### 2. `src/components/marketing/install-app-section.tsx` — landing секция

„Пазарен ден" editorial стил (като `feature-bento` / `done-for-you`):
- Kicker: „ПРИЛОЖЕНИЕ" (`text-[11px] font-bold uppercase tracking-[0.24em]` + hairline)
- H2 свръх-едро: „Frizmo винаги под ръка" (font-display extrabold tracking-tight)
- 3 ползи (икони от `<Icon>` set):
  - Мигновено — отваря се като истинско приложение, без браузър
  - Известия — веднага научаваш за нова поръчка
  - Икона на екрана — един тап, без да търсиш линк
- Визуал: телефонен мокъп с иконата на приложението на „home screen" — рисуван с CSS (рамка на телефон + `logo-mark.png` иконата + етикет „Frizmo Shops" отдолу, като истинска app икона). Без нов асет.
- Бутон „Как да инсталирам" (primary тъмен `bg-ink-900`) → отваря modal
- `<Reveal>` scroll анимация (уважава reduced-motion)
- Ако вече standalone → „✓ Вече е инсталирано" вместо бутон

### 3. `src/components/marketing/install-guide-modal.tsx` — цялоекранен modal (client)

- Формат: преизползва съществуващия `<Modal>` (`src/components/ui/modal.tsx`) — fullscreen на мобилно, центриран панел на десктоп. Проверява се дали Modal поддържа тези нужди; ако не → леко разширение на Modal, не нов компонент.
- При отваряне: `detectPlatform()` → показва разпознатото („Изглежда използваш **iPhone · Safari**") + номерирани стъпки (display цифри, като onboarding) с икони.
- Android Chrome с `beforeinstallprompt`: голям **„Инсталирай"** бутон отгоре (native prompt с един клик). Event-ът се лови глобално и се пази в ref/state.
- Ръчен превключвател долу: „Друго устройство?" → чипове **iPhone · Android · Компютър** → сменя стъпките.
- Затваряне: X горе вдясно + клик извън панела + Escape + „Разбрах" долу.
- ARIA: `role="dialog"`, `aria-modal`, focus управление, touch targets ≥44px (`h-11`).

### 4. Интеграция

- Секцията се вгражда в `src/app/(marketing)/page.tsx` (близо до финалния CTA / преди footer).
- Само токени, само light (публичните страници са светли).

## Точните стъпки per платформа

| Платформа | canInstall | Стъпки |
|-----------|-----------|--------|
| iOS Safari | manual | 1) Тапни **Сподели** (↑ иконата долу) 2) Избери **„Към началния екран"** 3) Тапни **„Добави"** |
| iOS не-Safari | wrong-browser | note: „Отвори този сайт в **Safari** — други браузъри на iPhone не позволяват инсталиране." + копирай линка |
| Android Chrome | prompt (ако има event) / manual | prompt: бутон „Инсталирай". manual: Меню (⋮) → „Инсталирай приложението" |
| Android Samsung | manual | Меню → „Добави страницата към" → „Начален екран" |
| Android Firefox | manual | Меню (⋮) → „Инсталирай" |
| Desktop Chrome/Edge | prompt / manual | Икона ⊕ в адресната лента → „Инсталирай" |

Всяка стъпка = номер (display цифра) + текст + опц. SVG икона. iOS share иконата се рисува точно (хората я търсят визуално) — нова икона `share` в `icon.tsx`.

## Тестване

- **Unit** `src/lib/pwa-platform.test.ts` (Vitest): моква userAgent низове за всяка комбинация (iOS Safari, iOS Chrome, Android Chrome/Samsung/Firefox, Desktop Chrome/Edge/Firefox) → проверява `detectPlatform()` os/browser + `getInstallInstructions()` връща правилния `canInstall` и брой стъпки. Това е сърцето на точността.
- Естетика: потребителят я съди сам (не Playwright за визуал).
- Гейт: `pnpm check` (lint + unit + build).

## Извън обхвата (YAGNI)

- OS версия в детекцията (ненадеждна, не мени стъпките).
- Автоматичен банер/popup (изрично отхвърлен — секция вместо това).
- A/B тестване, аналитика на инсталациите (post-MVP).
- Промяна на cookie банера (остава както е).

## Нови/променени файлове

- Create: `src/lib/pwa-platform.ts`
- Create: `src/lib/pwa-platform.test.ts`
- Create: `src/components/marketing/install-app-section.tsx`
- Create: `src/components/marketing/install-guide-modal.tsx`
- Modify: `src/components/ui/icon.tsx` (нова икона `share`)
- Modify: `src/app/(marketing)/page.tsx` (вгражда секцията)
- Modify: `src/components/ui/index.ts` ако трябва barrel export
