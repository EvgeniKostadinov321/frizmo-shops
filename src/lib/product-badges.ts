/** Дали продукт е „нов" — създаден в последните `days` дни спрямо `now` (ms). */
export function isNewProduct(createdAt: Date, now: number, days = 14): boolean {
  return now - createdAt.getTime() <= days * 86_400_000;
}
