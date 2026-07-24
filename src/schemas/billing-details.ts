import { z } from "zod";

/**
 * Данъчни данни на търговеца за официалната фактура (inv.bg) за месечната такса.
 * Toggle фирма/физическо лице: фирма → ЕИК+МОЛ задължителни; ФЛ → ЕГН задължителен.
 * Едни и същи правила на клиент и сървър.
 */

/** ЕИК/Булстат: 9 цифри (стандартен) или 13 (с клон/ЕИК по БУЛСТАТ). */
const eikRegex = /^\d{9}$|^\d{13}$/;
/** ЕГН: точно 10 цифри. */
const egnRegex = /^\d{10}$/;
/** ДДС номер: BG + 9-10 цифри (по избор). */
const vatRegex = /^BG\d{9,10}$/;

export const billingDetailsSchema = z
  .object({
    clientType: z.enum(["company", "individual"]),
    companyName: z.string().trim().min(2, "Името е твърде кратко").max(200),
    /** ЕИК — задължителен само за фирма. */
    eik: z.string().trim().optional().default(""),
    /** МОЛ — задължителен само за фирма. */
    mol: z.string().trim().max(200).optional().default(""),
    /** ДДС номер — по избор (повечето не са по ДДС). */
    vatNumber: z.string().trim().optional().default(""),
    /** ЕГН — задължителен само за физическо лице. */
    egn: z.string().trim().optional().default(""),
    address: z.string().trim().min(3, "Адресът е твърде кратък").max(300),
    city: z.string().trim().min(2, "Населеното място е твърде кратко").max(100),
    wantsInvoice: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.clientType === "company") {
      if (!eikRegex.test(v.eik)) {
        ctx.addIssue({ code: "custom", message: "ЕИК трябва да е 9 или 13 цифри", path: ["eik"] });
      }
      if (v.mol.length < 2) {
        ctx.addIssue({ code: "custom", message: "Въведи МОЛ (отговорно лице)", path: ["mol"] });
      }
    } else {
      if (!egnRegex.test(v.egn)) {
        ctx.addIssue({ code: "custom", message: "ЕГН трябва да е 10 цифри", path: ["egn"] });
      }
    }
    if (v.vatNumber && !vatRegex.test(v.vatNumber)) {
      ctx.addIssue({
        code: "custom",
        message: "ДДС номерът трябва да е формат BG123456789",
        path: ["vatNumber"],
      });
    }
  });

export type BillingDetailsInput = z.infer<typeof billingDetailsSchema>;
