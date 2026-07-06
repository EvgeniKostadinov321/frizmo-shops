import { z } from "zod";

/** Съобщение от контактната форма на магазина (публичен endpoint). */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Въведи име").max(80),
  email: z.email("Невалиден имейл"),
  message: z.string().trim().min(10, "Съобщението е твърде кратко").max(2000),
  /** Honeypot: реален потребител никога не го попълва. */
  website: z.string().max(100).default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;
