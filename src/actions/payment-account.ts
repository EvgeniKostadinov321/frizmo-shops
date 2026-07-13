"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, shopPaymentAccounts } from "@/db";
import { requireShop } from "@/lib/auth";
import { paymentAccountSchema } from "@/schemas/payment-account";

export type PaymentAccountState = { error?: string; ok?: boolean };

/** Записва/обновява ePay акаунт (upsert по shop+provider). Ключовете не се логват. */
export async function savePaymentAccount(
  _prev: PaymentAccountState,
  formData: FormData,
): Promise<PaymentAccountState> {
  const { shop } = await requireShop();
  const parsed = paymentAccountSchema.safeParse({
    kin: formData.get("kin"),
    secret: formData.get("secret"),
  });
  if (!parsed.success) return { error: "Провери въведените данни." };

  const credentials = { kin: parsed.data.kin, secret: parsed.data.secret };
  await db
    .insert(shopPaymentAccounts)
    .values({ shopId: shop.id, provider: "epay", credentials })
    .onConflictDoUpdate({
      target: [shopPaymentAccounts.shopId, shopPaymentAccounts.provider],
      set: { credentials, updatedAt: new Date() },
    });

  revalidatePath("/dashboard/fulfillment");
  return { ok: true };
}

/** Трие ePay акаунта на магазина. */
export async function deletePaymentAccount(): Promise<void> {
  const { shop } = await requireShop();
  await db
    .delete(shopPaymentAccounts)
    .where(
      and(eq(shopPaymentAccounts.shopId, shop.id), eq(shopPaymentAccounts.provider, "epay")),
    );
  revalidatePath("/dashboard/fulfillment");
}
