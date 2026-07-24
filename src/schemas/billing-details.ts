import { z } from "zod";
import { isValidEgn, isValidEik } from "@/lib/bg-identifiers";

/**
 * Данъчни данни на търговеца за официалната фактура (inv.bg) за месечната такса.
 * Toggle фирма/физическо лице: фирма → ЕИК+МОЛ задължителни; ФЛ → ЕГН задължителен.
 * Едни и същи правила на клиент и сървър. ЕИК/ЕГН се валидират с контролна цифра (L1),
 * не само дължина — невалиден идентификатор в НАП фактура = inv.bg я отказва.
 */

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
      if (!isValidEik(v.eik)) {
        ctx.addIssue({ code: "custom", message: "Невалиден ЕИК (провери цифрите)", path: ["eik"] });
      }
      if (v.mol.length < 2) {
        ctx.addIssue({ code: "custom", message: "Въведи МОЛ (отговорно лице)", path: ["mol"] });
      }
    } else {
      if (!isValidEgn(v.egn)) {
        ctx.addIssue({ code: "custom", message: "Невалиден ЕГН (провери цифрите)", path: ["egn"] });
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
