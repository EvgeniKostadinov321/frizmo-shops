import { describe, expect, it } from "vitest";

/** WCAG relative luminance — sRGB → linear → luminance. */
function luminance(hex: string): number {
  const rgb = hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const [r, g, b] = rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = luminance(hexA);
  const lumB = luminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Light palette pairs that MUST hit WCAG AA (4.5:1 body text, 3:1 large/UI). */
const LIGHT_PAIRS: { name: string; fg: string; bg: string; min: number }[] = [
  { name: "ink-900 on surface-50 (body text)", fg: "#1c2420", bg: "#faf8f5", min: 4.5 },
  { name: "ink-700 on surface-50 (soft text)", fg: "#4a544e", bg: "#faf8f5", min: 4.5 },
  { name: "brand-600 on surface-50 (links/accents)", fg: "#7f4712", bg: "#faf8f5", min: 4.5 },
  { name: "surface-50 on ink-900 (primary CTA button)", fg: "#faf8f5", bg: "#1c2420", min: 4.5 },
  { name: "white on brand-600 (badges)", fg: "#ffffff", bg: "#7f4712", min: 4.5 },
  { name: "ink-500 on surface-50 (metadata)", fg: "#616a64", bg: "#faf8f5", min: 4.5 },
  { name: "ink-500 on surface-100 (metadata on deep paper)", fg: "#616a64", bg: "#f2efea", min: 4.5 },
];

/** Dark palette pairs (dashboard dark mode) — same thresholds. */
const DARK_PAIRS: { name: string; fg: string; bg: string; min: number }[] = [
  { name: "ink-900 on surface-50 dark (body text)", fg: "#eae8e1", bg: "#151a17", min: 4.5 },
  { name: "ink-700 on surface-50 dark (soft text)", fg: "#a8b0a9", bg: "#151a17", min: 4.5 },
  { name: "brand-600 dark on surface-50 dark (links)", fg: "#e3ab6e", bg: "#151a17", min: 4.5 },
  { name: "ink-500 dark on surface-50 dark (metadata)", fg: "#8a948c", bg: "#151a17", min: 4.5 },
];

describe("token contrast ratios (WCAG AA)", () => {
  for (const pair of [...LIGHT_PAIRS, ...DARK_PAIRS]) {
    it(`${pair.name} >= ${pair.min}:1`, () => {
      expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
    });
  }
});
