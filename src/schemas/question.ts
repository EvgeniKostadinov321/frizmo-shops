import { z } from "zod";

export const submitQuestionSchema = z.object({
  productId: z.uuid(),
  askerName: z.string().trim().max(60).default(""),
  question: z.string().trim().min(5, "Въпросът е твърде кратък").max(500),
  /** Honeypot: реален потребител никога не го попълва. */
  website: z.string().max(100).default(""),
});

export const answerQuestionSchema = z.object({
  id: z.uuid(),
  answer: z.string().trim().min(1, "Въведи отговор").max(1000),
});
