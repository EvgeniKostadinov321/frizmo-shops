import { and, desc, eq } from "drizzle-orm";
import { db, subscribers } from "@/db";

/** Потвърдените абонати на магазин (за dashboard списъка + CSV). */
export async function getConfirmedSubscribers(shopId: string) {
  return db.query.subscribers.findMany({
    where: and(eq(subscribers.shopId, shopId), eq(subscribers.status, "confirmed")),
    orderBy: [desc(subscribers.confirmedAt)],
    columns: { email: true, confirmedAt: true },
  });
}

/** Брой потвърдени абонати. */
export async function countConfirmedSubscribers(shopId: string): Promise<number> {
  return db.$count(
    subscribers,
    and(eq(subscribers.shopId, shopId), eq(subscribers.status, "confirmed")),
  );
}
