import type { CSSProperties } from "react";
import type { BusinessCategory } from "@/schemas/shop";
import type { SiteSettings, ThemeId } from "@/schemas/site-settings";

/**
 * Темите на публичните магазини. Това Е дефиницията на темите (техният
 * "tokens.css") — единственото място със стойности за --sf-* променливите.
 * Storefront компонентите ползват само променливите; заглавията получават
 * шрифт/тежест от глобалното правило [data-storefront] в globals.css.
 */
export interface ThemeVars {
  "--sf-bg": string;
  "--sf-surface": string;
  "--sf-text": string;
  "--sf-muted": string;
  "--sf-border": string;
  "--sf-radius": string;
  "--sf-heading-weight": string;
  "--sf-font-heading": string;
  "--sf-font-body": string;
}

export const THEME_PRESETS: Record<ThemeId, ThemeVars> = {
  /* Изчистена, безвремева — за всеки бизнес */
  classic: {
    "--sf-bg": "#ffffff",
    "--sf-surface": "#f6f6f4",
    "--sf-text": "#1d1d1b",
    "--sf-muted": "#6d6d68",
    "--sf-border": "#e6e6e2",
    "--sf-radius": "0.375rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Ателие — топла светла, сериф: занаяти, храни артизан, за дома */
  atelie: {
    "--sf-bg": "#faf5ec",
    "--sf-surface": "#fffdf8",
    "--sf-text": "#33271a",
    "--sf-muted": "#80705c",
    "--sf-border": "#e9ddc9",
    "--sf-radius": "0.625rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-lora), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Витрина — изчистена светла, image-first: мода премиум, обувки */
  vitrina: {
    "--sf-bg": "#ffffff",
    "--sf-surface": "#fafafa",
    "--sf-text": "#111111",
    "--sf-muted": "#5b5b5b",
    "--sf-border": "#ececec",
    "--sf-radius": "0.125rem",
    "--sf-heading-weight": "800",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Пулс — ТЪМНА смела: streetwear, младежки брандове, аксесоари */
  puls: {
    "--sf-bg": "#111111",
    "--sf-surface": "#1a1a1a",
    "--sf-text": "#fafafa",
    "--sf-muted": "#a3a3a3",
    "--sf-border": "#2e2e2e",
    "--sf-radius": "0.25rem",
    "--sf-heading-weight": "800",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Ефир — светла wellness: козметика clean, натурална грижа, био */
  efir: {
    "--sf-bg": "#fdf1ef",
    "--sf-surface": "#fffafb",
    "--sf-text": "#5a3d47",
    "--sf-muted": "#9b7d86",
    "--sf-border": "#f0dfe4",
    "--sf-radius": "0.75rem",
    "--sf-heading-weight": "600",
    "--sf-font-heading": "var(--font-lora), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Оникс — ТЪМНА premium, display сериф: луксозна козметика, бижута */
  oniks: {
    "--sf-bg": "#14100c",
    "--sf-surface": "#1c1610",
    "--sf-text": "#f3ead9",
    "--sf-muted": "#9a8b72",
    "--sf-border": "#2e2519",
    "--sf-radius": "0.25rem",
    "--sf-heading-weight": "600",
    "--sf-font-heading": "var(--font-playfair), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Сигнал — студена структурирана, trust-focused: електроника, техника */
  signal: {
    "--sf-bg": "#f4f6f8",
    "--sf-surface": "#ffffff",
    "--sf-text": "#0f1b2a",
    "--sf-muted": "#5a6b7a",
    "--sf-border": "#dbe2e8",
    "--sf-radius": "0.375rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Основа — светла индустриална, кондензиран: строителни, за дома */
  osnova: {
    "--sf-bg": "#f5f2ee",
    "--sf-surface": "#ffffff",
    "--sf-text": "#211d18",
    "--sf-muted": "#6e665c",
    "--sf-border": "#e2ddd5",
    "--sf-radius": "0.1875rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-condensed), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Гранит — ТЪМНА индустриална, кондензиран: строителни, инструменти */
  granit: {
    "--sf-bg": "#1c1e21",
    "--sf-surface": "#2a2d31",
    "--sf-text": "#eef0f2",
    "--sf-muted": "#a2a8af",
    "--sf-border": "#3a3e43",
    "--sf-radius": "0.1875rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-condensed), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
};

export const THEME_LABELS: Record<ThemeId, string> = {
  classic: "Класическа",
  atelie: "Ателие",
  vitrina: "Витрина",
  puls: "Пулс",
  efir: "Ефир",
  oniks: "Оникс",
  signal: "Сигнал",
  osnova: "Основа",
  granit: "Гранит",
};

export interface ThemeMeta {
  /** Кратко усещане — за preview картата в setup wizard-а. */
  tagline: string;
  /** За кои магазини е подходяща. */
  bestFor: string;
  /** Тъмна тема (тъмен фон/светъл текст) — за групиране в UI. */
  isDark: boolean;
}

/** Метаданни на всяка тема — захранва preview картите в setup wizard-а. */
export const THEME_META: Record<ThemeId, ThemeMeta> = {
  classic: { tagline: "Изчистена и безвремева — за всеки бизнес.", bestFor: "Универсална", isDark: false },
  atelie: { tagline: "Топла и автентична — усеща се ръчният труд.", bestFor: "Ръчна изработка, храни, за дома", isDark: false },
  vitrina: { tagline: "Минимал, който оставя снимките да говорят.", bestFor: "Мода, обувки", isDark: false },
  puls: { tagline: "Смела и енергична — за младежки брандове.", bestFor: "Streetwear, аксесоари", isDark: true },
  efir: { tagline: "Нежна и чиста — wellness усещане.", bestFor: "Козметика, натурална грижа", isDark: false },
  oniks: { tagline: "Тъмен лукс със златен акцент.", bestFor: "Луксозна козметика, бижута", isDark: true },
  signal: { tagline: "Ясна и надеждна — фокус върху доверие.", bestFor: "Електроника, техника", isDark: false },
  osnova: { tagline: "Здрава и практична — за материали и инструменти.", bestFor: "Строителни, за дома", isDark: false },
  granit: { tagline: "Тъмна индустриална — професионално усещане.", bestFor: "Строителни, инструменти", isDark: true },
};

/**
 * Категория на бизнеса → 2–3 препоръчани теми (за setup wizard-а).
 * Изведено от проучването на реални магазини по вертикал
 * (docs/research/2026-07-05-ecommerce-design-research.md).
 */
export const CATEGORY_THEME_RECOMMENDATIONS: Record<BusinessCategory, ThemeId[]> = {
  "Дрехи и мода": ["vitrina", "puls", "oniks"],
  Обувки: ["vitrina", "puls"],
  "Храни и напитки": ["atelie", "efir"],
  Козметика: ["efir", "oniks"],
  "Ръчна изработка": ["atelie", "vitrina"],
  Електроника: ["signal", "vitrina"],
  "Строителни материали": ["osnova", "granit"],
  "За дома": ["atelie", "osnova", "vitrina"],
  Друго: ["classic", "vitrina"],
};

/** Препоръчани теми за категория; fallback за непозната стойност. */
export function recommendedThemesFor(category: string): ThemeId[] {
  return (
    (CATEGORY_THEME_RECOMMENDATIONS as Record<string, ThemeId[]>)[category] ?? [
      "classic",
      "vitrina",
    ]
  );
}

/** Курирани цветови комбинации за theme панела (primary + accent). */
export const PALETTE_PRESETS = [
  { name: "Гора", primary: "#0e7c4a", accent: "#c98a1b" },
  { name: "Океан", primary: "#1d4ed8", accent: "#0e9488" },
  { name: "Теракота", primary: "#b4532a", accent: "#3f6212" },
  { name: "Слива", primary: "#7e2a8c", accent: "#be7c2c" },
  { name: "Въглен", primary: "#27272a", accent: "#dc2626" },
  { name: "Роза", primary: "#be2a5d", accent: "#4a7a6f" },
] as const;

export function themeStyle(
  settings: Pick<SiteSettings, "theme" | "primaryColor" | "accentColor">,
): CSSProperties {
  return {
    ...THEME_PRESETS[settings.theme],
    "--sf-primary": settings.primaryColor,
    "--sf-accent": settings.accentColor,
  } as CSSProperties;
}
