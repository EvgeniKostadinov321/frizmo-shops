import { z } from "zod";
import { cmToMm, toCents, toMilliQuantity } from "@/lib/money";
import { isValidGtin } from "@/lib/gtin";

const priceString = z
  .string()
  .trim()
  .refine((s) => toCents(s) !== null, "Невалидна цена (пример: 12,50)");

const optionalPriceString = z.union([priceString, z.literal("")]);

const optionalStock = z.union([z.coerce.number().int().min(0, "Невалидна наличност"), z.literal("")]);

const optionalWeight = z.union([
  z.coerce.number().int().min(1, "Минимум 1 грам").max(200_000, "Максимум 200000 г"),
  z.literal(""),
]);

const optionalDimension = z.union([
  z.string().trim().refine((s) => {
    const mm = cmToMm(s);
    return mm !== null && mm >= 1 && mm <= 5000;
  }, "Невалиден размер в см (пример: 30 или 30,5)"),
  z.literal(""),
]);

const NET_UNITS = ["mg", "g", "kg", "ml", "l"] as const;

const netQuantity = z
  .union([
    z.object({
      value: z
        .string()
        .trim()
        .refine((s) => {
          const m = toMilliQuantity(s);
          return m !== null && m > 0;
        }, "Невалидно количество (пример: 0,5)"),
      unit: z.enum(NET_UNITS),
    }),
    z.null(),
  ])
  .default(null);

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
  weight: optionalWeight.default(""),
  length: optionalDimension.default(""),
  width: optionalDimension.default(""),
  height: optionalDimension.default(""),
  netQuantity,
  /* Продуктови кодове (identifiers) — надграждат product feed-а. */
  sku: z.string().trim().max(60).default(""),
  gtin: z
    .union([
      z
        .string()
        .trim()
        .refine((s) => isValidGtin(s), "Невалиден баркод (8–14 цифри с контролна цифра)"),
      z.literal(""),
    ])
    .default(""),
  brand: z.string().trim().max(60).default(""),
  cost: optionalPriceString.default(""),
  /* SEO override per продукт. */
  seoTitle: z.string().trim().max(60).default(""),
  seoDescription: z.string().trim().max(160).default(""),
  /* Закачена размерна таблица (per магазин). */
  sizeGuideId: z.union([z.uuid(), z.literal("")]).default(""),
});

export type ProductInput = z.infer<typeof productSchema>;
