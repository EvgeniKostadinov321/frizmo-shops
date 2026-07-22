import { describe, expect, it } from "vitest";
import { resolveReorderLine, type ReorderCandidate } from "./reorder-line";

const base: ReorderCandidate = {
  productId: "p1",
  variantKey: null,
  quantity: 2,
  productExists: true,
  productActive: true,
  stock: null,
};

describe("resolveReorderLine", () => {
  it("наличен продукт без лимит → пълно количество", () => {
    expect(resolveReorderLine(base)).toEqual({ productId: "p1", variantKey: null, quantity: 2 });
  });
  it("липсващ продукт → null (скип)", () => {
    expect(resolveReorderLine({ ...base, productExists: false })).toBeNull();
  });
  it("неактивен продукт → null", () => {
    expect(resolveReorderLine({ ...base, productActive: false })).toBeNull();
  });
  it("наличност 0 → null", () => {
    expect(resolveReorderLine({ ...base, stock: 0 })).toBeNull();
  });
  it("наличност под желаното → cap до наличността", () => {
    expect(resolveReorderLine({ ...base, stock: 1 })).toEqual({
      productId: "p1",
      variantKey: null,
      quantity: 1,
    });
  });
  it("ръчна изработка при stock=0 → НЕ се скипва (пълно количество)", () => {
    expect(resolveReorderLine({ ...base, stock: 0, madeToOrder: true })).toEqual({
      productId: "p1",
      variantKey: null,
      quantity: base.quantity,
    });
  });
});
