# PWA Install секция + инструкции — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing секция, която подканва към инсталиране на PWA, + цялоекранен modal с точни per-платформа/браузър инструкции.

**Architecture:** Чист детекционен модул (`pwa-platform.ts`, unit-тестван) захранва две marketing компоненти — секция (продава ползите) и modal (стъпките). Modal-ът преизползва `<Modal>`. Детекция по платформа+браузър, не версия; ръчен превключвател при грешна детекция.

**Tech Stack:** Next.js 16 (App Router), React client компоненти, Tailwind 4 (само токени), Vitest (unit).

**Спец:** `docs/superpowers/specs/2026-07-04-pwa-install-guide-design.md`

**Отклонение от спеца (съзнателно опростяване):** спецът предвиждаше native `beforeinstallprompt` бутон за Android Chrome/Desktop. Планът го **изпуска** — ръчни стъпки за всички. Причина: `beforeinstallprompt` е капризен (не се задейства надеждно, изисква глобален listener + eligibility критерии, различно поведение по браузър), а ръчните стъпки работят винаги и са по-прости. Native prompt-ът може да се добави post-MVP като подобрение, ако потребителят го поиска.

## Global Constraints

- UI текстове на български, типографски кавички „…“ (прав `"` в BG текст чупи JS/lint).
- Само дизайн токени от `tokens.css` — без inline hex/px. Публичните страници са само light.
- Tailwind 4 canonical класове: `z-100` не `z-[100]`, `bg-linear-to-b` не `bg-gradient-to-b`.
- Компонентите ползват `<Button>`, `<Icon>`, `<Modal>` от `src/components/ui` — без голи елементи.
- `"use client"` само при нужда (state/hooks/events). Компонент с hook = client.
- Touch targets ≥ 44px (`h-11`). ARIA на диалога. Mobile-first 375px.
- react-compiler гочи: setState синхронно в effect → `queueMicrotask`.
- Гейт преди commit: `pnpm check` (lint + unit + build).
- Емоджи НЕ се ползват в платформения UI — SVG икони от `<Icon>`.

---

### Task 1: Детекционен модул `pwa-platform.ts`

**Files:**
- Create: `src/lib/pwa-platform.ts`
- Test: `src/lib/pwa-platform.test.ts`

**Interfaces:**
- Produces:
  - `type OS = "ios" | "android" | "desktop"`
  - `type Browser = "safari" | "chrome" | "samsung" | "firefox" | "edge" | "other"`
  - `type Platform = { os: OS; browser: Browser; isStandalone: boolean }`
  - `detectPlatform(userAgent?: string, standalone?: boolean): Platform`
  - `type InstallStep = { text: string; icon?: import("@/components/ui").IconName }`
  - `type CanInstall = "manual" | "wrong-browser"`
  - `type InstallGuide = { deviceLabel: string; canInstall: CanInstall; steps: InstallStep[]; note?: string }`
  - `getInstallInstructions(os: OS, browser: Browser): InstallGuide`

- [ ] **Step 1: Write the failing test for detectPlatform**

```ts
// src/lib/pwa-platform.test.ts
import { describe, expect, it } from "vitest";
import { detectPlatform, getInstallInstructions } from "./pwa-platform";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  desktopEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
};

describe("detectPlatform", () => {
  it("iOS Safari", () => {
    const p = detectPlatform(UA.iosSafari, false);
    expect(p.os).toBe("ios");
    expect(p.browser).toBe("safari");
  });
  it("iOS Chrome (CriOS) → ios/chrome", () => {
    const p = detectPlatform(UA.iosChrome, false);
    expect(p.os).toBe("ios");
    expect(p.browser).toBe("chrome");
  });
  it("Android Chrome", () => {
    const p = detectPlatform(UA.androidChrome, false);
    expect(p.os).toBe("android");
    expect(p.browser).toBe("chrome");
  });
  it("Android Samsung Internet", () => {
    expect(detectPlatform(UA.androidSamsung, false).browser).toBe("samsung");
  });
  it("Android Firefox", () => {
    expect(detectPlatform(UA.androidFirefox, false).browser).toBe("firefox");
  });
  it("Desktop Chrome", () => {
    const p = detectPlatform(UA.desktopChrome, false);
    expect(p.os).toBe("desktop");
    expect(p.browser).toBe("chrome");
  });
  it("Desktop Edge", () => {
    expect(detectPlatform(UA.desktopEdge, false).browser).toBe("edge");
  });
  it("standalone флагът се пренася", () => {
    expect(detectPlatform(UA.iosSafari, true).isStandalone).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/pwa-platform.test.ts`
