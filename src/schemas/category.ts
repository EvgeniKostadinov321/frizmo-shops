import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Въведи име").max(60),
  parentId: z.union([z.uuid(), z.literal("")]).default(""),
});

export type CategoryInput = z.infer<typeof categorySchema>;
