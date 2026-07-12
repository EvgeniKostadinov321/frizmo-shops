/**
 * Общо тегло на поръчка в грамове — за товарителницата. Продукт без тегло (или
 * изтрит/непознат) → fallbackGrams (за да не блокира генерирането).
 */
export function aggregateOrderWeight(
  items: { productId: string | null; quantity: number }[],
  weights: Map<string, number | null>,
  fallbackGrams: number,
): number {
  let total = 0;
  for (const item of items) {
    const w = item.productId ? weights.get(item.productId) : null;
    total += (w ?? fallbackGrams) * item.quantity;
  }
  return total;
}

/**
 * COD сума за товарителницата: при наложен платеж куриерът събира total-а; иначе
 * нищо (превод/на място са платени другаде).
 */
export function resolveCodAmount(paymentType: string, totalCents: number): number | null {
  return paymentType === "cod" ? totalCents : null;
}
