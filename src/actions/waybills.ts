"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, orders, products } from "@/db";
import { getCourierAccount } from "@/db/queries/couriers";
import { getOrderWithItems } from "@/db/queries/orders";
import { requireShop } from "@/lib/auth";
import { getCourier } from "@/lib/couriers";
import { aggregateOrderWeight, resolveCodAmount } from "@/lib/courier-weight";

const FALLBACK_WEIGHT_GRAMS = 500;

/**
 * Генерира куриерска товарителница за поръчка: агрегира тегло (fallback за липсващо),
 * авто COD при наложен платеж, вика courier.createWaybill, записва waybillId/tracking.
 * Идемпотентен (не дублира). Tenant guard по shopId. Общи BG грешки.
 */
export async function generateWaybill(
  orderId: string,
): Promise<{ ok?: boolean; error?: string; trackingUrl?: string }> {
  const { shop } = await requireShop();
  const order = await getOrderWithItems(orderId);
  if (!order || order.shopId !== shop.id) return { error: "Поръчката не е намерена." };

  if (order.waybillId) {
    /* Идемпотентност: вече има товарителница → не дублирай, върни съществуващия tracking. */
    const courier = order.courierProvider ? getCourier(order.courierProvider) : null;
    return {
      ok: true,
      trackingUrl:
        courier && order.trackingNumber ? courier.trackingUrl(order.trackingNumber) : undefined,
    };
  }
  if (!order.courierProvider) return { error: "Методът на доставка не е куриерски." };

  const account = await getCourierAccount(shop.id, order.courierProvider);
  if (!account) return { error: "Няма свързан куриерски акаунт." };

  /* Тегло: сумирай от продуктите (fallback за липсващо/изтрито). */
  const productIds = order.items
    .map((i) => i.productId)
    .filter((id): id is string => id != null);
  const rows = productIds.length
    ? await db
        .select({ id: products.id, weightGrams: products.weightGrams })
        .from(products)
        .where(inArray(products.id, productIds))
    : [];
  const weights = new Map(rows.map((r) => [r.id, r.weightGrams]));
  const weightGrams = aggregateOrderWeight(
    order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    weights,
    FALLBACK_WEIGHT_GRAMS,
  );

  const codCents = resolveCodAmount(order.paymentType, order.totalCents);

  try {
    const courier = getCourier(order.courierProvider);
    const result = await courier.createWaybill(
      {
        receiverName: order.customerName,
        receiverPhone: order.customerPhone,
        officeId: order.courierOfficeId,
        address: order.address,
        city: order.city,
        sender: {
          name: account.senderName,
          phone: account.senderPhone,
          city: account.senderCity,
          address: account.senderAddress,
        },
        weightGrams,
        codCents,
        contents: `Поръчка №${order.orderNumber}`,
      },
      account.credentials as Record<string, string>,
    );

    await db
      .update(orders)
      .set({
        waybillId: result.waybillId,
        trackingNumber: result.trackingNumber,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    revalidatePath(`/dashboard/orders/${orderId}`);
    return { ok: true, trackingUrl: courier.trackingUrl(result.trackingNumber) };
  } catch (err) {
    console.error(JSON.stringify({ scope: "generate-waybill", orderId, error: String(err) }));
    return { error: "Товарителницата не може да се създаде сега. Опитай пак." };
  }
}
