import { and, eq, gte, lt, notInArray, sql } from "drizzle-orm";
import { db, orderItems, orders, subscribers } from "@/db";
import { EXCLUDED_FROM_REVENUE } from "@/db/queries/orders";

export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export interface PeriodMetrics {
  revenueCents: number;
  orderCount: number;
  /** 0 при нула поръчки. */
  avgOrderCents: number;
  newSubscribers: number;
}

export interface DailyRevenue {
  /** ISO дата (YYYY-MM-DD). */
  day: string;
  revenueCents: number;
  orderCount: number;
}

export interface TopProduct {
  name: string;
  revenueCents: number;
  quantity: number;
}

export interface Analytics {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  daily: DailyRevenue[];
  topProducts: TopProduct[];
}

/** Метрики за интервал [from, to) — изключва cancelled (конвенцията на приходите). */
async function periodMetrics(shopId: string, from: Date, to: Date): Promise<PeriodMetrics> {
  const [[orderRow], [subRow]] = await Promise.all([
    db
      .select({
        revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.shopId, shopId),
          notInArray(orders.status, [...EXCLUDED_FROM_REVENUE]),
          gte(orders.createdAt, from),
          lt(orders.createdAt, to),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscribers)
      .where(
        and(
          eq(subscribers.shopId, shopId),
          eq(subscribers.status, "confirmed"),
          gte(subscribers.confirmedAt, from),
          lt(subscribers.confirmedAt, to),
        ),
      ),
  ]);

  const revenueCents = Number(orderRow?.revenue ?? 0);
  const orderCount = Number(orderRow?.count ?? 0);
  return {
    revenueCents,
    orderCount,
    avgOrderCents: orderCount > 0 ? Math.round(revenueCents / orderCount) : 0,
    newSubscribers: Number(subRow?.count ?? 0),
  };
}

/** S5: всичко за /dashboard/analytics с минимален брой заявки (паралелни). */
export async function getAnalytics(shopId: string, periodDays: AnalyticsPeriod): Promise<Analytics> {
  const now = new Date();
  const from = new Date(now.getTime() - periodDays * 86_400_000);
  const prevFrom = new Date(from.getTime() - periodDays * 86_400_000);

  const notCancelledInPeriod = and(
    eq(orders.shopId, shopId),
    notInArray(orders.status, [...EXCLUDED_FROM_REVENUE]),
    gte(orders.createdAt, from),
  );

  const [current, previous, dailyRows, topRows] = await Promise.all([
    periodMetrics(shopId, from, now),
    periodMetrics(shopId, prevFrom, from),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(notCancelledInPeriod)
      .groupBy(sql`date_trunc('day', ${orders.createdAt})`),
    db
      .select({
        name: orderItems.productName,
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotalCents}), 0)`,
        quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(notCancelledInPeriod)
      .groupBy(orderItems.productName)
      .orderBy(sql`sum(${orderItems.lineTotalCents}) desc`)
      .limit(5),
  ]);

  /* Пълна дневна серия — дните без поръчки са нулеви колони. */
  const byDay = new Map(dailyRows.map((r) => [r.day, r]));
  const daily: DailyRevenue[] = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    daily.push({
      day: key,
      revenueCents: Number(row?.revenue ?? 0),
      orderCount: Number(row?.count ?? 0),
    });
  }

  return {
    current,
    previous,
    daily,
    topProducts: topRows.map((r) => ({
      name: r.name,
      revenueCents: Number(r.revenue),
      quantity: Number(r.quantity),
    })),
  };
}
