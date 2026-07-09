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

/**
 * Опции за час на всеки половин час (00:00 – 23:30) в 24-часов формат.
 * Native `<input type="time">` показва AM/PM според локала на потребителя, което
 * обърква българските търговци — затова ползваме Select с тези опции.
 */
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 48 },
  (_, i) => {
    const h = String(Math.floor(i / 2)).padStart(2, "0");
    const m = i % 2 === 0 ? "00" : "30";
    const value = `${h}:${m}`;
    return { value, label: value };
  },
);

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

/**
 * Форматирани редове за показване на време за доставка от jsonb стойност.
 * null/невалидно → празен масив (нищо не се показва). Ползва се на checkout и
 * order страницата за shipping метод с delivery_hours.
 */
export function deliveryHoursLines(value: unknown): string[] {
  if (value == null) return [];
  const parsed = workingHoursSchema.safeParse(value);
  if (!parsed.success) return [];
  return formatWorkingHours(parsed.data.days);
}

const DAY_SHORT = ["Пон", "Вт", "Ср", "Четв", "Пет", "Съб", "Нед"] as const;

/**
 * Групира последователни дни с еднакъв график за публично показване:
 * ["Пон – Пет: 09:00 – 18:00", "Съб – Нед: почивен ден"]
 */
export function formatWorkingHours(days: WorkingDay[]): string[] {
  if (days.length !== 7) return [];
  const key = (d: WorkingDay) => (d.closed ? "closed" : `${d.open}-${d.close}`);

  const lines: string[] = [];
  let start = 0;
  for (let i = 1; i <= days.length; i++) {
    if (i < days.length && key(days[i]!) === key(days[start]!)) continue;
    const end = i - 1;
    const label = start === end ? DAY_SHORT[start] : `${DAY_SHORT[start]} – ${DAY_SHORT[end]}`;
    const day = days[start]!;
    const value = day.closed ? "почивен ден" : `${day.open} – ${day.close}`;
    lines.push(`${label}: ${value}`);
    start = i;
  }
  return lines;
}
