import { describe, expect, it } from "vitest";
import { aggregateOrderWeight, resolveCodAmount } from "./courier-weight";

describe("aggregateOrderWeight", () => {
  it("сумира тегло × количество", () => {
    const weights = new Map([
      ["a", 500],
      ["b", 250],
    ]);
    const items = [
      { productId: "a", quantity: 2 },
      { productId: "b", quantity: 3 },
    ];
    expect(aggregateOrderWeight(items, weights, 300)).toBe(500 * 2 + 250 * 3);
  });

  it("продукт без тегло → fallback", () => {
    const weights = new Map<string, number | null>([["a", null]]);
    const items = [{ productId: "a", quantity: 2 }];
    expect(aggregateOrderWeight(items, weights, 300)).toBe(300 * 2);
  });

  it("непознат/липсващ productId → fallback", () => {
    const items = [{ productId: null, quantity: 1 }];
    expect(aggregateOrderWeight(items, new Map(), 300)).toBe(300);
  });

  it("празна поръчка → 0", () => {
    expect(aggregateOrderWeight([], new Map(), 300)).toBe(0);
  });
});

describe("resolveCodAmount", () => {
  it("cod → total", () => {
    expect(resolveCodAmount("cod", 11500)).toBe(11500);
  });
  it("bank_transfer → null", () => {
    expect(resolveCodAmount("bank_transfer", 11500)).toBe(null);
  });
  it("on_site → null", () => {
    expect(resolveCodAmount("on_site", 11500)).toBe(null);
  });
});
