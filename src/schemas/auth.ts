import { z } from "zod";

/** Текущата версия на легалните документи — записва се при приемане (GDPR доказуемост).
 *  Промени я при съществена промяна на Условията/Поверителността. */
export const TERMS_VERSION = "2026-07-25";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Въведи име").max(100),
  email: z.email("Невалиден имейл"),
  password: z.string().min(8, "Паролата трябва да е поне 8 знака").max(72),
  role: z.enum(["buyer", "seller"]).optional(),
  /* Задължително съгласие (GDPR). preprocess прави контракта устойчив на checkbox формати
     ("on"/"true"/true) — цялата логика е в схемата, не разпръсната в action-а (M1). */
  acceptTerms: z.preprocess(
    (v) => v === true || v === "on" || v === "true",
    z.literal(true, { error: "Трябва да приемеш Условията и Политиката за поверителност" }),
  ),
  /* Опционално маркетингово съгласие. */
  acceptMarketing: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()).default(false),
});

export const loginSchema = z.object({
  email: z.email("Невалиден имейл"),
  password: z.string().min(1, "Въведи парола"),
  /* Ролята на текущото действие (от контекста/toggle-а). Optional → стар линк без
     role пада в fallback клоновете. При вход тя надделява над hasShop. */
  role: z.enum(["buyer", "seller"]).optional(),
});

/** Заявка за възстановяване на парола — само имейл. */
export const forgotPasswordSchema = z.object({
  email: z.email("Невалиден имейл"),
});

/** Задаване на нова парола (след клик на recovery линка). */
export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Паролата трябва да е поне 8 знака").max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
