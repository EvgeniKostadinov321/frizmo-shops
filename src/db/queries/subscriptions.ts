import { eq } from "drizzle-orm";
import { db, subscriptions, type Subscription } from "@/db";

export async function getSubscription(shopId: string): Promise<Subscription | null> {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.shopId, shopId),
  });
  return row ?? null;
}
