import { z } from "zod";
import { toCents } from "@/lib/money";

const priceString = z
  .string()
  .trim()
  .refine((s) => toCents(s) !== null, "Невалидна цена (пример: 12,50)");

const optionalPriceString = z.union([priceString, z.literal("")]);

const optionalStock = z.union([z.coerce.number().int().min(0, "Невалидна наличност"), z.literal("")]);

export const productSchema = z.object({
  name: z.string().trim().min(2, "Въведи име").max(120),
  description: z.string().trim().max(10_000).default(""),
  categoryId: z.union([z.uuid(), z.literal("")]).default(""),
  price: priceString,
  promoPrice: optionalPriceString.default(""),
  stock: optionalStock.default(""),
  status: z.enum(["active", "inactive"]).default("active"),
  images: z.array(z.string().max(300)).max(8, "Максимум 8 снимки").default([]),
  attributes: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Име на характеристиката").max(60),
        value: z.string().trim().min(1, "Стойност").max(200),
      }),
    )
    .max(20, "Максимум 20 характеристики")
    .default([]),
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Име на опцията").max(40),
        values: z.array(z.string().trim().min(1).max(60)).min(1, "Поне една стойност").max(20),
      }),
    )
    .max(3, "Максимум 3 опции")
    .default([]),
  variants: z
    .array(
      z.object({
        options: z.record(z.string(), z.string()),
        price: optionalPriceString.default(""),
        stock: optionalStock.default(""),
        sku: z.string().trim().max(60).default(""),
        imagePaths: z.array(z.string().max(300)).default([]),
      }),
    )
    .max(100, "Максимум 100 варианта")
    .default([]),
  /** Количествена промоция „купи N за общо X“ (null = няма). */
  deal: z
    .union([
      z.object({
        quantity: z.coerce.number().int().min(2, "Минимум 2 броя").max(50),
        totalPrice: priceString,
      }),
      z.null(),
    ])
    .default(null),
});

export type ProductInput = z.infer<typeof productSchema>;