Expected: FAIL — „Cannot find module './pwa-platform'".

- [ ] **Step 3: Implement detectPlatform**

```ts
// src/lib/pwa-platform.ts
import type { IconName } from "@/components/ui";

export type OS = "ios" | "android" | "desktop";
export type Browser = "safari" | "chrome" | "samsung" | "firefox" | "edge" | "other";
export type Platform = { os: OS; browser: Browser; isStandalone: boolean };

/**
 * Разпознава платформа + браузър от userAgent. Аргументите позволяват тестване;
 * по подразбиране чете от navigator (клиент). Не разчита на версии — те са
 * ненадеждни и не менят install стъпките.
 */
export function detectPlatform(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  standalone?: boolean,
): Platform {
  const ua = userAgent.toLowerCase();
  const isStandalone =
    standalone ??
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true));

  let os: OS = "desktop";
  if (/iphone|ipad|ipod/.test(ua)) os = "ios";
  else if (/android/.test(ua)) os = "android";

  let browser: Browser = "other";
  if (os === "ios") {
    /* iOS: не-Safari браузърите се разпознават по crios/fxios/edgios. */
    if (/crios/.test(ua)) browser = "chrome";
    else if (/fxios/.test(ua)) browser = "firefox";
    else if (/edgios/.test(ua)) browser = "edge";
    else browser = "safari";
  } else if (os === "android") {
    if (/samsungbrowser/.test(ua)) browser = "samsung";
    else if (/firefox/.test(ua)) browser = "firefox";
    else browser = "chrome";
  } else {
    if (/edg\//.test(ua)) browser = "edge";
    else if (/firefox/.test(ua)) browser = "firefox";
    else if (/chrome/.test(ua)) browser = "chrome";
    else if (/safari/.test(ua)) browser = "safari";
  }

  return { os, browser, isStandalone: Boolean(isStandalone) };
}
```

- [ ] **Step 4: Run test to verify detectPlatform passes**

Run: `pnpm test -- src/lib/pwa-platform.test.ts`
Expected: `detectPlatform` тестовете PASS; `getInstallInstructions` тестове още липсват (ще добавим в Step 5).

- [ ] **Step 5: Write the failing test for getInstallInstructions**

Добави в `src/lib/pwa-platform.test.ts`:

```ts
describe("getInstallInstructions", () => {
  it("iOS Safari → manual, 3 стъпки", () => {
    const g = getInstallInstructions("ios", "safari");
    expect(g.canInstall).toBe("manual");
    expect(g.steps.length).toBe(3);
    expect(g.deviceLabel).toContain("iPhone");
  });
  it("iOS Chrome → wrong-browser с note", () => {
    const g = getInstallInstructions("ios", "chrome");
    expect(g.canInstall).toBe("wrong-browser");
    expect(g.note).toBeTruthy();
  });
  it("Android Chrome → manual стъпки", () => {
    const g = getInstallInstructions("android", "chrome");
    expect(g.canInstall).toBe("manual");
    expect(g.steps.length).toBeGreaterThan(0);
  });
  it("Android Samsung → manual", () => {
    expect(getInstallInstructions("android", "samsung").canInstall).toBe("manual");
  });
  it("Desktop Chrome → manual", () => {
    expect(getInstallInstructions("desktop", "chrome").canInstall).toBe("manual");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test -- src/lib/pwa-platform.test.ts`
Expected: FAIL — „getInstallInstructions is not a function".

- [ ] **Step 7: Implement getInstallInstructions**

Добави в `src/lib/pwa-platform.ts`:

