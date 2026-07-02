import type { CSSProperties } from "react";
import type { SiteSettings, ThemeId } from "@/schemas/site-settings";

/**
 * Темите на публичните магазини. Това Е дефиницията на темите (техният
 * "tokens.css") — единственото място със стойности за --sf-* променливите.
 * Storefront компонентите ползват само променливите: bg-(--sf-bg) и т.н.
 */
export interface ThemeVars {
  "--sf-bg": string;
  "--sf-surface": string;
  "--sf-text": string;
  "--sf-muted": string;
  "--sf-border": string;
  "--sf-radius": string;
  "--sf-heading-weight": string;
}

export const THEME_PRESETS: Record<ThemeId, ThemeVars> = {
  classic: {
    "--sf-bg": "#ffffff",
    "--sf-surface": "#f7f7f7",
    "--sf-text": "#1c1c1c",
    "--sf-muted": "#6b6b6b",
    "--sf-border": "#e5e5e5",
    "--sf-radius": "0.5rem",
    "--sf-heading-weight": "700",
  },
  modern: {
    "--sf-bg": "#fafafa",
    "--sf-surface": "#ffffff",
    "--sf-text": "#111111",
    "--sf-muted": "#555555",
    "--sf-border": "#dddddd",
    "--sf-radius": "1rem",
    "--sf-heading-weight": "800",
  },
  warm: {
    "--sf-bg": "#fdf9f3",
    "--sf-surface": "#ffffff",
    "--sf-text": "#2b2115",
    "--sf-muted": "#7a6a55",
    "--sf-border": "#eadfce",
    "--sf-radius": "0.75rem",
    "--sf-heading-weight": "700",
  },
};

export const THEME_LABELS: Record<ThemeId, string> = {
  classic: "Класическа",
  modern: "Модерна",
  warm: "Топла",
};

export function themeStyle(
  settings: Pick<SiteSettings, "theme" | "primaryColor" | "accentColor">,
): CSSProperties {
  return {
    ...THEME_PRESETS[settings.theme],
    "--sf-primary": settings.primaryColor,
    "--sf-accent": settings.accentColor,
  } as CSSProperties;
}
