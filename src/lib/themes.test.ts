import { describe, expect, it } from "vitest";
import { BUSINESS_CATEGORIES } from "@/schemas/shop";
import { THEMES } from "@/schemas/site-settings";
import {
  CATEGORY_THEME_RECOMMENDATIONS,
  recommendedThemesFor,
  THEME_LABELS,
  THEME_META,
  THEME_PRESETS,
} from "./themes";

const REQUIRED_VARS = [
  "--sf-bg",
  "--sf-surface",
  "--sf-text",
  "--sf-muted",
  "--sf-border",
  "--sf-radius",
  "--sf-heading-weight",
  "--sf-font-heading",
  "--sf-font-body",
] as const;

describe("THEME_PRESETS", () => {
  it("има запис за всяка тема с всички --sf-* полета", () => {
    for (const t of THEMES) {
      const p = THEME_PRESETS[t];
      expect(p, `липсва preset за ${t}`).toBeDefined();
      for (const v of REQUIRED_VARS) expect(p[v], `${t} липсва ${v}`).toBeTruthy();
    }
  });

  it("има label за всяка тема", () => {
    for (const t of THEMES) expect(THEME_LABELS[t], `липсва label за ${t}`).toBeTruthy();
  });
});

describe("THEME_META", () => {
  it("има метаданни за всяка тема", () => {
    for (const t of THEMES) {
      expect(THEME_META[t], `липсва meta за ${t}`).toBeDefined();
      expect(THEME_META[t].tagline).toBeTruthy();
      expect(THEME_META[t].bestFor).toBeTruthy();
    }
  });

  it("маркира тъмните теми", () => {
    expect(THEME_META.oniks.isDark).toBe(true);
    expect(THEME_META.puls.isDark).toBe(true);
    expect(THEME_META.granit.isDark).toBe(true);
    expect(THEME_META.atelie.isDark).toBe(false);
  });
});

describe("CATEGORY_THEME_RECOMMENDATIONS", () => {
  it("всяка категория има ≥2 препоръки, всички валидни теми", () => {
    for (const c of BUSINESS_CATEGORIES) {
      const recs = CATEGORY_THEME_RECOMMENDATIONS[c];
      expect(recs, `липсва мапинг за ${c}`).toBeDefined();
      expect(recs.length).toBeGreaterThanOrEqual(2);
      for (const t of recs) expect(THEME_PRESETS[t], `${c} → невалидна тема ${t}`).toBeDefined();
    }
  });

  it("recommendedThemesFor връща fallback за непозната категория", () => {
    expect(recommendedThemesFor("несъществуваща").length).toBeGreaterThanOrEqual(2);
  });
});
