import { and, desc, eq } from "drizzle-orm";
import { campaigns, db, subscribers } from "@/db";

/** Потвърдените абонати на магазин (за dashboard списъка + CSV). */
export async function getConfirmedSubscribers(shopId: string) {
  return db.query.subscribers.findMany({
    where: and(eq(subscribers.shopId, shopId), eq(subscribers.status, "confirmed")),
    orderBy: [desc(subscribers.confirmedAt)],
    columns: { email: true, confirmedAt: true },
  });
}

/** S4: историята на изпратените кампании (най-нови първи). */
export async function getCampaigns(shopId: string, limit = 20) {
  return db.query.campaigns.findMany({
    where: eq(campaigns.shopId, shopId),
    orderBy: [desc(campaigns.createdAt)],
    limit,
  });
}

/** Брой потвърдени абонати. */
export async function countConfirmedSubscribers(shopId: string): Promise<number> {
  return db.$count(
    subscribers,
    and(eq(subscribers.shopId, shopId), eq(subscribers.status, "confirmed")),
  );
}
