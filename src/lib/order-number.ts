/** "#0042" / "42" / " 42 " → 42. Невалиден (текст, ≤0, празно) → null. */
export function parseOrderNumber(input: string): number | null {
  const cleaned = input.trim().replace(/^#/, "").replace(/\s/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = parseInt(cleaned, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
