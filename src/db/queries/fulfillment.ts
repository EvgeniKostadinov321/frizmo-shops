import { asc, count, eq } from "drizzle-orm";
import { db, paymentMethods, shippingMethods } from "@/db";

export async function getShippingMethods(shopId: string) {
  return db.query.shippingMethods.findMany({
    where: eq(shippingMethods.shopId, shopId),
    orderBy: [asc(shippingMethods.sortOrder), asc(shippingMethods.createdAt)],
  });
}

export async function getPaymentMethods(shopId: string) {
  return db.query.paymentMethods.findMany({
    where: eq(paymentMethods.shopId, shopId),
    orderBy: [asc(paymentMethods.sortOrder), asc(paymentMethods.createdAt)],
  });
}

/**
 * Дефолтни методи при първо отваряне — checkout-ът никога не е празен.
 * Идемпотентно: сийдва само при нула методи от съответния вид.
 */
export async function ensureDefaultMethods(shopId: string) {
  const [shipping] = await db
    .select({ value: count() })
    .from(shippingMethods)
    .where(eq(shippingMethods.shopId, shopId));
  if ((shipping?.value ?? 0) === 0) {
    await db.insert(shippingMethods).values({
      shopId,
      type: "courier",
      name: "Куриер до адрес",
      priceCents: 500,
      freeOverCents: 6000,
    });
  }

  const [payment] = await db
    .select({ value: count() })
    .from(paymentMethods)
    .where(eq(paymentMethods.shopId, shopId));
  if ((payment?.value ?? 0) === 0) {
    await db.insert(paymentMethods).values({
      shopId,
      type: "cod",
      name: "Наложен платеж",
      details: "Плащаш на куриера при получаване.",
    });
  }
}
