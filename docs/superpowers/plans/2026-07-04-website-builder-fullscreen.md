# Уебсайт билдър full-screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Пренести редактора на storefront-а в собствен full-screen layout с табов панел и голямо живо preview; добави welcome модал; замени емоджитата с `<Icon>`.

**Architecture:** Нова route група `(builder)` със собствен layout (без dashboard chrome). URL остава `/dashboard/website`. Данните и мутациите не се пипат — чисто layout + UI.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 (токени в `tokens.css`), @dnd-kit (вече в проекта), съществуващи UI примитиви.

## Global Constraints

- UI текстове на български, типографски кавички „…" (прав `"` чупи lint/JS).
- Никакви емоджита в платформения UI — само `<Icon>` от `src/components/ui/icon.tsx`.
- Дизайн токени само (`brand-*`, `ink-*`, `surface-*`, `radius-*`); без inline hex/px.
- Dark mode през токени; никакви `dark:` варианти в компоненти.
- Touch targets ≥ 44px (`h-11`). Mobile-first (375px).
- Никакви голи `<button>`/`<input>` с класове — през UI компонентите.
- `pnpm check` (lint + unit + build) е гейт преди commit. PowerShell shell; multiline
  commit → temp файл + `git commit -F`.
- Мутациите (`saveSiteSettings`, `savePreviewDraft`, `publishShop`, `unpublishShop`,
  `setShopLogo`) и draft/live потокът остават непроменени.

---

### Task 1: Нови икони в icon.tsx

**Files:**
- Modify: `src/components/ui/icon.tsx` (обектът `ICON_PATHS`)

**Interfaces:**
- Produces: нови `IconName` стойности — `grip-vertical`, `monitor`, `smartphone`,
  `sparkles`, `layout-panel`, `megaphone`, `star`, `grid`, `tag`, `text`, `quote`,
  `shield-check`, `images`, `help-circle`, `map-pin`, `link`.

- [ ] **Step 1:** Добави следните записи в `ICON_PATHS` (Lucide-стил, 24 viewBox,
  stroke 2). Всяка стойност е масив от `d` string-ове:

```ts
  /* Дръжка за влачене (2×3 точки) */
  "grip-vertical": [
    "M9 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "M9 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    "M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "M15 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    "M15 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "M15 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  ],
  /* Монитор — десктоп preview */
  monitor: [
    "M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z",
    "M8 21h8", "M12 17v4",
  ],
  /* Смартфон — мобилен preview */
  smartphone: [
    "M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z",
    "M12 18h.01",
  ],
  /* Искри — done-for-you / магия */
  sparkles: [
    "M9.94 6.5 12 2l2.06 4.5L18 8.06l-4 3.44L15 16l-3-2-3 2 1-4.5-4-3.44Z",
    "M20 3v4", "M22 5h-4", "M4 17v2", "M5 18H3",
  ],
  /* Панел с голямо заглавие — hero */
  "layout-panel": [
    "M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Z",
    "M3 9h18",
  ],
  /* Мегафон — лента-съобщение */
  megaphone: [
    "m3 11 15-5v12L3 13v-2Z", "M11.6 16.8a3 3 0 1 1-5.8-1.6", "M18 8a3 3 0 0 1 0 6",
  ],
  /* Звезда — избрани продукти */
  star: [
    "M11.5 3.6a.6.6 0 0 1 1 0l2.2 4.5 4.9.7a.6.6 0 0 1 .3 1l-3.5 3.5.8 4.9a.6.6 0 0 1-.9.6L12 17l-4.4 2.3a.6.6 0 0 1-.9-.6l.8-4.9L4 10.3a.6.6 0 0 1 .3-1l4.9-.7Z",
  ],
  /* Решетка — категории */
  grid: [
    "M9 3H3v6h6V3Z", "M21 3h-6v6h6V3Z", "M21 15h-6v6h6v-6Z", "M9 15H3v6h6v-6Z",
  ],
  /* Етикет — промо банер */
  tag: [
    "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z",
    "M7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z",
  ],
  /* Текстови редове — текстов блок */
  text: ["M4 6h16", "M4 12h16", "M4 18h10"],
  /* Кавички — отзиви */
  quote: [
    "M3 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3",
    "M14 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3",
  ],
  /* Щит с отметка — доверие/badges */
  "shield-check": [
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z",
    "m9 12 2 2 4-4",
  ],
  /* Няколко снимки — галерия */
  images: [
    "M18 22H4a2 2 0 0 1-2-2V6", "M22 6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2Z",
    "M14.5 10.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "m22 14-3.5-3.5a1.5 1.5 0 0 0-2 0L11 16",
  ],
  /* Въпросителна в кръг — FAQ */
  "help-circle": [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
    "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01",
  ],
  /* Карфица — контакти и карта */
  "map-pin": [
    "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",
    "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  ],
  /* Верига — социални мрежи */
  link: [
    "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
    "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  ],
```

- [ ] **Step 2:** Провери типово — че `IconName` union-ът съдържа новите имена (авто
  от `keyof typeof ICON_PATHS`). Няма отделен тест; проверката е в build.

Run: `pnpm exec tsc --noEmit -p tsconfig.json` (само за уверение, че icon.tsx е валиден).
Expected: без нови грешки от icon.tsx (pre-existing грешки в contrast.test.ts са
несвързани — виж CLAUDE.md gotcha).

- [ ] **Step 3:** Commit

```bash
git add src/components/ui/icon.tsx
git commit -F <temp>   # "feat(icons): секционни + builder икони (grip, monitor, sparkles…)"
```

---

### Task 2: SECTION_DEFS.icon → IconName

**Files:**
- Modify: `src/lib/sections.ts`

**Interfaces:**
- Consumes: новите `IconName` от Task 1.
- Produces: `SectionDef.icon` вече е `IconName` (не `string`).

- [ ] **Step 1:** Смени import-а да включва типа:

```ts
import { type IconName } from "@/components/ui/icon";
```

- [ ] **Step 2:** Смени полето `icon` в `SectionDef` интерфейса:

```ts
interface SectionDef {
  label: string;
  icon: IconName;
  planTier: "starter" | "pro";
  defaultData: Record<string, unknown>;
}
```

- [ ] **Step 3:** Замени всяко емоджи в `SECTION_DEFS` с име:

```
hero: "layout-panel"          announcement: "megaphone"
featured-products: "star"     category-grid: "grid"
promo-banner: "tag"           image-text: "image"
rich-text: "text"             testimonials: "quote"
trust-badges: "shield-check"  gallery: "images"
faq: "help-circle"            contact-map: "map-pin"
socials: "link"
```

(Пример: `hero: { label: "Hero (голямо заглавие)", icon: "layout-panel", planTier: "starter", defaultData: {...} }`)

- [ ] **Step 4:** Провери build.

Run: `pnpm build`
Expected: build минава (грешки биха дошли от местата, ползващи `.icon` като текст —
поправят се в Task 3/4). Ако build гърми само там → продължи, ще се оправи. Иначе OK.

- [ ] **Step 5:** Commit (заедно с Task 3 и 4, ако build изисква — иначе самостоятелно).

---

### Task 3: SectionsList — икони вместо емоджита

**Files:**
- Modify: `src/components/dashboard/website/sections-list.tsx`

**Interfaces:**
- Consumes: `SECTION_DEFS[type].icon` (сега `IconName`), `<Icon>` от `@/components/ui`.

- [ ] **Step 1:** Добави `Icon` към import-а от `@/components/ui` (до `Button`).

- [ ] **Step 2:** В `SortableRow` замени дръжката `⠿`:

```tsx
      <button
        type="button"
        aria-label="Премести секцията"
        className="cursor-grab touch-none px-1 text-ink-500 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon name="grip-vertical" size={18} />
      </button>
```

- [ ] **Step 3:** Замени секционната икона `<span aria-hidden>{def.icon}</span>`:

```tsx
      <Icon name={def.icon} size={18} className="shrink-0 text-ink-500" />
```

- [ ] **Step 4:** Замени toggle бутона (`👁`/`🚫`):

```tsx
      <Button
        variant="ghost" size="sm"
        aria-label={section.enabled ? "Скрий секцията" : "Покажи секцията"}
        title={section.enabled ? "Скрий" : "Покажи"}
        onClick={onToggle}
      >
        <Icon name={section.enabled ? "eye" : "eye-off"} size={16} />
      </Button>
```

- [ ] **Step 5:** Замени редакция (`✎` → `pencil`) и премахни (`✕` → `x`):

```tsx
      <Button variant="ghost" size="sm" aria-label="Редактирай" onClick={onEdit}>
        <Icon name="pencil" size={16} />
      </Button>
      <Button variant="ghost" size="sm" aria-label="Премахни" onClick={onRemove}>
        <Icon name="x" size={16} />
      </Button>
```

- [ ] **Step 6:** Провери build.

Run: `pnpm build`
Expected: няма грешки от sections-list.tsx.

---

### Task 4: SectionForm — икони + чист picker

**Files:**
- Modify: `src/components/dashboard/website/section-form.tsx`
- Modify: `src/components/dashboard/website/editor.tsx` (section picker бутоните)

**Interfaces:**
- Consumes: `SECTION_DEFS[type].icon`, `<Icon>`.

- [ ] **Step 1:** В `section-form.tsx` добави `Icon` към import-а от `@/components/ui`.

- [ ] **Step 2:** Замени `BADGE_LABELS` (махни емоджитата от текста):

```ts
const BADGE_LABELS: Record<(typeof TRUST_BADGE_ICONS)[number], string> = {
  truck: "Доставка",
  shield: "Сигурност",
  return: "Връщане",
  phone: "Поддръжка",
  leaf: "Натурално",
  star: "Качество",
};
```

- [ ] **Step 3:** В `RowsEditor` замени бутона за премахване на ред `✕`:

```tsx
          <Button variant="ghost" size="sm" aria-label="Премахни"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
            <Icon name="x" size={16} />
          </Button>
```

- [ ] **Step 4:** В `editor.tsx` замени section picker бутоните в Drawer-а — иконата
  `{SECTION_DEFS[type].icon}` вече е `IconName`:

```tsx
            <button
              key={type}
              type="button"
              onClick={() => addSection(type)}
              className="flex items-center gap-2 rounded-control border border-surface-200 p-3 text-left text-sm font-medium text-ink-900 transition-colors hover:border-brand-500 hover:bg-brand-50"
            >
              <Icon name={SECTION_DEFS[type].icon} size={18} className="shrink-0 text-ink-500" />
              {SECTION_DEFS[type].label}
            </button>
```

(добави `Icon` към import-а от `@/components/ui` в editor.tsx)

- [ ] **Step 5:** Провери build.

Run: `pnpm build`
Expected: build минава без грешки за emoji/icon.

- [ ] **Step 6:** Commit (Tasks 2–4 заедно)

```bash
git add src/lib/sections.ts src/components/dashboard/website/sections-list.tsx src/components/dashboard/website/section-form.tsx src/components/dashboard/website/editor.tsx
git commit -F <temp>   # "refactor(website): икони вместо емоджита в билдъра"
```

---

### Task 5: Modal close бутон → Icon

**Files:**
- Modify: `src/components/ui/modal.tsx`

- [ ] **Step 1:** Добави import: `import { Icon } from "./icon";`

- [ ] **Step 2:** Замени `✕` в close бутона:

```tsx
          <Icon name="x" size={20} />
```

- [ ] **Step 3:** Commit

```bash
git add src/components/ui/modal.tsx
git commit -F <temp>   # "refactor(ui): Modal close бутон ползва Icon"
```

---

### Task 6: Welcome intro модал

**Files:**
- Create: `src/components/dashboard/website/website-intro-modal.tsx`

**Interfaces:**
- Produces: `<WebsiteIntroModal />` (self-contained, без props).
- Consumes: `Modal`, `Button`, `Checkbox`, `Icon` от `@/components/ui`.

- [ ] **Step 1:** Създай компонента (паттерн от cookie-consent.tsx — `queueMicrotask`
  проверка на localStorage):

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, Icon, Modal } from "@/components/ui";

const INTRO_KEY = "frizmo-website-intro";
const SUPPORT_EMAIL = "supportfrizmo@gmail.com";

export function WebsiteIntroModal() {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !window.localStorage.getItem(INTRO_KEY)) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    if (dontShow) window.localStorage.setItem(INTRO_KEY, "1");
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="Добре дошъл в редактора на твоя сайт"
      footer={<Button onClick={dismiss}>Разбрах, да започваме</Button>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-3">
          <Icon name="monitor" size={22} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="font-semibold text-ink-900">
              Редакторът работи най-добре от компютър или лаптоп
            </p>
            <p className="mt-1 text-sm text-ink-600">
              За удобна и прецизна настройка препоръчваме голям екран. Редакторът
              работи и от телефон, но заради малкото пространство прегледът няма да
              изглежда 1:1 с истинския ти сайт.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Icon name="sparkles" size={22} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="font-semibold text-ink-900">Искаш готов сайт без усилия?</p>
            <p className="mt-1 text-sm text-ink-600">
              Свържи се с нас на{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-600 underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              и ще настроим целия ти сайт вместо теб — тема, секции, снимки и текстове.
            </p>
          </div>
        </div>

        <Checkbox
          label="Не показвай това повече"
          checked={dontShow}
          onChange={(e) => setDontShow(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2:** Провери build.

Run: `pnpm build`
Expected: минава.

- [ ] **Step 3:** Commit

```bash
git add src/components/dashboard/website/website-intro-modal.tsx
git commit -F <temp>   # "feat(website): welcome intro модал (десктоп + done-for-you)"
```

---

### Task 7: Full-screen layout обвивка (топ-бар + панел с табове)

**Files:**
- Modify: `src/components/dashboard/website/editor.tsx` (голям рефактор: split на
  топ-бар/панел с табове/preview зона)

**Interfaces:**
- Consumes: `WebsiteIntroModal` (Task 6), `<Icon>` (`monitor`), съществуващите
  `ThemePanel`, `SectionsList`, `SectionForm`, `WebsitePreview`, action-ите.

- [ ] **Step 1:** Рефактор на `WebsiteEditor` — добави таб state и разбий JSX-а на
  топ-бар (`h-14`, sticky), тяло (`flex-1 flex overflow-hidden`), панел (`w-full
  lg:w-[380px] shrink-0 overflow-y-auto`) с сегментиран контрол горе, и preview зона.
  Root: `flex h-full flex-col`. Табове: `"theme" | "sections" | "about" | "preview"`
  (последният само за мобилно). Точна структура:

```tsx
  const [tab, setTab] = useState<"theme" | "sections" | "about" | "preview">("sections");

  // ... запази handleSave/handlePublishToggle/handleLogoChange/addSection/update и
  //     live-preview useEffect-а непроменени ...

  return (
    <div className="flex h-full flex-col">
      {/* Топ-бар */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-surface-200 bg-surface-0 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-ink-900">
            <Icon name="chevron-down" size={18} className="rotate-90" />
            <span className="hidden sm:inline">Табло</span>
          </Link>
          <div className="h-5 w-px bg-surface-200" />
          <h1 className="truncate text-sm font-bold text-ink-900">{shop.name}</h1>
          <Badge tone={isPublished ? "success" : "neutral"}>
            {isPublished ? "Публикуван" : "Чернова"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
             className="hidden text-sm text-brand-600 hover:underline sm:inline">
            Отвори сайта ↗
          </a>
          <Button variant="secondary" size="sm" onClick={handlePublishToggle} loading={publishing}>
            {isPublished ? "Скрий" : "Публикувай"}
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
            Запази
          </Button>
        </div>
      </header>

      {/* Тяло */}
      <div className="flex min-h-0 flex-1">
        {/* Панел */}
        <aside className={`w-full flex-col border-r border-surface-200 bg-surface-50 lg:flex lg:w-[380px] lg:shrink-0 ${tab === "preview" ? "hidden lg:flex" : "flex"}`}>
          {/* Табове */}
          <div className="flex shrink-0 gap-1 border-b border-surface-200 p-2">
            {([["theme","Тема"],["sections","Секции"],["about","За нас"]] as const).map(([key,label]) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={`h-9 flex-1 rounded-control text-sm font-medium transition-colors ${tab === key ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-surface-100"}`}>
                {label}
              </button>
            ))}
            {/* Само мобилно: таб Преглед */}
            <button type="button" onClick={() => setTab("preview")}
              aria-pressed={tab === "preview"}
              className={`h-9 flex-1 rounded-control text-sm font-medium transition-colors lg:hidden ${tab === "preview" ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-surface-100"}`}>
              Преглед
            </button>
          </div>
          {/* Съдържание на таб */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "theme" && (/* ThemePanel + footerText Input + Лого Card — виж Step 2 */)}
            {tab === "sections" && (/* Секции header + SectionsList — виж Step 2 */)}
            {tab === "about" && (/* За нас Textarea + ImageUploader — виж Step 2 */)}
          </div>
        </aside>

        {/* Preview зона */}
        <div className={`min-w-0 flex-1 ${tab === "preview" ? "flex" : "hidden lg:flex"}`}>
          <WebsitePreview ref={previewRef} slug={shop.slug} />
        </div>
      </div>

      {/* SectionForm drawer + section picker Drawer + WebsiteIntroModal остават */}
    </div>
  );
```

- [ ] **Step 2:** Премести съдържанието на трите Card-а (Тема/цветове, Лого, Секции,
  За нас) от текущия layout в съответните таб блокове. Тема таб = ThemePanel +
  footerText Input + Лого ImageUploader. Секции таб = заглавие „Секции" + „+ Добави"
  бутон + SectionsList. За нас таб = Textarea + ImageUploader. (Съдържанието е
  идентично на днешното — само пренаредено; без нова логика.)

- [ ] **Step 3:** Добави import-и: `Link` от `next/link`, `Icon` от `@/components/ui`,
  `WebsiteIntroModal` от `./website-intro-modal`. Монтирай `<WebsiteIntroModal />`
  в JSX-а (в края, до Drawer-ите).

- [ ] **Step 4:** Обнови `WebsitePreview` да прави preview зоната full-height —
  контейнерът вече не е `hidden lg:flex` (родителят го контролира); iframe-ът да е
  `h-full`, а на мобилно (таб Преглед) също да се вижда. Виж Task 8.

- [ ] **Step 5:** Провери build.

Run: `pnpm build`
Expected: минава.

---

### Task 8: WebsitePreview — full-height + икони + мобилен режим

**Files:**
- Modify: `src/components/dashboard/website/preview.tsx`

- [ ] **Step 1:** Добави `Icon` към import-а.

- [ ] **Step 2:** Махни външния `hidden ... lg:flex` gate (родителят го контролира
  сега) — контейнерът става `flex h-full flex-col gap-2 p-3`. iframe-ът: премахни
  `h-[70vh]`, сложи `h-full`; обвий в `flex-1 min-h-0` контейнер за да заеме
  височината. Desktop = `w-full`, mobile = `w-97.5` (запазено).

- [ ] **Step 3:** Замени device toggle емоджитата:

```tsx
            <Button variant={device === "desktop" ? "secondary" : "ghost"} size="sm"
              aria-label="Десктоп изглед" aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}>
              <Icon name="monitor" size={16} />
            </Button>
            <Button variant={device === "mobile" ? "secondary" : "ghost"} size="sm"
              aria-label="Мобилен изглед" aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}>
              <Icon name="smartphone" size={16} />
            </Button>
```

- [ ] **Step 4:** Provери build.

Run: `pnpm build`
Expected: минава.

- [ ] **Step 5:** Commit (Tasks 7–8 заедно)

```bash
git add src/components/dashboard/website/editor.tsx src/components/dashboard/website/preview.tsx
git commit -F <temp>   # "feat(website): full-screen редактор с табов панел"
```

---

### Task 9: Route група (builder) + преместване на page

**Files:**
- Create: `src/app/(builder)/dashboard/website/layout.tsx`
- Create: `src/app/(builder)/dashboard/website/page.tsx` (преместен)
- Delete: `src/app/(dashboard)/dashboard/website/page.tsx`

**Interfaces:**
- Consumes: `WebsiteEditor` (Task 7), `requireShop` (вече прави redirect при липса
  на магазин — не е нужен допълнителен guard).

- [ ] **Step 1:** Създай `(builder)/dashboard/website/layout.tsx` — full-screen
  черупка (без dashboard header/sidebar). `requireShop()` guard не е нужен тук —
  page-ът вече го вика; layout-ът е чисто presentational:

```tsx
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden bg-surface-50">{children}</div>;
}
```

- [ ] **Step 2:** Премести съдържанието на текущия `page.tsx` в новото място
  (`(builder)/dashboard/website/page.tsx`) — идентично, без промени (той вече ползва
  `requireShop()`, зарежда settings/categories/products и рендерира `<WebsiteEditor>`).

- [ ] **Step 3:** Изтрий стария `src/app/(dashboard)/dashboard/website/page.tsx`.

- [ ] **Step 4:** Изчисти `.next` (stale route типове след преместване на route) и билд:

Run: `Remove-Item .next -Recurse -Force; pnpm build`
Expected: build минава; `/dashboard/website` работи от новата група.

- [ ] **Step 5:** `pnpm check` — пълен гейт.

Run: `pnpm check`
Expected: lint + unit + build зелени.

- [ ] **Step 6:** Commit

```bash
git add src/app/(builder) src/app/(dashboard)/dashboard/website
git commit -F <temp>   # "feat(website): изнеси редактора в собствена full-screen route група"
```

---

### Task 10: WORKLOG + финален check

**Files:**
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1:** Добави ред в „Дневник" (текущ commit + резюме: full-screen билдър,
  табов панел, welcome модал, икони вместо емоджита).

- [ ] **Step 2:** Финален `pnpm check`.

Run: `pnpm check`
Expected: зелено.

- [ ] **Step 3:** Commit WORKLOG.

```bash
git add docs/WORKLOG.md
git commit -F <temp>   # "docs(worklog): full-screen уебсайт билдър"
```

---

## Self-Review

- **Spec coverage:** пълен route (T9), топ-бар+панел табове (T7), preview full-height +
  мобилен таб (T8), welcome модал (T6), икони/емоджита (T1–T5). ✅
- **Placeholders:** таб-съдържанието в T7 Step 1 е маркирано като „виж Step 2" —
  Step 2 дава точна инструкция кое съдържание отива в кой таб (идентично на днешните
  Card-ове). Приемливо, понеже кодът е буквално преместване на съществуващ JSX.
- **Type consistency:** `SectionDef.icon: IconName` (T2) съвпада с употребите в
  sections-list/section-form/editor/picker (T3, T4). `IconName`-ите от T1 покриват
  всички референции.
- **Draft/мутации непроменени:** T7 изрично запазва `update`, `handleSave`,
  live-preview useEffect-а. ✅
