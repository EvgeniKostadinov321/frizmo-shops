import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Въведи име").max(100),
  email: z.email("Невалиден имейл"),
  password: z.string().min(8, "Паролата трябва да е поне 8 знака").max(72),
  role: z.enum(["buyer", "seller"]).optional(),
});

export const loginSchema = z.object({
  email: z.email("Невалиден имейл"),
  password: z.string().min(1, "Въведи парола"),
  /* Ролята на текущото действие (от контекста/toggle-а). Optional → стар линк без
     role пада в fallback клоновете. При вход тя надделява над hasShop. */
  role: z.enum(["buyer", "seller"]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
