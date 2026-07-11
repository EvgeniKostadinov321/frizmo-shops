import { describe, expect, it } from "vitest";
import { isValidGtin } from "./gtin";

describe("isValidGtin", () => {
  it("приема валиден EAN-13", () => expect(isValidGtin("4006381333931")).toBe(true));
  it("приема валиден UPC-A (12)", () => expect(isValidGtin("036000291452")).toBe(true));
  it("приема валиден EAN-8", () => expect(isValidGtin("73513537")).toBe(true));
  it("приема валиден GTIN-14", () => expect(isValidGtin("10614141000415")).toBe(true));
  it("отхвърля грешна чексума", () => expect(isValidGtin("4006381333930")).toBe(false));
  it("отхвърля нецифри", () => expect(isValidGtin("abc")).toBe(false));
  it("отхвърля 7 цифри (грешна дължина)", () => expect(isValidGtin("1234567")).toBe(false));
  it("отхвърля празно", () => expect(isValidGtin("")).toBe(false));
  it("тримва интервали", () => expect(isValidGtin("  4006381333931  ")).toBe(true));
});
