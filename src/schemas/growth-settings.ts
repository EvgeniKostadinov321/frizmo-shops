import { z } from "zod";

/** Валидна ли е стойността спрямо типа: percent 1..100, fixed ≥1 цент. */
function validValue(type: "percent" | "fixed", value: number): boolean {
  return type === "percent" ? value >= 1 && value <= 100 : value >= 1;
}

/** Плосък вход от формата за welcome/referral купон настройки → валидиран. */
export const growthSettingsSchema = z
  .object({
    welcomeCouponEnabled: z.boolean(),
    welcomeCouponType: z.enum(["percent", "fixed"]),
    welcomeCouponValue: z.number().int(),
    welcomeCouponMinSubtotalCents: z.number().int().min(0).max(1_000_000),
    referralEnabled: z.boolean(),
    referralType: z.enum(["percent", "fixed"]),
    referralValue: z.number().int(),
    referralMinSubtotalCents: z.number().int().min(0).max(1_000_000),
  })
  .refine((c) => validValue(c.welcomeCouponType, c.welcomeCouponValue), {
    message: "Невалидна стойност за welcome купон",
    path: ["welcomeCouponValue"],
  })
  .refine((c) => validValue(c.referralType, c.referralValue), {
    message: "Невалидна стойност за реферален купон",
    path: ["referralValue"],
  });

export type GrowthSettingsInput = z.infer<typeof growthSettingsSchema>;
