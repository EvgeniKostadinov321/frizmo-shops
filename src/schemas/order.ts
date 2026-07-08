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
  /** N9: подаръчна опаковка (такса) + картичка (текст) — важат само ако магазинът ги предлага. */
  giftWrap: z.boolean().default(false),
  giftCard: z.boolean().default(false),
  giftNote: z.string().trim().max(200, "Текстът за картичката е до 200 знака").default(""),
  /** Приложен промо код (празно = без). Препотвърждава се на сървъра. */
  couponCode: z.string().trim().max(40).default(""),
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

/**
 * Ръчна поръчка от търговеца („каса" — телефонни/DM/офлайн продажби).
 * Без honeypot/купон; доставката може да е с override цена (уговорка).
 */
export const manualOrderSchema = z.object({
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
  /** Ръчна цена на доставка в центове (null = цената на метода). */
  shippingOverrideCents: z.union([z.number().int().min(0).max(100_000), z.null()]).default(null),
  /** N9: подаръчна опаковка (таксата на магазина се прилага на сървъра) + картичка. */
  giftWrap: z.boolean().default(false),
  giftCard: z.boolean().default(false),
  giftNote: z.string().trim().max(200).default(""),
  lines: z
    .array(
      z.object({
        productId: z.uuid(),
        variantKey: z.union([z.string().max(300), z.null()]),
        qty: z.number().int().min(1).max(999),
      }),
    )
    .min(1, "Добави поне един продукт")
    .max(50),
});

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;
