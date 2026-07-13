/**
 * Typed confirmation за изтриване на акаунт: въведеното трябва да съвпада ТОЧНО
 * с името на магазина (след trim). Case-sensitive — това е защитна бариера срещу
 * случаен клик, не UX удобство.
 */
export function confirmNameMatches(input: string, shopName: string): boolean {
  const trimmed = input.trim();
  return trimmed.length > 0 && trimmed === shopName.trim();
}

/**
 * Купувачко изтриване: потвърждението трябва да е думата „ИЗТРИЙ" (регистър и
 * интервали без значение). Купувачът няма магазин → не ползваме confirmNameMatches.
 */
export function confirmDeleteWord(input: string): boolean {
  return input.trim().toUpperCase() === "ИЗТРИЙ";
}
