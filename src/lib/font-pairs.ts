import type { SiteSettings } from "@/schemas/site-settings";

export type FontPairId = SiteSettings["fontPair"];

interface FontPair {
  id: FontPairId;
  label: string;
  /** CSS стойност за --sf-font-heading (null = остави темата). */
  heading: string | null;
  /** CSS стойност за --sf-font-body (null = остави темата). */
  body: string | null;
}

/* Курирани двойки от вече заредените шрифтове (root layout, next/font).
   „theme" = дефолт (шрифтът на избраната тема); останалите override-ват. */
const SANS = "ui-sans-serif, sans-serif";
const SERIF = "Georgia, serif";

export const FONT_PAIRS: FontPair[] = [
  { id: "theme", label: "По темата", heading: null, body: null },
  {
    id: "editorial",
    label: "Editorial",
    heading: `var(--font-playfair), ${SERIF}`,
    body: `var(--font-inter), ${SANS}`,
  },
  {
    id: "modern",
    label: "Модерен",
    heading: `var(--font-space-grotesk), ${SANS}`,
    body: `var(--font-inter), ${SANS}`,
  },
  {
    id: "warm",
    label: "Топъл",
    heading: `var(--font-lora), ${SERIF}`,
    body: `var(--font-inter), ${SANS}`,
  },
  {
    id: "industrial",
    label: "Индустриален",
    heading: `var(--font-condensed), ${SANS}`,
    body: `var(--font-inter), ${SANS}`,
  },
  {
    id: "clean",
    label: "Изчистен",
    heading: `var(--font-onest), ${SANS}`,
    body: `var(--font-inter), ${SANS}`,
  },
];

const BY_ID = new Map(FONT_PAIRS.map((p) => [p.id, p]));

/**
 * Връща override за --sf-font-heading/-body при избрана двойка, или null за
 * „theme" (тогава остават стойностите на темата). Ползва се от themeStyle.
 */
export function fontPairVars(id: FontPairId): { heading: string; body: string } | null {
  const pair = BY_ID.get(id);
  if (!pair || !pair.heading || !pair.body) return null;
  return { heading: pair.heading, body: pair.body };
}
