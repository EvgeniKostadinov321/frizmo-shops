import { describe, expect, it } from "vitest";
import { productValues } from "./product-values";
import { productSchema } from "@/schemas/product";

function values(extra: Record<string, unknown>) {
  const parsed = productSchema.parse({ name: "Продукт", price: "12,50", ...extra });
  return productValues(parsed, "shop-1");
}

describe("productValues — нови полета", () => {
  it("мапва тегло/размери/количество", () => {
    const v = values({
      weight: "750",
      length: "30",
      width: "20",
      height: "10",
      netQuantity: { value: "0,5", unit: "l" },
    });
    expect(v.weightGrams).toBe(750);
    expect(v.lengthMm).toBe(300);
    expect(v.widthMm).toBe(200);
    expect(v.heightMm).toBe(100);
    expect(v.netQuantityValue).toBe(500);
    expect(v.netQuantityUnit).toBe("l");
  });

  it("празни полета → всичките шест null", () => {
    const v = values({});
    expect(v.weightGrams).toBeNull();
    expect(v.lengthMm).toBeNull();
    expect(v.widthMm).toBeNull();
    expect(v.heightMm).toBeNull();
    expect(v.netQuantityValue).toBeNull();
    expect(v.netQuantityUnit).toBeNull();
  });
});
