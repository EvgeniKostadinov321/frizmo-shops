import { z } from "zod";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const workingDaySchema = z.object({
  closed: z.boolean(),
  open: z.string().regex(TIME_PATTERN, "Невалиден час"),
  close: z.string().regex(TIME_PATTERN, "Невалиден час"),
});

export const workingHoursSchema = z.object({
  days: z.array(workingDaySchema).length(7),
});

export type WorkingDay = z.infer<typeof workingDaySchema>;
export type WorkingHours = z.infer<typeof workingHoursSchema>;

export const DAY_LABELS = [
  "Понеделник",
  "Вторник",
  "Сряда",
  "Четвъртък",
  "Петък",
  "Събота",
  "Неделя",
] as const;

/** Делници 9–18, уикенд почивен — разумна начална стойност. */
export function defaultWorkingDays(): WorkingDay[] {
  return DAY_LABELS.map((_, i) => ({
    closed: i >= 5,
    open: "09:00",
    close: "18:00",
  }));
}

/** Тълерантно четене от jsonb (вкл. стария формат { text }). */
export function parseWorkingHours(value: unknown): WorkingDay[] {
  const parsed = workingHoursSchema.safeParse(value);
  return parsed.success ? parsed.data.days : defaultWorkingDays();
}
