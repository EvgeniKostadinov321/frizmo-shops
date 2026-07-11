import { z } from "zod";

export const sizeGuideSchema = z
  .object({
    name: z.string().trim().min(2, "Въведи име").max(60),
    columns: z
      .array(z.string().trim().min(1, "Празна колона").max(40))
      .min(1, "Поне една колона")
      .max(8, "Максимум 8 колони"),
    rows: z.array(z.array(z.string().trim().max(40))).max(50, "Максимум 50 реда"),
  })
  .superRefine((v, ctx) => {
    for (const [i, row] of v.rows.entries()) {
      if (row.length !== v.columns.length) {
        ctx.addIssue({
          code: "custom",
          path: ["rows", i],
          message: "Редът не съвпада с броя колони",
        });
      }
    }
  });

export type SizeGuideInput = z.infer<typeof sizeGuideSchema>;
