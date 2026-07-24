/**
 * Приоритетна логика за цената на куриерска доставка (единствен източник за
 * checkout и създаване на поръчка). Приоритет:
 *   1. Праг за безплатна (собственикът) — над него доставката е БЕЗПЛАТНА (не пита live).
 *   2. Live цена от куриера (calculatePrice) — точната цена за пратката.
 *   3. Резервна цена (собственикът) — ако live извикването върне null (грешка/недостъпен).
 * Всичко в EUR центове.
 */
interface ResolveOpts {
  subtotalCents: number;
  freeOverCents: number | null;
  fallbackPriceCents: number;
  /** Извиква куриера за live цена; null при грешка/недостъпност. */
  live: () => Promise<{ amountCents: number } | null>;
}

export interface ResolvedShipping {
  cents: number;
  free: boolean;
  source: "free" | "live" | "fallback";
}

export async function resolveCourierShippingCents(o: ResolveOpts): Promise<ResolvedShipping> {
  if (o.freeOverCents != null && o.subtotalCents >= o.freeOverCents) {
    return { cents: 0, free: true, source: "free" };
  }
  const live = await o.live();
  if (live) return { cents: live.amountCents, free: false, source: "live" };
  return { cents: o.fallbackPriceCents, free: false, source: "fallback" };
}
