import { and, desc, eq, gte, notInArray, sql } from "drizzle-orm";
import { categories, db, orderItems, orders, products, subscribers } from "@/db";
import { EXCLUDED_FROM_REVENUE } from "@/db/queries/orders";
import type { AnalyticsPeriod } from "@/db/queries/analytics";

export interface NamedMetric {
  name: string;
  orderCount: number;
  revenueCents: number;
}

export interface Breakdowns {
  sources: {
    byPayment: NamedMetric[];
    byCity: NamedMetric[];
    coupon: { withCoupon: NamedMetric; withoutCoupon: NamedMetric; totalDiscountCents: number };
  };
  conversion: {
    newSubscribers: number;
    subscribersWhoOrdered: number;
    welcomeOrders: number;
    welcomeRevenueCents: number;
  };
  repeat: {
    repeatCustomers: number;
    totalCustomers: number;
    top: { phoneMasked: string; orderCount: number; totalCents: number }[];
  };
  categories: NamedMetric[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Наложен платеж",
  bank_transfer: "Банков превод",
  on_site: "На място",
};

/** Маскира телефон за показване: първи 4 + *** + последни 2 (къс номер → непокътнат). */
export function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}

const num = (v: unknown): number => Number(v ?? 0);

/** В3: четири analytics разреза за периода. Всичко е агрегат — нула нови таблици. */
export async function getAnalyticsBreakdowns(
  shopId: string,
  periodDays: AnalyticsPeriod,
): Promise<Breakdowns> {
  const from = new Date(Date.now() - periodDays * 86_400_000);
  const inPeriod = and(
    eq(orders.shopId, shopId),
    notInArray(orders.status, [...EXCLUDED_FROM_REVENUE]),
    gte(orders.createdAt, from),
  );

  const [
    paymentRows,
    cityRows,
    couponRow,
    newSubRow,
    orderedRow,
    welcomeRow,
    repeatRows,
    totalCustomersRow,
    categoryRows,
  ] = await Promise.all([
    // 1a. По метод на плащане
    db
      .select({
        key: orders.paymentType,
        orderCount: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      })
      .from(orders)
      .where(inPeriod)
      .groupBy(orders.paymentType),
    // 1b. По град (топ 5)
    db
      .select({
        key: orders.city,
        orderCount: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      })
      .from(orders)
      .where(inPeriod)
      .groupBy(orders.city)
      .orderBy(desc(sql`sum(${orders.totalCents})`))
      .limit(5),
    // 1c. С/без купон + обща отстъпка
    db
      .select({
        withCouponCount: sql<number>`count(*) filter (where ${orders.couponCode} <> '')::int`,
        withCouponRevenue: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.couponCode} <> ''), 0)`,
        withoutCouponCount: sql<number>`count(*) filter (where ${orders.couponCode} = '')::int`,
        withoutCouponRevenue: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.couponCode} = ''), 0)`,
        totalDiscount: sql<number>`coalesce(sum(${orders.discountCents}), 0)`,
      })
      .from(orders)
      .where(inPeriod),
    // 2a. Нови confirmed абонати в периода
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(subscribers)
      .where(
        and(
          eq(subscribers.shopId, shopId),
          eq(subscribers.status, "confirmed"),
          gte(subscribers.confirmedAt, from),
        ),
      ),
    // 2b. Абонати (по имейл), направили поръчка в периода
    db
      .select({ c: sql<number>`count(distinct ${subscribers.email})::int` })
      .from(subscribers)
      .innerJoin(
        orders,
        and(eq(orders.shopId, shopId), eq(orders.customerEmail, subscribers.email)),
      )
      .where(
        and(
          eq(subscribers.shopId, shopId),
          eq(subscribers.status, "confirmed"),
          notInArray(orders.status, [...EXCLUDED_FROM_REVENUE]),
          gte(orders.createdAt, from),
        ),
      ),
    // 2c. Поръчки с welcome код
    db
      .select({
        c: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      })
      .from(orders)
      .where(and(inPeriod, sql`${orders.couponCode} ilike 'WELCOME-%'`)),
    // 3. Повторни клиенти (по телефон) — all-time, топ 5
    db
      .select({
        phone: orders.customerPhone,
        orderCount: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.shopId, shopId),
          notInArray(orders.status, [...EXCLUDED_FROM_REVENUE]),
        ),
      )
      .groupBy(orders.customerPhone)
      .having(sql`count(*) > 1`)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    // 3b. Общо различни клиенти (телефони) — all-time
    db
      .select({ c: sql<number>`count(distinct ${orders.customerPhone})::int` })
      .from(orders)
      .where(
        and(
          eq(orders.shopId, shopId),
          notInArray(orders.status, [...EXCLUDED_FROM_REVENUE]),
        ),
      ),
    // 4. Топ категории по приходи (топ 5)
    db
      .select({
        name: sql<string>`coalesce(${categories.name}, 'Без категория')`,
        orderCount: sql<number>`count(distinct ${orders.id})::int`,
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotalCents}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(inPeriod)
      .groupBy(categories.name)
      .orderBy(desc(sql`sum(${orderItems.lineTotalCents})`))
      .limit(5),
  ]);

  const c = couponRow[0];
  const repeatCount = repeatRows.length;

  return {
    sources: {
      byPayment: paymentRows.map((r) => ({
        name: PAYMENT_LABELS[r.key] ?? r.key,
        orderCount: num(r.orderCount),
        revenueCents: num(r.revenue),
      })),
      byCity: cityRows.map((r) => ({
        name: r.key || "Неизвестен",
        orderCount: num(r.orderCount),
        revenueCents: num(r.revenue),
      })),
      coupon: {
        withCoupon: {
          name: "С купон",
          orderCount: num(c?.withCouponCount),
          revenueCents: num(c?.withCouponRevenue),
        },
        withoutCoupon: {
          name: "Без купон",
          orderCount: num(c?.withoutCouponCount),
          revenueCents: num(c?.withoutCouponRevenue),
        },
        totalDiscountCents: num(c?.totalDiscount),
      },
    },
    conversion: {
      newSubscribers: num(newSubRow[0]?.c),
      subscribersWhoOrdered: num(orderedRow[0]?.c),
      welcomeOrders: num(welcomeRow[0]?.c),
      welcomeRevenueCents: num(welcomeRow[0]?.revenue),
    },
    repeat: {
      repeatCustomers: repeatCount,
      totalCustomers: num(totalCustomersRow[0]?.c),
      top: repeatRows.map((r) => ({
        phoneMasked: maskPhone(r.phone),
        orderCount: num(r.orderCount),
        totalCents: num(r.totalCents),
      })),
    },
    categories: categoryRows.map((r) => ({
      name: r.name,
      orderCount: num(r.orderCount),
      revenueCents: num(r.revenue),
    })),
  };
}
