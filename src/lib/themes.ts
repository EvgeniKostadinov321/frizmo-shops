import type { CSSProperties } from "react";
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
  /* Геометрична, смела — мода, техника, младежки бранд */
  modern: {
    "--sf-bg": "#fafafa",
    "--sf-surface": "#ffffff",
    "--sf-text": "#09090b",
    "--sf-muted": "#52525b",
    "--sf-border": "#d4d4d8",
    "--sf-radius": "1rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
  /* Серифна топлина — храни, ферми, занаяти */
  warm: {
    "--sf-bg": "#faf5ec",
    "--sf-surface": "#fffdf8",
    "--sf-text": "#33271a",
    "--sf-muted": "#80705c",
    "--sf-border": "#e9ddc9",
    "--sf-radius": "0.625rem",
    "--sf-heading-weight": "600",
    "--sf-font-heading": "var(--font-lora), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
  },
};

export const THEME_LABELS: Record<ThemeId, string> = {
  classic: "Класическа",
  modern: "Модерна",
  warm: "Топла",
};

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
