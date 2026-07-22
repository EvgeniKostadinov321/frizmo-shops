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

  describe("chosenRole (контекстът побеждава hasShop)", () => {
    it("избор 'buyer' → /account ДОРИ да има магазин (dual-role)", () => {
      expect(resolvePostAuthPath(true, null, undefined, "buyer")).toBe("/account");
      expect(resolvePostAuthPath(true, "seller", undefined, "buyer")).toBe("/account");
    });
    it("избор 'buyer' с next → next, дори собственик", () => {
      expect(resolvePostAuthPath(true, null, "/s/shop/checkout", "buyer")).toBe("/s/shop/checkout");
    });
    it("избор 'seller' → /dashboard дори без магазин (нов продавач)", () => {
      expect(resolvePostAuthPath(false, null, undefined, "seller")).toBe("/dashboard");
      expect(resolvePostAuthPath(false, null, "/account", "seller")).toBe("/dashboard");
    });
    it("без явна роля → пада на hasShop/preferredRole (обратна съвместимост)", () => {
      expect(resolvePostAuthPath(true, null, undefined, undefined)).toBe("/dashboard");
      expect(resolvePostAuthPath(false, "buyer", undefined, undefined)).toBe("/account");
    });
    it("избор 'buyer' + open-redirect next → /account (гардът важи)", () => {
      expect(resolvePostAuthPath(true, null, "https://evil.com", "buyer")).toBe("/account");
    });
  });
});
