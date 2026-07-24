import "server-only";
import { eq } from "drizzle-orm";
import { db, merchantBillingDetails } from "@/db";

export type MerchantBillingDetails = typeof merchantBillingDetails.$inferSelect;

/** Данъчните данни на магазина за официалната фактура (null ако още не са попълнени). */
export async function getMerchantBillingDetails(
  shopId: string,
): Promise<MerchantBillingDetails | null> {
  const row = await db.query.merchantBillingDetails.findFirst({
    where: eq(merchantBillingDetails.shopId, shopId),
  });
  return row ?? null;
}
