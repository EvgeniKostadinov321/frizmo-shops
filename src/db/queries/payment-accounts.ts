import { and, eq } from "drizzle-orm";
import { db, shopPaymentAccounts, type ShopPaymentAccount } from "@/db";
import type { PaymentId } from "@/lib/payments";

/** Платежният акаунт на магазина за даден провайдър (undefined = няма). */
export async function getShopPaymentAccount(
  shopId: string,
  provider: PaymentId,
): Promise<ShopPaymentAccount | undefined> {
  return db.query.shopPaymentAccounts.findFirst({
    where: and(
      eq(shopPaymentAccounts.shopId, shopId),
      eq(shopPaymentAccounts.provider, provider),
    ),
  });
}
