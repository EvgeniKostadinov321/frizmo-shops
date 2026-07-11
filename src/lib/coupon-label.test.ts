import { describe, expect, it } from "vitest";
import { welcomeCouponLabel } from "./coupon-label";

describe("welcomeCouponLabel", () => {
  it("percent → „−10%“", () => {
    expect(welcomeCouponLabel("percent", 10)).toBe("−10%");
  });
  it("fixed → форматирана сума с минус и знак €", () => {
    const label = welcomeCouponLabel("fixed", 500);
    expect(label.startsWith("−")).toBe(true);
    expect(label).toContain("5,00");
    expect(label).toContain("€");
  });
});
