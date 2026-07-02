import { z } from "zod";
import { parseBgPhone } from "@/lib/phone";
import { workingHoursSchema } from "@/lib/working-hours";

export const BUSINESS_CATEGORIES = [
  "Дрехи и мода",
  "Обувки",
  "Храни и напитки",
  "Козметика",
  "Ръчна изработка",
  "Електроника",
  "Строителни материали",
  "За дома",
  "Друго",
] as const;

export const shopSchema = z.object({
  name: z.string().trim().min(2, "Въведи име на магазина").max(80),
  businessCategory: z.enum(BUSINESS_CATEGORIES, { message: "Избери категория" }),
  description: z.string().trim().max(2000).default(""),
  city: z.string().trim().max(60).default(""),
  address: z.string().trim().max(160).default(""),
  phone: z
    .string()
    .trim()
    .max(30)
    .default("")
    .refine(
      (s) => s === "" || parseBgPhone(s).ok,
      "Невалиден телефонен номер (пример: 0888 123 456)",
    ),
  email: z.union([z.email("Невалиден имейл"), z.literal("")]).default(""),
  workingHours: workingHoursSchema,
  facebook: z.union([z.url("Невалиден линк"), z.literal("")]).default(""),
  instagram: z.union([z.url("Невалиден линк"), z.literal("")]).default(""),
});

export type ShopInput = z.infer<typeof shopSchema>;