```ts
export type InstallStep = { text: string; icon?: IconName };
export type CanInstall = "manual" | "wrong-browser";
export type InstallGuide = {
  deviceLabel: string;
  canInstall: CanInstall;
  steps: InstallStep[];
  note?: string;
};

/**
 * Точните install стъпки за дадена платформа+браузър. Чиста функция —
 * ползва се и от секцията, и от modal-а (ръчен превключвател подава os/browser).
 */
export function getInstallInstructions(os: OS, browser: Browser): InstallGuide {
  if (os === "ios") {
    if (browser !== "safari") {
      return {
        deviceLabel: "iPhone",
        canInstall: "wrong-browser",
        steps: [],
        note: "За да инсталираш на iPhone, отвори този сайт в Safari — другите браузъри на iPhone не позволяват добавяне към началния екран.",
      };
    }
    return {
      deviceLabel: "iPhone · Safari",
      canInstall: "manual",
      steps: [
        { text: "Тапни бутона „Сподели“ в лентата долу.", icon: "share" },
        { text: "Превърти и избери „Към началния екран“.", icon: "plus" },
        { text: "Тапни „Добави“ горе вдясно.", icon: "check" },
      ],
    };
  }

  if (os === "android") {
    if (browser === "samsung") {
      return {
        deviceLabel: "Android · Samsung Internet",
        canInstall: "manual",
        steps: [
          { text: "Отвори менюто (трите чертички долу).", icon: "menu" },
          { text: "Избери „Добави страницата към“ → „Начален екран“.", icon: "plus" },
          { text: "Потвърди с „Добави“.", icon: "check" },
        ],
      };
    }
    if (browser === "firefox") {
      return {
        deviceLabel: "Android · Firefox",
        canInstall: "manual",
        steps: [
          { text: "Отвори менюто (трите точки).", icon: "menu" },
          { text: "Избери „Инсталирай“.", icon: "plus" },
          { text: "Потвърди инсталирането.", icon: "check" },
        ],
      };
    }
    return {
      deviceLabel: "Android · Chrome",
      canInstall: "manual",
      steps: [
        { text: "Отвори менюто (трите точки горе вдясно).", icon: "menu" },
        { text: "Избери „Инсталирай приложението“.", icon: "plus" },
        { text: "Потвърди с „Инсталирай“.", icon: "check" },
      ],
    };
  }

  return {
    deviceLabel: "Компютър",
    canInstall: "manual",
    steps: [
      { text: "Погледни вдясно в адресната лента за иконата за инсталиране (⊕).", icon: "plus" },
      { text: "Кликни я и избери „Инсталирай“.", icon: "check" },
    ],
    note: "Ако не виждаш иконата, отвори менюто на браузъра → „Инсталирай Frizmo Shops“.",
  };
}
```

- [ ] **Step 8: Run test to verify all pass**

Run: `pnpm test -- src/lib/pwa-platform.test.ts`
Expected: PASS (всички describe блока).

- [ ] **Step 9: Commit**

```bash
git add src/lib/pwa-platform.ts src/lib/pwa-platform.test.ts
git commit -m "feat(pwa): детекционен модул за install инструкции (платформа+браузър)"
```

---

### Task 2: Икона `share` в icon set

**Files:**
- Modify: `src/components/ui/icon.tsx`

**Interfaces:**
- Consumes: —
- Produces: нов ключ `"share"` в `IconName` (ползва се от Task 1 инструкциите и Task 4 modal).

- [ ] **Step 1: Добави share иконата**

