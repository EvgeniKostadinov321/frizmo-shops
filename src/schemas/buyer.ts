import { z } from "zod";
import { parseBgPhone } from "@/lib/phone";

const phone = z.string().refine((v) => parseBgPhone(v).ok, "Невалиден телефонен номер.");

export const addressSchema = z.object({
  label: z.string().max(40).optional().default(""),
  receiverName: z.string().min(2, "Въведи име.").max(100),
  receiverPhone: phone,
  city: z.string().max(60).optional().default(""),
  address: z.string().max(200).optional().default(""),
  courierProvider: z.enum(["econt", "speedy"]).optional(),
  courierOfficeId: z.string().max(60).optional(),
  courierOfficeName: z.string().max(200).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const buyerProfileSchema = z.object({
  fullName: z.string().min(2, "Въведи име.").max(100),
  phone,
});

export type AddressInput = z.infer<typeof addressSchema>;
export type BuyerProfileInput = z.infer<typeof buyerProfileSchema>;
