import { formatPrice } from "@/lib/money";

export type CouponType = "percent" | "fixed";

/** Човешки етикет за купон: „−10%“ или „−5,00 €“. */
export function welcomeCouponLabel(type: CouponType, value: number): string {
  return type === "percent" ? `−${value}%` : `−${formatPrice(value)}`;
}
