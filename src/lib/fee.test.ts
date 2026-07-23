import { describe, it, expect } from "vitest";
import { feeCents, feeBaseCents, FEE_MIN_CENTS, FEE_CAP_CENTS } from "./fee";

describe("feeBaseCents", () => {
  it("вади отстъпката от subtotal", () => {
    expect(feeBaseCents({ subtotalCents: 2000, discountCents: 500 })).toBe(1500);
  });
  it("не пада под 0 при отстъпка > subtotal", () => {
    expect(feeBaseCents({ subtotalCents: 1000, discountCents: 1500 })).toBe(0);
  });
});

describe("feeCents", () => {
  it("прилага процента при средна база", () => {
    // 2000 * 0.05 = 100
    expect(feeCents(2000)).toBe(100);
  });
  it("вдига до минимума при малка база", () => {
    // 300 * 0.05 = 15 → под 30 → 30
    expect(feeCents(300)).toBe(FEE_MIN_CENTS);
  });
  it("реже до тавана при голяма база", () => {
    // 200000 * 0.05 = 10000 → над 5000 → 5000
    expect(feeCents(200000)).toBe(FEE_CAP_CENTS);
  });
  it("база 0 → такса 0 (не минимума)", () => {
    expect(feeCents(0)).toBe(0);
  });
  it("отрицателна база → 0", () => {
    expect(feeCents(-100)).toBe(0);
  });
  it("закръгля с round, не floor", () => {
    // 250 * 0.05 = 12.5 → round → 13, но под мин 30 → 30
    expect(feeCents(250)).toBe(FEE_MIN_CENTS);
    // 610 * 0.05 = 30.5 → round → 31 (над мин 30)
    expect(feeCents(610)).toBe(31);
  });
  it("монотонност: по-голяма база → по-голяма или равна такса", () => {
    let prev = 0;
    for (let base = 0; base <= 300000; base += 137) {
      const fee = feeCents(base);
      expect(fee).toBeGreaterThanOrEqual(prev);
      prev = fee;
    }
  });
  it("връща цели центове (integer)", () => {
    for (const base of [123, 999, 4567, 88888]) {
      expect(Number.isInteger(feeCents(base))).toBe(true);
    }
  });
});
