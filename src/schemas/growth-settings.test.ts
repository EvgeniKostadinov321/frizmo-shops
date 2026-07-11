import { describe, expect, it } from "vitest";
import { growthSettingsSchema } from "./growth-settings";

const base = {
  welcomeCouponEnabled: true,
  welcomeCouponType: "percent" as const,
  welcomeCouponValue: 15,
  welcomeCouponMinSubtotalCents: 0,
  referralEnabled: false,
  referralType: "percent" as const,
  referralValue: 10,
  referralMinSubtotalCents: 0,
};

describe("growthSettingsSchema", () => {
  it("percent приема 1..100", () => {
    expect(growthSettingsSchema.safeParse(base).success).toBe(true);
  });
  it("percent над 100 се отхвърля", () => {
    expect(growthSettingsSchema.safeParse({ ...base, welcomeCouponValue: 150 }).success).toBe(false);
  });
  it("отрицателна fixed стойност се отхвърля", () => {
    expect(
      growthSettingsSchema.safeParse({ ...base, welcomeCouponType: "fixed", welcomeCouponValue: -5 })
        .success,
    ).toBe(false);
  });
  it("fixed приема положителна сума в центове", () => {
    expect(
      growthSettingsSchema.safeParse({ ...base, welcomeCouponType: "fixed", welcomeCouponValue: 500 })
        .success,
    ).toBe(true);
  });
});