В `src/components/ui/icon.tsx`, в обекта `ICON_PATHS`, добави преди затварящата `} as const;` (Lucide „share" пътища — iOS-style споделяне):

```ts
  /* Споделяне (iOS share sheet иконата — стрелка нагоре от кутия) */
  share: [
    "M12 2v13",
    "m8 6 4-4 4 4",
    "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7",
  ],
```

- [ ] **Step 2: Провери, че билдът приема иконата (typecheck)**

Run: `npx tsc --noEmit`
Expected: без грешки, свързани с `share`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/icon.tsx
git commit -m "feat(ui): share икона (за iOS install инструкции)"
```

---

### Task 3: Install guide modal

**Files:**
- Create: `src/components/marketing/install-guide-modal.tsx`

**Interfaces:**
- Consumes: `detectPlatform`, `getInstallInstructions`, `type OS` от `@/lib/pwa-platform`; `Modal`, `Button`, `Icon` от `@/components/ui`.
- Produces: `InstallGuideModal({ open, onClose }: { open: boolean; onClose: () => void })`.

- [ ] **Step 1: Създай modal компонента**

```tsx
// src/components/marketing/install-guide-modal.tsx
"use client";

import { useEffect, useState } from "react";
import {
  detectPlatform,
  getInstallInstructions,
  type OS,
} from "@/lib/pwa-platform";
import { Button, Icon, Modal } from "@/components/ui";

/* Ръчните избори за превключвателя „Друго устройство?". Браузърът се приема
   като най-честия за всяка платформа — точните стъпки не зависят силно от него
   при ръчен избор (iOS→safari е единственият път; android→chrome е мнозинството). */
const DEVICE_CHOICES: { os: OS; label: string }[] = [
  { os: "ios", label: "iPhone" },
  { os: "android", label: "Android" },
  { os: "desktop", label: "Компютър" },
];

export function InstallGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  /* Разпознатата платформа + ръчно избран override. null = още не е детектирано
     (сървър/първи render), за да няма hydration mismatch. */
  const [os, setOs] = useState<OS | null>(null);
  const [browser, setBrowser] = useState<import("@/lib/pwa-platform").Browser>("other");

  useEffect(() => {
    if (!open) return;
    const p = detectPlatform();
    /* setState синхронно в effect чупи react-compiler lint → queueMicrotask */
    queueMicrotask(() => {
      setOs(p.os);
      setBrowser(p.browser);
    });
  }, [open]);

  /* При ръчен избор ползваме дефолтен браузър за платформата. */
  function pickDevice(next: OS) {
    setOs(next);
    setBrowser(next === "ios" ? "safari" : next === "android" ? "chrome" : "chrome");
  }

  const guide = os ? getInstallInstructions(os, browser) : null;

  return (
    <Modal open={open} onClose={onClose} title="Инсталирай Frizmo Shops">
      {guide && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-ink-500">
            Изглежда използваш <span className="font-semibold text-ink-900">{guide.deviceLabel}</span>.
          </p>

          {guide.canInstall === "wrong-browser" ? (
            <p className="rounded-control border border-surface-200 bg-surface-50 p-4 text-sm text-ink-700">
              {guide.note}
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-sm font-extrabold text-brand-700">
                    {i + 1}
                  </span>
                  <span className="flex flex-1 items-center gap-2 pt-1 text-sm text-ink-900">
                    {step.icon && <Icon name={step.icon} size={16} className="shrink-0 text-ink-500" />}
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {guide.note && guide.canInstall !== "wrong-browser" && (
            <p className="text-xs text-ink-500">{guide.note}</p>
          )}

          {/* Ръчен превключвател — при грешна детекция */}
          <div className="border-t border-surface-200 pt-4">
            <p className="mb-2 text-xs font-medium text-ink-500">Друго устройство?</p>
            <div className="flex flex-wrap gap-2">
              {DEVICE_CHOICES.map((choice) => (
                <button
                  key={choice.os}
                  type="button"
                  onClick={() => pickDevice(choice.os)}
                  aria-pressed={os === choice.os}
                  className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
                    os === choice.os
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-surface-300 text-ink-700 hover:bg-surface-100"
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          <Button variant="secondary" onClick={onClose} className="w-full">
            Разбрах
          </Button>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Провери typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/marketing/install-guide-modal.tsx`
Expected: без грешки.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/install-guide-modal.tsx
git commit -m "feat(pwa): install guide modal с точни стъпки + ръчен превключвател"
```

---

### Task 4: Install секция в landing

**Files:**
- Create: `src/components/marketing/install-app-section.tsx`

**Interfaces:**
- Consumes: `InstallGuideModal` (Task 3); `detectPlatform` (за standalone гард); `Icon` от `@/components/ui`; `Reveal` от `@/components/marketing/reveal`.
- Produces: `InstallAppSection()` (default секция за landing).

- [ ] **Step 1: Създай секцията**

```tsx
// src/components/marketing/install-app-section.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { detectPlatform } from "@/lib/pwa-platform";
import { Icon } from "@/components/ui";
import { Reveal } from "@/components/marketing/reveal";
import { InstallGuideModal } from "./install-guide-modal";

const BENEFITS: { icon: import("@/components/ui").IconName; title: string; text: string }[] = [
  { icon: "rocket", title: "Мигновено", text: "Отваря се като истинско приложение — без адресна лента, без браузър." },
  { icon: "bell", title: "Известия", text: "Веднага научаваш за нова поръчка, дори когато не си в сайта." },
  { icon: "store", title: "Икона на екрана", text: "Един тап от началния екран — без да търсиш линк всеки път." },
];

export function InstallAppSection() {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    /* setState синхронно в effect чупи react-compiler lint → queueMicrotask */
    queueMicrotask(() => setInstalled(p.isStandalone));
  }, []);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-24">
      <Reveal>
        <div className="grid items-center gap-12 rounded-card border border-surface-200 bg-surface-0 p-8 shadow-card md:grid-cols-[1.1fr_0.9fr] md:p-12">
          {/* Текст + ползи */}
          <div className="flex flex-col items-start gap-6">
            <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
              <span className="shrink-0">Приложение</span>
              <span aria-hidden className="h-px w-16 bg-surface-200" />
            </p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
              Frizmo винаги под ръка
            </h2>
            <p className="max-w-lg text-lg leading-relaxed text-ink-700">
              Добави Frizmo Shops на началния екран на телефона си — управлявай магазина
              и поръчките си като истинско приложение, за секунди.
            </p>
            <ul className="flex flex-col gap-4">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Icon name={b.icon} size={20} />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink-900">{b.title}</span>
                    <span className="block text-sm text-ink-500">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            {installed ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
                <Icon name="check" size={16} />
                Приложението вече е инсталирано
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-13 items-center gap-2 rounded-full bg-ink-900 px-7 text-base font-bold text-surface-0 shadow-card transition-transform hover:-translate-y-0.5"
              >
                Как да инсталирам
                <Icon name="chevron-down" size={18} className="-rotate-90" />
              </button>
            )}
          </div>

          {/* Визуал: телефон с иконата на приложението (home screen mock) */}
          <div className="flex justify-center">
            <div className="relative aspect-9/16 w-56 overflow-hidden rounded-[2.5rem] border-8 border-ink-900 bg-surface-50 shadow-float">
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                <Image
                  src="/logo-mark.png"
                  alt="Иконата на Frizmo Shops"
                  width={72}
                  height={72}
                  className="rounded-[22%] shadow-card"
                />
                <span className="font-display text-base font-extrabold tracking-tight text-ink-900">
                  Frizmo <span className="text-ember-500">Shops</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <InstallGuideModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
```

- [ ] **Step 2: Провери typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/marketing/install-app-section.tsx`
Expected: без грешки. (Ако lint се оплаче за `aspect-9/16` или `z-` → приложи canonical форма.)

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/install-app-section.tsx
git commit -m "feat(pwa): install секция за landing (ползи + телефон визуал + бутон)"
```

---

### Task 5: Вграждане в landing page

**Files:**
- Modify: `src/app/(marketing)/page.tsx`

**Interfaces:**
- Consumes: `InstallAppSection` (Task 4).

- [ ] **Step 1: Импортирай секцията**

В `src/app/(marketing)/page.tsx`, до другите marketing импорти (след ред `import { HeroStorefrontDemo } ...`), добави:

```tsx
import { InstallAppSection } from "@/components/marketing/install-app-section";
```

- [ ] **Step 2: Вгради секцията преди FAQ секцията**

Намери коментара `{/* FAQ — split: заглавие + контакт карта вляво, акордеон вдясно */}` и вмъкни ПРЕДИ него:

```tsx
      {/* Инсталирай като приложение (PWA) */}
      <section className="bg-surface-100/60">
        <InstallAppSection />
      </section>

```

- [ ] **Step 3: Провери билда**

Run: `pnpm build`
Expected: `✓ Compiled successfully`. Landing route се билдва без грешки.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat(pwa): вгради install секцията в landing"
```

---

### Task 6: Финален гейт + WORKLOG

**Files:**
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Пусни пълния гейт**

Run: `pnpm check`
Expected: lint чист, всички unit тестове PASS (включително новите pwa-platform), `✓ Compiled successfully`.

- [ ] **Step 2: Обнови WORKLOG**

В `docs/WORKLOG.md`, най-отгоре на „## Дневник (най-новото най-отгоре)", добави нов ред:

```md
- **2026-07-04** — **PWA install секция + инструкции modal.** Landing секция „Frizmo
  винаги под ръка" (ползи + телефон визуал + бутон „Как да инсталирам") → цялоекранен
  modal с точни per-платформа/браузър стъпки (`src/lib/pwa-platform.ts`, unit-тестван:
  iOS Safari/не-Safari, Android Chrome/Samsung/Firefox, Desktop). Ръчен превключвател
  при грешна детекция. Секция вместо банер — избягва overlap с cookie банера. Спец:
  `docs/superpowers/specs/2026-07-04-pwa-install-guide-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/WORKLOG.md
git commit -m "docs: WORKLOG — PWA install секция"
```

- [ ] **Step 4: Push на dev**

```bash
git push origin dev
```

(Push към `main` става само при изрична заявка от потребителя.)
