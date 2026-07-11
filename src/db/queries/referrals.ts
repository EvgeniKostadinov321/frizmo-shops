import { desc, eq } from "drizzle-orm";
import { db, referrals, subscribers } from "@/db";

export interface ShopReferral {
  email: string;
  code: string;
  referredCount: number;
}

/** Реферали на магазина + имейла на реферера, сортирани по брой доведени. */
export async function getShopReferrals(shopId: string): Promise<ShopReferral[]> {
  return db
    .select({
      email: subscribers.email,
      code: referrals.code,
      referredCount: referrals.referredCount,
    })
    .from(referrals)
    .innerJoin(subscribers, eq(referrals.subscriberId, subscribers.id))
    .where(eq(referrals.shopId, shopId))
    .orderBy(desc(referrals.referredCount));
}
