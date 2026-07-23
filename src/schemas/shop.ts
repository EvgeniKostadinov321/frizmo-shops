import { z } from "zod";
import { parseBgPhone } from "@/lib/phone";
import { isSafeHref } from "@/lib/safe-url";
import { workingHoursSchema } from "@/lib/working-hours";

/* Социален линк: празен ИЛИ безопасен http(s) URL. z.url() пропуска javascript:/data:
   (одит #2 VAL-01) → изрично изискваме безопасен протокол. */
const socialUrlField = () =>
  z
    .string()
    .trim()
    .max(300)
    .refine((s) => s === "" || (/^https?:\/\//i.test(s) && isSafeHref(s)), "Невалиден линк (само https://)")
    .default("");

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

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

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
  facebook: socialUrlField(),
  instagram: socialUrlField(),
  tiktok: socialUrlField(),
  youtube: socialUrlField(),
  /* Viber = линк (https://) ИЛИ телефон (viber://chat?number=…) — приемаме
     произволен низ до 200 знака, за да не блокираме телефонния формат. */
  viber: z.string().trim().max(200).default(""),
});

export type ShopInput = z.infer<typeof shopSchema>;

/** Ф2: режим на сложност на dashboard-а. */
export const complexityModeSchema = z.enum(["hobby", "business", "full"]);
