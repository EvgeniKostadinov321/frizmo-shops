import "server-only";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db, pushSubscriptions, type Shop } from "@/db";
import { formatPrice } from "@/lib/money";

function configured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

/** Праща push към всички устройства на потребителя; чисти мъртвите абонаменти. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url: string },
): Promise<void> {
  if (!configured()) {
    console.warn("VAPID ключовете липсват — push известието е пропуснато.");
    return;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.error("Push се провали:", error);
        }
      }
    }),
  );
}

export async function sendNewOrderPush(
  shop: Shop,
  orderNumber: number,
  totalCents: number,
): Promise<void> {
  await sendPushToUser(shop.ownerId, {
    title: `Нова поръчка #${String(orderNumber).padStart(4, "0")} 🎉`,
    body: `${shop.name}: поръчка за ${formatPrice(totalCents)}`,
    url: "/dashboard/orders",
  });
}
