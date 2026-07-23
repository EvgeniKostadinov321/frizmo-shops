/**
 * Аритметика на транзакционната такса — ЕДИНСТВЕНИЯТ източник (по модела на pricing.ts).
 * Integer евроценти навсякъде; round (не floor/ceil). Всички стойности са конфиг тук.
 */

export const FEE_RATE = 0.05; // 5%
export const FEE_MIN_CENTS = 30; // 0.30€ минимум на продажба
export const FEE_CAP_CENTS = 5000; // 50€ таван на продажба
export const AUTO_COMPLETE_DAYS = 30; // авто-completed на заседнали shipped
export const FEE_GRACE_DAYS = 14; // grace преди спиране при неплатена фактура

/** База на таксата = само стоката (subtotal − отстъпка), без доставка/опаковка; не под 0. */
export function feeBaseCents(order: { subtotalCents: number; discountCents: number }): number {
  return Math.max(0, order.subtotalCents - order.discountCents);
}

/** Такса за една продажба. База ≤ 0 → 0. Иначе clamp(round(база*rate), min, cap). */
export function feeCents(baseCents: number): number {
  if (baseCents <= 0) return 0;
  const raw = Math.round(baseCents * FEE_RATE);
  return Math.min(Math.max(raw, FEE_MIN_CENTS), FEE_CAP_CENTS);
}
