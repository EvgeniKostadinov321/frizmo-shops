import { z } from "zod";

/** Форма за създаване/редакция на купон (dashboard). */
export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Кодът е твърде кратък")
      .max(40)
      /* \p{L} = буква на всяка азбука (вкл. кирилица), \p{N} = цифра. Купонът
         може да е на български (ЛЯТО10) или латиница (SUMMER10). */
      .regex(/^[\p{L}\p{N}_-]+$/u, "Само букви, цифри, тире и долна черта"),
    discountType: z.enum(["percent", "fixed"]),
    /** Процент (1–100) ИЛИ сума в евро (за fixed) — валидира се по тип. */
    discountValue: z.number().positive("Стойността трябва да е > 0"),
    minSubtotalCents: z.number().int().min(0).default(0),
    maxUses: z.union([z.number().int().positive(), z.null()]).default(null),
    /** ISO дата или null (безсрочен). */
    expiresAt: z.union([z.string(), z.null()]).default(null),
    active: z.boolean().default(true),
  })
  .refine((v) => v.discountType !== "percent" || (v.discountValue >= 1 && v.discountValue <= 100), {
    message: "Процентът трябва да е между 1 и 100",
    path: ["discountValue"],
  });

export type CouponInput = z.infer<typeof couponSchema>;
