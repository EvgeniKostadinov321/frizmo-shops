import { z } from "zod";

export const paymentAccountSchema = z.object({
  /** ePay клиентски идентификационен номер (KIN/MIN). */
  kin: z.string().trim().min(1, "Въведи КИН").max(64),
  /** ePay secret word (тайната дума за подписване). */
  secret: z.string().trim().min(1, "Въведи тайната дума").max(200),
});

export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;
