import { and, asc, eq } from "drizzle-orm";
import { db, coupons, type Coupon } from "@/db";
import type { AppliedCoupon } from "@/lib/pricing";

export type CouponRejectReason = "not_found" | "expired" | "inactive" | "limit_reached";

export interface CouponCheck {
  ok: boolean;
  coupon?: AppliedCoupon;
  row?: Coupon;
  reason?: CouponRejectReason;
}

/** Нормализира въведен код за търсене (uppercase, trim). */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Намира и валидира купон по код (активен, неизтекъл, под лимита). Връща
 * `AppliedCoupon` за pricing или причина за отказ. Не пипа usedCount — това
 * става атомарно в транзакцията на поръчката.
 */
export async function findValidCoupon(
  shopId: string,
  rawCode: string,
  now: Date = new Date(),
): Promise<CouponCheck> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, reason: "not_found" };

  const row = await db.query.coupons.findFirst({
    where: and(eq(coupons.shopId, shopId), eq(coupons.code, code)),
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.active) return { ok: false, reason: "inactive", row };
  if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: "expired", row };
  }
  if (row.maxUses !== null && row.usedCount >= row.maxUses) {
    return { ok: false, reason: "limit_reached", row };
  }

  return {
    ok: true,
    row,
    coupon: {
      code: row.code,
      discountType: row.discountType,
      discountValue: row.discountValue,
      minSubtotalCents: row.minSubtotalCents,
    },
  };
}

/** Всички купони на магазина за dashboard (най-новите/активни отгоре). */
export async function getShopCoupons(shopId: string): Promise<Coupon[]> {
  return db.query.coupons.findMany({
    where: eq(coupons.shopId, shopId),
    orderBy: [asc(coupons.code)],
  });
}
