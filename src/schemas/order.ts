import { z } from "zod";
import { parseBgPhone } from "@/lib/phone";

export const orderSchema = z.object({
  customerName: z.string().trim().min(2, "Въведи име").max(100),
  customerPhone: z
    .string()
    .trim()
    .refine((s) => parseBgPhone(s).ok, "Невалиден телефонен номер (пример: 0888 123 456)"),
  customerEmail: z.union([z.email("Невалиден имейл"), z.literal("")]).default(""),
  address: z.string().trim().max(200).default(""),
  city: z.string().trim().max(60).default(""),
  note: z.string().trim().max(500).default(""),
  shippingMethodId: z.uuid("Избери доставка"),
  paymentMethodId: z.uuid("Избери плащане"),
  lines: z
    .array(
      z.object({
        productId: z.uuid(),
        variantKey: z.union([z.string().max(300), z.null()]),
        qty: z.number().int().min(1).max(999),
      }),
    )
    .min(1, "Количката е празна")
    .max(50),
  /** Honeypot: реален потребител никога не го попълва. */
  website: z.string().max(100).default(""),
});

export type OrderInput = z.infer<typeof orderSchema>;
