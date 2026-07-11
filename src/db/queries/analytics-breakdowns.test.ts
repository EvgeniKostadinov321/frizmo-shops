import { describe, expect, it } from "vitest";
import { maskPhone } from "./analytics-breakdowns";

describe("maskPhone", () => {
  it("маскира средата (запазва първи 4 + последни 2)", () => {
    expect(maskPhone("0877167172")).toBe("0877***72");
  });
  it("къс номер (≤6) → без маскиране", () => {
    expect(maskPhone("123")).toBe("123");
    expect(maskPhone("123456")).toBe("123456");
  });
  it("празен → празен", () => {
    expect(maskPhone("")).toBe("");
  });
});
