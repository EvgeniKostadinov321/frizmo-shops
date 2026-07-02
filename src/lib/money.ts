/** Цените се съхраняват като integer евроцентове. Никога float в бизнес логика. */

export function toCents(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", frac = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
}

const eurFormatter = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  useGrouping: false,
});

export function formatPrice(cents: number): string {
  return eurFormatter.format(cents / 100);
}
