import { describe, expect, it } from "vitest";
import { resolvePostAuthPath } from "@/lib/auth-redirect";

describe("resolvePostAuthPath", () => {
  it("има магазин → dashboard", () => {
    expect(resolvePostAuthPath(true, null)).toBe("/dashboard");
  });
  it("продавач без магазин → dashboard", () => {
    expect(resolvePostAuthPath(false, "seller")).toBe("/dashboard");
  });
  it("купувач без магазин → /account (или валиден next)", () => {
    expect(resolvePostAuthPath(false, "buyer")).toBe("/account");
    expect(resolvePostAuthPath(false, "buyer", "/s/shop/checkout")).toBe("/s/shop/checkout");
  });
  it("непознат next се пренебрегва (open-redirect гард)", () => {
    expect(resolvePostAuthPath(false, "buyer", "https://evil.com")).toBe("/account");
  });
});
