/** Дали продукт е „нов" — създаден в последните `days` дни спрямо `now` (ms). */
export function isNewProduct(createdAt: Date, now: number, days = 14): boolean {
  return now - createdAt.getTime() <= days * 86_400_000;
}

/**
 * Текст за срока на ръчна изработка — „10–14 дни" или „14 дни" (когато min=max),
 * празно ако липсва срок. Чиста функция.
 */
export function leadDaysText(min: number | null, max: number | null): string {
  if (min === null || max === null) return "";
  return min === max ? `${min} дни` : `${min}–${max} дни`;
}
