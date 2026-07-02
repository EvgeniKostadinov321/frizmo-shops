import { formatPrice } from "@/lib/money";

/**
 * Pricing engine — ЕДИНСТВЕНОТО място, което смята цени на количка/поръчка.
 * Чиста функция без db достъп: количката и checkout-ът я викат с едни и същи
 * данни, затова клиентската и сървърната сума не могат да се разминат.
 */

export interface PricingVariant {
  key: string;
  label: string;
  priceCents: number | null;
  stock: number | null;
}

export interface PricingProduct {
  id: string;
  name: string;
  status: "active" | "inactive";
  priceCents: number;
  promoPriceCents: number | null;
  stock: number | null;
  variants: PricingVariant[];
  deal: { quantity: number; totalPriceCents: number } | null;
}

export interface CartLine {
  productId: string;
  variantKey: string | null;
  qty: number;
}

export type LineError =
  | "not_found"
  | "inactive"
  | "variant_missing"
  | "out_of_stock"
  | "insufficient_stock"
  | "invalid_qty";

export interface PricedLine {
  productId: string;
  variantKey: string | null;
  productName: string;
  variantLabel: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
  /** Напр. "2 бр за 30,00 €" — празно, ако няма приложен deal. */
  appliedDeal: string;
  error?: LineError;
}

export interface ShippingOption {
  name: string;
  priceCents: number;
  freeOverCents: number | null;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
  shipping: { name: string; priceCents: number; freeApplied: boolean } | null;
  totalCents: number;
  hasErrors: boolean;
}

export function priceCart(
  lines: CartLine[],
  products: Map<string, PricingProduct>,
  shipping?: ShippingOption,
): PricedCart {
  const priced: PricedLine[] = lines.map((line) => {
    const base: PricedLine = {
      productId: line.productId,
      variantKey: line.variantKey,
      productName: "",
      variantLabel: "",
      qty: line.qty,
      unitPriceCents: 0,
      lineTotalCents: 0,
      appliedDeal: "",
    };

    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 999) {
      return { ...base, error: "invalid_qty" };
    }

    const product = products.get(line.productId);
    if (!product) return { ...base, error: "not_found" };
    base.productName = product.name;

    if (product.status !== "active") return { ...base, error: "inactive" };

    let variant: PricingVariant | null = null;
    if (line.variantKey) {
      variant = product.variants.find((v) => v.key === line.variantKey) ?? null;
      if (!variant) return { ...base, error: "variant_missing" };
      base.variantLabel = variant.label;
    }

    /* Наличност: вариантната, ако вариантът я следи; иначе продуктовата. */
    const stock = variant ? variant.stock : product.stock;
    if (stock !== null) {
      if (stock <= 0) return { ...base, error: "out_of_stock" };
      if (line.qty > stock) return { ...base, error: "insufficient_stock" };
    }

    /* Единична цена: вариантна ?? промо ?? базова. */
    const unitPriceCents =
      variant?.priceCents ?? product.promoPriceCents ?? product.priceCents;
    base.unitPriceCents = unitPriceCents;

    /* Количествена промоция: цели групи от N, остатъкът по единичната цена. */
    const deal = product.deal;
    if (deal && deal.quantity >= 2 && line.qty >= deal.quantity) {
      const groups = Math.floor(line.qty / deal.quantity);
      const remainder = line.qty % deal.quantity;
      base.lineTotalCents = groups * deal.totalPriceCents + remainder * unitPriceCents;
      base.appliedDeal = `${deal.quantity} бр за ${formatPrice(deal.totalPriceCents)}`;
    } else {
      base.lineTotalCents = unitPriceCents * line.qty;
    }

    return base;
  });

  const hasErrors = priced.some((l) => l.error);
  const subtotalCents = priced.reduce((sum, l) => (l.error ? sum : sum + l.lineTotalCents), 0);

  let shippingResult: PricedCart["shipping"] = null;
  if (shipping) {
    const freeApplied =
      shipping.freeOverCents !== null && subtotalCents >= shipping.freeOverCents;
    shippingResult = {
      name: shipping.name,
      priceCents: freeApplied ? 0 : shipping.priceCents,
      freeApplied,
    };
  }

  return {
    lines: priced,
    subtotalCents,
    shipping: shippingResult,
    totalCents: subtotalCents + (shippingResult?.priceCents ?? 0),
    hasErrors,
  };
}
