import { z } from "zod";
import { isValidBgIban } from "@/lib/iban";
import { toCents } from "@/lib/money";
import { workingHoursSchema } from "@/lib/working-hours";

const priceString = z
  .string()
  .trim()
  .refine((s) => toCents(s) !== null, "Невалидна цена (пример: 5,00)");

const optionalPriceString = z.union([priceString, z.literal("")]);

export const SHIPPING_TYPES = [
  { value: "courier", label: "Куриер до адрес/офис" },
  { value: "pickup", label: "Взимане от място" },
  { value: "local", label: "Доставка от производителя" },
] as const;

export const PAYMENT_TYPES = [
  { value: "cod", label: "Наложен платеж" },
  { value: "bank_transfer", label: "Банков превод" },
  { value: "on_site", label: "Плащане на място" },
] as const;

export const shippingMethodSchema = z.object({
  type: z.enum(["courier", "pickup", "local"]),
  name: z.string().trim().min(2, "Въведи име").max(60),
  price: priceString,
  freeOver: optionalPriceString.default(""),
  /** Опционално време за доставка (само инфо на клиента). null = не се показва. */
  deliveryHours: z.union([workingHoursSchema, z.null()]).default(null),
});

export const paymentMethodSchema = z
  .object({
    type: z.enum(["cod", "bank_transfer", "on_site"]),
    name: z.string().trim().min(2, "Въведи име").max(60),
    details: z.string().trim().max(300).default(""),
  })
  .superRefine((v, ctx) => {
    /* Банков превод изисква валиден BG IBAN в details (смисълът на метода). */
    if (v.type === "bank_transfer" && !isValidBgIban(v.details)) {
      ctx.addIssue({
        code: "custom",
        path: ["details"],
        message: "Въведи валиден IBAN (напр. BG80 BNBG 9661 1020 3456 78)",
      });
    }
  });

export type ShippingMethodInput = z.infer<typeof shippingMethodSchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
