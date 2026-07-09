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

/** Центове → стойност за формуляр ("1250" → "12,50"). Обратното на toCents. */
export function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Десетичен стринг (точка или запетая) → мащабиран integer (× factor), закръглен.
 * Симетрично на toCents, но факторът е параметър. null при празно/невалидно/отрицателно.
 * Позволява до 3 десетични знака (достатъчно за × 1000).
 */
export function parseScaled(input: string, factor: number): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * factor);
}

/** Количество: десетичен вход → стойност × 1000 (0.5 → 500). */
export function toMilliQuantity(s: string): number | null {
  return parseScaled(s, 1000);
}

/** Размер: см вход → милиметри (30 → 300; 30,5 → 305). */
export function cmToMm(s: string): number | null {
  return parseScaled(s, 10);
}

const NET_UNIT_LABELS: Record<string, string> = {
  mg: "мг",
  g: "г",
  kg: "кг",
  ml: "мл",
  l: "л",
};

/** Съхранена стойност (× 1000) + единица → BG стринг за показване („1,5 л“). */
export function formatNetQuantity(value: number, unit: string): string {
  const num = value / 1000;
  const text = Number.isInteger(num) ? String(num) : String(num).replace(".", ",");
  return `${text} ${NET_UNIT_LABELS[unit] ?? unit}`;
}

/** Обратно на parseScaled — съхранена стойност → стринг за <input> (точка, без „.0“). */
export function scaledToInput(value: number, factor: number): string {
  const num = value / factor;
  return Number.isInteger(num) ? String(num) : String(num);
}
