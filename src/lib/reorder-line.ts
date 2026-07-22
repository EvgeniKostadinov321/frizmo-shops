export interface ReorderLine {
  productId: string;
  variantKey: string | null;
  quantity: number;
}

export interface ReorderCandidate {
  productId: string;
  variantKey: string | null;
  quantity: number;
  productExists: boolean;
  productActive: boolean;
  /** null = без следене на наличност (неограничено). */
  stock: number | null;
  /** Ръчна изработка: приема поръчки дори при stock=0 (не се скипва). */
  madeToOrder?: boolean;
}

/** Чиста логика: наличен ли е артикулът и с какво количество. null = скип. */
export function resolveReorderLine(c: ReorderCandidate): ReorderLine | null {
  if (!c.productExists || !c.productActive) return null;
  /* Ръчна изработка → приема поръчки дори изчерпана: третираме като неследена
     наличност (пълното количество минава; финалната проверка е на checkout). */
  if (c.madeToOrder) {
    return { productId: c.productId, variantKey: c.variantKey, quantity: c.quantity };
  }
  if (c.stock !== null && c.stock <= 0) return null;
  const qty = c.stock !== null ? Math.min(c.quantity, c.stock) : c.quantity;
  if (qty <= 0) return null;
  return { productId: c.productId, variantKey: c.variantKey, quantity: qty };
}
