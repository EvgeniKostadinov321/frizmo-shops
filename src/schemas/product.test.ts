import { describe, expect, it } from "vitest";
import { productSchema } from "./product";

/** База с всички задължителни полета — надграждаме я per-тест. */
const base = { name: "Продукт", price: "12,50" };

function parse(extra: Record<string, unknown>) {
  return productSchema.safeParse({ ...base, ...extra });
}

describe("productSchema — тегло", () => {
  it("валидно тегло минава", () => expect(parse({ weight: "4500" }).success).toBe(true));
  it("празно тегло минава (по избор)", () => expect(parse({ weight: "" }).success).toBe(true));
  it("липсващо тегло минава (default)", () => expect(parse({}).success).toBe(true));
  it("нула отпада", () => expect(parse({ weight: "0" }).success).toBe(false));
  it("над тавана отпада", () => expect(parse({ weight: "300000" }).success).toBe(false));
  it("текст отпада", () => expect(parse({ weight: "abc" }).success).toBe(false));
});

describe("productSchema — размери", () => {
  it("цял см минава", () => expect(parse({ length: "30" }).success).toBe(true));
  it("десетичен см минава", () => expect(parse({ length: "30,5" }).success).toBe(true));
  it("празно минава", () => expect(parse({ length: "" }).success).toBe(true));
  it("нула отпада (< 1мм)", () => expect(parse({ length: "0" }).success).toBe(false));
  it("над 500см отпада", () => expect(parse({ length: "600" }).success).toBe(false));
  it("текст отпада", () => expect(parse({ width: "abc" }).success).toBe(false));
});

describe("productSchema — количество", () => {
  it("валидно количество минава", () =>
    expect(parse({ netQuantity: { value: "0,5", unit: "l" } }).success).toBe(true));
  it("нулева стойност отпада", () =>
    expect(parse({ netQuantity: { value: "0", unit: "l" } }).success).toBe(false));
  it("невалидна единица отпада", () =>
    expect(parse({ netQuantity: { value: "1", unit: "xx" } }).success).toBe(false));
  it("null минава", () => expect(parse({ netQuantity: null }).success).toBe(true));
  it("липсващо минава (default null)", () => {
    const r = parse({});
    expect(r.success && r.data.netQuantity).toBeNull();
  });
});
