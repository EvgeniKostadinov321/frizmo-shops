import { cmToMm, toMilliQuantity } from "@/lib/money";

interface Cells {
  weight_grams: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  net_quantity: string;
  net_quantity_unit: string;
}

interface Measures {
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  netQuantityValue: number | null;
  netQuantityUnit: string | null;
}

const NET_UNITS = ["mg", "g", "kg", "ml", "l"];

/** Парсва измервателните CSV клетки на един ред. Празно → null; невалидно → грешка. */
export function parseCsvMeasures(
  c: Cells,
): { ok: true; values: Measures } | { ok: false; error: string } {
  let weightGrams: number | null = null;
  if (c.weight_grams.trim() !== "") {
    const w = Number(c.weight_grams.trim());
    if (!Number.isInteger(w) || w < 1 || w > 200_000) {
      return { ok: false, error: `невалидно тегло „${c.weight_grams}“` };
    }
    weightGrams = w;
  }

  function dim(raw: string, label: string): number | null | { error: string } {
    if (raw.trim() === "") return null;
    const mm = cmToMm(raw);
    if (mm === null || mm < 1 || mm > 5000) return { error: `невалиден размер (${label}) „${raw}“` };
    return mm;
  }
  const l = dim(c.length_cm, "дължина");
  if (l !== null && typeof l === "object") return { ok: false, error: l.error };
  const w = dim(c.width_cm, "ширина");
  if (w !== null && typeof w === "object") return { ok: false, error: w.error };
  const h = dim(c.height_cm, "височина");
  if (h !== null && typeof h === "object") return { ok: false, error: h.error };

  let netQuantityValue: number | null = null;
  let netQuantityUnit: string | null = null;
  if (c.net_quantity.trim() !== "") {
    const m = toMilliQuantity(c.net_quantity);
    const unit = c.net_quantity_unit.trim().toLowerCase();
    if (m === null || m <= 0 || !NET_UNITS.includes(unit)) {
      return { ok: false, error: `невалидно количество „${c.net_quantity} ${c.net_quantity_unit}“` };
    }
    netQuantityValue = m;
    netQuantityUnit = unit;
  }

  return {
    ok: true,
    values: {
      weightGrams,
      lengthMm: l,
      widthMm: w,
      heightMm: h,
      netQuantityValue,
      netQuantityUnit,
    },
  };
}
