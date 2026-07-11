import { describe, expect, it } from "vitest";
import { COUPON_CODE_ALPHABET, generateCouponCode } from "./coupon-code";

describe("generateCouponCode", () => {
  it("има префикс, тире и 6 символа от безопасната азбука", () => {
    const code = generateCouponCode("WELCOME");
    expect(code).toMatch(/^WELCOME-[0-9A-Z]{6}$/);
    const suffix = code.split("-")[1]!;
    for (const ch of suffix) expect(COUPON_CODE_ALPHABET).toContain(ch);
  });

  it("не съдържа объркващи символи 0 O 1 I L", () => {
    expect(COUPON_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("uppercase префикс се запазва", () => {
    expect(generateCouponCode("REF")).toMatch(/^REF-/);
  });
});
