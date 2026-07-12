import { z } from "zod";

export const courierAccountSchema = z.object({
  provider: z.enum(["econt", "speedy"]),
  username: z.string().trim().min(1, "Въведи потребител").max(100),
  password: z.string().trim().min(1, "Въведи парола/токен").max(200),
  senderName: z.string().trim().min(2, "Въведи име на подателя").max(100),
  senderPhone: z.string().trim().min(4, "Въведи телефон").max(30),
  senderCity: z.string().trim().min(2, "Въведи град").max(60),
  senderAddress: z.string().trim().min(2, "Въведи адрес").max(200),
});

export type CourierAccountInput = z.infer<typeof courierAccountSchema>;
