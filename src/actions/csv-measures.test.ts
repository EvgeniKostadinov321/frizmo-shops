import { describe, expect, it } from "vitest";
import { parseCsvMeasures } from "./csv-measures";

describe("parseCsvMeasures", () => {
  it("празни клетки → всички null", () => {
    const r = parseCsvMeasures({ weight_grams: "", length_cm: "", width_cm: "", height_cm: "", net_quantity: "", net_quantity_unit: "" });
    expect(r).toEqual({
      ok: true,
      values: { weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, netQuantityValue: null, netQuantityUnit: null },
    });
  });

  it("валидни стойности", () => {
    const r = parseCsvMeasures({ weight_grams: "750", length_cm: "30", width_cm: "20", height_cm: "10", net_quantity: "0.5", net_quantity_unit: "l" });
    expect(r).toEqual({
      ok: true,
      values: { weightGrams: 750, lengthMm: 300, widthMm: 200, heightMm: 100, netQuantityValue: 500, netQuantityUnit: "l" },
    });
  });

  it("невалидно тегло → грешка", () => {
    const r = parseCsvMeasures({ weight_grams: "abc", length_cm: "", width_cm: "", height_cm: "", net_quantity: "", net_quantity_unit: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("тегло");
  });

  it("невалиден размер → грешка", () => {
    const r = parseCsvMeasures({ weight_grams: "", length_cm: "9999", width_cm: "", height_cm: "", net_quantity: "", net_quantity_unit: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("размер");
  });

  it("количество без валидна единица → грешка", () => {
    const r = parseCsvMeasures({ weight_grams: "", length_cm: "", width_cm: "", height_cm: "", net_quantity: "0.5", net_quantity_unit: "xx" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("количество");
  });
});
